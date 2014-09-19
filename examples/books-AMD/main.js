/*jshint strict:false */
/*globals requirejs:false, Backbone:false */

requirejs.config({
    baseUrl: "app/",
    paths: {
        "underscore":           "../bower_components/underscore/underscore",
        "jquery":               "../bower_components/jquery/jquery",
        "backbone":             "../bower_components/backbone/backbone",
        "backbone-faux-server": "../bower_components/backbone-faux-server/backbone-faux-server"
    },
    shim: {
        underscore: {
            exports: "_",
            init: function () {
                // _.noConflict();
            }
        },
        backbone: {
            deps: ["underscore", "jquery"],
            init: function () {
                return Backbone.noConflict();
            }
        }
    }
});

requirejs(["faux-server", "app"], function (fauxServer, app) {
    fauxServer.run();
    app.run();
});
