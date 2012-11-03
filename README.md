Backbone Faux Server
====================

A (tiny) framework for easily mocking-up a server when working with
[Backbone.js](https://github.com/documentcloud/backbone)

Define any number of routes that map `<model-URL, sync-method>` pairs to custom handlers (callbacks). Faux-server
overrides Backbone's native sync so that whenever a Model (or Collection) is synced and its URL along with the sync
method being used form a pair that matches a defined route, the route's handler is invoked. Implement handlers in JS to
test the expected behaviour of your app, work with dummy data, support persistence using local-storage, etc. When / if
you choose to move to a real server, switching back to Backbone's native, ajax-based sync is as simple as calling
`backboneFauxServer.enable(false)`.

Usage
-----

Backbone-faux-server ('BFS' onwards) will be exposed as a Global, CommonJS module or AMD module depending on the
detected environment.

* When working in a *browser environment, without a module-framework,* include backbone.faux.server.js after backbone.js

    ```html
    <script type="text/javascript" src="backbone.js"></script>
    <script type="text/javascript" src="backbone.faux.server.js"></script>
    ```

    and BFS will be exposed as the global `backboneFauxServer`:

    ```javascript
    console.log("working with version " + backboneFauxServer.getVersion());
    ```

* `require` when working *with CommonJS* (e.g. Node.js)

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

Note that the `url` property is used, as it normally would in any scenario involving a remote server.

Continue by defining routes on the BFS, to handle model syncing. Every route defines a mapping from a Model(or
Collection)-URL & sync-method (as defined in the context of HTTP (POST, GET, PUT, DELETE)) to some specific handler
(callback):

`<model-URL, sync-method> → handler`

For example, to handle the creation of a Book, define a route that maps the `<"library-app/books", "POST">` pair to a
handler, like so:

```javascript
backboneFauxServer.addRoute("createBook", "library-app/books", "POST", function (context) {
	// Every handler receives a 'context' parameter. Use context.data (a hash of Book attributes)
	//  to create the Book entry in your persistence layer. Return attributes of created Book.
	//  Something along the lines of:
	context.data.id = newId(); // Almost certainly, you'll have to create an id
	books.push(context.data); // Save to persistence layer
	return context.data;
});
```

The "createBook" parameter simply defines a name for the route. The URL parameter, "library-app/books", is prety
straightforward in the preceding example but note that the URL may also be specified as a matching expression, simillar
to those used on [Backbone routes](http://backbonejs.org/#Router-routes). So URL-expressions may contain parameter
parts, `:param`, which match a single URL component between slashes; and splat parts `*splat`, which can match any
number of URL components. The values captured by params and splats will be passed as parameters to the given handler
method. The URL-expression can also be a raw regular expression, in which case all values captured by reg-exp capturing
groups will be passed as parameters to the handler method.

Define more routes to handle updating, reading and deleting Models. The `addRoutes` method is used below to define
routes to handle all actions (create, read, update and delete) for the preceding Book example:

```javascript
backboneFauxServer.addRoutes({
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

Reference
---------

### Methods

#### addRoute
```javascript
addRoute (name, urlExp, httpMethod, handler)
```
Add a route to the BFS. Every route defines a mapping from a Model(or Collection)-URL & sync-method (as defined in the
context of HTTP (POST, GET, PUT, DELETE)) to some specific handler (callback):

`<model-URL, sync-method> → handler`

So every time a Model is created, read, updated or deleted, its URL and the the sync method being used will be tested
against defined routes in order to find a handler for creating, reading, updating or deleting this Model. The same
applies to reading Collections. Everytime a Collection is read, its URL (and the 'read' method) will be tested against
defined routes in order to find a handler for reading this Collection. When a match for the `<model-URL, sync-method>`
pair is not found among defined routes, the native sync (or a custom handler) will be invoked (see
[setOnNoRoute](https://github.com/biril/backbone-faux-server#setOnNoRoute)).
* `name`: The name of the route
* `urlExp`: An expression against which, Model(or Collection)-URLs will be tested. This is syntactically and
    functionally analogous to [Backbone routes](http://backbonejs.org/#Router-routes) so `urlExp`s may contain
    parameter parts, `:param`, which match a single URL component between slashes; and splat parts `*splat`, which can
    match any number of URL components. The values captured by params and splats will be passed as parameters to the
    given handler method. The `urlExp` can also be a raw regular expression, in which case all values captured by
    reg-exp capturing groups will be passed as parameters to the given handler method.
* `httpMethod`: The sync method, as defined in the context of HTTP (POST, GET, PUT, DELETE), that should trigger the
    route's handler (both the URL and the method should match for the handler to be invoked). Note that when
    `Backbone.emulateHTTP` is set to true, 'create', 'update' and 'delete' are all mapped to POST. This may be set to
    '*' or any falsy value in order for the route's handler to be invoked when `urlExp` matches the Model's (or
    Collection's) URL _regardless_ of method. (In this case, the handler's `context` parameter may be queried for the
    method that is currently being handled.)
* `handler`: The handler to be invoked when both route's URL and route's method match. The handler's signature should be
    
    `function (context, [param1, [param2, ...]])`
    
    where context contains properties `data`, `httpMethod` and `route` and `param1`, `param2`, ... are parameters
    deduced from matching the `urlExp` to the Model (or Collection) URL. Specifically:
    * `context.data`: Attributes of the Model (or Collection) being proccessed. Valid only on 'create' (POST) or
    'update' (PUT).
    * `context.httpMethod`: The HTTP Method (POST, GET, PUT, DELETE) that is currently being handled by the handler.
    * `context.route`: The route that is currently being handled by the handler.
    
    On success, the handler should return created Model attributes after handling a POST and updated Model attributes
    after handling a PUT. Return Model attributes after handling a GET or an array of Model attributes after handling
    a GET that refers to a collection. Note that only attributes that have been changed on the server (and should be
    updated on the client) need to be included in returned hashes. Return nothing after handling a DELETE. On failure,
    return any string (presumably a custom error messsage, an HTTP status code that indicates failure, etc).

#### addRoutes
```javascript
addRoutes (routes)
```
Add multiple routes to the BFS.
* `routes`: A hash of routes to add. Hash keys should be the route names and each route (nested hash) should contain
    `urlExp`, `name` and `handler` properties. See [addRoute](https://github.com/biril/backbone-faux-server#addRoute).

#### setOnNoRoute
```javascript
setOnNoRoute (handler)
```
Set a handler to be invoked when no route is matched to the current `<model-URL, sync-method>` pair. By default the
native sync will be invoked - call this method to provide a custom handler which overrides this behaviour.
* `handler`: A handler to be invoked when no route is matched to the current `<model-URL, sync-method>`. Ommit the
    parameter to set the default native sync behaviour. The handler should have the same signature as Backbone's sync.
    That is, `function (method, model, [options])`

#### enable
```javascript
enable (shouldEnable)
```
Enable or disable the BFS. When disabled, syncing is performed by the native Backbone sync method. Handy for easily
toggling between mock / real server
* `shouldEnable`: Indicates whether the BFS should be enabled or disabled. Set to true or ommit altogether to enable, set
    to false to disable

#### getVersion
```javascript
getVersion ()
```
Get current version of BFS

#### noConflict
```javascript
noConflict ()
```
Run in no-conflict mode, setting the global `backboneFauxServer` variable to to its previous value. Returns a reference
to the BFS

License
-------

Licensed under the MIT License (LICENSE.txt).

Copyright (c) 2012 Alex Lambiris
