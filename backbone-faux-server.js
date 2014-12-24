//     Backbone Faux Server v0.10.5
//
//     https://github.com/biril/backbone-faux-server
//     Licensed and freely distributed under the MIT License
//     Copyright (c) 2012-2014 Alex Lambiris

/*global exports, define, global, require, _, Backbone */

// Detect env & export module
// --------------------------

(function (root, createModule) {
    "use strict";

    // Detect current environment. Faux-server will be exposed as module / global accordingly:

    // A global `exports` object signifies CommonJS-like enviroment that supports `module.exports`,
    //  e.g. Node
    if (typeof exports === "object") {
        return createModule(exports, require("underscore"), require("backbone"));
    }

    // A global `define` method with an `amd` property signifies the presence of an AMD loader
    //  (require.js, curl.js)
    if (typeof define === "function" && define.amd) {
        return define(["underscore", "backbone", "exports"], function (_, Backbone, exports) {
            return createModule(exports, _, Backbone);
        });
    }

    // Otherwise we assume running in a browser:

    // Save a reference to previous value of `fauxServer` before (potentially) overwriting it - so
    //  that it can be restored on `noConflict`
    var previousFauxServer = root.fauxServer;

    //
    createModule(root.fauxServer = {}, _, Backbone);

    // The `noConflict` method sets the `fauxServer` _global_ to to its previous value (_once_),
    //  returning a reference to `fauxServer` (_always_)
    root.fauxServer.noConflict = function () {
        var fauxServer = root.fauxServer;
        root.fauxServer = previousFauxServer;
        return (fauxServer.noConflict = function () { return fauxServer; }).call();
    };

// Create module
// --------------------------

}(this, function (fauxServer, _, Backbone) {
    "use strict";

    var
        // A no-op method to reuse
        noOp = function () {},

        // Clone an array skipping all tail-elements which are undefined. `Array.length` can't be
        //  trusted for arrays containing tail-element(s) explicitly set to `undefined` as it's
        //  always set to the index of the last element plus one - and a tail element explicitly
        //  set to undefined will in fact count as the 'last element'. Problematic when counting
        //  function arguments in order to sanitize, provide defaults, etc
        skipUndefinedTail = function (array) {
            var a = [], i = array.length - 1;
            for (; i >= 0; i--) { if (!_.isUndefined(array[i])) { a[i] = array[i]; } }
            return a;
        },

        // Convert a urlExp string - a string containing parameter parts (‘:param’), splat parts
        //  (‘*splat’) and parentheses into a regular expression
        makeRegExp = (function () {
            var
                // To escape special chars before converting to reg-exp
                e = /[\-{}\[\]+?.,\\\^$|#\s]/g,

                // Optional part
                o = /\((.*?)\)/g,

                // Named param (+ extra capturing parens for opt-part detection)
                p = /(\(\?)?:[A-Za-z_](?:\w)+/g,

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

        // Save a reference to the native sync method. Will be invoked when no route is matched
        //  during sync (and there's no default-route) or faux-server is disabled altogether
        nativeSync = Backbone.sync,

        // Indicates whether faux-server is currently enabled
        isEnabled = true,

        // The default-route - a route that contains the default handler if one is defined. The
        //  default handler is invoked when no matching route is found for some model-URL /
        //  sync-method pair and may be set by means of `setDefaultHandler`. A `null` value
        //  signifies the absence of a default handler
        defaultRoute = null,

        // Server's emulated latency
        latency = 0,

        // Mapping of CRUD (+ patch) to HTTP verbs
        crudToHttp = {
            "create": "POST",
            "read": "GET",
            "update": "PUT",
            "delete": "DELETE",
            "patch": "PATCH"
        },

        // Collection of all defined routes
        routes = [],

        // Get a route matching the given <`url`, `httpMethod`> pair. Routes that exactly match the
        //  HTTP-method take precedence over match-all-methods routes (those with `httpMethod` set
        //  to '*'). Matching routes that were defined later take precedence over those that were
        //  defined earlier. A returned matching route will contain the additional `handlerParams`
        //  property: an array containing params that are to be passed to the handler as captured
        //  when the given URL was matched. Will return `null` if no route found. Note that
        //  the acquired route is a copy - it cannot be modified to affect faux-server's behaviour
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

        // Create route for given `name`, `urlExp`, `httpMethod` and `handler`. Will set missing
        //  arguments to defaults and sanitize values where appropriate - note that the only
        //  mandatory argument is `urlExp`
        createRoute = function (name, urlExp, httpMethod, handler) {
            var args = skipUndefinedTail(_.toArray(arguments));

            switch (args.length) {

            // Missing `name`, `handler` or `httpMethod`
            case 3:

                // Missing `name` or `httpMethod`
                if (_.isFunction(args[2])) {
                    handler = args[2];

                    // Missing `name`
                    if (args[1] === "*" || _.contains(crudToHttp, args[1])) {
                        urlExp = args[0];
                        httpMethod = args[1];
                        name = null;

                    // Missing `httpMethod`
                    } else {
                        httpMethod = "*";
                    }

                // Missing `handler`
                } else {
                    handler = noOp;
                }
                break;

            // Missing `name` & `httpMethod`, `httpMethod` & `handler` or `name` & `handler`
            case 2:

                // Missing `name` & `httpMethod`
                if (_.isFunction(args[1])) {
                    urlExp = args[0];
                    handler = args[1];
                    httpMethod = "*";
                    name = null;

                // Missing `name` & `handler` or `httpMethod` & `handler`
                } else {
                    handler = noOp;

                    // Missing `name` & `handler`
                    if (args[1] === "*" || _.contains(crudToHttp, args[1])) {
                        urlExp = args[0];
                        httpMethod = args[1];
                        name = null;

                    // Missing `httpMethod` & `handler`
                    } else {
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
        },

        // Get the data that should be sent to the server during a sync. This depends on
        //  the sync-method being used and any options that may have been given
        getRequestData = function (httpMethod, model, options) {
            // A `data` property whithin options overrides any Model data.
            if (options.data) { return options.data; }

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
        createTransport = function (syncOptions /*, syncContext */) {
            var success = syncOptions.success || noOp,
                error = syncOptions.error || noOp;

            // If an underlying ajax lib is defined for Backbone (`Backbone.$`) and it features a
            //  `Deferred` method (which is precisely the case when `Backbone.$` = `jQuery`) then
            //  attempt to create a 'deferred transport' which will invoke the `success` / `error`
            //  callbacks when its promise is fulfilled / rejected. Note that sync will return the
            //  transport's promise _not_ the transport itself
            if (Backbone.$ && _.isFunction(Backbone.$.Deferred)) {
                try {
                    var deferred = Backbone.$.Deferred();
                    deferred.then(success, error);
                    return deferred;
                } catch (e) {}
            }

            // Otherwise create a poor-man's deferred - an object that implements a dumb
            //  `promise` / `resolve` / `reject` interface without actual promise semantics:
            //  `resolve` and `reject` just delegate to `success` and `error` callbacks while
            //  `promise` returns an `undefined`. This is a good enough transport
            return {
                promise: noOp,
                resolve: function (value) { success(value); },
                reject: function (reason) { error(reason); }
            };
        };

    // ### The Sync method

    // Replace Backbone's native sync with faux-server sync:
    Backbone.sync = function (crudMethod, model, options) {

        // If faux-server is disabled, fall back to original sync
        if (!isEnabled) { return nativeSync.call(model, crudMethod, model, options); }

        _.defaults(options || (options = {}), {
            emulateHTTP: Backbone.emulateHTTP,
            emulateJSON: Backbone.emulateJSON
        });

        var
            // Sync context
            ctx = {
                data: null,
                url: null,
                httpMethod: crudToHttp[crudMethod],
                route: null
            },

            // An exec-method to actually run the appropriate handler. Defined below
            execHandler = null,

            // We'll be creating a transport for this sync..
            transport = null,

            // ..and returning the transport's promise
            transportPromise = null;

        // When emulating HTTP, 'create', 'update', 'delete' and 'patch' are all mapped to POST.
        if (options.emulateHTTP && ctx.httpMethod !== "GET") {
            ctx.httpMethodOverride = ctx.httpMethod;
            ctx.httpMethod = "POST";
        }

        // Ensure that we have a URL (A `url` property whithin options overrides Model /
        //  Collection URL)
        if(!(ctx.url = options.url || _.result(model, "url"))) {
            throw new Error("sync: Undefined 'url' property or function of Model / Collection");
        }

        // Find route for given URL or fall back to native sync if none found
        if (!(ctx.route = getMatchingRoute(ctx.url, ctx.httpMethod) || defaultRoute)) {
            return nativeSync.call(model, crudMethod, model, options);
        }

        // Ensure that we have the appropriate request data
        ctx.data = getRequestData(ctx.httpMethod, model, options);

        // Create a transport for this sync
        transport = createTransport(options, ctx);

        // An exec-method to actually run the handler and subsequently invoke success / error
        //  callbacks. (The relevant 'success' or 'error' event will be triggered by backbone)
        execHandler = function () {
            var result = ctx.route.handler.apply(null, [ctx].concat(ctx.route.handlerParams));
            transport[_.isString(result) ? "reject" : "resolve"](result);
        };

        // The transport's promise to return. Assuming the default transport-factory implementation
        //  this may be an actual promise or just undefined
        transportPromise = transport.promise();

        model.trigger("request", model, transportPromise, options);

        // Call exec-method asynchronously, taking into account any given latency
        _.delay(execHandler, _.isFunction(latency) ? latency(ctx) : latency);

        return transportPromise;
    };

    // ### The fauxServer API

    // Extend `fauxServer` with the fauxServer API methods:
    _.extend(fauxServer, {


        // #### addRoute([name, ]urlExp[, httpMethod][, handler])
        // Add a route to the faux-server - a mapping from a Model(or Collection)-URL & sync-method
        //  (an HTTP verb (POST, GET, PUT, PATCH or DELETE)) to some specific handler (callback):
        //  `<model-URL, sync-method> -> handler`. Whenever a Model is created, read, updated or
        //  deleted, its URL and the the sync method being used will be tested against defined
        //  routes in order to find a handler for creating, reading, updating or deleting this
        //  Model. The same applies to reading Collections. When a match for the <model-URL,
        //  sync-method> pair is _not_ found among defined routes, the native sync will be invoked
        //  (this behaviour may be overriden - see `setDefaultHandler`). Later routes take
        //  precedence over earlier routes so in configurations where multiple routes match,
        //  the one most recently defined will be used.
        //
        //  The route `name` is optional and a named route may be queried and / or removed by its
        //   name. Additionally, a named route will replace an earlier defined route of same name.
        //
        //  The route `urlExp` is an expression against which, Model(or Collection)-URLs will be
        //   matched. This is syntactically and functionally analogous to Backbone routes,
        //   featuring parameter parts (':param'), splat parts ('*splat') and parentheses. The
        //   values captured by params and splats will be passed as parameters to the given handler
        //   method. Regular expressions may also be used, in which case all values captured by
        //   reg-exp capturing groups will be passed as parameters to the given handler method.
        //   Note that `:param`s are required to begin with a letter or underscore - those that
        //   don't are treated as a fixed part of the URL.
        //
        //  The route's `httpMethod` is an HTTP verb (POST, GET, PUT, PATCH or DELETE), that should
        //   trigger the route's handler. Both the URL-expression and the method should match for
        //   the handler to be invoked. httpMethod may also be set to '*' (or omitted) to create a
        //   match-all-methods handler: One that will be invoked whenever urlExp matches the
        //   model's (or collection's) URL _regardless_ of method. In the scope of a
        //   match-all-methods handler, the HTTP method currently being handled may be acquired by
        //   querying the context parameter for `context.httpMethod`. Note that when
        //   `Backbone.emulateHTTP` is set to true or `emulateHTTP` is passed as an inline option
        //   during sync, 'create', 'update', 'delete' and 'patch' will all be mapped to POST. In
        //   this case `context.httpMethod` will be set to POST and the true HTTP method may be
        //   acquired by querying `context.httpMethodOverride`.
        //
        //  The route `handler`'s signature should be
        //   `function (context, [param1, [param2, ...]])`
        //   where `context` contains properties `data`, `httpMethod`, `httpMethodOverride`,
        //   `route` and `param1`, `param2`, ... are parameters derived by matching the `urlExp` to
        //   the Model (or Collection) URL. Specifically, about `context` properties:
        //
        //   * `context.data`: Attributes of the Model (or Collection) being processed. Valid
        //      only on 'create' (POST), 'update' (PUT) or 'patch' (PATCH). In the specific case of
        //      PATCH, context.data may only contain a _subset_ of Model's attributes.
        //   * `context.httpMethod`: The HTTP Method (POST, GET, PUT, PATCH, DELETE) that
        //      is currently being handled.
        //   * `context.url`: The URL that is currently being handled.
        //   * `context.httpMethodOverride`: The true HTTP Method (POST, GET, PUT, PATCH, DELETE)
        //      that is currently being handled when Backbone.emulateHTTP is set to true.
        //      The equivalent of Backbone's X-HTTP-Method-Override header.
        //   * `context.route`: The route that is currently being handled.
        //
        //  On success, the handler should return created Model attributes after handling a POST or
        //   updated Model attributes after handling a PUT or PATCH. Return Model attributes after
        //   handling a GET or an array of Model attributes after handling a GET that refers to a
        //   collection. Note that only attributes that have been changed on the server (and should
        //   be updated on the client) need to be included. Return nothing after handling a DELETE.
        //   On failure, the handler should return s string (presumably a custom error message, an
        //   HTTP status code that indicates failure, etc).

        //
        addRoute: function (/* name, urlExp, httpMethod, handler */) {
            var route, routeIndex;

            // Create the route, defaulting and sanitizing where appropriate
            route = createRoute.apply(null, arguments);

            // If a route of given name is already present then overwrite it with this one.
            //  Otherwise just append the new route
            _.any(routes, function (r, i) {
                if (r.name === route.name) {
                    routeIndex = i;
                    return true;
                }
            }) || (routeIndex = routes.length);
            routes[routeIndex] = route;

            return this;
        },


        // #### addRoutes(routes)
        // Add multiple routes to faux-server. Given `routes` should be a hash or array: In the
        //  case of a hash, keys should be route names and each route (nested hash) need only
        //  contain `urlExp`, `httpMethod` and `handler`. Also see `addRoute`. Returns the
        //  faux-server

        //
        addRoutes: function (routes) {
            var isArray = _.isArray(routes);
            _.each(routes, function (r, rName) {
                this.addRoute(isArray ? r.name : rName, r.urlExp, r.httpMethod, r.handler);
            }, this);
            return this;
        },


        // #### removeRoute(routeName)
        // Remove route of given `routeName`. Returns the faux-server

        //
        removeRoute: function (routeName) {
            routes = _.reject(routes, function (r) { return r.name === routeName; });
            return this;
        },


        // #### removeRoutes()
        // Remove all previously defined routes. Returns the faux-server

        //
        removeRoutes: function () {
            routes = [];
            return this;
        },


        // #### getRoute(routeName)
        // Get route of given `routeName` or `null` if no such route exists. Note that the
        //  acquired route is a copy - it cannot be modified to affect faux-server's behaviour

        //
        getRoute: function (routeName) {
            var route = _.find(routes, function (r) { return r.name === routeName; });
            return route ? _.clone(route) : null;
        },


        // #### getRouteAt(index)
        // Get route at given `index` or `null` if no such route exists. Note that the
        //  acquired route is a copy - it cannot be modified to affect faux-server's behaviour

        //
        getRouteAt: function (index) {
            return routes[index] ? _.clone(routes[index]) : null;
        },


        // #### getMatchingRoute(url, httpMethod)
        // Get route matching the given <`url`, `httpMethod`> pair or `null` if no such route
        //  exists. Note that the acquired route is a copy - it cannot be modified to affect
        //  faux-server's behaviour. See earlier definition of `getMatchingRoute` for details

        //
        getMatchingRoute: getMatchingRoute,


        // #### setDefaultHandler([handler])
        // Set the given `handler` as the one to be invoked when no route is matched to the current
        //  <model-URL, sync-method> pair. This will override the default behaviour of invoking the
        //  native sync. Omit the parameter to reset to the default behaviour. See `addRoute` for
        //  handler's signature and semantics. Note that a default-handler isn't part of a route,
        //  so the `context.route` parameter will not be valid. Returns the faux-server

        //
        setDefaultHandler: function (handler) {
            defaultRoute = !handler ? null : {
                name: "",
                urlExp: "",
                handler: handler,
                handlerParams: []
            };
            return this;
        },


        // #### setLatency(min[, max])
        // Set server's emulated latency to `min` ms or a random latency withing [`min`, `max`] ms
        //  when the optional `max` parameter is given. Omitting both parameters will set latency
        //  to 0. In place of a fixed minimum, a function may also be given that returns a latency.
        //  The function will be invoked per handled route, with the same parameters as those
        //  passed to the relevant route handler (`context`, etc). Returns the faux-server

        //
        setLatency: function (min, max) {
            latency = !max ? (min || 0) : function () { return min + Math.random() * (max - min); };
            return this;
        },


        // #### setTransportFactory(factory)
        // Set the server's transport factory - a factory function with signature
        //  `function (syncOptions, syncContext)`
        //  invoked  _per sync_ (with the relevant options / context) to create a new transport - a
        //  deferred-like object implementing a `promise` / `resolve` / `reject` interface. A
        //  successfull sync will invoke `transport.resolve` while a failed one will invoke
        //  `transport.reject` The sync method will always return `transport.promise()`. Returns
        //  the faux-server

        //
        setTransportFactory: function (factory) {
            createTransport = factory;
            return this;
        },


        // #### enable(shouldEnable)
        // Enable / disable the faux-server. When disabled, sync will be delegated to the native
        //  backbone `sync`. Handy for easily toggling between mock / real server. Set
        //  `shouldEnable` to `true` or omit altogether to enable, set to `false` to disable.
        //  Returns the faux-server

        //
        enable: function (shouldEnable) {
            isEnabled = _.isUndefined(shouldEnable) || shouldEnable;
            return this;
        },


        // #### getVersion()
        // Get faux-server version

        //
        getVersion: function () {
            return "0.10.5"; // Keep in sync with package.json
        }
    });


    // #### get/post/put/patch/del([name, ]urlExp[, handler])
    // Add a route to the faux-server, for HTTP GET / POST / PUT / PATCH / DEL

    // Attach `<httpMethod>(name, urlExp, handler)` shortcut-methods which delegate to `addRoute`
    _.each(_.values(crudToHttp), function (httpMethod) {

        // All shortcut-methods are named after the relevant HTTP verb except for 'delete' which is
        //  abbreviated to 'del' to avoid reserved-word trouble
        var method = httpMethod === "DELETE" ? "del" : httpMethod.toLowerCase();

        fauxServer[method] = function () {
            var args = skipUndefinedTail(_.toArray(arguments));
            if (!args.length) { throw new Error(method + ": Missing mandatory 'urlExp' argument"); }

            // The `httpMethod` must be inserted into the args, either at tail-position if
            //  `handler` is missing or just before it (after `urlExp`) if it's present
            if (!_.isFunction(args[args.length - 1])) { args.push(httpMethod); }
            else { args.splice(args.length - 1, 0, httpMethod); }

            // Delegate to `addRoute`
            return fauxServer.addRoute.apply(this, args);
        };
    });

    return fauxServer;
}));
