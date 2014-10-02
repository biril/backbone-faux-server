/*global QUnit, Backbone, fauxServer, test, ok, strictEqual, deepEqual */

(function () {
    "use strict";

    //
    QUnit.module("handlers", {
        setup: function () {
            this.Book = Backbone.Model.extend({
                defaults: {
                    title: "Unknown title",
                    author: "Unknown author"
                }
            });
            this.Books = Backbone.Collection.extend({
                model: this.Book,
                url: "library-app/books"
            });
            this.createDummyBook = function (id) {
                var dummyBook = new this.Book({
                        title: "The Catcher in the Rye",
                        author: "J. D. Salinger",
                        pubDate: "July 16, 1951"
                    });
                if (id) { dummyBook.set({ id: id }); }
                return dummyBook;
            };

            Backbone.emulateHTTP = false;
            Backbone.emulateJSON = false;

            Backbone.$ = undefined;
            Backbone.ajax = function () { throw "Unexpected call to DOM-library ajax"; };
        },
        teardown: function () {
            delete this.Book;
            delete this.Books;
            delete this.createDummyBook;

            fauxServer.removeRoutes();
            fauxServer.setDefaultHandler();
            fauxServer.setLatency();
        }
    });

    test("POST-handler invoked with expected context when saving a new Model", 6, function () {
        var book = this.createDummyBook();
        book.urlRoot = "library-app/books";

        fauxServer.addRoute("createBook", "library-app/books", "POST", function (context) {
            ok(true, "POST-handler is called");
            ok(context, "_context_ is passed to POST-handler");
            deepEqual(context.data, book.toJSON(), "_context.data_ is set and reflects Model attributes");
            strictEqual(context.httpMethod, "POST", "_context.httpMethod_ is set to 'POST'");
            strictEqual(context.url, book.urlRoot, "_context.url_ is set to 'Model-URL'");
            strictEqual(context.httpMethodOverride, undefined, "_context.httpMethodOverride_ is not set");
        });

        book.save(); // Create
    });

    test("POST-handler sets attributes on saved Model", 2, function () {
        var createdBookId = "0123456789",
            book = this.createDummyBook();
        book.urlRoot = "library-app/books";

        fauxServer.addRoute("createBook", "library-app/books", "POST", function () {
            return { id: createdBookId, creationTime: "now" };
        });

        book.save(); // Create

        strictEqual(book.id, createdBookId, "id returned by POST-handler is set on Model");
        strictEqual(book.get("creationTime"), "now", "Attributes returned by POST-handler are set on Model");
    });

    test("GET-handler invoked with expected context when fetching a Model", 6, function () {
        var fetchedBookId = "0123456789",
            book = new this.Book({ id: fetchedBookId });

        book.urlRoot = "library-app/books";

        fauxServer.addRoute("readBook", "library-app/books/:id", "GET", function (context, bookId) {
            ok(true, "GET-handler is called");
            ok(context, "_context_ is passed to GET-handler");
            strictEqual(context.httpMethod, "GET", "_context.httpMethod_ is set to 'GET'");
            strictEqual(context.url, book.urlRoot + "/" + fetchedBookId, "_context.url_ is set to 'Model-URL/id'");
            strictEqual(context.httpMethodOverride, undefined, "_context.httpMethodOverride_ is not set");
            strictEqual(bookId, fetchedBookId, "_bookId_ is passed to GET-handler and set to id of book being fetched");
        });

        book.fetch(); // Read
    });

    test("GET-handler sets attributes on fetched Model", 1, function () {
        var fetchedBookId = "0123456789",
            book = new this.Book({ id: fetchedBookId }),
            retBookAttrs = this.createDummyBook(fetchedBookId).toJSON();

        book.urlRoot = "library-app/books";

        // We've created a book of id 0123456789 and we'll be fetching it. The retBookAttrs hash
        //  holds the supposed attributes of the book so we'll be returning these from the GET-handler

        fauxServer.addRoute("readBook", "library-app/books/:id", "GET", function () {
            return retBookAttrs;
        });

        book.fetch(); // Read

        deepEqual(book.toJSON(), retBookAttrs, "Attributes returned by GET-handler are set on Model");
    });

    test("GET-handler invoked with expected context when fetching a Collection", 5, function () {
        var books = new this.Books();

        fauxServer.addRoute("readBooks", "library-app/books", "GET", function (context) {
            ok(true, "GET-handler is called");
            ok(context, "_context_ is passed to GET-handler");
            strictEqual(context.httpMethod, "GET", "_context.httpMethod_ is set to 'GET'");
            strictEqual(context.url, books.url, "_context.url_ is set to 'Collection-URL'");
            strictEqual(context.httpMethodOverride, undefined, "_context.httpMethodOverride_ is not set");
        });

        books.fetch(); // Read
    });

    test("GET-handler sets attributes on fetched Collection", 1, function () {
        var books = new this.Books(),
            retBooksAttrs = [this.createDummyBook("one").toJSON(), this.createDummyBook("two").toJSON()];

        // We've created an empty Collection (of url 'library-app/books') and we'll be fetching it.
        //  The retBooksAttrs is an array of attributes hashes for the supposed models in the collection
        //  so we'll be returning that from the GET-handler

        fauxServer.addRoute("readBooks", "library-app/books", "GET", function () {
            return retBooksAttrs;
        });

        books.fetch(); // Read

        deepEqual(books.toJSON(), retBooksAttrs, "Model attributes returned by GET-handler are set on Collection Models");
    });

    test("PUT-handler invoked with expected context when updating a Model (saving a Model which has an id)", 7, function () {
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
        });

        book.save(); // Update
    });

    test("PUT-handler sets attributes on saved (updated) Model", 1, function () {
        var updatedBookId = "0123456789",
            book = this.createDummyBook(updatedBookId);
        book.urlRoot = "library-app/books";

        fauxServer.addRoute("updateBook", "library-app/books/:id", "PUT", function () {
            return { modificationTime: "now" };
        });

        book.save(); // Update

        strictEqual(book.get("modificationTime"), "now", "Attributes returned by PUT-handler are set on Model");
    });

    test("PATCH-handler invoked with expected context when updating a Model (saving a Model which has an id)", 9, function () {
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
        });

        book.save(null, { patch: true }); // Patching without any 'changed attributes'

        // Test patching with some specific 'changed attributes' (expecting only changed attributes)
        fauxServer.addRoute("updateBook", "library-app/books/:id", "PATCH", function (context) {
            ok(true, "PATCH-handler is called (when patching with some specific 'changed attributes')");
            deepEqual(context.data, { author: "Me" }, "_context.data_ is set and equals 'changed attributes'");
        });

        book.save({ author: "Me" }, { patch: true }); // Patching with some specific 'changed attributes'
    });

    test("PATCH-handler sets attributes on saved (updated) Model", 1, function () {
        var updatedBookId = "0123456789",
            book = this.createDummyBook(updatedBookId);
        book.urlRoot = "library-app/books";

        // Test patching when no 'changed attributes' are given (expecting complete model data)
        fauxServer.addRoute("updateBook", "library-app/books/:id", "PATCH", function () {
            return { modificationTime: "now" };
        });

        book.save(null, { patch: true }); // Patching without any 'changed attributes'

        strictEqual(book.get("modificationTime"), "now", "Attributes returned by PATCH-handler are set on Model");
    });

    test("DELETE-handler invoked with expected context destroying a Model", 6, function () {
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

    test("Synced by appropriate handlers for all methods (unnamed handlers added with addRoute)", 5, function () {
        var book = this.createDummyBook();
        book.urlRoot = "library-app/books";

        fauxServer
        .addRoute("library-app/books", "POST", (function () {
            var isCalled = false;
            return function () {
                ok(!isCalled, "POST-handler called");
                isCalled = true;
                return { id: "0123456789" };
            };
        }()))
        .addRoute("library-app/books/:id", "GET", (function () {
            var isCalled = false;
            return function () {
                ok(!isCalled, "GET-handler called");
                isCalled = true;
            };
        }()))
        .addRoute("library-app/books/:id", "PUT", (function () {
            var isCalled = false;
            return function () {
                ok(!isCalled, "PUT-handler called");
                isCalled = true;
            };
        }()))
        .addRoute("library-app/books/:id", "PATCH", (function () {
            var isCalled = false;
            return function () {
                ok(!isCalled, "PATCH-handler called");
                isCalled = true;
            };
        }()))
        .addRoute("library-app/books/:id", "DELETE", (function () {
            var isCalled = false;
            return function () {
                ok(!isCalled, "DELETE-handler called");
                isCalled = true;
            };
        }()));

        book.save();    // create
        book.fetch();   // get
        book.save();    // update
        book.save(null, { patch: true });
        book.destroy(); // delete
    });

    test("Synced by appropriate handlers for all methods (unnamed handlers added with get, post, etc)", 5, function () {
        var book = this.createDummyBook();
        book.urlRoot = "library-app/books";

        fauxServer
        .post("library-app/books", (function () {
            var isCalled = false;
            return function () {
                ok(!isCalled, "POST-handler called");
                isCalled = true;
                return { id: "0123456789" };
            };
        }()))
        .get("library-app/books/:id", (function () {
            var isCalled = false;
            return function () {
                ok(!isCalled, "GET-handler called");
                isCalled = true;
            };
        }()))
        .put("library-app/books/:id", (function () {
            var isCalled = false;
            return function () {
                ok(!isCalled, "PUT-handler called");
                isCalled = true;
            };
        }()))
        .patch("library-app/books/:id", (function () {
            var isCalled = false;
            return function () {
                ok(!isCalled, "PATCH-handler called");
                isCalled = true;
            };
        }()))
        .del("library-app/books/:id", (function () {
            var isCalled = false;
            return function () {
                ok(!isCalled, "DELETE-handler called");
                isCalled = true;
            };
        }()));

        book.save();    // create
        book.fetch();   // get
        book.save();    // update
        book.save(null, { patch: true });
        book.destroy(); // delete
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
}());
