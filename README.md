mapviz.js plugin for jquery.
To run this example:
git clone git@github.com:ehur/mapviz.git

python -m SimpleHTTPServer

navigate to localhost:8000

Usage: see the drawMap() functions in index.html and solarInstallations.html for usage examples


To use the plugin in your own code you will need from this repo:

-   lib/mapviz.js //the plugin itself
-   styles/mapvizstyles.css //styles required for the map legend
-   data/ca_counties_name.json //topojson for California counties

(todo: a future release will hopefully bundle both the style and the json into the plugin, so the extra files won't be needed.)


And you'll need includes for:

-   jquery
-   underscore
-   d3.v3
-   topojson


for example:

    <script type="text/javascript" src="lib/jquery/jquery-1.11.0.min.js"></script>
    <script type="text/javascript" src="lib/underscore-min-1.6.0.js"></script>
    <script type="text/javascript" src="lib/mapviz.js"></script>
    <script src="http://d3js.org/d3.v3.min.js" charset="utf-8"></script>
    <script src="http://d3js.org/topojson.v1.min.js"></script>
