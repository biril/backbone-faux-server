/**
 * A (tiny) framework for easily mocking-up a server when working with Backbone.js. Define any
 *  number of routes that map <model-URL, sync-method> pairs to custom handlers (callbacks).
 *  Faux-server overrides Backbone's native sync so that whenever a Model (or Collection) is synced
 *  and its URL along with the sync method being used form a pair that matches a defined route, the
 *  route's handler is invoked. Implement handlers directly in JS to test the expected behaviour of
 *  your app, work with dummy data, support persistance using local-storage, etc. When / if you
 *  choose to move to a real server, switching to Backbone's native, ajax-based sync is as simple
 *  as calling backboneFauxServer.enable(false)
 */
(function (root, createModule) {
	"use strict";

	// Export faux-server module depending on current environment:
	
	// A global 'exports' object signifies CommonJS environment
	if (typeof exports !== "undefined") {
		createModule(root, exports, require("underscore"), require("backbone"));
		return;
	}

	// A global 'define' method with an 'amd' property signifies the
	//  presence of an AMD loader
	if (typeof define === "function" && define.amd) {
		define(["underscore", "backbone", "exports"], function (_, Backbone, exports) {
			return createModule(root, exports, _, Backbone);
		});
		return;
	}

	// Browser environment, without a module-framework
	root.backboneFauxServer = createModule(root, {}, _, Backbone);

}(this, function (root, backboneFauxServer, _, Backbone) {
	"use strict";

	// Save a reference to the previous value of 'backboneFauxServer', so that it
	//  can be restored later on, if 'noConflict' is used
	var previousBackboneFauxServer = root.backboneFauxServer,

		nativeSync = Backbone.sync, // Save a reference to the native sync method

		// Indicates whether the faux-server is currently enabled
		isEnabled = true,

		// A handler that should be invoked when no matching route is found for some
		//  <model-URL, sync-method> pair. The native sync by default
		onNoRoute = nativeSync,

		// Convert a route string (containing params and splats) into a regular expression
		routeExpToRegExp = (function () {
			var namedParam    = /:\w+/g,
				splatParam    = /\*\w+/g;
			return function(route) {
				route = route.replace(namedParam, "([^\/]+)").replace(splatParam, "(.*?)");
				return new RegExp("^" + route + "$");
			};
		}()),

		// Map from CRUD to HTTP-methods
		crudToHttp = { "create": "POST", "read": "GET", "update": "PUT", "delete": "DELETE" },
		
		// Routes
		routes = {},

		/**
		 * Get a route matching the given <URL, HTTP-method> pair. Routes that exactly
		 *  match the HTTP-method are prefered to match-all routes (those with '*'-method)
		 * @param  {string} url The URL
		 * @param  {string} httpMethod The HTTP method
		 * @return {object} A matching route if one is found, undefined otherwise
		 */
		getMatchingRoute = function (url, httpMethod) {
			var rName, r, weakMatch, match;
			for (rName in routes) {
				if (routes.hasOwnProperty(rName)) {
					r = routes[rName];
					if (r.urlExp.test(url)) {
						if (r.httpMethod === httpMethod) { return r; } // Found a match
						if (r.httpMethod === "*") { weakMatch = r; } // Found a weak match
					}
				}
			}
			return weakMatch; // Found no match - returning a weak match or undefined
		},

		// A convenient no-op to reuse
		noOp = function () {};

	// Modify Backbone's sync to use the faux-server sync method (when appropriate)
	Backbone.sync = function (crudMethod, model, options) {

		// If faux-server is disabled, fall back to original sync
		if (!isEnabled) { return nativeSync.call(model, crudMethod, model, options); }

		var httpMethod = crudToHttp[crudMethod],
			httpMethodOverride,
			data = null,
			route = null,
			url = null,
			handlerContext = null,
			result = null;

		// When emulating HTTP, 'create', 'update' and 'delete' are all mapped to POST.
		if (Backbone.emulateHTTP && (httpMethod === "POST" || httpMethod === "PUT" || httpMethod === "DELETE")) {
			httpMethodOverride = httpMethod;
			httpMethod = "POST";
		}

		// Ensure that we have a URL
		if(!(url = options.url || _.result(model, "url"))) {
			throw new Error("A 'url' property or function must be specified");
		}

		route = getMatchingRoute(url, httpMethod); // Find route for given URL

		// If route is not found
		if (!route) { return onNoRoute.call(model, crudMethod, model, options); }

		// Ensure that we have the appropriate request data. A data property whithin options overrides
		//  the Model / Collection data. Additionally, Model / Collection data should only be provided
		//  to the server when creating or updating
		if (options.data) { data = options.data; }
		else {
			if (model && crudMethod === "create" || crudMethod === "update") {
				data = model.toJSON();
			}
		}

		// Context paramater for the acquired handler
		handlerContext = {
			data: data,
			httpMethod: httpMethod,
			httpMethodOverride: httpMethodOverride,
			route: _.clone(route)
		};

		// Handle
		result = route.handler.apply(null, [handlerContext].concat(route.urlExp.exec(url).slice(1)));

		// A string result indicates error
		if (_.isString(result)) { options.error(model, result); }
		else { options.success(result); }
	};

	return _.extend(backboneFauxServer, {
		/**
		 * Add a route to the faux-server. Every route defines a mapping from a Model(or Collection)-URL
		 *  & sync-method (as defined in the context of HTTP (POST, GET, PUT, DELETE)) to some specific
		 *  handler (callback):
		 *  <model-URL, sync-method> -> handler
		 *  So every time a Model is created, read, updated or deleted, its URL and the the sync method being
		 *  used will be tested against defined routes in order to find a handler for creating, reading,
		 *  updating or deleting this Model. The same applies to reading Collections. Everytime a Collection
		 *  is read, its URL (and the 'read' method) will be tested against defined routes in order to find a
		 *  handler for reading this Collection. When a match for the <model-URL, sync-method> pair is not
		 *  found among defined routes, the native sync (or a custom handler) will be invoked (see
		 *  backboneFauxServer.setOnNoRoute).
		 * @param {string} name The name of the route
		 * @param {string|RegExp} urlExp An expression against which, Model(or Collection)-URLs will be
		 *  tested. This is syntactically and functionally analogous to Backbone routes so urlExps may contain
		 *  parameter parts, ':param', which match a single URL component between slashes; and splat parts
		 *  '*splat', which can match any number of URL components. The values captured by params and splats
		 *  will be passed as parameters to the given handler method. (see http://backbonejs.org/#Router-routes).
		 *  The urlExp can also be a raw regular expression, in which case all values captured by reg-exp
		 *  capturing groups will be passed as parameters to the given handler method.
		 * @param {string} [httpMethod="*"] The sync method, as defined in the context of HTTP (POST, GET, PUT,
		 *  DELETE), that should trigger the route's handler (both the URL-expression and the method should
		 *  match for the handler to be invoked). httpMethod may also be set to '*' to create a
		 *  match-all-methods handler; one that will be invoked whenever urlExp matches the model's
		 *  (or collection's) URL _regardless_ of method. Omitting the parameter or setting to falsy values has
		 *  the same effect. In the scope of a math-all-mmethods handler, the HTTP method currently being
		 *  handled may be acquired by querying the context parameter for context.httpMethod. Note that when
		 *  Backbone.emulateHTTP is set to true, 'create', 'update' and 'delete' are all mapped to POST so
		 *  context.httpMethod will be set to POST for all these methods. However, in this case, the true HTTP
		 *  method being handled may be acquired by querying the handler's context for context.httpMethodOverride.
		 * @param {function} [handler=no-op] The handler to be invoked when both route's URL and route's method
		 *  match. A do-nothing handler will be used if one is not provided. Its signature should be
		 *  function (context, [param1, [param2, ...]])
		 *  where context contains properties data, httpMethod, httpMethodOverrde, route and param1, param2, ...
		 *  are parameters deduced from matching the urlExp to the Model (or Collection) URL. Specifically, about
		 *  context properties:
		 *   * {any} context.data Attributes of the Model (or Collection) being proccessed. Valid only on
		 *      'create' (POST) or 'update' (PUT).
		 *   * {string} context.httpMethod The HTTP Method (POST, GET, PUT, DELETE) that is currently being
		 *      handled by the handler.
		 *   * {string} context.httpMethodOverride The true HTTP Method (POST, GET, PUT, DELETE) that is
		 *      currently being handled when Backbone.emulateHTTP is set to true. The equivalent of
		 *      Backbone's X-HTTP-Method-Override header (see http://backbonejs.org/#Sync-emulateHTTP).
		 *   * {object} context.route The route that is currently being handled by the handler.
		 *  On success: Return created Model attributes after handling a POST and updated Model attributes after
		 *  handling a PUT. Return Model attributes after handling a GET or an array of Model attributes after
		 *  handling a GET that refers to a collection. Note that only attributes that have been changed on the
		 *  server (and should be updated on the client) need to be included in returned hashes. Return nothing
		 *  after handling a DELETE. On failure: Return any string (presumably a custom error messsage, an HTTP
		 *  status code that indicates failure, etc).
		 * @return {object} The faux-server
		 */
		addRoute: function (name, urlExp, httpMethod, handler) {
			routes[name] = {
				urlExp: _.isRegExp(urlExp) ? urlExp : routeExpToRegExp(urlExp),
				httpMethod: httpMethod ? httpMethod.toUpperCase() : "*",
				handler: handler || noOp
			};
			return this; // Chain
		},
		/**
		 * Add multiple routes to the faux-server
		 * @param {object} routesToAdd A hash of routes to add. Hash keys should be the route names
		 *  and each route (nested hash) should contain urlExp, name and handler properties. Also see
		 *  addRoute()
		 * @return {object} The faux-server
		 */
		addRoutes: function (routesToAdd) {
			_.each(routesToAdd, function (r, rName) {
				this.addRoute(rName, r.urlExp, r.httpMethod, r.handler);
			}, this);
			return this; // Chain
		},
		/**
		 * Remove route of given name
		 * @param  {string} routeName Name of route to remove
		 * @return {object} The faux-server
		 */
		removeRoute: function (routeName) {
			if (routes[routeName]) { delete routes[routeName]; }
			return this; // Chain
		},
		/**
		 * Remove all previously defined routes
		 * @return {object} The faux-server
		 */
		removeRoutes: function () {
			routes = {};
			return this; // Chain
		},
		/**
		 * Get route of specified name
		 * @param  {string} routeName Name of route to acquire
		 * @return {object} Route of specified name or null if no such route exists. Note that
		 *  the returned route is a copy and cannot be modified to alter faux-server's behaviour
		 */
		getRoute: function (routeName) {
			var route = routes[routeName];
			return !route ? null : _.clone(route);
		},
		/**
		 *
		 */
		getMatchingRoute: getMatchingRoute,
		/**
		 * Set a handler to be invoked when no route is matched to the current
		 *  <model-URL, sync-method> pair. By default the native sync will be invoked -
		 *  call this method to provide a custom handler which overrides this behaviour.
		 * @param {any} handler A handler to be invoked when no route is matched to the current
		 *  <model-URL, sync-method>. Ommit the parameter to set the default native sync behaviour.
		 *  The handler should have the same signature as Backbone's sync. That is,
		 *  function (method, model, [options])
		 * @return {object} The faux-server
		 */
		setOnNoRoute: function (handler) {
			onNoRoute = _.isFunction(handler) ? handler : nativeSync;
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
			return "0.2.0";
		},
	
		/**
		 * Run in noConflict mode, setting the global 'backboneFauxServer' variable to to its
		 *  previous value
		 * @return {object} The faux-server
		 */
		noConflict: function () {
			root.backboneFauxServer = previousBackboneFauxServer;
			return this; // Chain
		}
	});
}));