/*global QUnit, Backbone, fauxServer, asyncTest, start, ok, strictEqual, deepEqual, setInterval, clearInterval */

(function () {
    "use strict";

    // Helpers to wait for `pred` to become `true`and subsequently execute `thenDo`
    var atFirst = function (thenDo) { thenDo(); },
        andThenWhen = function (pred, thenDo) {
            var interval = setInterval(function () {
                if (pred()) {
                    clearInterval(interval);
                    thenDo();
                }
            }, 100);
        };

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
            Backbone.ajax = function () {
                throw "Unexpected call to DOM-library ajax";
            };
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

    ///

    asyncTest("POST-handler invoked asynchronously when saving a new Model", 1, function () {
        var isOuterScopeExecuted = false,
            book = this.createDummyBook();
        book.urlRoot = "library-app/books";

        fauxServer.addRoute("createBook", "library-app/books", "POST", function () {
            ok(isOuterScopeExecuted);
            start();
        });

        book.save(); // Create

        isOuterScopeExecuted = true;
    });

    asyncTest("POST-handler invoked with expected context when saving a new Model", 6, function () {
        var book = this.createDummyBook();
        book.urlRoot = "library-app/books";

        fauxServer.addRoute("createBook", "library-app/books", "POST", function (context) {
            ok(true, "POST-handler is called");
            ok(context, "_context_ is passed to POST-handler");
            deepEqual(context.data, book.toJSON(), "_context.data_ is set and reflects Model attributes");
            strictEqual(context.httpMethod, "POST", "_context.httpMethod_ is set to 'POST'");
            strictEqual(context.url, book.urlRoot, "_context.url_ is set to 'Model-URL'");
            strictEqual(context.httpMethodOverride, undefined, "_context.httpMethodOverride_ is not set");
            start();
        });

        book.save(); // Create
    });

    asyncTest("POST-handler sets attributes on saved Model", 2, function () {
        var createdBookId = "0123456789",
            book = this.createDummyBook();
        book.urlRoot = "library-app/books";

        fauxServer.addRoute("createBook", "library-app/books", "POST", function () {
            return { id: createdBookId, creationTime: "now" };
        });

        // Create
        book.save(null, {
            success: function () {
                strictEqual(book.id, createdBookId, "id returned by POST-handler is set on Model");
                strictEqual(book.get("creationTime"), "now", "Attributes returned by POST-handler are set on Model");
                start();
            }
        });
    });

    ///

    asyncTest("GET-handler invoked asynchronously when fetching a Model", 1, function () {
        var isOuterScopeExecuted = false,
            fetchedBookId = "0123456789",
            book = new this.Book({ id: fetchedBookId });
        book.urlRoot = "library-app/books";

        fauxServer.addRoute("readBook", "library-app/books/:id", "GET", function () {
            ok(isOuterScopeExecuted);
            start();
        });

        book.fetch(); // Read

        isOuterScopeExecuted = true;
    });

    asyncTest("GET-handler invoked with expected context when fetching a Model", 6, function () {
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
            start();
        });

        book.fetch(); // Read
    });

    asyncTest("GET-handler sets attributes on fetched Model", 1, function () {
        var fetchedBookId = "0123456789",
            book = new this.Book({ id: fetchedBookId }),
            retBookAttrs = this.createDummyBook(fetchedBookId).toJSON();

        book.urlRoot = "library-app/books";

        // We've created a book of id 0123456789 and we'll be fetching it. The retBookAttrs hash
        //  holds the supposed attributes of the book so we'll be returning these from the GET-handler

        fauxServer.addRoute("readBook", "library-app/books/:id", "GET", function () {
            return retBookAttrs;
        });

        // Read
        book.fetch({
            success: function () {
                deepEqual(book.toJSON(), retBookAttrs, "Attributes returned by GET-handler are set on Model");
                start();
            }
        });
    });

    ///

    asyncTest("GET-handler invoked asynchronously when fetching a Collection", 1, function () {
        var isOuterScopeExecuted = false,
            books = new this.Books();

        fauxServer.addRoute("readBooks", "library-app/books", "GET", function () {
            ok(isOuterScopeExecuted);
            start();
        });

        books.fetch(); // Read

        isOuterScopeExecuted = true;
    });

    asyncTest("GET-handler invoked with expected context when fetching a Collection", 5, function () {
        var books = new this.Books();

        fauxServer.addRoute("readBooks", "library-app/books", "GET", function (context) {
            ok(true, "GET-handler is called");
            ok(context, "_context_ is passed to GET-handler");
            strictEqual(context.httpMethod, "GET", "_context.httpMethod_ is set to 'GET'");
            strictEqual(context.url, books.url, "_context.url_ is set to 'Collection-URL'");
            strictEqual(context.httpMethodOverride, undefined, "_context.httpMethodOverride_ is not set");
            start();
        });

        books.fetch(); // Read
    });

    asyncTest("GET-handler sets attributes on fetched Collection", 1, function () {
        var books = new this.Books(),
            retBooksAttrs = [this.createDummyBook("one").toJSON(), this.createDummyBook("two").toJSON()];

        // We've created an empty Collection (of url 'library-app/books') and we'll be fetching it.
        //  The retBooksAttrs is an array of attributes hashes for the supposed models in the collection
        //  so we'll be returning that from the GET-handler

        fauxServer.addRoute("readBooks", "library-app/books", "GET", function () {
            return retBooksAttrs;
        });

        books.fetch({ // Read
            success: function () {
                deepEqual(books.toJSON(), retBooksAttrs, "Model attributes returned by GET-handler are set on Collection Models");
                start();
            }
        });
    });

    ///

    asyncTest("PUT-handler invoked asynchronously when updating a Model (saving a Model which has an id)", 1, function () {
        var isOuterScopeExecuted = false,
            updatedBookId = "0123456789",
            book = this.createDummyBook(updatedBookId);
        book.urlRoot = "library-app/books";

        fauxServer.addRoute("updateBook", "library-app/books/:id", "PUT", function () {
            ok(isOuterScopeExecuted);
            start();
        });

        book.save(); // Update

        isOuterScopeExecuted = true;
    });

    asyncTest("PUT-handler invoked with expected context when updating a Model (saving a Model which has an id)", 7, function () {
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
            start();
        });

        book.save(); // Update
    });

    asyncTest("PUT-handler sets attributes on saved (updated) Model", 1, function () {
        var updatedBookId = "0123456789",
            book = this.createDummyBook(updatedBookId);
        book.urlRoot = "library-app/books";

        fauxServer.addRoute("updateBook", "library-app/books/:id", "PUT", function () {
            return { modificationTime: "now" };
        });

        // Update
        book.save(null, {
            success: function () {
                strictEqual(book.get("modificationTime"), "now", "Attributes returned by PUT-handler are set on Model");
                start();
            }
        });
    });

    ///

    asyncTest("PATCH-handler invoked with expected context, on Model update with no specific given changed attributes", 7, function () {
        var updatedBookId = "0123456789",
            book = this.createDummyBook(updatedBookId);
        book.urlRoot = "library-app/books";

        // Test patching when _no_ changed attributes are given (expecting complete model data)
        fauxServer.addRoute("updateBook", "library-app/books/:id", "PATCH", function (context, bookId) {
            ok(true, "PATCH-handler is called (when patching without 'changed attributes')");
            ok(context, "_context_ is passed to PATCH-handler");
            deepEqual(context.data, book.toJSON(), "_context.data_ is set and reflects Model attributes");
            strictEqual(context.httpMethod, "PATCH", "_context.httpMethod_ is set to 'PATCH'");
            strictEqual(context.url, book.urlRoot + "/" + updatedBookId, "_context.url_ is set to 'Model-URL/id'");
            strictEqual(context.httpMethodOverride, undefined, "_context.httpMethodOverride_ is not set");
            strictEqual(bookId, updatedBookId, "_bookId_ is passed to PATCH-handler and set to id of book being updated");
            start();
        });

        book.save(null, { patch: true }); // Patching without specific changed attributes
    });

    asyncTest("PATCH-handler invoked with expected context, on Model update with some specific given changed attributes", 2, function () {
        var updatedBookId = "0123456789",
            book = this.createDummyBook(updatedBookId);
        book.urlRoot = "library-app/books";

        // Test patching with some specific changed attributes (expecting only changed attributes)
        fauxServer.addRoute("updateBook", "library-app/books/:id", "PATCH", function (context) {
            ok(true, "PATCH-handler is called (when patching with some specific 'changed attributes')");
            deepEqual(context.data, { author: "Me" }, "_context.data_ is set and equals 'changed attributes'");
            start();
        });

        book.save({ author: "Me" }, { patch: true }); // Patching with some specific changed attributes
    });

    asyncTest("PATCH-handler sets attributes on saved (updated) Model", 1, function () {
        var updatedBookId = "0123456789",
            book = this.createDummyBook(updatedBookId);
        book.urlRoot = "library-app/books";

        // Test patching when no 'changed attributes' are given (expecting complete model data)
        fauxServer.addRoute("updateBook", "library-app/books/:id", "PATCH", function () {
            return { modificationTime: "now" };
        });

        book.save(null, {  // Patching without any 'changed attributes'
            patch: true,
            success: function () {
                strictEqual(book.get("modificationTime"), "now", "Attributes returned by PATCH-handler are set on Model");
                start();
            }
        });
    });

    ///

    asyncTest("DELETE-handler invoked asynchronously when destroying a Model", 1, function () {
        var isOuterScopeExecuted = false,
            deletedBookId = "0123456789",
            book = this.createDummyBook(deletedBookId);
        book.urlRoot = "library-app/books";

        fauxServer.addRoute("deleteBook", "library-app/books/:id", "DELETE", function () {
            ok(isOuterScopeExecuted);
            start();
        });

        book.destroy(); // Delete

        isOuterScopeExecuted = true;
    });

    asyncTest("DELETE-handler invoked with expected context destroying a Model", 6, function () {
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
            start();
        });

        book.destroy(); // Delete
    });

    ///

    asyncTest("A POST-handler invoked when creating Model and emulateHTTP is true", 4, function () {
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
            start();
        });

        book.save(); // Create
    });

    asyncTest("A POST-handler (instead of PUT) invoked when updating Model and emulateHTTP is true", 5, function () {
        Backbone.emulateHTTP = true;

        var numOfHandlersInvoked = 0,
            startIfDone = function () {
                if (++numOfHandlersInvoked === 2) {
                    start();
                }
            },
            book = this.createDummyBook("0123456789");
        book.urlRoot = "library-app/books";

        fauxServer.addRoute("updateBook", "library-app/books/:id", "POST", function (context) {
            ok(true, "POST-handler is called when Backbone.emulateHTTP is true");
            ok(context, "_context_ is passed to POST-handler");
            strictEqual(context.httpMethod, "POST", "_context.httpMethod_ is set to 'POST'");
            strictEqual(context.httpMethodOverride, "PUT", "_context.httpMethodOverride_ is set to 'PUT'");
            startIfDone();
        });

        book.save(); // Update

        // Also test with emulateHTTP as an inline option during update
        Backbone.emulateHTTP = false;
        fauxServer.addRoute("updateBook", "library-app/books/:id", "POST", function () {
            ok(true, "POST-handler is also called when emulateHTTP passed as an inline option");
            startIfDone();
        });
        book.save(null, { emulateHTTP: true });
    });

    asyncTest("A POST-handler (instead of PATCH) called when updating Model and emulateHTTP is true", 5, function () {
        Backbone.emulateHTTP = true;

        var numOfHandlersInvoked = 0,
            startIfDone = function () {
                if (++numOfHandlersInvoked === 2) {
                    start();
                }
            },
            book = this.createDummyBook("0123456789");
        book.urlRoot = "library-app/books";

        fauxServer.addRoute("updateBook", "library-app/books/:id", "POST", function (context) {
            ok(true, "POST-handler is called when Backbone.emulateHTTP is true");
            ok(context, "_context_ is passed to POST-handler");
            strictEqual(context.httpMethod, "POST", "_context.httpMethod_ is set to 'POST'");
            strictEqual(context.httpMethodOverride, "PATCH", "_context.httpMethodOverride_ is set to 'PATCH'");
            startIfDone();
        });

        book.save(null, { patch: true }); // Patch

        // Also test with emulateHTTP as an inline option during patch
        Backbone.emulateHTTP = false;
        fauxServer.addRoute("updateBook", "library-app/books/:id", "POST", function () {
            ok(true, "POST-handler is also called when emulateHTTP passed as an inline option");
            startIfDone();
        });
        book.save(null, { emulateHTTP: true, patch: true });
    });

    asyncTest("A POST-handler (instead of DELETE) invoked when destroying Model and emulateHTTP is true", 5, function () {
        Backbone.emulateHTTP = true;

        var numOfHandlersInvoked = 0,
            startIfDone = function () {
                if (++numOfHandlersInvoked === 2) {
                    start();
                }
            },
            book = this.createDummyBook("0123456789");
        book.urlRoot = "library-app/books";

        fauxServer.addRoute("deleteBook", "library-app/books/:id", "POST", function (context) {
            ok(true, "POST-handler is called when Backbone.emulateHTTP is true");
            ok(context, "_context_ is passed to POST-handler");
            strictEqual(context.httpMethod, "POST", "_context.httpMethod_ is set to 'POST'");
            strictEqual(context.httpMethodOverride, "DELETE", "_context.httpMethodOverride_ is set to 'DELETE'");
            startIfDone();
        });

        book.destroy(); // Delete

        // Also test with emulateHTTP as an inline option during delete
        Backbone.emulateHTTP = false;
        fauxServer.addRoute("deleteBook", "library-app/books/:id", "POST", function () {
            ok(true, "POST-handler is also called when emulateHTTP passed as an inline option");
            startIfDone();
        });
        book.destroy({ emulateHTTP: true });
    });

    asyncTest("Synced by appropriate handlers for all methods (unnamed handlers added with addRoute)", 5, function () {
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

        book.save(null, { // create
            success: function () {
                book.fetch({ // get
                    success: function () {
                        book.save(null, { // update
                            success: function () {
                                book.save(null, { // update with patch
                                    patch: true,
                                    success: function () {
                                        book.destroy({
                                            success: function () {
                                                start();
                                            }
                                        }); // delete
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    });

    asyncTest("Synced by appropriate handlers for all methods (unnamed handlers added with get, post, etc)", 5, function () {
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

        book.save(null, { // create
            success: function () {
                book.fetch({ // get
                    success: function () {
                        book.save(null, { // update
                            success: function () {
                                book.save(null, { // update with patch
                                    patch: true,
                                    success: function () {
                                        book.destroy({  // delete
                                            success: function () {
                                                start();
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    });

    asyncTest("Syncing performed by native sync iff no route matches and no default-handler defined", 2, function () {
        var isFirstSaveDone, isSecondSaveDone,
            book = this.createDummyBook();
        book.urlRoot = "library-app/books";

        atFirst(function () {
            Backbone.ajax = function () {
                ok(true, "Native sync called when no route matches");
                isFirstSaveDone = true;
            };
            book.save();
        });
        andThenWhen(function () { return isFirstSaveDone; }, function () {
            fauxServer.addRoute("createBook", "library-app/books", "*", function () {
                ok(true, "Handler called when route matches");
                isSecondSaveDone = true;
            });
            Backbone.ajax = function () { ok(false, "Fail: Native sync called when route matches"); }; // This better not be called
            book.save();
        });
        andThenWhen(function () { return isSecondSaveDone; }, start);
    });

    asyncTest("Syncing performed by default-handler iff no route matches and default-handler defined", 2, function () {
        var isFirstSaveDone, isSecondSaveDone,
            book = this.createDummyBook();
        book.urlRoot = "library-app/books";

        atFirst(function () {
            fauxServer.setDefaultHandler(function () {
                ok(true, "Default-handler called");
                isFirstSaveDone = true;
            });
            Backbone.ajax = function () { ok(false, "Fail: Native sync called when default-handler defined"); }; // This better not be called
            book.save();
        });
        andThenWhen(function () { return isFirstSaveDone; }, function () {
            fauxServer.setDefaultHandler(); // Remove default handler
            Backbone.ajax = function () {
                ok(true, "Native sync called when no default-handler defined");
                isSecondSaveDone = true;
            };
            book.save();
        });
        andThenWhen(function () { return isSecondSaveDone; }, start);
    });

    asyncTest("Faux-server may be disabled & re-enabled", 3, function () {
        var isFirstSaveDone, isSecondSaveDone, isThirdSaveDone,
            book = this.createDummyBook();
        book.urlRoot = "library-app/books";

        atFirst(function () {
            fauxServer.addRoute("createBook", "library-app/books", "*", function () {
                ok(true, "Handler called when faux-server enabled");
                isFirstSaveDone = true;
            });
            book.save();
        });
        andThenWhen(function () { return isFirstSaveDone; }, function () {
            fauxServer.enable(false);
            fauxServer.addRoute("createBook", "library-app/books", "*", function () {
                ok(false, "Fail: Handler called when faux-server disabled");
            });
            Backbone.ajax = function () {
                ok(true, "Native sync called when faux-server disabled");
                isSecondSaveDone = true;
            };
            book.save();
        });
        andThenWhen(function () { return isSecondSaveDone; }, function () {
            fauxServer.enable();
            fauxServer.addRoute("createBook", "library-app/books", "*", function () {
                ok(true, "Handler called when faux-server re-enabled");
                isThirdSaveDone = true;
            });
            Backbone.ajax = function () { ok(false, "Fail: Native sync called when faux-server re-enabled"); };
            book.save();
        });
        andThenWhen(function () { return isThirdSaveDone; }, start);
    });
}());
