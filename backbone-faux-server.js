//     Backbone Faux Server v0.10.1

//     https://github.com/biril/backbone-faux-server
//     Licensed and freely distributed under the MIT License
//     Copyright (c) 2012-2013 Alex Lambiris

/*global exports, define, global, require, _, Backbone */
(function (root, createModule) {
    "use strict";

    var
        // Detect current environment. Faux-server will be exposed as module / global accordingly
        env = (function () {
            // A global `exports` object signifies CommonJS-like enviroments that support
            //  `module.exports`, e.g. Node
            if (typeof exports === "object") { return "CommonJS"; }

            // A global `define` method with an `amd` property signifies the presence of an AMD
            //  loader (require.js, curl.js)
            if (typeof define === "function" && define.amd) { return "AMD"; }

            // Otherwise we assume running in a browser
            return "browser";
        }()),

        // The `fauxServer` object to be exposed as module / global
        fauxServer = null;

    // Support for CommonJS will be specific to node. So if in fact the detected environment is
    //  'commonJS' we assume the presense of node's `global` object and set root to it. (`root` is
    //  already set to `this` but in the specific case of Node, `this` won't actually capture the
    //  global context - `global` is needed)
    if (env === "CommonJS") { root = global; }

    // Expose as module / global depending on environment
    switch (env) {
    case "CommonJS":
        createModule(root.setTimeout, exports, require("underscore"), require("backbone"));
        break;

    case "AMD":
        define(["underscore", "backbone", "exports"], function (_, Backbone, exports) {
            return createModule(root.setTimeout, exports, _, Backbone);
        });
        break;

    case "browser":

        // When running in a browser, the additional `noConflict` method is attached to
        //  `fauxServer`. This is only meaningful in this specific case where `fauxServer` is
        //  globally exposed
        fauxServer = createModule(root.setTimeout, {}, _, Backbone);
        fauxServer.noConflict = (function() {

            // Save a reference to the previous value of 'fauxServer', so that it can be restored
            //  later on, if 'noConflict' is used
            var previousFauxServer = root.fauxServer;

            // The `noConflict` method: Sets the _global_ `fauxServer` variable to to its previous
            //  value returning a reference to `fauxServer`
            return function () {
                root.fauxServer = previousFauxServer;
                fauxServer.noConflict = function () { return fauxServer; };
                return fauxServer;
            };
        }());

        root.fauxServer = fauxServer;
    }

}(this, function (setTimeout, fauxServer, _, Backbone) {
    "use strict";

    var
        // Helper which clones an array skipping any and all tail-elements which are undefined.
        //  Array.length can't be trusted when the array contains undefined tail-element(s) which
        //  are explicitly set: It is always set to the index of the last array element plus one
        //  and a tail element explicitly set to undefined will in fact count as the 'last
        //  element'. This can be problematic when counting function arguments in order to
        //  sanitize, provide defaults, etc
        skipUndefinedTail = function (array) {
            var a = [], i = array.length - 1;
            for (; i >= 0; i--) { if (!_.isUndefined(array[i])) { a[i] = array[i]; } }
            return a;
        },

        // Save a reference to the native sync method. Used when no route is matched during syncing
        //  or faux-server is altogether disabled
        nativeSync = Backbone.sync,

        // Indicates whether the faux-server is currently enabled
        isEnabled = true,

        // The default-route, that is to say, a route that contains the default handler if one
        //  is defined. The default handler is invoked when no matching route is found for some
        //  <model-URL, sync-method> pair and may be defined by `setDefaultHandler`. A null value
        //  for the default-route signifies the absence of a default handler
        defaultRoute = null,

        // Convert a urlExp string (containing params and splats) into a regular expression
        makeRegExp = (function () {
            var
                // To escape special chars before converting to reg-exp
                e = /[\-{}\[\]+?.,\\\^$|#\s]/g,

                // Optional part
                o = /\((.*?)\)/g,

                // Named param (+ extra capturing parens for opt-part detection)
                p = /(\(\?)?:\w+/g,

                // Splat param
                s = /\*\w+/g,

                // Don't confuse (regex-equivalent-subsituted) optional parts with named params
                getReplacementForP = function (match, isOptPart) {
                    return isOptPart ? match : "([^\/]+)";
                };

            return function(exp) {
                exp = exp.replace(e, "\\$&")
                         .replace(o, "(?:$1)?")
                         .replace(p, getReplacementForP)
                         .replace(s, "(.*?)");

                return new RegExp("^" + exp + "$");
            };
        }()),

        // A no-op method to reuse
        noOp = function () {},

        // Server's emulated latency
        latency = 0,

        // Map from CRUD (+ patch) to HTTP-methods (verbs)
        crudToHttp = {
            "create": "POST",
            "read": "GET",
            "update": "PUT",
            "delete": "DELETE",
            "patch": "PATCH"
        },

        // Collection of all defined routes
        routes = [],

        /**
         * Get a route matching the given <URL, HTTP-method> pair. Routes that exactly match the
         *  HTTP-method take precedence over match-all-methods routes (those with `httpMethod` set
         *  to '*'). Matching routes that were defined later take precedence over those that were
         *  defined earlier. A returned matching route will contain the additional handlerParams
         *  property: an array containing params that are to be passed to the handler as captured
         *  when the given URL was matched
         * @param  {string} `url` The route URL
         * @param  {string} `httpMethod` The route HTTP method
         * @return {object} A matching route if one is found, null otherwise. Note that
         *  the returned route is a copy and cannot be modified to alter faux-server's behaviour
         */
        getMatchingRoute = function (url, httpMethod) {
            var i, r, weakMatch;
            for (i = routes.length - 1; i >= 0; --i) { // Iterating from latest to earliest
                r = routes[i];
                if (r.urlExp.test(url)) {
                    if (r.httpMethod === httpMethod) { // Found a match ..
                        r = _.clone(r);
                        r.handlerParams = r.urlExp.exec(url).slice(1);
                        return r; // .. so return it. We're done
                    }
                    if (r.httpMethod === "*") { weakMatch = r; } // Found a weak match
                }
            }
            if (weakMatch) { // Found a weak match. That's good too ..
                r = _.clone(weakMatch);
                r.handlerParams = r.urlExp.exec(url).slice(1);
                return r; // .. so return it. We're done
            }
            return null;
        },

        // Get the data that should be sent to the server during a sync. This depends on
        //  the sync-method being used and any options that may have been given
        getRequestData = function (httpMethod, model, options) {
            // A `data` property whithin options overrides any Model data.
            if (options.data) { return options.data; }

            // If no Model is given (??) then request data will be undefined no matter what
            if (!model) { return; }

            // In the specific case of PATCH, a hash of 'changed attributes' is expected within
            //  options. If no such thing is present then the complete Model representation will
            //  be used instead
            if (httpMethod === "PATCH") { return options.attrs || model.toJSON(); }

            // Send the complete Model representation when POSTing or PUTing
            if (httpMethod === "POST" || httpMethod === "PUT") { return model.toJSON(); }
        },

        // Invoked _per sync_ (with the relevant options / context) to create a new transport -
        //  a deferred-like object implementing a `promise` / `resolve` / `reject` interface. A
        //  successfull sync will invoke `transport.resolve` while a failed one will invoke
        //  `transport.reject`. The sync method will always return `transport.promise()`
        createTransport = function (syncOptions, syncContext) {
            // If an underlying ajax lib is defined for Backbone (`Backbone.$`) and it features a
            //  `Deferred` method (which is precisely the case when Backbone.$ = jQuery) then
            //  attempt to create a 'deferred transport' which will invoke the `success` / `error`
            //  callbacks when its promise is fulfilled / rejected. Note that sync will return the
            //  transport's promise _not_ the transport itself
            if (Backbone.$ && _.isFunction(Backbone.$.Deferred)) {
                try {
                    var deferred = Backbone.$.Deferred();
                    deferred.then(syncOptions.success, syncOptions.error);
                    return deferred;
                } catch (e) {}
            }

            // Otherwise create a poor-man's deferred - an object that implements a dumb
            //  `promise` / `resolve` / `reject` interface without actual promise semantics:
            //  `resolve` and `reject` just delegate to `success` and `error` callbacks while
            //  `promise` returns an `undefined`. This is a good enough transport
            return {
                promise: noOp,
                resolve: function (value) { syncOptions.success(value); },
                reject: function (reason) { syncOptions.error(reason); }
            };
        };

    // Modify Backbone's sync to use the faux-server sync method (when appropriate)
    Backbone.sync = function (crudMethod, model, options) {

        // If faux-server is disabled, fall back to original sync
        if (!isEnabled) { return nativeSync.call(model, crudMethod, model, options); }
        
        _.defaults(options || (options = {}), {
            emulateHTTP: Backbone.emulateHTTP,
            emulateJSON: Backbone.emulateJSON
        });

        var
            // Sync context
            c = {
                data: null,
                url: null,
                httpMethod: crudToHttp[crudMethod],
                route: null
            },

            // An exec-method to actually run the appropriate handler. Defined below
            execHandler = null,

            // We'll be attempting to create a deferred and return the underlying promise.
            //  Defined below
            transport = null;

        // When emulating HTTP, 'create', 'update', 'delete' and 'patch' are all mapped to POST.
        if (options.emulateHTTP && c.httpMethod !== "GET") {
            c.httpMethodOverride = c.httpMethod;
            c.httpMethod = "POST";
        }

        // Ensure that we have a URL (A `url` property whithin options overrides Model /
        //  Collection URL)
        if(!(c.url = options.url || _.result(model, "url"))) {
            throw new Error("sync: Undefined 'url' property or function of Model / Collection");
        }

        // Find route for given URL or fall back to native sync if none found
        if (!(c.route = getMatchingRoute(c.url, c.httpMethod) || defaultRoute)) {
            return nativeSync.call(model, crudMethod, model, options);
        }

        // Ensure that we have the appropriate request data
        c.data = getRequestData(c.httpMethod, model, options);

        // Create a transport for this sync
        transport = createTransport(options);

        // An exec-method to actually run the handler and subsequently invoke success / error
        //  callbacks. (The relevant 'success' or 'error' event will be triggered by backbone)
        execHandler = function () {
            var result = c.route.handler.apply(null, [c].concat(c.route.handlerParams)); // Handle
            transport[_.isString(result) ? "reject" : "resolve"](result);
        };

        model.trigger("request", model, null, options);

        // Call exec-method _now_ if zero-latency, else call later
        if (!latency) { execHandler(); }
        else { setTimeout(execHandler, _.isFunction(latency) ? latency() : latency); }

        // Return the transport's promise. Assuming the default transport-factory implementation
        //  this may be an actual promise or just undefined
        return transport.promise();
    };

    // Attach methods to faux-server
    _.extend(fauxServer, {

        /**
         * Add a route to the faux-server. Every route defines a mapping from a
         *  Model(or Collection)-URL & sync-method (an HTTP verb (POST, GET, PUT, PATCH or DELETE))
         *  to some specific handler (callback):
         *  `<model-URL, sync-method> -> handler`
         *  So whenever a Model is created, read, updated or deleted, its URL and the the sync
         *  method being used is tested against defined routes in order to find a handler for
         *  creating, reading, updating or deleting this Model. The same applies to reading
         *  Collections: Whenever a Collection is read, its URL (and the 'read' method) is tested
         *  against defined routes in order to find a handler for reading it. When a match for
         *  the <model-URL, sync-method> pair is not found among defined routes, the native sync
         *  is invoked (this behaviour may be overriden - see fauxServer.setDefaultHandler).
         *  Later routes take precedence over earlier routes so in configurations where multiple
         *  routes match, the one most recently defined will be used.
         * @param {string} name The name of the route. Optional
         * @param {string|RegExp} urlExp An expression against which, Model(or Collection)-URLs will
         *  be tested. This is syntactically and functionally analogous to Backbone routes: urlExps
         *  may contain parameter parts, ':param', which match a single URL component between
         *  slashes; and splat parts '*splat', which can match any number of URL components.
         *  Parentheses may also be used to denote optional parts.The values captured by params and
         *  splats will be passed as parameters to the given handler method.
         *  (see http://backbonejs.org/#Router-routes). Regular expressions may also be
         *  used, in which case all values captured by reg-exp capturing groups will be passed as
         *  parameters to the given handler method.
         * @param {string} [httpMethod="*"] The sync method (an HTTP verb (POST, GET, PUT, PATCH or
         *  DELETE)), that should trigger the route's handler. Both the URL-expression and the
         *  method should match for the handler to be invoked. httpMethod may also be set to '*' to
         *  create a match-all-methods handler: One that will be invoked whenever urlExp matches the
         *  model's (or collection's) URL _regardless_ of method. Omitting the parameter has the
         *  same effect. In the scope of a match-all-methods handler, the HTTP method currently
         *  being handled may be acquired by querying the context parameter for context.httpMethod.
         *  Note that when Backbone.emulateHTTP is set to true or emulateHTTP is passed as an inline
         *  option during sync, 'create', 'update', 'delete' and 'patch' will all be mapped to POST.
         *  In this case context.httpMethod will be set to POST and the true HTTP method may be
         *  acquired by querying context.httpMethodOverride.
         * @param {function} [handler=no-op] The handler to be invoked when both route's URL and
         *  route's method match. A do-nothing handler will be used if one is not provided. Its
         *  signature should be
         *  `function (context, [param1, [param2, ...]])`
         *  where context contains properties `data`, `httpMethod`, `httpMethodOverride`, `route`
         *  and `param1`, `param2`, ... are parameters derived by matching the `urlExp` to the
         *  Model (or Collection) URL. Specifically, about context properties:
         *   * {any} `context.data`: Attributes of the Model (or Collection) being proccessed. Valid
         *      only on 'create' (POST), 'update' (PUT) or 'patch' (PATCH). In the specific case of
         *      PATCH, context.data may only contain a _subset_ of Model's attributes.
         *   * {string} `context.httpMethod`: The HTTP Method (POST, GET, PUT, PATCH, DELETE) that
         *      is currently being handled.
         *   * {string} `context.url`: The URL that is currently being handled.
         *   * {string} `context.httpMethodOverride`: The true HTTP Method (POST, GET, PUT, PATCH,
         *      DELETE) that is currently being handled when Backbone.emulateHTTP is set to true.
         *      The equivalent of [Backbone's](http://backbonejs.org/#Sync-emulateHTTP)
         *      X-HTTP-Method-Override header.
         *   * {object} `context.route`: The route that is currently being handled.
         *  On success: Return created Model attributes after handling a POST or updated Model
         *  attributes after handling a PUT or PATCH. Return Model attributes after handling a GET
         *  or an array of Model attributes after handling a GET that refers to a collection. Note
         *  that only attributes that have been changed on the server (and should be updated on the
         *  client) need to be included in returned hashes. Return nothing after handling a DELETE.
         *  On failure, the handler should return s string (presumably a custom error messsage, an
         *  HTTP status code that indicates failure, etc).
         * @return {object} The faux-server
         */
        addRoute: function (name, urlExp, httpMethod, handler) {
            var routeIndex = routes.length,

                // Create the route, setting missing arguments to defaults and sanitizing where
                //  appropriate - note that the only mandatory argument is `urlExp`
                route = (function (args) {
                    switch (args.length) {

                    // Missing `name`, `handler` or `httpMethod`
                    case 3:
                        if (_.isFunction(args[2])) { // Missing `name` or `httpMethod`
                            handler = args[2];
                            if (args[1] === "*" || _.contains(crudToHttp, args[1])) { // Missing `name`
                                urlExp = args[0];
                                httpMethod = args[1];
                                name = null;
                            } else { // Missing httpMethod
                                httpMethod = "*";
                            }
                        } else { // Missing handler
                            handler = noOp;
                        }
                        break;

                    // Missing `name` & `httpMethod`, `httpMethod` & `handler` or `name` & `handler`
                    case 2:
                        if (_.isFunction(args[1])) { // Missing `name` & `httpMethod`
                            urlExp = args[0];
                            handler = args[1];
                            httpMethod = "*";
                            name = null;
                        } else { // Missing `name` & `handler` or `httpMethod` & `handler`
                            handler = noOp;
                            if (args[1] === "*" || _.contains(crudToHttp, args[1])) { // Missing `name` & `handler`
                                urlExp = args[0];
                                httpMethod = args[1];
                                name = null;
                            } else { // Missing `httpMethod` & `handler`
                                httpMethod = "*";
                            }
                        }
                        break;

                    // Missing `name` & `httpMethod` & `handler`
                    case 1:
                        urlExp = args[0];
                        httpMethod = "*";
                        handler = noOp;
                        name = null;
                        break;

                    case 0:
                        throw new Error("addRoute: Missing mandatory 'urlExp' argument");
                    }

                    httpMethod = httpMethod.toUpperCase();
                    urlExp = _.isRegExp(urlExp) ? urlExp : makeRegExp(urlExp);

                    return {
                        name: name || _.uniqueId(httpMethod + "_" + urlExp + "_"),
                        urlExp: urlExp,
                        httpMethod: httpMethod,
                        handler: handler
                    };
                }(skipUndefinedTail(_.toArray(arguments))));

            // If a route of given name is already present then overwrite it with this one.
            //  Otherwise just append the new route
            _.any(routes, function (r, i) {
                if (r.name === route.name) {
                    routeIndex = i;
                    return true;
                }
            });
            routes[routeIndex] = route;

            return this;
        },

        /**
         * Add multiple routes to the faux-server
         * @param {object|array} routesToAdd A hash or array of routes to add. When passing a hash,
         *  keys should be route names and each route (nested hash) need only contain urlExp,
         *  httpMethod, handler. See addRoute().
         * @return {object} The faux-server
         */
        addRoutes: function (routesToAdd) {
            var isArray = _.isArray(routesToAdd);
            _.each(routesToAdd, function (r, rName) {
                this.addRoute(isArray ? r.name : rName, r.urlExp, r.httpMethod, r.handler);
            }, this);
            return this;
        },

        /**
         * Remove route of given name
         * @param  {string} routeName Name of route to remove
         * @return {object} The faux-server
         */
        removeRoute: function (routeName) {
            routes = _.reject(routes, function (r) { return r.name === routeName; });
            return this;
        },

        /**
         * Remove all previously defined routes
         * @return {object} The faux-server
         */
        removeRoutes: function () {
            routes = [];
            return this;
        },

        /**
         * Get route of specified name
         * @param  {string} routeName Name of route to acquire
         * @return {object} Route of specified name or null if no such route exists. Note that
         *  the returned route is a copy and cannot be modified to alter faux-server's behaviour
         */
        getRoute: function (routeName) {
            var route = _.find(routes, function (r) { return r.name === routeName; });
            return route ? _.clone(route) : null;
        },

        /**
         * Get route at specified index
         * @param  {int} routeIndex Index of route to acquire
         * @return {object} Route at specified index or null if no such route exists. Note that
         *  the returned route is a copy and cannot be modified to alter faux-server's behaviour
         */
        getRouteAt: function (routeIndex) {
            return routes[routeIndex] ? _.clone(routes[routeIndex]) : null;
        },

        /**
         * Get a route matching the given <URL, HTTP-method> pair. See closed-over getMatchingRoute
         */
        getMatchingRoute: getMatchingRoute,

        /**
         * Set a handler to be invoked when no route is matched to the current
         *  <model-URL, sync-method> pair. This will override the default behaviour of invoking the
         *  native sync.
         * @param {any} handler A handler to be invoked when no route is found that matches a given
         *  <model-URL, sync-method> pair. Ommit the parameter to reset to the default behaviour.
         *  See addRoute for handler's signature and semantics. Note that a default-handler isn't
         *  part of a route, so the context.route parameter will not be valid.
         * @return {object} The faux-server
         */
        setDefaultHandler: function (handler) {
            defaultRoute = !handler ? null : {
                name: "",
                urlExp: "",
                handler: handler,
                handlerParams: []
            };
            return this;
        },

        /**
         * Set server's emulated latency
         * @param {number} min Server's emulated latency in ms. Interpreted as the minimum of a
         *  range when a 'max' value is provided. Ommitting will set to 0
         * @param {number} max Maximum server latency in ms. Specifying this parameter will cause
         *  syncing to occur with a random latency in the [min, max] range
         * @return {object} The faux-server
         */
        setLatency: function (min, max) {
            latency = !max ? (min || 0) : function () { return min + Math.random() * (max - min); };
            return this;
        },

        /*
         * Set server's transport factory
         * @param {object} transportFactory A factory function with signature
         *  `function (syncOptions, syncContext)`
         *  invoked _per sync_ (with the relevant options / context) to create a new transport - a
         *  deferred-like object implementing a `promise` / `resolve` / `reject` interface. A
         *  successfull sync will invoke `transport.resolve` while a failed one will invoke
         *  `transport.reject` The sync method will always return `transport.promise()`
         * @return {object} The faux-server
         */
        setTransportFactory: function (transportFactory) {
            createTransport = transportFactory;
            return this;
        },

        /**
         * Enable or disable the faux-server. When the faux-server is disabled, syncing is performed
         *  by the native Backbone sync method. Handy for easily toggling between mock / real server
         * @param {bool} shouldEnable Indicates whether the faux-server should be enabled
         *  or disabled. Set to true or ommit altogether to enable, set to false to disable
         * @return {object} The faux-server
         */
        enable: function (shouldEnable) {
            isEnabled = _.isUndefined(shouldEnable) || shouldEnable;
            return this;
        },

        /**
         * Get current version of the library
         * @return {string} Current version of the library
         */
        getVersion: function () {
            return "0.10.1"; // Keep in sync with package.json
        }
    });

    // Attach <httpMethod>(name, urlExp, handler) methods to faux-server (`get`, `post`, `put`,
    //  `patch` and `del`). These all delegate to addRoute
    _.each(_.values(crudToHttp), function (httpMethod) {

        // All shortcut-methods are named after the relevant HTTP verb except for 'delete' which is
        //  abbreviated to 'del' in order to avoid reserved word awkwardness
        var method = httpMethod === "DELETE" ? "del" : httpMethod.toLowerCase();
        fauxServer[method] = function () {
            // Expecting `name`, `urlExp`, `handler` arguments. Only `urlExp` is mandatory
            var args = skipUndefinedTail(_.toArray(arguments));

            if (!args.length) { throw new Error(method + ": Missing mandatory 'urlExp' argument"); }

            // The `httpMethod` must be inserted into the args, either at tail-position if
            //  `handler` is missing or just before it (after `urlExp`) if it's present
            if (!_.isFunction(args[args.length - 1])) { args.push(httpMethod); }
            else { args.splice(args.length - 1, 0, httpMethod); }

            return fauxServer.addRoute.apply(this, args);
        };
    });

    return fauxServer;
}));
