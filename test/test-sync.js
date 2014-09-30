/*global QUnit, Backbone, fauxServer, test, ok, start, stop */

(function () {
    "use strict";

    //
    QUnit.module("sync", {
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
