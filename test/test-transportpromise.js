/*global QUnit, Backbone, fauxServer, $, test, ok, start, stop */

(function () {
    "use strict";

    var __fauxServer;

    // Helpers
    var doGenericSetup = function () {
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
            Backbone.ajax = function () { throw "Unexpected call to DOM-library ajax"; };

            __fauxServer = fauxServer.create(Backbone);
        },
        doGenericTeardown = function () {
            delete this.Book;
            delete this.Books;
            delete this.createDummyBook;

            __fauxServer.destroy();
        };

    //
    QUnit.module("transport (with $)", {
        setup: function () {
            doGenericSetup.call(this);
            Backbone.$ = $;
        },
        teardown: function () {
            doGenericTeardown.call(this);
        }
    });

    test("Sync returns a promise-transport (a thenable object)", 6, function () {
        __fauxServer.addRoutes({
            createBook: { urlExp: "library-app/books",     httpMethod: "POST" },
            readBook:   { urlExp: "library-app/books/:id", httpMethod: "GET" },
            readBooks:  { urlExp: "library-app/books",     httpMethod: "GET" },
            updateBook: { urlExp: "library-app/books/:id", httpMethod: "PUT" },
            patchBook:  { urlExp: "library-app/books/:id", httpMethod: "PATCH" },
            deleteBook: { urlExp: "library-app/books/:id", httpMethod: "DELETE" }
        });

        var book = this.createDummyBook(),
            books = new this.Books(),
            isThenable = function (q) { return q && q.then && typeof q.then === "function"; };
        book.urlRoot = "library-app/books";

        ok(isThenable(book.save()), "true when saving a Model");
        book.set({ id: "0123456789" });
        ok(isThenable(book.fetch()), "true when reading a Model");
        ok(isThenable(books.fetch()), "true when reading a Collection");
        ok(isThenable(book.save()), "true when updating a Model");
        ok(isThenable(book.save(null, { patch: true })), "true when updating a Model by patching");
        ok(isThenable(book.destroy()), "true when deleting a Model");
    });

    test("request event includes a promise-transport (a thenable object)", 6, function () {
        __fauxServer.addRoutes({
            createBook: { urlExp: "library-app/books",     httpMethod: "POST" },
            readBook:   { urlExp: "library-app/books/:id", httpMethod: "GET" },
            readBooks:  { urlExp: "library-app/books",     httpMethod: "GET" },
            updateBook: { urlExp: "library-app/books/:id", httpMethod: "PUT" },
            patchBook:  { urlExp: "library-app/books/:id", httpMethod: "PATCH" },
            deleteBook: { urlExp: "library-app/books/:id", httpMethod: "DELETE" }
        });

        var book = this.createDummyBook(),
            books = new this.Books(),
            isThenable = function (q) { return q && q.then && typeof q.then === "function"; };
        book.urlRoot = "library-app/books";

        //
        book.on("request", function (__, xhr) {
            ok(isThenable(xhr), "true when saving a model");
        });
        book.save();
        book.off("request");

        //
        book.set({ id: "0123456789" });
        book.on("request", function (__, xhr) {
            ok(isThenable(xhr), "true when reading a model");
        });
        book.fetch();
        book.off("request");

        //
        books.on("request", function (__, xhr) {
            ok(isThenable(xhr), "true when reading a Collection");
        });
        books.fetch();
        books.off("request");

        //
        book.on("request", function (__, xhr) {
            ok(isThenable(xhr), "true when updating a Model");
        });
        book.save();
        book.off("request");

        //
        book.on("request", function (__, xhr) {
            ok(isThenable(xhr), "true when updating a Model by patching");
        });
        book.save(null, { patch: true });
        book.off("request");

        //
        book.on("request", function (__, xhr) {
            ok(isThenable(xhr), "true when deleting a Model");
        });
        book.destroy();
        book.off("request");
    });

    test("Returned promise-transport is fulfilled on sync success", 12, function () {
        __fauxServer.addRoutes({
            createBook: { urlExp: "library-app/books",     httpMethod: "POST" },
            readBook:   { urlExp: "library-app/books/:id", httpMethod: "GET" },
            readBooks:  { urlExp: "library-app/books",     httpMethod: "GET" },
            updateBook: { urlExp: "library-app/books/:id", httpMethod: "PUT" },
            patchBook:  { urlExp: "library-app/books/:id", httpMethod: "PATCH" },
            deleteBook: { urlExp: "library-app/books/:id", httpMethod: "DELETE" }
        });

        var book = this.createDummyBook(),
            books = new this.Books(),
            stillWaitingOnCallbacks;
        book.urlRoot = "library-app/books";

        book.save()                     .then(function () { ok(true, "true when saving a Model"); });
        book.set({ id: "0123456789" });
        book.fetch()                    .then(function () { ok(true, "true when reading a Model"); });
        books.fetch()                   .then(function () { ok(true, "true when reading a Collection"); });
        book.save()                     .then(function () { ok(true, "true when updating a Model"); });
        book.save(null, { patch: true }).then(function () { ok(true, "true when updating a Model by patching"); });
        book.destroy()                  .then(function () { ok(true, "true when deleting a Model"); });

        book = this.createDummyBook();
        books = new this.Books();
        book.urlRoot = "library-app/books";
        __fauxServer.setLatency(100);
        stillWaitingOnCallbacks = 6;

        book.save().then(function () {
            ok(true, "true when saving a Model, with latency");
            if (!(--stillWaitingOnCallbacks)) { start(); }
        });
        book.set({ id: "0123456789" });
        book.fetch().then(function () {
            ok(true, "true when reading a Model, with latency");
            if (!(--stillWaitingOnCallbacks)) { start(); }
        });
        books.fetch().then(function () {
            ok(true, "true when reading a Collection, with latency");
            if (!(--stillWaitingOnCallbacks)) { start(); }
        });
        book.save().then(function () {
            ok(true, "true when updating a Model, with latency");
            if (!(--stillWaitingOnCallbacks)) { start(); }
        });
        book.save(null, { patch: true }).then(function () {
            ok(true, "true when updating a Model by patching, with latency");
            if (!(--stillWaitingOnCallbacks)) { start(); }
        });
        book.destroy().then(function () {
            ok(true, "true when deleting a Model, with latency");
            if (!(--stillWaitingOnCallbacks)) { start(); }
        });

        stop();
    });

    test("Returned promise-transport is rejected on sync error", 12, function () {
        __fauxServer.addRoutes({
            createBook: { urlExp: "library-app/books",     httpMethod: "POST",   handler: function () { return "Some error occured on create"; } },
            readBook:   { urlExp: "library-app/books/:id", httpMethod: "GET",    handler: function () { return "Some error occured on read model"; } },
            readBooks:  { urlExp: "library-app/books",     httpMethod: "GET",    handler: function () { return "Some error occured on read collection"; } },
            updateBook: { urlExp: "library-app/books/:id", httpMethod: "PUT",    handler: function () { return "Some error occured on update"; } },
            patchBook:  { urlExp: "library-app/books/:id", httpMethod: "PATCH",  handler: function () { return "Some error occured on update (by patching)"; } },
            deleteBook: { urlExp: "library-app/books/:id", httpMethod: "DELETE", handler: function () { return "Some error occured on delete"; } }
        });

        var book = this.createDummyBook(),
            books = new this.Books(),
            stillWaitingOnCallbacks;
        book.urlRoot = "library-app/books";

        book.save()                     .then(null, function () { ok(true, "true when saving a Model"); });
        book.set({ id: "0123456789" });
        book.fetch()                    .then(null, function () { ok(true, "true when reading a Model"); });
        books.fetch()                   .then(null, function () { ok(true, "true when reading a Collection"); });
        book.save()                     .then(null, function () { ok(true, "true when updating a Model"); });
        book.save(null, { patch: true }).then(null, function () { ok(true, "true when updating a Model by patching"); });
        book.destroy()                  .then(null, function () { ok(true, "true when deleting a Model"); });

        book = this.createDummyBook();
        books = new this.Books();
        book.urlRoot = "library-app/books";
        __fauxServer.setLatency(100);
        stillWaitingOnCallbacks = 6;

        book.save().then(null, function () {
            ok(true, "true when saving a Model, with latency");
            if (!(--stillWaitingOnCallbacks)) { start(); }
        });
        book.set({ id: "0123456789" });
        book.fetch().then(null, function () {
            ok(true, "true when reading a Model, with latency");
            if (!(--stillWaitingOnCallbacks)) { start(); }
        });
        books.fetch().then(null, function () {
            ok(true, "true when reading a Collection, with latency");
            if (!(--stillWaitingOnCallbacks)) { start(); }
        });
        book.save().then(null, function () {
            ok(true, "true when updating a Model, with latency");
            if (!(--stillWaitingOnCallbacks)) { start(); }
        });
        book.save(null, { patch: true }).then(null, function () {
            ok(true, "true when updating a Model by patching, with latency");
            if (!(--stillWaitingOnCallbacks)) { start(); }
        });
        book.destroy().then(null, function () {
            ok(true, "true when deleting a Model, with latency");
            if (!(--stillWaitingOnCallbacks)) { start(); }
        });

        stop();
    });
}());
