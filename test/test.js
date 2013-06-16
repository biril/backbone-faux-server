/*global QUnit, test, ok, strictEqual, deepEqual, start, stop, Backbone, fauxServer */
(function () {
    "use strict";

    // Helper
    var dumpArray = function (array) {
        var i, l, d = [];
        for (i = 0, l = array.length; i < l; ++i) {
            d.push(array[i] === undefined ? "_undefined_" : array[i]);
        }
        return d.join(", ");
    };

    //
    QUnit.module("Basics", {
        setup: function () {
            Backbone.$ = undefined;
        },
        teardown: function () {
            // Nada
        }
    });

    test("Routes are added and removed", function () {
        var h = function () {}; // No-op

        fauxServer.addRoute("testRoute1", "", "", h);
        fauxServer.addRoutes({
            "testRoute2": { urlExp: "", httpMethod: "", handler: h },
            "testRoute3": { urlExp: "", httpMethod: "PUT", handler: h }
        });

        ok(fauxServer.getRoute("testRoute1"), "_addRoute_ adds route");
        ok(fauxServer.getRoute("testRoute2"), "_addRoutes_ adds routes");
        ok(fauxServer.getRoute("testRoute3"), "_addRoutes_ adds routes");

        fauxServer.addRoute("testRoute3", "override", "POST", h);
        strictEqual(fauxServer.getRoute("testRoute3").httpMethod, "POST", "Adding route of same name overrides previous");

        fauxServer.removeRoute("testRoute2");
        ok(!fauxServer.getRoute("testRoute2"), "_removeRoute_ removes route");

        fauxServer.removeRoutes();

        ok(!fauxServer.getRoute("testRoute1"), "_removeRoutes_ removes routes");
        ok(!fauxServer.getRoute("testRoute3"), "_removeRoutes_ removes routes");
    });

    test("URL-expressions match (regular expressions)", function () {
        var matchingRoute = null, i, numOfTests,
            tests = [{
                urlExp: /\/?this\/is\/an?\/([^\/]+)\/([^\/]+)\/?/,
                url: "is/this/is/a/regular/expression/?",
                params: ["regular", "expression"]
            }];

        for (i = 0, numOfTests = tests.length; i < numOfTests; ++i) {
            fauxServer.addRoute("testRoute", tests[i].urlExp);
            matchingRoute = fauxServer.getMatchingRoute(tests[i].url);
            ok(matchingRoute, tests[i].urlExp + " matches " + tests[i].url);
            deepEqual(matchingRoute.handlerParams, tests[i].params, "with _handerParams_: " + dumpArray(tests[i].params));
        }
    });

    test("URL-expressions match (named params & splats)", function () {
        var matchingRoute = null, i, numOfTests,
            tests = [{
                urlExp: "some/url",
                url: "some/url",
                params: []
            }, {
                urlExp: "1/2/:param1/:param2/3/4",
                url: "1/2/hello/world/3/4",
                params: ["hello", "world"]
            }, {
                urlExp: "1/2/*param",
                url: "1/2/hello/world/3/4",
                params: ["hello/world/3/4"]
            }, {
                urlExp: "1/2/*param/3/4",
                url: "1/2/hello/world/3/4",
                params: ["hello/world"]
            }, {
                urlExp: "1/2/:param1/:param2/*param",
                url: "1/2/hello/world/3/4",
                params: ["hello", "world", "3/4"]
            }, {
                urlExp: "1/2/*param1/:param2",
                url: "1/2/hello/world/3/4",
                params: ["hello/world/3", "4"]
            }, {
                urlExp: "book-:title/page-:number",
                url: "book-do androids dream of electric sheep/page-303",
                params: ["do androids dream of electric sheep", "303"]
            }, {
                urlExp: "book::title/page::number",
                url: "book:do androids dream of electric sheep/page:303",
                params: ["do androids dream of electric sheep", "303"]
            }, {
                urlExp: "search/:query/p:page",
                url: "search/obama/p2",
                params: ["obama", "2"]
            }, {
                urlExp: "file/*path",
                url: "file/nested/folder/file.txt",
                params: ["nested/folder/file.txt"]
            }];

        for (i = 0, numOfTests = tests.length; i < numOfTests; ++i) {
            fauxServer.addRoute("testRoute", tests[i].urlExp);
            matchingRoute = fauxServer.getMatchingRoute(tests[i].url);
            ok(matchingRoute, tests[i].urlExp + " matches " + tests[i].url);
            deepEqual(matchingRoute.handlerParams, tests[i].params, "with _handerParams_: " + dumpArray(tests[i].params));
        }
    });

    test("URL-expressions match (optional parts)", function () {
        var matchingRoute = null, i, numOfTests,
            tests = [{
                urlExp: "docs/:section(/:subsection)",
                url: "docs/faq",
                params: ["faq", undefined]
            }, {
                urlExp: "docs/:section(/:subsection)",
                url: "docs/faq/installing",
                params: ["faq", "installing"]
            }, {
                urlExp: "docs/:section(/:subsection)(/:subsubsection)",
                url: "docs/faq",
                params: ["faq", undefined, undefined]
            }, {
                urlExp: "docs/:section(/:subsection)(/:subsubsection)",
                url: "docs/faq/installing",
                params: ["faq", "installing", undefined]
            }, {
                urlExp: "docs/:section(/:subsection)(/:subsubsection)",
                url: "docs/faq/installing/macos",
                params: ["faq", "installing", "macos"]
            }, {
                urlExp: "docs/(maybe/):id",
                url: "docs/1",
                params: ["1"]
            }, {
                urlExp: "docs/(maybe/):id",
                url: "docs/maybe/1",
                params: ["1"]
            }, {
                urlExp: "#/##/###/(something/)else",
                url: "#/##/###/else",
                params: []
            }, {
                urlExp: "#/##/###/(something/)else",
                url: "#/##/###/something/else",
                params: []
            }, {
                urlExp: "#/##/###/(:something/)else",
                url: "#/##/###/else",
                params: [undefined]
            }, {
                urlExp: "#/##/###/(:something/)else",
                url: "#/##/###/anything/else",
                params: ["anything"]
            }, {
                urlExp: "#/##/###/(###:something/)else",
                url: "#/##/###/else",
                params: [undefined]
            }, {
                urlExp: "#/##/###/(###:something/)else",
                url: "#/##/###/###anything/else",
                params: ["anything"]
            }];

        for (i = 0, numOfTests = tests.length; i < numOfTests; ++i) {
            fauxServer.addRoute("testRoute", tests[i].urlExp);
            matchingRoute = fauxServer.getMatchingRoute(tests[i].url);
            ok(matchingRoute, tests[i].urlExp + " matches " + tests[i].url);
            deepEqual(matchingRoute.handlerParams, tests[i].params, "with _handerParams_: " + dumpArray(tests[i].params));
        }
    });

    test("Later routes take precedence over earlier routes (but not when they're a weaker match)", function () {
        var earlierHandler = function () {},
            laterHandler = function () {},
            weaklyMatchedHandler = function () {};

        fauxServer.addRoute("testRoute1", /some\/url/, "POST", earlierHandler);
        fauxServer.addRoute("testRoute2", /some\/(other\/)?url/, "POST", laterHandler);
        strictEqual(fauxServer.getMatchingRoute("some/url", "POST").handler, laterHandler, "Later route takes precendence");

        // Test a later-but-weaker route
        fauxServer.addRoute("testRoute3", /some\/(other\/)?url/, "*", weaklyMatchedHandler);
        strictEqual(fauxServer.getMatchingRoute("some/url", "POST").handler, laterHandler, "But not when a weaker match");
    });


    //
    QUnit.module("Sync", {
        setup: function () {
            var Book = Backbone.Model.extend({
                    defaults: {
                        title: "Unknown title",
                        author: "Unknown author"
                    }
                }),
                Books = Backbone.Collection.extend({
                    model: Book,
                    url: "library-app/books"
                }),
                createDummyBook = function (id) {
                    var dummyBook = new Book({
                            title: "The Catcher in the Rye",
                            author: "J. D. Salinger",
                            pubDate: "July 16, 1951"
                        });
                    if (id) { dummyBook.set({ id: id }); }
                    return dummyBook;
                };

            Backbone.$ = undefined;

            this.Book = Book;
            this.Books = Books;
            this.createDummyBook = createDummyBook;
        },
        teardown: function () {
            delete this.Book;
            delete this.Books;
            fauxServer.removeRoutes();
            fauxServer.setDefaultHandler();
            fauxServer.setLatency();
            Backbone.emulateHTTP = false;
            Backbone.ajax = function () { throw "Unexpected call to DOM-library ajax"; };
        }
    });

    test("POST-handler functions as expected when saving a new Model", 8, function () {
        var createdBookId = "0123456789",
            book = this.createDummyBook();
        book.urlRoot = "library-app/books";

        fauxServer.addRoute("createBook", "library-app/books", "POST", function (context) {
            ok(true, "POST-handler is called");
            ok(context, "_context_ is passed to POST-handler");
            deepEqual(context.data, book.toJSON(), "_context.data_ is set and reflects Model attributes");
            strictEqual(context.httpMethod, "POST", "_context.httpMethod_ is set to 'POST'");
            strictEqual(context.url, book.urlRoot, "_context.url_ is set to 'Model-URL'");
            strictEqual(context.httpMethodOverride, undefined, "_context.httpMethodOverride_ is not set");

            return { id: createdBookId, creationTime: "now" };
        });

        book.save(); // Create

        strictEqual(book.id, createdBookId, "id returned by POST-handler is set on Model");
        strictEqual(book.get("creationTime"), "now", "Attributes returned by POST-handler are set on Model");
    });

    test("GET-handler functions as expected when fetching a Model", 7, function () {
        var fetchedBookId = "0123456789",
            book = new this.Book({ id: fetchedBookId }),
            retBookAttrs = this.createDummyBook(fetchedBookId).toJSON();

        book.urlRoot = "library-app/books";

        // We've created a book of id 0123456789 and we'll be fetching it. The retBookAttrs hash
        //  holds the supposed attributes of the book so we'll be returning these from the GET-handler

        fauxServer.addRoute("readBook", "library-app/books/:id", "GET", function (context, bookId) {
            ok(true, "GET-handler is called");
            ok(context, "_context_ is passed to GET-handler");
            strictEqual(context.httpMethod, "GET", "_context.httpMethod_ is set to 'GET'");
            strictEqual(context.url, book.urlRoot + "/" + fetchedBookId, "_context.url_ is set to 'Model-URL/id'");
            strictEqual(context.httpMethodOverride, undefined, "_context.httpMethodOverride_ is not set");
            strictEqual(bookId, fetchedBookId, "_bookId_ is passed to GET-handler and set to id of book being fetched");

            return retBookAttrs;
        });

        book.fetch(); // Read

        deepEqual(book.toJSON(), retBookAttrs, "Attributes returned by GET-handler are set on Model");
    });

    test("GET-handler functions as expected when fetching a Collection", 6, function () {
        var books = new this.Books(),
            retBooksAttrs = [this.createDummyBook("one").toJSON(), this.createDummyBook("two").toJSON()];

        // We've created an empty Collection (of url 'library-app/books') and we'll be fetching it.
        //  The retBooksAttrs is an array of attributes hashes for the supposed models in the collection
        //  so we'll be returning that from the GET-handler

        fauxServer.addRoute("readBooks", "library-app/books", "GET", function (context) {
            ok(true, "GET-handler is called");
            ok(context, "_context_ is passed to GET-handler");
            strictEqual(context.httpMethod, "GET", "_context.httpMethod_ is set to 'GET'");
            strictEqual(context.url, books.url, "_context.url_ is set to 'Collection-URL'");
            strictEqual(context.httpMethodOverride, undefined, "_context.httpMethodOverride_ is not set");

            return retBooksAttrs;
        });

        books.fetch(); // Read

        deepEqual(books.toJSON(), retBooksAttrs, "Model attributes returned by GET-handler are set on Collection Models");
    });

    test("PUT-handler functions as expected when saving a Model which is not new (has an id)", 8, function () {
        var updatedBookId = "0123456789",
            book = this.createDummyBook(updatedBookId);
        book.urlRoot = "library-app/books";

        fauxServer.addRoute("updateBook", "library-app/books/:id", "PUT", function (context, bookId) {
            ok(true, "PUT-handler is called");
            ok(context, "_context_ is passed to PUT-handler");
            deepEqual(context.data, book.toJSON(), "_context.data_ is set and reflects Model attributes");
            strictEqual(context.httpMethod, "PUT", "_context.httpMethod_ is set to 'PUT'");
            strictEqual(context.url, book.urlRoot + "/" + updatedBookId, "_context.url_ is set to 'Model-URL/id'");
            strictEqual(context.httpMethodOverride, undefined, "_context.httpMethodOverride_ is not set");
            strictEqual(bookId, updatedBookId, "_bookId_ is passed to PUT-handler and set to id of book being updated");

            return { modificationTime: "now" };
        });

        book.save(); // Update

        strictEqual(book.get("modificationTime"), "now", "Attributes returned by PUT-handler are set on Model");
    });

    test("PATCH-handler functions as expected when saving a Model which is not new (has an id)", 10, function () {
        var updatedBookId = "0123456789",
            book = this.createDummyBook(updatedBookId);
        book.urlRoot = "library-app/books";

        // Test patching when no 'changed attributes' are given (expecting complete model data)
        fauxServer.addRoute("updateBook", "library-app/books/:id", "PATCH", function (context, bookId) {
            ok(true, "PATCH-handler is called (when patching without 'changed attributes')");
            ok(context, "_context_ is passed to PATCH-handler");
            deepEqual(context.data, book.toJSON(), "_context.data_ is set and reflects Model attributes");
            strictEqual(context.httpMethod, "PATCH", "_context.httpMethod_ is set to 'PATCH'");
            strictEqual(context.url, book.urlRoot + "/" + updatedBookId, "_context.url_ is set to 'Model-URL/id'");
            strictEqual(context.httpMethodOverride, undefined, "_context.httpMethodOverride_ is not set");
            strictEqual(bookId, updatedBookId, "_bookId_ is passed to PATCH-handler and set to id of book being updated");

            return { modificationTime: "now" };
        });

        book.save(null, { patch: true }); // Patching without any 'changed attributes'

        strictEqual(book.get("modificationTime"), "now", "Attributes returned by PATCH-handler are set on Model");

        // Test patching with some specific 'changed attributes' (expecting only changed attributes)
        fauxServer.addRoute("updateBook", "library-app/books/:id", "PATCH", function (context) {
            ok(true, "PATCH-handler is called (when patching witH some specific 'changed attributes')");
            deepEqual(context.data, { author: "Me" }, "_context.data_ is set and equals 'changed attributes'");
        });

        book.save({ author: "Me" }, { patch: true }); // Patching with some specific 'changed attributes'
    });

    test("DELETE-handler functions as expected when destroying a Model", 6, function () {
        var deletedBookId = "0123456789",
            book = this.createDummyBook(deletedBookId);
        book.urlRoot = "library-app/books";

        fauxServer.addRoute("deleteBook", "library-app/books/:id", "DELETE", function (context, bookId) {
            ok(true, "DELETE-handler is called");
            ok(context, "_context_ is passed to DELETE-handler");
            strictEqual(context.httpMethod, "DELETE", "_context.httpMethod_ is set to 'DELETE'");
            strictEqual(context.url, book.urlRoot + "/" + deletedBookId, "_context.url_ is set to 'Model-URL/id'");
            strictEqual(context.httpMethodOverride, undefined, "_context.httpMethodOverride_ is not set");
            strictEqual(bookId, deletedBookId, "_bookId_ is passed to DELETE-handler and set to id of book being deleted");
        });

        book.destroy(); // Delete
    });

    test("A POST-handler called when creating Model and emulateHTTP is true", 4, function () {
        Backbone.emulateHTTP = true;

        var book = this.createDummyBook();
        book.urlRoot = "library-app/books";

        // A POST-handler is called for 'create' regardless of the value of emulateHTTP.
        //  Still, we want to make sure that context.httpMethodOverride is there, and set to POST
        fauxServer.addRoute("createBook", "library-app/books", "POST", function (context) {
            ok(true, "POST-handler is called when Backbone.emulateHTTP is true");
            ok(context, "_context_ is passed to POST-handler");
            strictEqual(context.httpMethod, "POST", "_context.httpMethod_ is set to 'POST'");
            strictEqual(context.httpMethodOverride, "POST", "_context.httpMethodOverride_ is set to 'POST'");
        });

        book.save(); // Create
    });

    test("A POST-handler (instead of PUT) called when updating Model and emulateHTTP is true", 5, function () {
        Backbone.emulateHTTP = true;

        var book = this.createDummyBook("0123456789");
        book.urlRoot = "library-app/books";

        fauxServer.addRoute("updateBook", "library-app/books/:id", "POST", function (context) {
            ok(true, "POST-handler is called when Backbone.emulateHTTP is true");
            ok(context, "_context_ is passed to POST-handler");
            strictEqual(context.httpMethod, "POST", "_context.httpMethod_ is set to 'POST'");
            strictEqual(context.httpMethodOverride, "PUT", "_context.httpMethodOverride_ is set to 'PUT'");
        });

        book.save(); // Update

        // Also test with emulateHTTP as an inline option during update
        Backbone.emulateHTTP = false;
        fauxServer.addRoute("updateBook", "library-app/books/:id", "POST", function () {
            ok(true, "POST-handler is also called when emulateHTTP passed as an inline option");
        });
        book.save(null, { emulateHTTP: true });
    });

    test("A POST-handler (instead of PATCH) called when updating Model and emulateHTTP is true", 5, function () {
        Backbone.emulateHTTP = true;

        var book = this.createDummyBook("0123456789");
        book.urlRoot = "library-app/books";

        fauxServer.addRoute("updateBook", "library-app/books/:id", "POST", function (context) {
            ok(true, "POST-handler is called when Backbone.emulateHTTP is true");
            ok(context, "_context_ is passed to POST-handler");
            strictEqual(context.httpMethod, "POST", "_context.httpMethod_ is set to 'POST'");
            strictEqual(context.httpMethodOverride, "PATCH", "_context.httpMethodOverride_ is set to 'PATCH'");
        });

        book.save(null, { patch: true }); // Patch

        // Also test with emulateHTTP as an inline option during patch
        Backbone.emulateHTTP = false;
        fauxServer.addRoute("updateBook", "library-app/books/:id", "POST", function () {
            ok(true, "POST-handler is also called when emulateHTTP passed as an inline option");
        });
        book.save(null, { emulateHTTP: true, patch: true });
    });

    test("A POST-handler (instead of DELETE) called when destroying Model and emulateHTTP is true", 5, function () {
        Backbone.emulateHTTP = true;

        var book = this.createDummyBook("0123456789");
        book.urlRoot = "library-app/books";

        fauxServer.addRoute("deleteBook", "library-app/books/:id", "POST", function (context) {
            ok(true, "POST-handler is called when Backbone.emulateHTTP is true");
            ok(context, "_context_ is passed to POST-handler");
            strictEqual(context.httpMethod, "POST", "_context.httpMethod_ is set to 'POST'");
            strictEqual(context.httpMethodOverride, "DELETE", "_context.httpMethodOverride_ is set to 'DELETE'");
        });

        book.destroy(); // Delete

        // Also test with emulateHTTP as an inline option during delete
        Backbone.emulateHTTP = false;
        fauxServer.addRoute("deleteBook", "library-app/books/:id", "POST", function () {
            ok(true, "POST-handler is also called when emulateHTTP passed as an inline option");
        });
        book.destroy({ emulateHTTP: true });
    });

    test("Syncing performed by native sync iff no route matches and no default-handler defined", 2, function () {
        var book = this.createDummyBook();
        book.urlRoot = "library-app/books";

        Backbone.ajax = function () { ok(true, "Native sync called when no route matches"); };

        book.save();

        fauxServer.addRoute("createBook", "library-app/books", "*", function () {
            ok(true, "Handler called when route matches");
        });

        Backbone.ajax = function () { ok(false, "Fail: Native sync called when route matches"); };

        book.save();
    });

    test("Syncing performed by default-handler iff no route matches and default-handler defined", 2, function () {
        var book = this.createDummyBook();
        book.urlRoot = "library-app/books";

        fauxServer.setDefaultHandler(function () { // Add a default handler
            ok(true, "Default-handler called");
        });

        Backbone.ajax = function () { ok(false, "Fail: Native sync called when default-handler defined"); }; // This better not be called

        book.save();

        fauxServer.setDefaultHandler(); // Remove default handler

        Backbone.ajax = function () { ok(true, "Native sync called when no default-handler defined"); };

        book.save();
    });

    test("Syncing triggers 'request' event", 6, function () {
        fauxServer.addRoutes({
            createBook: { urlExp: "library-app/books",     httpMethod: "POST" },
            readBook:   { urlExp: "library-app/books/:id", httpMethod: "GET" },
            readBooks:  { urlExp: "library-app/books",     httpMethod: "GET" },
            updateBook: { urlExp: "library-app/books/:id", httpMethod: "PUT" },
            patchBook:  { urlExp: "library-app/books/:id", httpMethod: "PATCH" },
            deleteBook: { urlExp: "library-app/books/:id", httpMethod: "DELETE" }
        });

        var book = this.createDummyBook(),
            books = new this.Books();
        book.urlRoot = "library-app/books";

        // Expect this to be called 5 times, one for each book-Model-sync op
        book.on("request", function () { ok(true, "'request' event triggered on Model"); });

        // Expect this to be called just once, for the books-Collection-sync op
        books.on("request", function () { ok(true, "'request' event triggered on Collection"); });

        book.save();                      // Create
        book.set({ id: "0123456789" });
        book.fetch();                     // Read Model
        books.fetch();                    // Read Collection
        book.save();                      // Update
        book.save(null, { patch: true }); // Update (by patching)
        book.destroy();                   // Delete
    });


    test("Returning non-string from any handler invokes success handler & triggers 'sync' event", 12, function () {
        // Adding routes without defining a handler => implicitly defining a def do-nothing handler
        //  which returns undefined
        fauxServer.addRoutes({
            createBook: { urlExp: "library-app/books",     httpMethod: "POST" },
            readBook:   { urlExp: "library-app/books/:id", httpMethod: "GET" },
            readBooks:  { urlExp: "library-app/books",     httpMethod: "GET" },
            updateBook: { urlExp: "library-app/books/:id", httpMethod: "PUT" },
            patchBook:  { urlExp: "library-app/books/:id", httpMethod: "PATCH" },
            deleteBook: { urlExp: "library-app/books/:id", httpMethod: "DELETE" }
        });

        var book = this.createDummyBook(),
            books = new this.Books();
        book.urlRoot = "library-app/books";


        // Expect this to be called 5 times, one for each book-Model-sync op
        book.on("sync", function () { ok(true, "'sync' event triggered on Model"); });

        // Expect this to be called just once, for the books-Collection-sync op
        books.on("sync", function () { ok(true, "'sync' event triggered on Collection"); });


        book.save(null, { // Create
            success: function () {
                ok(true, "Success handler called when saving a new Model (a POST-handler)");
            }
        });

        book.set({ id: "0123456789" });

        book.fetch({ // Read Model
            success: function () {
                ok(true, "Success handler called when fetching a Model (a GET-handler)");
            }
        });

        books.fetch({ // Read Collection
            success: function () {
                ok(true, "Success handler called when fetching a Collection (a GET-handler)");
            }
        });

        book.save(null, { // Update
            success: function () {
                ok(true, "Success handler called when updating a Model (a PUT-handler)");
            }
        });

        book.save(null, { // Update (by patching)
            patch: true,
            success: function () {
                ok(true, "Success handler called when patching a Model (a PATCH-handler)");
            }
        });

        book.destroy({ // Delete
            success: function () {
                ok(true, "Success handler called when destroying a Model (a DELETE-handler)");
            }
        });
    });

    test("Returning a string from any handler invokes error handler & signals 'error' event)", 12, function () {
        fauxServer.addRoutes({
            createBook: { urlExp: "library-app/books",     httpMethod: "POST",   handler: function () { return "Some error occured on create"; } },
            readBook:   { urlExp: "library-app/books/:id", httpMethod: "GET",    handler: function () { return "Some error occured on read model"; } },
            readBooks:  { urlExp: "library-app/books",     httpMethod: "GET",    handler: function () { return "Some error occured on read collection"; } },
            updateBook: { urlExp: "library-app/books/:id", httpMethod: "PUT",    handler: function () { return "Some error occured on update"; } },
            patchBook:  { urlExp: "library-app/books/:id", httpMethod: "PATCH",  handler: function () { return "Some error occured on update (by patching)"; } },
            deleteBook: { urlExp: "library-app/books/:id", httpMethod: "DELETE", handler: function () { return "Some error occured on delete"; } }
        });

        var book = this.createDummyBook(),
            books = new this.Books();
        book.urlRoot = "library-app/books";


        // Expect this to be called 5 times, one for each book-Model-sync op
        book.on("error", function () { ok(true, "'error' event triggered on Model"); });

        // Expect this to be called just once, for the books-Collection-sync op
        books.on("error", function () { ok(true, "'error' event triggered on Collection"); }); // Expect this to be called 1 time


        book.save(null, { // Create
            error: function () {
                ok(true, "Error handler called when saving a new Model (a POST-handler)");
            }
        });

        book.set({ id: "0123456789" });

        book.fetch({ // Read Model
            error: function () {
                ok(true, "Error handler called when fetching a Model (a GET-handler)");
            }
        });

        books.fetch({ // Read Collection
            error: function () {
                ok(true, "Error handler called when fetching a Collection (a GET-handler)");
            }
        });

        book.save(null, { // Update
            error: function () {
                ok(true, "Error handler called when updating a Model (a PUT-handler)");
            }
        });

        book.save(null, { // Update (by patching)
            patch: true,
            error: function () {
                ok(true, "Error handler called when patching a Model (a PATCH-handler)");
            }
        });

        book.destroy({ // Delete
            error: function () {
                ok(true, "Error handler called when destroying a Model (a DELETE-handler)");
            }
        });
    });

    test("Faux-server may be disabled & re-enabled", 3, function () {
        var book = this.createDummyBook();
        book.urlRoot = "library-app/books";

        fauxServer.addRoute("createBook", "library-app/books", "*", function () {
            ok(true, "Handler called when faux-server enabled");
        });

        book.save();

        fauxServer.enable(false);
        fauxServer.addRoute("createBook", "library-app/books", "*", function () {
            ok(false, "Fail: Handler called when faux-server disabled");
        });
        Backbone.ajax = function () { ok(true, "Native sync called when faux-server disabled"); };

        book.save();

        fauxServer.enable();
        fauxServer.addRoute("createBook", "library-app/books", "*", function () {
            ok(true, "Handler called when faux-server re-enabled");
        });
        Backbone.ajax = function () { ok(false, "Fail: Native sync called when faux-server re-enabled"); };

        book.save();
    });

    test("Latency taken into account when syncing", 1, function () {
        var latency = 303,
            t0 = 0,
            now = function () { return +(new Date()); },
            book = this.createDummyBook();
        book.urlRoot = "library-app/books";

        fauxServer.setLatency(latency);

        fauxServer.setDefaultHandler(function () { // Add a default handler
            var dt = now() - t0;
            start();
            ok(dt >= latency, "Handler called after " + dt + " MS");
        });

        t0 = now();
        stop();
        book.fetch();
    });
}());