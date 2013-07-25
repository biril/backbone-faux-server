//     Backbone Faux Server v0.8.5

//     https://github.com/biril/backbone-faux-server
//     Licensed and freely distributed under the MIT License
//     Copyright (c) 2012-2013 Alex Lambiris

/*global exports, define, global, require, _, Backbone */
(function (root, createModule) {
    "use strict";

    // Detect current environment. Faux-server will be exposed as module / global depending on that
    var env = (function () {
            // A global 'exports' object signifies CommonJS-like enviroments that support
            //  module.exports, e.g. Node
            if (typeof exports === "object") { return "CommonJS"; }

            // A global 'define' method with an 'amd' property signifies the presence of an AMD
            //  loader (require.js, curl.js)
            if (typeof define === "function" && define.amd) { return "AMD"; }

            return "browser";
        }()),
        fauxServer = null; // To be defined

    // Support for CommonJS will be specific to node. So if in fact the detected environment is
    //  'commonJS' we assume the presense of node's 'global' object and set root to it. ('root' is
    //  already set to 'this' but in the specific case of node, 'this' won't actually capture the
    //  global context - 'global' is needed)
    if (env === "CommonJS") { root = global; }

    // Expose as module / global depending on environment
    switch (env) {
    case "CommonJS":
        createModule(root.setTimeout, exports, require("underscore"), require("backbone"));
        break;

    case "AMD":
        define(["underscore", "exports"], function (_, exports) {
            return createModule(root.setTimeout, exports, _, Backbone);
        });
        break;

    case "browser":
        fauxServer = createModule(root.setTimeout, {}, _, Backbone);

        // Run in no-conflict mode, setting the global fauxServer variable to to its previous value.
        //  Only useful when working in a browser environment without a module-framework as this is
        //  the only case where fauxServer is exposed globally. Returns a reference to fauxServer
        fauxServer.noConflict = (function() {

            // Save a reference to the previous value of 'fauxServer', so that it can be restored
            //  later on, if 'noConflict' is used
            var previousFauxServer = root.fauxServer;

            // noConflict
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
        // Save a reference to the native sync method
        nativeSync = Backbone.sync,

        // Indicates whether the faux-server is currently enabled
        isEnabled = true,

        // The default-route, that is to say, a route that contains the default handler if one
        //  is defined. The default handler is invoked when no matching route is found for some
        //  <model-URL, sync-method> pair and may be defined by setDefaultHandler. A null value
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

        // Map from CRUD (+ patch) to HTTP-methods
        crudToHttp = {
            "create": "POST",
            "read": "GET",
            "update": "PUT",
            "delete": "DELETE",
            "patch": "PATCH"
        },

        // Routes
        routes = [],

        /**
         * Get a route matching the given <URL, HTTP-method> pair. Routes that exactly match the
         *  HTTP-method take precedence over match-all-methods routes (those with httpMethod set
         *  to '*'). Matching routes that were defined later take precedence over those that were
         *  defined earlier. A returned matching route will contain the additional handlerParams
         *  property; an array containing params that are to be passed to the handler as captured
         *  when the given URL was matched
         * @param  {string} url The URL
         * @param  {string} httpMethod The HTTP method
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
            // A data property whithin options overrides any Model data.
            if (options.data) { return options.data; }

            // If no Model is given (??) then req data will be undefined no matter what
            if (!model) { return; }

            // In the specific case of PATCH, a hash of 'changed attributes' is expected within
            //  options. If no such thing is present then the complete Model representation will
            //  be used instead
            if (httpMethod === "PATCH") { return options.attrs || model.toJSON(); }

            // Send the complete Model representation when POSTing or PUTing
            if (httpMethod === "POST" || httpMethod === "PUT") { return model.toJSON(); }
        };

    // Modify Backbone's sync to use the faux-server sync method (when appropriate)
    Backbone.sync = function (crudMethod, model, options) {

        // If faux-server is disabled, fall back to original sync
        if (!isEnabled) { return nativeSync.call(model, crudMethod, model, options); }

        var
            // Handler context
            c = {
                data: null,
                url: null,
                httpMethod: crudToHttp[crudMethod],
                route: null
            },

            // An exec-method to actually run the appropriate handler. Defined below
            execHandler = null,

            // We'll be attempting to crate a deferred and return the underlying promise.
            //  Defined below
            deferred = null;

        // When emulating HTTP, 'create', 'update', 'delete' and 'patch' are all mapped to POST.
        if ((Backbone.emulateHTTP || options.emulateHTTP) && c.httpMethod !== "GET") {
            c.httpMethodOverride = c.httpMethod;
            c.httpMethod = "POST";
        }

        // Ensure that we have a URL (A url property whithin options overrides the Model /
        //  Collection URL.)
        if(!(c.url = options.url || _.result(model, "url"))) {
            throw new Error("A 'url' property or function must be specified");
        }

        // Find route for given URL or fall back to native sync if none found
        if (!(c.route = getMatchingRoute(c.url, c.httpMethod) || defaultRoute)) {
            return nativeSync.call(model, crudMethod, model, options);
        }

        // Ensure that we have the appropriate request data
        c.data = getRequestData(c.httpMethod, model, options);

        // Try to create a deferred (and subsequently return the underlying promise). This will be
        //  possible if Backbone's ajax lib offers a .Deferred method (which is the case for
        //  jQuery). If this is not possible, then create a poor-man's deferred which just delegates
        //  to the given success / error handlers (and features no actual underlying promise)
        if (Backbone.$ && _.isFunction(Backbone.$.Deferred)) {
            (deferred = Backbone.$.Deferred()).then(options.success, options.error);
        } else {
            deferred = {
                promise: function () {},
                resolve: function (value) { options.success(value); },
                reject: function (reason) { options.error(reason); }
            };
        }

        // An exec-method to actually run the handler and subsequently invoke success / error
        //  callbacks. (the relevant 'success' or 'error' event will be triggered by backbone)
        execHandler = function () {
            var result = c.route.handler.apply(null, [c].concat(c.route.handlerParams)); // Handle
            deferred[_.isString(result) ? "reject" : "resolve"](result);
        };

        model.trigger("request", model, null, options);

        // Call exec-method *now* if zero-latency, else call later
        if (!latency) { execHandler(); }
        else { setTimeout(execHandler, _.isFunction(latency) ? latency() : latency); }

        // Return the deferred's underlying promise. If this is a dummy-deferred then .promise()
        //  will just be undefined
        return deferred.promise();
    };

    return _.extend(fauxServer, {
        /**
         * Add a route to the faux-server. Every route defines a mapping from a
         *  Model(or Collection)-URL & sync-method (an HTTP verb (POST, GET, PUT, PATCH or DELETE))
         *  to some specific handler (callback):
         *  <model-URL, sync-method> -> handler
         *  So any time a Model is created, read, updated or deleted, its URL and the the sync
         *  method being used will be tested against defined routes in order to find a handler for
         *  creating, reading, updating or deleting this Model. The same applies to reading
         *  Collections: Whenever a Collection is read, its URL (and the 'read' method) will be
         *  tested against defined routes in order to find a handler for reading it. When a match
         *  for the <model-URL, sync-method> pair is not found among defined routes, the native sync
         *  will be invoked (this behaviour may be overriden - see fauxServer.setDefaultHandler).
         *  Later routes take precedence over earlier routes so in configurations where multiple
         *  routes match, the one most recently defined will be used.
         * @param {string} name The name of the route. Optional
         * @param {string|RegExp} urlExp An expression against which, Model(or Collection)-URLs will
         *  be tested. This is syntactically and functionally analogous to Backbone routes: urlExps
         *  may contain parameter parts, ':param', which match a single URL component between
         *  slashes; and splat parts '*splat', which can match any number of URL components. The
         *  values captured by params and splats will be passed as parameters to the given handler
         *  method. (see http://backbonejs.org/#Router-routes). Regular expressions may also be
         *  used, in which case all values captured by reg-exp capturing groups will be passed as
         *  parameters to the given handler method.
         * @param {string} [httpMethod="*"] The sync method (an HTTP verb (POST, GET, PUT, PATCH or
         *  DELETE)), that should trigger the route's handler (both the URL-expression and the
         *  method should match for the handler to be invoked). httpMethod may also be set to '*' to
         *  create a match-all-methods handler; one that will be invoked whenever urlExp matches the
         *  model's (or collection's) URL _regardless_ of method. Omitting the parameter has the
         *  same effect. In the scope of a match-all-methods handler, the HTTP method currently
         *  being handled may be acquired by querying the context parameter for context.httpMethod.
         *  Note that when Backbone.emulateHTTP is set to true or emulateHTTP is passed as an inline
         *  option during sync, 'create', 'update', 'delete' and 'patch' will all be mapped to POST.
         *  In this case context.httpMethod will be set to POST and the true HTTP method may be
         *  acquired by querying context.httpMethodOverride.
         * @param {function} [handler=no-op] The handler to be invoked when both route's URL and
         *  route's method match. A do-nothing handler will be used if one is not provided. Its
         *  signature should be function (context, [param1, [param2, ...]]) where context contains
         *  properties data, httpMethod, httpMethodOverride, route and param1, param2, ... are
         *  parameters deduced from matching the urlExp to the Model (or Collection) URL.
         *  Specifically, about context properties:
         *   * {any} context.data Attributes of the Model (or Collection) being proccessed. Valid
         *      only on 'create' (POST), 'update' (PUT) or 'patch' (PATCH). In the specific case of
         *      PATCH, context.data may only contain a _subset_ of Model's attributes.
         *   * {string} context.httpMethod The HTTP Method (POST, GET, PUT, PATCH, DELETE) that is
         *      currently being handled.
         *   * {string} context.url The URL that is currently being handled.
         *   * {string} context.httpMethodOverride The true HTTP Method (POST, GET, PUT, PATCH,
         *      DELETE) that is currently being handled when Backbone.emulateHTTP is set to true.
         *      The equivalent of Backbone's X-HTTP-Method-Override header
         *      (see http://backbonejs.org/#Sync-emulateHTTP).
         *   * {object} context.route The route that is currently being handled.
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

                // Create the route, setting absent arguments to defaults and sanitizing where
                //  appropriate - note that the only mandatory argument is urlExp
                route = (function (_args) {
                    var args = [], i;

                    // Can't trust _args.length. The length property always returns the index of the
                    //  last array element, plus one. But an element explicitly set to undefined will
                    //  actually count as the 'last element'
                    for (i = _args.length - 1; i >= 0; i--) { if (_args[i]) { args[i] = _args[i]; } }

                    switch (args.length) {
                    case 3: // Missing name, handler or httpMethod
                        if (_.isFunction(args[2])) { // Missing name or httpMethod
                            handler = args[2];
                            if (args[1] === "*" || _.contains(crudToHttp, args[1])) { // Missing name
                                urlExp = args[0];
                                httpMethod = args[1];
                                name = httpMethod + "_" + urlExp;
                            } else { // Missing httpMethod
                                httpMethod = "*";
                            }
                        } else { // Missing handler
                            handler = noOp;
                        }
                        break;
                    case 2: // Missing name & httpMethod, httpMethod & handler or name & handler
                        if (_.isFunction(args[1])) { // Missing name & httpMethod
                            urlExp = args[0];
                            handler = args[1];
                            httpMethod = "*";
                            name = httpMethod + "_" + urlExp;
                        } else { // Missing name & handler or httpMethod & handler
                            handler = noOp;
                            if (args[1] === "*" || _.contains(crudToHttp, args[1])) { // Missing name & handler
                                urlExp = args[0];
                                httpMethod = args[1];
                                name = httpMethod + "_" + urlExp;
                            } else { // Missing httpMethod & handler
                                httpMethod = "*";
                            }
                        }
                        break;
                    case 1: // Missing name & httpMethod & handler
                        urlExp = args[0];
                        httpMethod = "*";
                        handler = noOp;
                        name = httpMethod + "_" + urlExp;
                        break;
                    }
                    return {
                        name: name,
                        urlExp: _.isRegExp(urlExp) ? urlExp : makeRegExp(urlExp),
                        httpMethod: httpMethod.toUpperCase(),
                        handler: handler
                    };
                }(_.toArray(arguments)));

            _.any(routes, function (r, i) {
                if (r.name === route.name) {
                    routeIndex = i;
                    return true;
                }
            });
            routes[routeIndex] = route;

            return this; // Chain
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
            return this; // Chain
        },
        /**
         * Remove route of given name
         * @param  {string} routeName Name of route to remove
         * @return {object} The faux-server
         */
        removeRoute: function (routeName) {
            routes = _.reject(routes, function (r) { return r.name === routeName; });
            return this; // Chain
        },
        /**
         * Remove all previously defined routes
         * @return {object} The faux-server
         */
        removeRoutes: function () {
            routes = [];
            return this; // Chain
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
            return this; // Chain
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
            return this; // Chain
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
            return this; // Chain
        },

        /**
         * Get current version of the library
         * @return {string} Current version of the library
         */
        getVersion: function () {
            return "0.8.5"; // Keep in sync with package.json
        }
    });
}));