/*global QUnit, Backbone, fauxServer, test, ok, strictEqual, start, stop, throws */

(function () {
    "use strict";

    //
    QUnit.module("sync", {
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

    test("sync throws when model has no URL", 5, function () {
        var model = new Backbone.Model(),
            collection = new Backbone.Collection();

        fauxServer.setDefaultHandler(function () {
            ok(false, "Fail: default handler invoked although model has no URL");
        });

        throws(function () { model.fetch();  }, "throws for read");
        throws(function () { model.save();   }, "throws for create");
        throws(function () { model.delete(); }, "throws for delete");

        model.set({ id: 1 });

        throws(function () { model.save();   }, "throws for update");

        //

        throws (function () { collection.fetch(); }, "throws for collection read");
    });

    test("sync may be invoked directly, without options", 4, function () {
        var book = this.createDummyBook();
        book.urlRoot = "library-app/books";

        fauxServer.setDefaultHandler(function (context) {
            ok(true, "Handler invoked for " + context.httpMethod);
        });

        book.sync("read", book);
        book.sync("create", book);
        book.set({ id: 1 });
        book.sync("update", book);
        book.sync("delete", book);
    });

    test("sync options default to backbone's emulateHTTP", 6, function () {

        Backbone.emulateHTTP = true;

        var book = this.createDummyBook();
        book.urlRoot = "library-app/books";

        fauxServer.post("handler", "library-app/books", function (context) {
            strictEqual(context.httpMethod, "POST");
            strictEqual(context.httpMethodOverride, "POST");
        });
        book.sync("create", book);

        fauxServer.post("handler", "library-app/books/:id", function (context) {
            strictEqual(context.httpMethod, "POST");
            strictEqual(context.httpMethodOverride, "PUT");
        });
        book.set({ id: 1 });
        book.sync("update", book);

        fauxServer.post("handler", "library-app/books/:id", function (context) {
            strictEqual(context.httpMethod, "POST");
            strictEqual(context.httpMethodOverride, "DELETE");
        });
        book.sync("delete", book);
    });

    test("Latency (abs. value) taken into account when syncing", 1, function () {
        var latency = 303,
            t0 = 0,
            now = function () { return +(new Date()); },
            book = this.createDummyBook();
        book.urlRoot = "library-app/books";

        fauxServer
        .setLatency(latency)
        .setDefaultHandler(function () {
            var dt = now() - t0;
            start();
            ok(dt >= latency, "Handler called after (" + latency + " <=) " + dt + " ms");
        });

        t0 = now();
        stop();
        book.fetch(); // sync
    });

    test("Latency (random value within range) taken into account when syncing", 1, function () {
        var latencyMin = 101,
            latencyMax = 303,
            t0 = 0,
            now = function () { return +(new Date()); },
            book = this.createDummyBook();
        book.urlRoot = "library-app/books";

        fauxServer
        .setLatency(latencyMin, latencyMax)
        .setDefaultHandler(function () {
            var dt = now() - t0;
            start();
            ok(dt >= latencyMin && dt <= latencyMax,
                "Handler called after ("+ latencyMin + " <=) " + dt + " (<= " + latencyMax + ") ms");
        });

        t0 = now();
        stop();
        book.fetch(); // sync
    });
}());
