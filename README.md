Backbone Faux Server
====================

[![Build Status](https://travis-ci.org/biril/backbone-faux-server.png)](https://travis-ci.org/biril/backbone-faux-server)
[![NPM version](https://badge.fury.io/js/backbone-faux-server.png)](http://badge.fury.io/js/backbone-faux-server)


A (tiny) framework for easily mocking-up a server when working with
[Backbone.js](https://github.com/documentcloud/backbone)

Define any number of routes that map `<model-URL, sync-method>` pairs to custom handlers
(callbacks). Faux-server overrides (is a drop-in replacement of) Backbone's native sync so that
whenever a Model (or Collection) is synced and its URL along with the sync method being used form a
pair that matches a defined route, the route's handler is invoked. Implement handlers in JS to test
the expected behaviour of your app, work with dummy data, support persistence using local-storage,
etc. When & if you choose to move to a real server, switching back to Backbone's native, ajax-based
sync is as simple as calling `fauxServer.enable(false)`.

Backbone faux server (henceforth 'BFS') grew out of the author's need to quickly flesh out Backbone
prototype apps without having to fiddle with a server, a DB, or anything else that would require
more than a JS script. Other solutions exist for this (such as
[Backbone localStorage Adapter](https://github.com/jeromegn/Backbone.localStorage)) but they deviate
from (or at least obscure) Backbone's opinion of Model URLs, REST and their interdependence. BFS
facilitates handling POSTs, GETs, PUTs and DELETEs *per* Model (or Collection) URL as if you're
working on the server side. Functionality written this way, may be ported to your actual server in a
very straightforward manner.


Set up
------

`git clone git://github.com/biril/backbone-faux-server` or `npm install backbone-faux-server` to get
up and running. BFS will be exposed as a Global, a CommonJS module or an AMD module depending on the
detected environment.

* When developing for *the browser, without an AMD module loader*, include backbone.faux.server.js
    after backbone.js:

    ```html
    ...
    <script type="text/javascript" src="backbone.js"></script>
    <script type="text/javascript" src="backbone.faux.server.js"></script>
    ...
    ```

    and the module will be exposed as the global `fauxServer`:

    ```javascript
    console.log("working with version " + fauxServer.getVersion());
    ```

* `require` when working *with CommonJS* (e.g. Node.js). Assuming BFS is `npm install`ed:

    ```javascript
    var fauxServer = require("backbone-faux-server");
    console.log("working with version " + fauxServer.getVersion());
    ```

    (see Caveats for issues related to `npm install`ing Backbone along with BFS)

* Or list as a dependency when working *with an AMD loader* (e.g. require.js):

    ```javascript
    // Your module
    define(["backbone.faux.server"], function (fauxServer) {
    	console.log("working with version " + fauxServer.getVersion());
    });
    ```

    (you'll probably want to use AMD-compliant versions of
    [Backbone](https://github.com/amdjs/backbone) and
    [Underscore](https://github.com/amdjs/underscore))


Usage
-----

Define Backbone Models and Collections as you normally would:

```javascript
var Book = Backbone.Model.extend({
	defaults: {
		title: "Unknown title",
		author: "Unknown author"
	}
});
var Books = Backbone.Collection.extend({
	model: Book,
	url: "library-app/books"
});
```

Note that the `url` property is used, as it normally would in any scenario involving a remote
server.

Continue by defining routes, to handle Model syncing as needed. Every route defines a mapping from
a Model(or Collection)-URL & sync-method (an HTTP verb (POST, GET, PUT, PATCH, DELETE)) to some
specific handler (callback):

`<model-URL, sync-method> → handler`

For example, to handle the creation of a Book (`Books.create(..)`), define a route that maps the
`<"library-app/books", "POST">` pair to a handler, like so:

```javascript
fauxServer.addRoute("createBook", "library-app/books", "POST", function (context) {
	// Every handler receives a 'context' parameter. Use context.data (a hash of Book attributes)
	//  to create the Book entry in your persistence layer. Return attributes of created Book.
	//  Something along the lines of:
	context.data.id = newId(); // Almost certainly, you'll have to create an id
	books.push(context.data); // Save to persistence layer
	return context.data;
});
```

The "createBook" parameter simply defines a name for the route. The URL parameter,
"library-app/books", is pretty straightforward in the preceding example - it's the URL of the Books
Collection. Note however that the URL may (and usually will) be specified as a matching expression,
similarly to [Backbone routes](http://backbonejs.org/#Router-routes): URL-expressions may contain
parameter parts, `:param`, which match a single URL component between slashes; and splat parts
`*splat`, which can match any number of URL components. The values captured by params and splats
will be passed as extra parameters to the given handler method. Regular expressions may also be
used, in which case all values captured by reg-exp capturing groups will be passed as extra
parameters to the handler method.

Define more routes to handle updating, reading and deleting Models. The `addRoutes` method is used
below to define routes to handle all actions (create, read, update and delete) for the preceding
Book example:

```javascript
fauxServer.addRoutes({
	createBook: {
		urlExp: "library-app/books",
		httpMethod: "POST",
		handler: function (context) {
			// Create book using attributes in context.data
			// Save to persistence layer
			// Return attributes of newly created book
		}
	},
	readBooks: {
		urlExp: "library-app/books",
		httpMethod: "GET",
		handler: function (context) {
			// Return array of stored book attributes
		}
	},
	readBook: {
		urlExp: "library-app/books/:id",
		httpMethod: "GET",
		handler: function (context, bookId) {
			// Return attributes of stored book with id 'bookId'
		}
	},
	updateBook: {
		urlExp: "library-app/books/:id",
		httpMethod: "PUT",
		handler: function (context, bookId) {
			// Update stored book with id 'bookId', using attributes in context.data
			// Return updated attributes
		}
	},
	deleteBook: {
		urlExp: "library-app/books/:id",
		httpMethod: "DELETE",
		handler: function (context, bookId) {
			// Delete stored book of id 'bookId'
		}
	}
}
```

Route names can be useful for querying and / or removing earlier defined routes. However, this is
often unecessary and route names may be skipped in most route declarations. (They're mandatory as
keys when passing a hash of routes to `addRoutes`.) Coming back to the earlier "createBook" example,
the route name may be skipped like so:

```javascript
fauxServer.addRoute("library-app/books", "POST", function (context) {
	// Create book ..
});
```

Moreover, faux-server exposes `get`, `post`, `put`, `delete` and `patch` methods as shortcuts for
calling `addRoute` with a specific `httpMethod`. Thus, the preceding POST-route addition may be
rewritten as

```javascript
fauxServer.post("library-app/books", function (context) {
	// Create book ..
});
```

Similarly, an alternative, more compact syntax for the preceding `addRoutes` example would be:

```javascript
fauxServer
	.post("library-app/books", function (context) {
		// Create book using attributes in context.data
		// Save to persistence layer
		// Return attributes of newly created book

	}).get("library-app/books", function (context) {
		// Return array of stored book attributes

	}).get("library-app/books/:id", function (context, bookId) {
		// Return attributes of stored book with id 'bookId'

	}).put("library-app/books/:id", function (context, bookId) {
		// Update stored book with id 'bookId', using attributes in context.data
		// Return updated attributes

	}).delete("library-app/books/:id", function (context, bookId) {
		// Delete stored book of id 'bookId'
	});
}
```


Testing
-------

The test suite may be run in a browser (test/index.html) or on the command line, by running
`make test` or `npm test`. The command line version runs on Node and depends on
[node-qunit](https://github.com/kof/node-qunit) so an `npm install` is required beforehand.


Reference
---------

The following list, while not exhaustive, includes all essential parts of the BFS API. The ommitted
bits are there to aid testing and fascilitate fancy stuff you probably won't ever need. Further
insight may be gained by taking a look at the test suit and - of course - the source.

### Methods

All methods return the faux-server unless otherwise noted.

#### addRoute (name, urlExp, httpMethod, handler)

Add a route to the faux-server. Every route defines a mapping from a Model(or Collection)-URL &
sync-method (an HTTP verb (POST, GET, PUT, PATCH or DELETE)) to some specific handler (callback):

`<model-URL, sync-method> → handler`

So every time a Model is created, read, updated or deleted, its URL and the the sync method being
used will be tested against defined routes in order to find a handler for creating, reading,
updating or deleting this Model. The same applies to reading Collections: Whenever a Collection is
read, its URL (and the 'read' method) will be tested against defined routes in order to find a
handler for reading it. When a match for the `<model-URL, sync-method>` pair is not found among
defined routes, the native sync will be invoked (this behaviour may be overriden - see
`fauxServer.setDefaultHandler`). Later routes take precedence over earlier routes so in
configurations where multiple routes match, the one most recently defined will be used.

* `name`: The name of the route. Optional
* `urlExp`: An expression against which, Model(or Collection)-URLs will be tested. This is
	syntactically and functionally analogous to
	[Backbone routes](http://backbonejs.org/#Router-routes): `urlExp`s may contain parameter parts,
	`:param`, which match a single URL component between slashes; and splat parts `*splat`, which
	can match any number of URL components. Parentheses may also be used to denote optional parts.
	The values captured by params and splats will be passed as parameters to the given handler
	method. Regular expressions may also be used, in which case all values captured by
	reg-exp capturing groups will be passed as parameters to the given handler method.
* `httpMethod`: The sync method, (an HTTP verb (POST, GET, PUT, PATCH or DELETE), that should
	trigger the route's handler (both the URL-expression and the method should match for the
	handler to be invoked). `httpMethod` may also be set to '*' to create a match-all-methods
	handler; one that will be invoked whenever `urlExp` matches the model's (or collection's) URL
	_regardless_ of method. Omitting the parameter has the same effect. In the scope of a
	match-all-methods handler, the HTTP method currently being handled may be acquired by querying
	the `context` parameter for `context.httpMethod`. Note that when `Backbone.emulateHTTP` is set
	to true or `emulateHTTP` is passed as an inline option during sync, 'create', 'update', 'patch'
	and 'delete' will all be mapped to POST. In this case `context.httpMethod` will be set to POST
	and the true HTTP method being handled may be acquired by querying `context.httpMethodOverride`.
* `handler`: The handler to be invoked when both route's URL-expression and route's method match. A
	do-nothing handler will be used if one is not provided. Its signature should be

    `function (context, [param1, [param2, ...]])`

    where `context` contains properties `data`, `httpMethod`, `httpMethodOverride`, `route` and
    `param1`, `param2`, ... are parameters deduced from matching the `urlExp` to the Model
    (or Collection) URL. Specifically, about `context` properties:

    * `context.data`: Attributes of the Model (or Collection) being proccessed. Valid only on
       'create' (POST), 'update' (PUT) or 'patch' (PATCH). In the specific case of PATCH,
       `context.data` may only contain a _subset_ of Model's attributes.
    * `context.httpMethod`: The HTTP Method (POST, GET, PUT, PATCH or DELETE) that is currently
       being handled.
    * `context.url`: The URL that is currently being handled.
    * `context.httpMethodOverride`: The true HTTP method (POST, GET, PUT, PATCH or DELETE) that is
       currently being handled when `Backbone.emulateHTTP` is set to true. The equivalent of
       [Backbone's](http://backbonejs.org/#Sync-emulateHTTP) `X-HTTP-Method-Override` header.
    * `context.route`: The route that is currently being handled.

    On success, the handler should return created Model attributes after handling a POST and updated
    Model attributes after handling a PUT or PATCH. Return Model attributes after handling a GET or
    an array of Model attributes after handling a GET that refers to a collection. Note that only
    attributes that have been changed on the server (and should be updated on the client) need to be
    included in returned hashes. Return nothing after handling a DELETE. On failure, the handler
    should return a string (presumably a custom error messsage, an HTTP status code that indicates
    failure, etc).

#### &lt;httpMethod&gt; (name, urlExp, handler)

`get`, `post`, `put`, `delete` and `patch` methods which act as shortcuts for calling `addRoute`
with a specific `httpMethod`. See `addRoute` above for parameter descriptions and further details.

#### addRoutes (routes)

Add multiple routes to the faux-server.

* `routes`: A hash or array of routes to add. When passing a hash, keys should be route names and
	each route (nested hash) need only contain `urlExp`, `httpMethod` and `handler`.

#### removeRoute (name)

Remove the route of given name.

* `name`: Name of route to remove.

#### removeRoutes ()

Remove all defined routes.

#### getRoute (name)

Get route of given name.

* `name`: Name of route to acquire.
* returns: Route of given name or null if no such route exists. Note that the returned route is a
	copy and cannot be modified to alter faux-server's behaviour.

#### setDefaultHandler (handler)

Set a handler to be invoked when no route is matched to the current `<model-URL, sync-method>`
pair. This will override the default behaviour of invoking the native sync.

* `handler`: A handler to be invoked when no route is found that matches a given
	`<model-URL, sync-method>` pair. Ommit the parameter to reset to the default behaviour. See
	`addRoute` for handler's signature and semantics. Note that a default-handler isn't part of a
	route, so the `context.route` parameter will not be valid.

#### setLatency (min, max)

Set server's emulated latency (zero by default)

* `min`: Server's emulated latency in ms. Interpreted as the minimum of a range when a `max` value
	is provided. Ommitting will set to 0.
* `max`: Maximum server latency in ms. Specifying this will cause syncing to occur with a random
	latency in the [min, max] range.

#### enable (shouldEnable)

Enable or disable the faux-server. When disabled, syncing is performed by the native Backbone sync
method. Handy for easily toggling between mock / real server.

* `shouldEnable`: Indicates whether to enable or disable. Set to true or ommit altogether to enable
	the faux-server, set to false to disable.

#### getVersion ()

Get the faux-server version

#### noConflict ()

Run in no-conflict mode, setting the global `fauxServer` variable to to its previous value. Only
useful when working in a browser environment without a module-framework as this is the only case
where `fauxServer` is exposed globally. Returns a reference to the faux-server.

Caveats / WTF
-------------
* When working with Node.js and npm be sure to `npm install backbone` _before_ `npm install`ing BFS.
	Installing in reverse order will cause BFS to fail due to Node's
    [module caching caveats](http://nodejs.org/api/modules.html#modules_module_caching_caveats).
* `npm install`ing with the `--dev` switch will fail
    [due to node-qunit](https://github.com/kof/node-qunit/issues/41).
* The current version of BFS is tested against and intended to work with Backbone 1.0. Check out
    [BFS v0.7.0](https://github.com/biril/backbone-faux-server/tree/v0.7.0) if you need to work
    with a previous version (such as 0.9.10).

License
-------

Licensed and freely distributed under the MIT License (LICENSE.txt).

Copyright (c) 2012-2013 Alex Lambiris
