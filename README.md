Backbone Faux Server
====================

[![Build Status](https://travis-ci.org/biril/backbone-faux-server.png)](https://travis-ci.org/biril/backbone-faux-server)
[![NPM version](https://badge.fury.io/js/backbone-faux-server.png)](http://badge.fury.io/js/backbone-faux-server)
[![Bower version](https://badge.fury.io/bo/backbone-faux-server.png)](http://badge.fury.io/bo/backbone-faux-server)

A (tiny) framework for mocking up server-side persistence / processing for
[Backbone.js](https://github.com/documentcloud/backbone)

Define any number of routes that map `<model-URL, sync-method>` pairs to custom handlers.
Faux-server overrides (is a drop-in replacement of) Backbone's native sync so that
whenever a Model (or Collection) is synced and its URL along with the sync method form a pair that
matches a defined route, the route's handler is invoked. Implement handlers to test the expected
behaviour of your app, work with dummy data, support persistence using local-storage, etc. When &
if you choose to move to a real server, switching back to Backbone's native, ajax-based sync is as
simple as calling `fauxServer.enable(false)`.

Backbone faux server (henceforth 'BFS') grew out of the author's need to quickly flesh out Backbone
prototype apps without having to fiddle with a server, a DB, or anything else that would require
more than a JS script.
[Similar solutions](https://github.com/jashkenas/backbone/wiki/Extensions%2C-Plugins%2C-Resources#storage)
exist for this but they deviate from or obscure Backbone's opinion of Model URLs, REST and their
interdependence. Additionally, BFS doesn't implement some specific persistence scheme but only
provides hooks for your own custom processing / persistence scheme, _per_ HTTP verb, _per_ resource
(Model or Collection URL). Functionality written this way, may be ported to the server-side in a
straightforward manner.


Set up
------

To get Backbone Faux Server

* install with bower, `bower install backbone-faux-server`,
* install with npm, `npm install backbone-faux-server` or
* just include [`backbone-faux-server.js`](https://raw.github.com/biril/backbone-faux-server/master/backbone-faux-server.js)
    in your project.

BFS may be used as an exported global, a CommonJS module or an AMD module depending on the current
environment:

* In projects targetting _browsers, without an AMD module loader_, include backbone-faux-server.js
    after backbone.js:

    ```html
    ...
    <script type="text/javascript" src="backbone.js"></script>
    <script type="text/javascript" src="backbone-faux-server.js"></script>
    ...
    ```

    This will export the `fauxServer` global:

    ```javascript
    console.log("fauxServer version: " + fauxServer.getVersion());
    ```

    The project also includes a relevant
    [example app](https://github.com/biril/backbone-faux-server/tree/master/examples/books) where
    BFS is included through a `<script>` tag and treated as a global.

* `require` when working _with CommonJS_ (e.g. Node). Assuming BFS is `npm install`ed:

    ```javascript
    var fauxServer = require("backbone-faux-server");
    console.log("fauxServer version: " + fauxServer.getVersion());
    ```

    (see [the Caveats section](#caveats--wtf) for issues related to `npm install`ing Backbone along
    with BFS)

* Or list as a dependency when working _with an AMD loader_ (e.g. RequireJS):

    ```javascript
    // Your module
    define(["backbone-faux-server"], function (fauxServer) {
        console.log("fauxServer version: " + fauxServer.getVersion());
    });
    ```

    Note that the AMD definition of BFS depends on `backbone` and `underscore` so some loader
    setup will be required. For non-AMD compliant versions of Backbone (< 1.1.1) or Undescore
    (< 1.6.0), [James Burke's amdjs forks](https://github.com/amdjs) may be used instead, along
    with the necessary paths configuration

    ```javascript
    require.config({
        baseUrl: "myapp/",
        paths: {
            "underscore": "mylibs/underscore",
            "backbone": "mylibs/backbone"
        }
    });
    ```

    or you may prefer to just [shim them](http://requirejs.org/docs/api.html#config-shim).

    The project also includes a relevant
    [example app](https://github.com/biril/backbone-faux-server/tree/master/examples/books-AMD)
    where BFS is treated as an AMD module.


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

Note that the `url` property is used, as it would in any scenario involving a remote resource.

Continue by defining routes, to handle Model syncing as needed. Every route defines a mapping from
a Model(or Collection)-URL & sync-method (an HTTP verb (POST, GET, PUT, PATCH, DELETE)) to some
specific handler (callback):

`<model-URL, sync-method> → handler`

For example, to handle the creation of a Book (`Books.create(..)`), define a route that maps the
`<"library-app/books", "POST">` pair to a handler, like so:

```javascript
fauxServer.addRoute("createBook", "library-app/books", "POST", function (context) {
    // Every handler receives a 'context' parameter. Use context.data (a hash of Book
    //  attributes) to create the Book entry in your persistence layer. Return
    //  attributes of created Book. Something along the lines of:
    context.data.id = newId(); // You'll probably want to assign an id to the new book
    books.push(context.data);  // Save to persistence layer
    return context.data;
});
```

The "createBook" parameter simply defines a name for the route. The URL parameter,
"library-app/books", is pretty straightforward in the preceding example - it's the URL of the Books
Collection. Note however that the URL may (and usually will) be specified as a matching expression,
similarly to [Backbone routes](http://backbonejs.org/#Router-routes): URL-expressions may contain
parameter parts, `:param`, which match a single URL component between slashes; and splat parts
`*splat`, which can match any number of URL components. Optional parts are denoted using
parentheses. The values captured by params and splats will be passed as extra parameters to the
given handler method. Regular expressions may also be used, in which case all values captured by
reg-exp capturing groups will be passed as extra parameters to the handler method.

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
often unecessary and route names may be skipped in most declarations. (They're mandatory as keys
when passing a hash of routes to `addRoutes`.) Coming back to the earlier "createBook" example,
the route name may be skipped like so:

```javascript
fauxServer.addRoute("library-app/books", "POST", function (context) {
    // Create book ..
});
```

Moreover, faux-server exposes `get`, `post`, `put`, `del` and `patch` methods as shortcuts for
calling `addRoute` with a specific `httpMethod`. Thus, the preceding POST-route addition may be
rewritten as

```javascript
fauxServer.post("library-app/books", function (context) {
    // Create book ..
});
```

Thus, an alternative, more compact syntax for the preceding `addRoutes` example would be:

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

    }).del("library-app/books/:id", function (context, bookId) {
        // Delete stored book of id 'bookId'
    });
}
```


Testing / Contributing
----------------------

The QUnit test suite may be run in a browser (test/index.html) or on the command line, by running
`make test` or `npm test`. The command line version runs on Node and depends on
[node-qunit](https://github.com/kof/node-qunit) (`npm install` to fetch it before testing). A
[coverage report](http://biril.github.io/backbone-faux-server/lcov-report/backbone-faux-server/backbone-faux-server.js.html)
is also available.

Contributions are obviously appreciated. Please commit your changes on the `dev` branch - not
`master`. `dev` is always ahead, contains the latest state of the project and is periodically
merged back to `master` with the appropriate version bump. In lieu of a formal styleguide, take
care to maintain the existing coding style. Test your code prior to a pull request.


Reference
---------

The following list, while not exhaustive, includes all essential parts of the BFS API. The ommitted
bits are there to aid testing and fascilitate fancier stuff you probably won't ever need. Further
insight may be gained by taking a look at
[the examples](https://github.com/biril/backbone-faux-server/tree/master/examples),
[the test suite](https://github.com/biril/backbone-faux-server/tree/master/test) and - of course -
[the source](https://github.com/biril/backbone-faux-server/blob/master/backbone-faux-server.js).

### Methods

All methods return the faux-server instance and may be chained, unless otherwise noted.

#### addRoute ([name, ]urlExp[, httpMethod]&#91;, handler&#93;)

Add a route to the faux-server. Every route defines a mapping from a Model(or Collection)-URL &
sync-method (an HTTP verb (POST, GET, PUT, PATCH or DELETE)) to some specific handler (callback):

`<model-URL, sync-method> → handler`

Whenever a Model is created, read, updated or deleted, its URL and the the sync method being
used are tested against defined routes in order to find a handler for creating, reading,
updating or deleting this Model. The same applies to reading Collections: Whenever a Collection is
read, its URL (and the 'read' method) will be tested against defined routes in order to find a
handler for reading it. When a match for the `<model-URL, sync-method>` pair is not found among
defined routes, the native sync is invoked (this behaviour may be overriden - see
`fauxServer.setDefaultHandler`). Later routes take precedence over earlier routes so in
configurations where multiple routes match, the one most recently defined will be used.

* `name`: Name of this route. Optional. A named route may be queried and / or removed by its name
    (see `getRoute` / `removeRoute`) and will replace an earlier defined route of same name.
* `urlExp`: An expression against which, Model(or Collection)-URLs will be tested. This is
    syntactically and functionally analogous to
    [Backbone routes](http://backbonejs.org/#Router-routes): `urlExp`s may contain parameter parts,
    `:param`, which match a single URL component between slashes; and splat parts `*splat`, which
    can match any number of URL components. Parentheses may also be used to denote optional parts.
    The values captured by params and splats will be passed as parameters to the given handler
    method. Regular expressions may also be used, in which case all values captured by
    reg-exp capturing groups will be passed as parameters to the given handler method. Note that
    `:param`s are required to begin with a letter or underscore - those that don't are treated as
    a fixed part of the URL. The expression `http://example.com:8080` contains _no_ `:param` parts.
* `httpMethod`: The sync method, (an HTTP verb (POST, GET, PUT, PATCH or DELETE)), that should
    trigger the route's handler. Both the URL-expression and the method should match for the
    handler to be invoked. `httpMethod` may also be set to '*' or ommitted to create a
    match-all-methods handler: One that will be invoked whenever `urlExp` matches the model's (or
    collection's) URL _regardless_ of method. In the scope of a match-all-methods handler, the HTTP
    method currently being handled may be acquired by querying the `context` parameter for
    `context.httpMethod`. Note that when `Backbone.emulateHTTP` is set to true or `emulateHTTP` is
    passed as an inline option during sync, 'create', 'update', 'patch' and 'delete' will all be
    mapped to POST. In this case `context.httpMethod` will be set to POST and the true HTTP method
    being handled may be acquired by querying `context.httpMethodOverride`.
* `handler`: The handler to be invoked when both route's URL-expression and route's method match. A
    do-nothing handler will be used if one is not provided. The handler's expected signature is

    `function (context, [param1, [param2, ...]])`

    where `context` contains properties `data`, `httpMethod`, `httpMethodOverride`, `route` and
    `param1`, `param2`, ... are parameters derived by matching the `urlExp` to the Model
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

#### &lt;httpMethod&gt; ([name, ]urlExp[, handler])

`get`, `post`, `put`, `del` and `patch` methods which act as shortcuts for calling `addRoute`
with a specific `httpMethod`. See `addRoute` above for parameter descriptions and further details.

#### addRoutes (routes)

Add multiple routes to the faux-server.

* `routes`: A hash or array of routes to add. Each route is itself a hash with `name`, `urlExp`,
    `httpMethod` and `handler` attributes. As is the case with `addRoute`, the only attribute whose
    presence is mandatory is `urlExp`. Note that when passing a hash of routes, its keys are
    treated as route names and the `name` attribute should be ommitted.

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

#### setDefaultHandler ([handler])

Set a handler to be invoked when no route is matched to the current `<model-URL, sync-method>`
pair. This will override the default behaviour of invoking the native sync.

* `handler`: A handler to be invoked when no route is found that matches a given
    `<model-URL, sync-method>` pair. Ommit the parameter to reset to the default behaviour. See
    `addRoute` for handler's signature and semantics. Note that a default-handler isn't part of a
    route, so the `context.route` parameter will not be valid.

#### setLatency (min[, max])

Set server's emulated latency (zero by default)

* `min`: Server's emulated latency in ms. Interpreted as the minimum of a range when a `max` value
    is provided. Ommitting will set to 0.
* `max`: Maximum server latency in ms. Specifying this will cause syncing to occur with a random
    latency in the [min, max] range.

#### setTransportFactory (transportFactory)

Set server's transport factory

* `transportFactory`: A factory function with signature

    `function (syncOptions, syncContext)`

    invoked _per sync_ (with sync's relevant options and context) to create a new transport.

Transports are deferred-like objects implementing a `resolve` / `reject` / `promise` interface. A
successful sync will invoke `transport.resolve` while a failed one will invoke `transport.reject`.
The sync method will always return `transport.promise()`.

See [the Tranport section](#transports) for further details.

#### enable ([shouldEnable])

Enable or disable the faux-server. When disabled, syncing is performed by the native Backbone sync
method. Handy for easily toggling between mock / real server.

* `shouldEnable`: Indicates whether to enable or disable. Set to true or ommit to enable the
    faux-server, set to false to disable.

#### getVersion ()

Get the faux-server version

#### noConflict ()

Run in no-conflict mode, setting the global `fauxServer` variable to to its previous value. Only
useful when working in a browser environment without a module-loader as this is the only case
where `fauxServer` is exposed globally. Returns a reference to the faux-server.


Transports
----------

Backbone is built on minimum assumptions regarding the communication layer and/or persistence
strategy applications will make use of. Although, more often that not, this is jQuery's `ajax`
function, you may choose to [use a modified ajax function](http://backbonejs.org/#Sync-ajax) or
[bypass the sync method](http://backbonejs.org/#Sync) altogether (this is in fact how BFS works).
Backbone will, generally speaking, abstract this away so that applications may be written on top of
a normalized layer.

Having said that, specific choices in the method of communication / persistence can affect how
application code is written in certain ways. As an example consider the case of chaining a `then`
call after sync:

```javascript
aModel.save().then(function () {
    // .. continue after successfully saving the model ..
});
```

This works under the assumption that Backbone's `sync` returns a
[promise](http://promises-aplus.github.io/promises-spec), which is the case when
the underlying ajax function - the communication layer - does so. Which holds true specifically
for [jQuery's `ajax`](http://api.jquery.com/jQuery.ajax) but not necessarily for other
communication layers and/or persistence strategies.

As BFS is itself such a strategy, one that completely bypasses the communication layer, there may
be cases where application code assumes and makes use of functionality which will not be available
when the app is run on a faux server. A common problematic example is implementations which rely on
the creation of `jqXHR` objects when Models are synced: BFS `sync` will attempt to return a jQuery
promise when that's feasible (when `Backbone.$` is found to be the jQuery object at runtime) or
just return undefined otherwise - never will it return an actual `jqXHR`. You can compensate for
that by implementing a custom 'transport'.

Transports are a BFS abstraction intended as a means of mocking the aspects (the API) of an
application-specific communication layer. It may be helpful to think of the `jqXHR` object as a
concrete example of a transport - or, to be precise, a transport's promise.

Transports are deferred-like objects implementing a `resolve` / `reject` / `promise` interface. BFS
will instantiate a new transport on every sync, and return its promise by invoking
`transport.promise`. When the sync is successful, i.e. when the relevant handler returns a
non-string value, `transport.resolve` will be called with the handler's returned result. When the
sync fails, i.e. when the relevant handler returns a string result, `transport.reject` will be
called with the handler's result. It is the transport's responsibility to subsequently call the
given success or error callbacks.

To define a custom transport, to be instantiated on every invocation of `sync`, call
[`fauxServer.setTransportFactory`](#settransportfactory-transportfactory) providing a
transport-factory function. Implement your custom transport-factory function so that

* it instantiates and returns a `transport` object with `resolve` / `reject` and `promise` methods.
   A deferred object is an obvious choice for this (see
   [jQuery's $.Deferred](http://api.jquery.com/category/deferred-object) or
   [Q's Q.defer](https://github.com/kriskowal/q#using-deferreds)) but any object with the
   aforementioned methods is adequate.
* `transport.resolve` invokes the sync's success callback, `options.success`.
* `transport.reject` invokes the sync's error callback, `options.error`.
* `transport.promise` returns an object featuring all properties and methods your implementation
   requires on the object returned when `sync`ing (`fetch`ing, `save`ing, etc). Think of it as a
   mocked `jqXHR`.

As a reference, this is (a somewhat simplified version of) the default BFS transport-factory:

```javascript
// Transport-factory function, invoked _per sync_ (with the relevant options / context)
//  to instantiate a new transport
function (syncOptions, syncContext) {
    // If an underlying ajax lib is defined for Backbone and it features a
    //  Deferred method (which is precisely the case when Backbone.$ = jQuery)
    //  then create and return a deferred object as transport
    if (Backbone.$ && Backbone.$.Deferred) {
        var deferred = Backbone.$.Deferred();
        deferred.then(syncOptions.success, syncOptions.error);
        return deferred;
    }

    // Otherwise create a poor-man's deferred - an object that implements a
    //  promise/resolve/reject interface without actual promise semantics:
    //  resolve and reject just delegate to success and error callbacks while
    //  promise() returns undefined. This is a good enough transport
    return {
        promise: function () {},
        resolve: function (value) { syncOptions.success(value); },
        reject: function (reason) { syncOptions.error(reason); }
    };
}
```


Caveats / WTF
-------------

* When developing for Node, using npm for dependency management, be sure to `npm install backbone`
    _before_ `npm install`ing BFS. The opposite will cause BFS to fail due to Node's
    [module caching caveats](http://nodejs.org/api/modules.html#modules_module_caching_caveats).
* `npm install`ing with the `--dev` switch will fail due to node-qunit
    [quirk](https://github.com/kof/node-qunit/issues/41). As a solution, `npm install qunit` before
    installing other devDependencies.
* The current version of BFS is tested against BB v1.1.2. It's generally compatible with 1.x
    revisions but _not_ 0.9.x revisions.
    ([BFS v0.7.0](https://github.com/biril/backbone-faux-server/releases/tag/v0.7.0) is the last
    known good version for BB &lt;= v0.9.10).


License
-------

Licensed and freely distributed under the MIT License (LICENSE.txt).

Copyright (c) 2012-2014 Alex Lambiris
