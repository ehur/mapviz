/**
************************************************************************************
**      CodeChix mapviz.js jquery plugin - show quantifiable data by geography on a map
**      codechix.org - May the code be with you...
**              2013-2014
************************************************************************************
**
** License:             AGPL 3.0 http://www.gnu.org/licenses/agpl.txt
** Version:             1.0
** Project/Library:     mapviz
** Description:         To use the plugin in your own code from git@github.com:ehur/mapviz.git repo you will need:
 lib/mapviz.js //the plugin itself
 styles/mapvizstyles.css //styles required for the map legend
 data/ca_counties_name.json //topojson for California counties

 And you'll need includes for:
 jquery
 underscore
 d3.v3
 topojson
 for example:

 <script type="text/javascript" src="lib/jquery/jquery-1.11.0.min.js"></script>
 <script type="text/javascript" src="lib/underscore-min-1.6.0.js"></script>
 <script type="text/javascript" src="lib/mapviz.js"></script>
 <script src="http://d3js.org/d3.v3.min.js" charset="utf-8"></script>
 <script src="http://d3js.org/topojson.v1.min.js"></script>
**
** Main Contact:   ehurley@heraconsulting.com
** Alt. Contact:   organizers@codechix.org
***********************************************************************************/

(function($) {

    String.prototype.splitCSV = function(sep) {
        for (var foo = this.split(sep = sep || ","), x = foo.length - 1, tl; x >= 0; x--) {
            if (foo[x].replace(/"\s+$/, '"').charAt(foo[x].length - 1) == '"') {
                if ((tl = foo[x].replace(/^\s+"/, '"')).length > 1 && tl.charAt(0) == '"') {
                    foo[x] = foo[x].replace(/^\s*"|"\s*$/g, '').replace(/""/g, '"');
                } else if (x) {
                    foo.splice(x - 1, 2, [foo[x - 1], foo[x]].join(sep));
                } else foo = foo.shift().split(sep).concat(foo);
            } else foo[x].replace(/""/g, '"');
        } return foo;
    };

    $.fn.mapviz = function(opts) {

        // given: level (county/zip), sourceType (csv/json), source (http json resource), csvColIndexForLevel, csvColIndexForCount,
        //        jsonWrapperObjectName, jsonPropertyNameForArea, jsonPropertyNameForQuantity,
        //        colorScheme (one of orange, purple, green or blue),
        //        legendTitle (title for the legend / key, if any
        // when: init -> populate mapDataArray
        // when: render -> drawCaliforniaWithData

        var level = opts.level,
            sourceType = opts.sourceType,
            source = opts.source,
            csvColIndexForLevel = opts.csvColIndexForLevel,
            csvColIndexForCount = opts.csvColIndexForCount,
            jsonWrapperObjectName = opts.jsonWrapperObjectName,//TODO: make this fixed? something like data...
            jsonPropertyNameForArea = opts.jsonPropertyNameForArea,
            jsonPropertyNameForQuantity = opts.jsonPropertyNameForQuantity,
            mapDataArray = {},
            placeWithMaxCount,
            maxCount,
            csvHasHeader = opts.csvHasHeader;

        function getScheme(){
            var schemes = {orange : [ "#fff5eb",
                                       "#fee6ce",
                                       "#fdd0a2",
                                       "#fdae6b",
                                       "#fd8d3c",
                                       "#f16913",
                                       "#d94801",
                                       "#a63603",
                                       "#7f2704"],
                            purple : [ "#fcfbfd",
                                        "#efedf5",
                                        "#dadaeb",
                                        "#bcbddc",
                                        "#9e9ac8",
                                        "#807dba",
                                        "#6a51a3",
                                        "#54278f",
                                        "#3f007d"],
                            green:[ "#f7fcf5",
                                    "#e5f5e0",
                                    "#c7e9c0",
                                    "#a1d99b",
                                    "#74c476",
                                    "#41ab5d",
                                    "#238b45",
                                    "#006d2c",
                                    "#00441b"],
                            blue: [ "#f7fbff",
                                    "#deebf7",
                                    "#c6dbef",
                                    "#9ecae1",
                                    "#6baed6",
                                    "#4292c6",
                                    "#2171b5",
                                    "#08519c",
                                    "#08306b"]
            }
            return (opts.colorScheme && schemes[opts.colorScheme]) ? schemes[opts.colorScheme] : schemes["orange"]; //orange is default
        }

        function getLegendColor(){
            var dataDomain = [0], percentileSize = maxCount/100,
                colorSchemeRange = ["white"],
                color;
            _.each([1,2,3,4,5,6,7,8,9],function(i){
               dataDomain.push(Math.round(i * 11.111 * percentileSize))
            });
            colorSchemeRange = ["white"];  //color range starts at white, the default color for count=0
            _.each(getScheme(),function(e){colorSchemeRange.push(e);});
            color = d3.scale.threshold()
                .domain(dataDomain)
                .range(colorSchemeRange);
            return color;
        }

        function getLegendScale(){
            var x = d3.scale.linear()
                .domain([0, maxCount])
                .range([0, 600]);
            return x;
        }

        function getLegendAxis(){
            var legendScale = getLegendScale(),
                formatNumber, xAxis;
            if (_.max(legendScale.domain()) > 100 ) {
                formatNumber= d3.format(",d");
            } else {
                formatNumber = d3.format("d%");
            }
            xAxis = d3.svg.axis()
                .scale(getLegendScale())
                .orient("bottom")
                .tickSize(13)
                .tickValues(getLegendColor().domain())
                .tickFormat(function(d) {
                    return d >= 0 ? formatNumber(d) : null;
                });
            return xAxis;
        }

        function getScaledColor(areaId){
            if (!mapDataArray[areaId] > 0) {return "white";}
            var percentOfMax = mapDataArray[areaId] * 100/ maxCount,
                bucketSize = 11.111,    //9 buckets in 100
                bucket = _.find([1,2,3,4,5,6,7,8,9], function(i){
                      return Math.round(percentOfMax) <= Math.round(i * bucketSize);
                });
            return getScheme()[bucket-1] //zero based index
        }

        function appendLegend(svg){
            var g = svg.append("g")
                .attr("class", "key")
                .attr("transform", "translate(400,40)"),
                color = getLegendColor(),
                x = getLegendScale(),
                xAxis = getLegendAxis(),
                theData = color.range().map(function(d, i) {
                    return {
                        x0: i ? x(color.domain()[i - 1]) : x.range()[0],
                        x1: i < color.domain().length ? x(color.domain()[i]) : x.range()[1],
                        z: d
                    };
                });


            g.selectAll("rect")
                .data(theData)
                .enter().append("rect")
                .attr("height", 8)
                .attr("x", function(d) {
                    return d.x0;
                })
                .attr("width", function(d) {
                    return d.x1 - d.x0;
                })
                .style("fill", function(d) {
                    return d.z;
                });

            g.call(xAxis).append("text")
                .attr("class", "caption")
                .attr("y", -6)
                .attr("x", 50)
                .text(opts.legendTitle);

        }

        function init(){

            if (sourceType === "csv") {
                var deferred = $.Deferred();
                $.when(getCsvData()).then(function(lines){
                    var allLines = lines.split(/\r\n|\n/);
                    if (csvHasHeader) {
                        allLines.shift();               //remove optional header rec
                    }
                    _.each(allLines,function(line){
                        var lineElements = line.splitCSV(),
                            level = lineElements[csvColIndexForLevel].toLowerCase();
                        mapDataArray[level] = Number(lineElements[csvColIndexForCount]);
                    });
                    placeWithMaxCount = _.max(allLines,function(line){
                        var lineElements = line.splitCSV();
                        return Number(lineElements[csvColIndexForCount]);
                    });
                    maxCount = Number(placeWithMaxCount.splitCSV()[csvColIndexForCount]);
                    deferred.resolve();
                });
                return deferred.promise();
            }
            if (sourceType === "json") {
                var deferred = $.Deferred();
                $.when(getJsonData()).then(function(data){
                    _.each(data[jsonWrapperObjectName],function(element){
                        var level = element[jsonPropertyNameForArea].toLowerCase();
                        mapDataArray[level] = element[jsonPropertyNameForQuantity];
                    });
                    placeWithMaxCount = _.max(data[jsonWrapperObjectName],function(data){
                        return data[jsonPropertyNameForQuantity];
                    });
                    maxCount = Number(placeWithMaxCount[jsonPropertyNameForQuantity]);
                    deferred.resolve();
                });
                return deferred.promise();
            }
       }


        function getCsvData(){
            return $.get(source).promise();
        }

        function getJsonData(){
            return $.getJSON(source).promise();
        }

        function render(mapPlaceholderElement){
            init().done(function(){
                drawCalifornia(mapPlaceholderElement);
            });
        }

        function getAreaId(){
            return (level === "zip") ? "GEOID10" : "NAME";
        }

        function drawCalifornia(containerElement){
            
            var width=1200,height=1200,svg,projection,path,zip,
                jsonMapFile = (level === "zip") ? "../geopolitical/ca_zipcodes.json" : "data/ca_counties_name.json";  //defaults to county level unless zip specified.
            
            projection = d3.geo.albers()
                .rotate([122,0])            //rotate from 0 longitude over to 122, where CA is
                .center([0,38])             //center the projection around 38 latitude
                .parallels([32,42])
                .scale(5000)
                .translate([250,370]);      //The translation offset determines the pixel coordinates of the projection’s center.

            path = d3.geo.path().projection(projection);

            svg=d3.select(containerElement.selector).append("svg")
                .attr("width",width)
                .attr("height",height);

            svg.append("rect")
                .attr("fill","white")
                .attr("width","100%")
                .attr("height","100%");

            d3.json(jsonMapFile,function(errors,mapData){
                var featureName = (level === "zip") ? "ca_zipcodes" : "ca_counties",
                    areas = topojson.feature(mapData, mapData.objects[featureName]);

                svg.selectAll(".area-nofill")
                    .data(areas.features)
                    .enter()
                    .append("path")
                    .attr("class",function(d){
                        if ( mapDataArray[d.properties[getAreaId()].toLowerCase()] > 0){
                            return "area-fill";
                        } else {
                            return "area-nofill";
                        }
                    })
                    .attr("d",path)
                    .append("svg:title") //this adds the mouseover tooltip
                    .text(function(d){
                        var areaName = d.properties[getAreaId()],
                        areaDataPoint =  mapDataArray[areaName.toLowerCase()] > 0 ? mapDataArray[areaName.toLowerCase()] : 0;
                        return areaName + " : " + areaDataPoint;
                    });

                svg.selectAll(".area-nofill")
                    .attr("fill","white");

                svg.selectAll(".area-fill")
                    .attr("fill",function(d){
                        var areaId = d.properties[getAreaId()].toLowerCase();
                        return getScaledColor(areaId);
                    });

                svg.selectAll("text")   //append text
                    .data(areas.features)
                    .enter().append("text")
                    .attr("transform", function(d) {
                        return "translate(" + path.centroid(d) + ") scale(0.3)";
                    })
                    .attr("dy", ".35em")
                    .text(function(d) {
                        return d.properties[getAreaId()];
                    });

                svg.append("path")
                    .datum(areas)
                    .attr("fill","none")
                    .attr("stroke","gray")
                    .attr("stroke-linejoin","round")
                    .attr("stroke-width",0.4)
                    .attr("d",path);
            });
            appendLegend(svg);
        }

        return render(this);
    }

}(jQuery));