Backbone Faux Server
====================

A (tiny) framework for easily mocking-up a server when working with [Backbone.js](https://github.com/documentcloud/backbone)

Define any number of routes that map `<model-URL, sync-method>` pairs to custom handlers (callbacks). Faux-server overrides Backbone's native sync so that whenever a Model (or Collection) is synced and its URL along with the sync method being used form a pair that matches a defined route, the route's handler is invoked. Implement handlers in JS to test the expected behaviour of your app, work with dummy data, support persistence using local-storage, etc. When / if you choose to move to a real server, switching to Backbone's native, ajax-based sync is as simple as calling `backboneFauxServer.enable(false)`.

Usage
-----

Backbone-faux-server ('BFS' onwards) will be exposed as a Global, CommonJS module or AMD module depending on the detected environment. 

* When working in a *browser environment, without a module-framework,* include backbone.faux.server.js after backbone.js

    ```html
    <script type="text/javascript" src="backbone.js"></script>
    <script type="text/javascript" src="backbone.faux.server.js"></script>
    ```

    and BFS will be exposed as the global `backboneFauxServer`:

    ```javascript
    console.log("working with version " + backboneFauxServer.getVersion());
    ```

* `Require` when working *with CommonJS* (e.g. Node.js)

    ```javascript
    var backboneFauxServer = require("./backbone.faux.server.js");
    console.log("working with version " + backboneFauxServer.getVersion());
    ```

* Or list as a dependency when working *with an AMD loader* (e.g. require.js)

    ```javascript
    // Your module
    define(["backbone.faux.server"], function (backboneFauxServer) {
    	console.log("working with version " + backboneFauxServer.getVersion());
    });
    ```

License
-------

Licensed under the MIT License (LICENSE.txt).

Copyright (c) 2012 Alex Lambiris
