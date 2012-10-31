Backbone Faux Server
====================

A (tiny) framework for easily mocking-up a server when working with
[Backbone.js](https://github.com/documentcloud/backbone)

Define any number of routes that map `<model-URL, sync-method>` pairs to custom handlers (callbacks).
Faux-server overrides Backbone's native sync so that whenever a Model (or Collection) is synced and
its URL along with the sync method being used form a pair that matches a defined route, the route's
handler is invoked. Implement handlers in JS to test the expected behaviour of your app, work with
dummy data, support persistence using local-storage, etc. When / if you choose to move to a real server,
switching to Backbone's native, ajax-based sync is as simple as calling `backboneFauxServer.enable(false)`.

Usage
-----

Backbone-faux-server ('BFS' onwards) will be exposed as a Global, CommonJS module or AMD module depending
on the detected environment. 

* When working in a *browser environment, without a module-framework,* include backbone.faux.server.js
    after backbone.js

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

Define Backbone models and collections as you normally would:

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

Continue by defining routes on the BFS, to handle model syncing. Every route defines a mapping from a
Model(or Collection)-URL & sync-method (as defined in the context of HTTP (POST, GET, PUT, DELETE)) to some
specific handler (callback):

`<model-URL, sync-method> → handler`

For example, to handle the creation of a Book you'd have define a route that maps the pair 
`<"library-app/books", "POST">` to a handler, like so:

```javascript
backboneFauxServer.addRoute("createBook", "library-app/books", "POST", function (context) {
	// Every handler receives a 'context' parameter. Use context.data (which is a hash of Book
	//  attributes) to create the Book entry in your persistence layer. Return attributes of
	//  created Book. Something along the lines of:
	context.data.id = newId(); // Almost certainly, you'll have to create an id
	books.push(context.data); // Save to persistence layer
	return context.data;
});
```

The "createBook" parameter simply defines a name for the route. The URL parameter, "library-app/books", is
very straightforward in the preceding example but note that the URL may also be specified as a matching
expression, simillar to those used on [Backbone routes](http://backbonejs.org/#Router-routes). So
URL-expressions may contain parameter parts, `:param`, which match a single URL component between slashes;
and splat parts `*splat`, which can match any number of URL components. The values 'captured' by params and
splats will be passed as parameters to the given handler method. The URL-expression can also be a raw regular
expression, in which case all values captured by reg-exp capturing groups will be passed as parameters to the
handler method.

More routes may be defined to handle all actions (create, read, update and delete) for the preceding Book example:

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

License
-------

Licensed under the MIT License (LICENSE.txt).

Copyright (c) 2012 Alex Lambiris
