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
	
	// A global 'exports' object signifies Node.js / CommonJS environment
	if (typeof exports !== "undefined") {
		createModule(root, exports, require("underscore", "backbone"));
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

	// Browser
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
		routes = [];

	// Modify Backbone's sync to use the faux-server sync method (when appropriate)
	Backbone.sync = function (crudMethod, model, options) {

		// If faux-server is disabled, fall back to original sync
		if (!isEnabled) { return nativeSync.call(model, crudMethod, model, options); }

		var httpMethod = crudToHttp[crudMethod],
			data = null,
			route = null,
			url = null,
			handlerContext = null,
			result = null;

		// When emulating HTTP, 'create', 'update' and 'delete' are all mapped to POST.
		if (Backbone.emulateHTTP && (httpMethod === "PUT" || httpMethod === "DELETE")) { httpMethod = "POST"; }

		// Ensure that we have a URL
		if(!(url = options.url || _.result(model, "url"))) {
			throw new Error("A 'url' property or function must be specified");
		}

		// Find route for given URL
		route = _.find(routes, function (r) {
			return r.urlExp.test(url) && (r.httpMethod === "*" || r.httpMethod === httpMethod);
		});

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
		 *  '*splat', which can match any number of URL components. The values 'captured' by params and splats
		 *  will be passed as parameters to the given handler method. (see http://backbonejs.org/#Router-routes).
		 *  The urlExp can also be a raw regular expression, in which case all values captured by reg-exp
		 *  capturing groups will be passed as parameters to the given handler method.
		 * @param {string} httpMethod The sync method, as defined in the context of HTTP (POST, GET, PUT, DELETE),
		 *  that should trigger the route's handler (both the URL and the method should match for the handler to
		 *  be invoked). Note that when Backbone.emulateHTTP is set to true, 'create', 'update' and 'delete' are
		 *  all mapped to POST. This may be set to '*' or any falsy value in order for the route's handler to be
		 *  invoked when urlExp matches the model's (or collection's) URL _regardless_ of method. (In this case,
		 *  the handler's context parameter may be queried for the method that is currently being handled)
		 * @param {function} handler The handler to be invoked when both route's URL and route's method match.
		 *  The handler's signature should be
		 *  function (context, [param1, [param2, ...]])
		 *  where context contains properties data, httpMethod and route and param1, param2, ... are parameters
		 *  deduced from matching the urlExp to the Model (or Collection) URL. Specifically:
		 *   * {any} context.data Attributes of the Model (or Collection) being proccessed. Valid only on
		 *      'create' (POST) or 'update' (PUT).
		 *   * {string} context.httpMethod The HTTP Method (POST, GET, PUT, DELETE) that is currently being
		 *      handled by the handler.
		 *   * {object} context.route The route that is currently being handled by the handler.
		 *  On success: Return created Model attributes after handling a POST and updated Model attributes after
		 *  handling a PUT. Return Model attributes after handling a GET or an array of Model attributes after
		 *  handling a GET that refers to a collection. Note that only attributes that have been changed on the
		 *  server (and should be updated on the client) need to be included in returned hashes. Return nothing
		 *  after handling a DELETE. On failure: Return any string (presumably a custom error messsage, an HTTP
		 *  status code that indicates failure, etc).
		 */
		addRoute: function (name, urlExp, httpMethod, handler) {
			routes.push({
				name: name,
				urlExp: _.isRegExp(urlExp) ? urlExp : routeExpToRegExp(urlExp),
				httpMethod: httpMethod.toUpperCase() || "*",
				handler: handler
			});
			return this; // Chain
		},
		/**
		 * Add multiple routes to the faux-server
		 * @param {object} routesToAdd A hash of routes to add. Hash keys should be the route names
		 *  and each route (nested hash) should contain urlExp, name and handler properties. Also see
		 *  addRoute()
		 */
		addRoutes: function (routesToAdd) {
			_.each(routesToAdd, function (r, routeName) {
				this.addRoute(routeName, r.urlExp, r.httpMethod, r.handler);
			}, this);
			return this; // Chain
		},
		/**
		 * Set a handler to be invoked when no route is matched to the current
		 *  <model-URL, sync-method> pair. By default the native sync will be invoked -
		 *  call this method to provide a custom handler which overrides this behaviour.
		 * @param {any} handler A handler to be invoked when no route is matched to the current
		 *  <model-URL, sync-method>. Ommit the parameter to set the default native sync behaviour.
		 *  The handler should have the same signature as Backbone's sync. That is,
		 *  function (method, model, [options])
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
			return "0.1";
		},
	
		/**
		 * Run in noConflict mode, setting the global 'backboneFauxServer' variable to to its
		 *  previous value
		 * @return {[type]} A reference to the backboneFauxServer module
		 */
		noConflict: function () {
			root.backboneFauxServer = previousBackboneFauxServer;
			return this;
		}
	});
}));