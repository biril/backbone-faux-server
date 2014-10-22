/*global QUnit, Backbone, fauxServer, test, asyncTest, ok, strictEqual, deepEqual, start, stop, throws */

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

    test("Throws when Model / Collection has no URL", 5, function () {
        var model = new Backbone.Model(),
            collection = new Backbone.Collection();

        fauxServer.setDefaultHandler(function () {
            ok(false, "Fail: default handler invoked although model has no URL");
        });

        throws(function () { model.fetch();  }, "throws for model read");
        throws(function () { model.save();   }, "throws for model create");
        throws(function () { model.delete(); }, "throws for model delete");

        model.set({ id: 1 });

        throws(function () { model.save();   }, "throws for model update");

        //

        throws (function () { collection.fetch(); }, "throws for collection read");
    });

    asyncTest("A url property in options overrides Model's / Collection's URL", 5, function () {
        var numOfTimesHandlerInvoked = 0,
            book = new this.Book(),
            books = new this.Books();
        books.add(book);

        fauxServer.addRoute("theRoute", "some/overriden/url", "*", function (context) {
            ok(true, "Handler invoked for model sync with " + context.httpMethod + " verb");
            if (++numOfTimesHandlerInvoked === 5) { start(); }
        });

        book.fetch({ url: "some/overriden/url" });
        book.save(null, { url: "some/overriden/url" });
        book.set({ id: 1 });
        book.save(null, { url: "some/overriden/url" });
        book.destroy({ url: "some/overriden/url" });

        fauxServer.addRoute("theRoute", "some/other/url", "*", function (context) {
            ok(true, "Handler invoked for collection sync with " + context.httpMethod + " verb");
            if (++numOfTimesHandlerInvoked === 5) { start(); }
        });

        //
        books.fetch({ url: "some/other/url" });
    });

    asyncTest("A data property in options overrides Model's data", 3, function () {
        var numOfTimesHandlerInvoked = 0,
            book = new this.Book(),
            books = new this.Books();
        books.add(book);

        fauxServer.setDefaultHandler(function (context) {
            deepEqual(context.data, { some: 1, data: "2" },
                "Handler invoked with expected data for " + context.httpMethod);
            if(++numOfTimesHandlerInvoked === 3) { start(); }
        });

        book.save(null, { data: { some: 1, data: "2" } });
        book.set({ id: 1 });
        book.save(null, { data: { some: 1, data: "2" } });
        book.save(null, { data: { some: 1, data: "2" }, patch: true });
    });

    asyncTest("May be invoked directly, without options", 5, function () {
        var numOfTimesHandlerInvoked = 0,
            book = new this.Book(),
            books = new this.Books();
        books.add(book);

        fauxServer.setDefaultHandler(function (context) {
            ok(true, "Handler invoked for model sync with " + context.httpMethod + " verb");
            if (++numOfTimesHandlerInvoked === 5) { start(); }
        });

        book.sync("read", book);
        book.sync("create", book);
        book.set({ id: 1 });
        book.sync("update", book);
        book.sync("delete", book);

        fauxServer.setDefaultHandler(function (context) {
            ok(true, "Handler invoked for collection sync with " + context.httpMethod + " verb");
            if (++numOfTimesHandlerInvoked === 5) { start(); }
        });

        books.sync("read", book);
    });

    asyncTest("Options default to backbone's emulateHTTP", 6, function () {

        Backbone.emulateHTTP = true;

        var numOfTimesHandlerInvoked = 0,
            book = this.createDummyBook();
        book.urlRoot = "library-app/books";

        fauxServer.post("handler", "library-app/books", function (context) {
            strictEqual(context.httpMethod, "POST", "during invocation of create-handler: httpMethod is POST");
            strictEqual(context.httpMethodOverride, "POST", "during invocation of create-handler: httpMethodOverride is POST");
            if (++numOfTimesHandlerInvoked === 3) { start(); }
        });
        book.sync("create", book);

        fauxServer.post("handler", "library-app/books/:id", function (context) {
            strictEqual(context.httpMethod, "POST", "during invocation of update-handler: httpMethod is POST");
            strictEqual(context.httpMethodOverride, "PUT", "during invocation of update-handler: httpMethodOverride is PUT");
            if (++numOfTimesHandlerInvoked === 3) { start(); }
        });
        book.set({ id: 1 });
        book.sync("update", book);

        fauxServer.post("handler", "library-app/books/:id", function (context) {
            strictEqual(context.httpMethod, "POST", "during invocation of delete-handler: httpMethod is POST");
            strictEqual(context.httpMethodOverride, "DELETE", "during invocation of delete-handler: httpMethodOverride is DELETE");
            if (++numOfTimesHandlerInvoked === 3) { start(); }
        });
        book.sync("delete", book);
    });

    asyncTest("Latency (abs. value) taken into account", 1, function () {
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

        book.fetch(); // sync
    });

    asyncTest("Latency (random value within range) taken into account", 1, function () {
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

        book.fetch(); // sync
    });

}());
