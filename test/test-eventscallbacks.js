/*global QUnit, Backbone, fauxServer, test, ok, strictEqual, deepEqual */

(function () {
    "use strict";

    //
    QUnit.module("events & callbacks", {
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


    test("Returning non-string from any handler invokes success callback & triggers 'sync' event", 12, function () {
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

    test("Model.fetch() success callback is invoked with (model, response, options) [GET-handler]", 3, function () {
        var book = this.createDummyBook("0123456789"),
            readRouteResponse = { someExtraAttribute: "extraAttribute" };
        book.urlRoot = "library-app/books";

        // Reading the model
        fauxServer.addRoute("readBook", "library-app/books/:id", "GET", function () {
            return readRouteResponse;
        });
        book.fetch({
            someOption: true,
            success: function (model, response, options) {
                strictEqual(model, book, "success callback invoked with _model_");
                deepEqual(response, readRouteResponse, "success callback invoked with _response_");
                ok(options.someOption, "success callback invoked with _options_");
            }
        });
    });

    test("Collection.fetch() success callback is invoked with (collection, response, options) [GET-handler]", 3, function () {
        var books = new this.Books(),
            readRouteResponse = [{ someExtraAttribute: "extraAttribute" }];

        // Reading the collection
        fauxServer.addRoute("readBooks", "library-app/books", "GET", function () {
            return readRouteResponse;
        });
        books.fetch({
            someOption: true,
            success: function (collection, response, options) {
                strictEqual(collection, books, "success callback invoked with _collection_");
                deepEqual(response, readRouteResponse, "success callback invoked with _response_");
                ok(options.someOption, "success callback invoked with _options_");
            }
        });
    });

    test("Model.save() success callback is invoked with (model, response, options) after create [POST-handler]", 3, function () {
        var book = this.createDummyBook(),
            createRouteResponse = { id: "0123456789", creationTime: "now", updateTime: "now" };
        book.urlRoot = "library-app/books";

        // Creating the model
        fauxServer.addRoute("createBook", "library-app/books", "POST", function () {
            return createRouteResponse;
        });
        book.save(null, {
            someOption: true,
            success: function (model, response, options) {
                strictEqual(model, book, "success callback invoked with _model_");
                deepEqual(response, createRouteResponse, "success callback invoked with _response_");
                ok(options.someOption, "success callback invoked with _options_");
            }
        });
    });

    test("Model.save() success callback is invoked with (model, response, options) after update [PUT-handler]", 3, function () {
        var book = this.createDummyBook("0123456789"),
            updateRouteResponse = { updateTime: "now" };
        book.urlRoot = "library-app/books";

        // Updating the model
        fauxServer.addRoute("updateBook", "library-app/books/:id", "PUT", function () {
            return updateRouteResponse;
        });
        book.save(null, {
            someOption: true,
            success: function (model, response, options) {
                strictEqual(model, book, "success callback invoked with _model_");
                deepEqual(response, updateRouteResponse, "success callback invoked with _response_");
                ok(options.someOption, "success callback invoked with _options_");
            }
        });
    });

    test("Model.save() success callback is invoked with (model, response, options) after update [PATCH-handler]", 3, function () {
        var book = this.createDummyBook("0123456789"),
            updateRouteResponse = { updateTime: "now" };
        book.urlRoot = "library-app/books";

        // Updating the model (by patching)
        fauxServer.addRoute("updateBook", "library-app/books/:id", "PATCH", function () {
            return updateRouteResponse;
        });
        book.save(null, {
            patch: true,
            someOption: true,
            success: function (model, response, options) {
                strictEqual(model, book, "success callback invoked with _model_");
                deepEqual(response, updateRouteResponse, "success callback invoked with _response_");
                ok(options.someOption, "success callback invoked with _options_");
            }
        });
    });

    test("Model.destroy() success callback is invoked with (model, response, options) [DELETE-handler]", 3, function () {
        var book = this.createDummyBook("0123456789"),
            deleteRouteResponse = { someAttribute: "attribute" };
        book.urlRoot = "library-app/books";

        // Deleting the model
        fauxServer.addRoute("readBook", "library-app/books/:id", "DELETE", function () {
            return deleteRouteResponse;
        });
        book.destroy({
            someOption: true,
            success: function (model, response, options) {
                strictEqual(model, book, "success callback invoked with _model_");
                deepEqual(response, deleteRouteResponse, "success callback invoked with _response_");
                ok(options.someOption, "success callback invoked with _options_");
            }
        });
    });

    test("Returning a string from any handler invokes error callback & signals 'error' event)", 12, function () {
        fauxServer.addRoutes({
            createBook: { urlExp: "library-app/books",     httpMethod: "POST",   handler: function () { return "Error on create"; } },
            readBook:   { urlExp: "library-app/books/:id", httpMethod: "GET",    handler: function () { return "Error on read model"; } },
            readBooks:  { urlExp: "library-app/books",     httpMethod: "GET",    handler: function () { return "Error on read collection"; } },
            updateBook: { urlExp: "library-app/books/:id", httpMethod: "PUT",    handler: function () { return "Error on update"; } },
            patchBook:  { urlExp: "library-app/books/:id", httpMethod: "PATCH",  handler: function () { return "Error on update (by patching)"; } },
            deleteBook: { urlExp: "library-app/books/:id", httpMethod: "DELETE", handler: function () { return "Error on delete"; } }
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

    test("Model.fetch() error callback is invoked with (model, response, options) [GET-handler]", 3, function () {
        var book = this.createDummyBook("0123456789"),
            readRouteResponse = "Error on read";
        book.urlRoot = "library-app/books";

        // Reading the model
        fauxServer.addRoute("readBook", "library-app/books/:id", "GET", function () {
            return readRouteResponse;
        });
        book.fetch({
            someOption: true,
            error: function (model, response, options) {
                strictEqual(model, book, "error callback invoked with _model_");
                strictEqual(response, readRouteResponse, "error callback invoked with _response_");
                ok(options.someOption, "error callback invoked with _options_");
            }
        });
    });

    test("Collection.fetch() error callback is invoked with (collection, response, options) [GET-handler]", 3, function () {
        var books = new this.Books(),
            readRouteResponse = "Error on read";

        // Reading the collection
        fauxServer.addRoute("readBooks", "library-app/books", "GET", function () {
            return readRouteResponse;
        });
        books.fetch({
            someOption: true,
            error: function (collection, response, options) {
                strictEqual(collection, books, "success callback invoked with _collection_");
                strictEqual(response, readRouteResponse, "error callback invoked with _response_");
                ok(options.someOption, "success callback invoked with _options_");
            }
        });
    });

    test("Model.save() error callback is invoked with (model, response, options) after create [POST-handler]", 3, function () {
        var book = this.createDummyBook(),
            createRouteResponse = "Error on create";
        book.urlRoot = "library-app/books";

        // Creating the model
        fauxServer.addRoute("createBook", "library-app/books", "POST", function () {
            return createRouteResponse;
        });
        book.save(null, {
            someOption: true,
            error: function (model, response, options) {
                strictEqual(model, book, "error callback invoked with _model_");
                strictEqual(response, createRouteResponse, "error callback invoked with _response_");
                ok(options.someOption, "error callback invoked with _options_");
            }
        });
    });

    test("Model.save() error callback is invoked with (model, response, options) after create [PUT-handler]", 3, function () {
        var book = this.createDummyBook("0123456789"),
            updateRouteResponse = "Error on update";
        book.urlRoot = "library-app/books";

        // Creating the model
        fauxServer.addRoute("createBook", "library-app/books/:id", "PUT", function () {
            return updateRouteResponse;
        });
        book.save(null, {
            someOption: true,
            error: function (model, response, options) {
                strictEqual(model, book, "error callback invoked with _model_");
                strictEqual(response, updateRouteResponse, "error callback invoked with _response_");
                ok(options.someOption, "error callback invoked with _options_");
            }
        });
    });

    test("Model.destroy() error callback is invoked with (model, response, options) after create [DELETE-handler]", 3, function () {
        var book = this.createDummyBook("0123456789"),
            deleteRouteResponse = "Error on delete";
        book.urlRoot = "library-app/books";

        // Creating the model
        fauxServer.addRoute("deleteBook", "library-app/books/:id", "DELETE", function () {
            return deleteRouteResponse;
        });
        book.destroy({
            someOption: true,
            error: function (model, response, options) {
                strictEqual(model, book, "error callback invoked with _model_");
                strictEqual(response, deleteRouteResponse, "error callback invoked with _response_");
                ok(options.someOption, "error callback invoked with _options_");
            }
        });
    });
}());
