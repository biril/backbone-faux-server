/*jshint browser:true */
/*global define:false */
define(["underscore", "backbone-faux-server"], function (_, fauxServer) {

    "use strict";

    var booksAttrs = {
            gatsby: {
                title: 'The Great Gatsby',
                author: 'F. Scott Fitzgerald',
                year: 1925
            },
            catcher: {
                title: 'The Catcher in the Rye',
                author: 'J.D. Salinger',
                year: 1951
            },
            mockingbird: {
                title: 'To Kill a Mockingbird',
                author: 'Harper Lee',
                year: 1960
            },
            mice: {
                title: 'Of Mice and Men',
                author: 'John Steinbeck',
                year: 1937
            },
            sea: {
                title: 'The Old Man and the Sea',
                author: 'Ernest Hemingway',
                year: 1951
            },
            scarlet: {
                title: 'The Scarlet Letter',
                author: 'Nathaniel Hawthorne',
                year: 1850
            },
            five: {
                title: 'Slaughterhouse-Five',
                author: 'Kurt Vonnegut',
                year: 1969
            },
            whale: {
                title: 'Moby-Dick',
                author: 'Herman Melville',
                year: 1851
            },
            sawyer: {
                title: 'The Adventures of Tom Sawyer',
                author: 'Mark Twain',
                year: 1876
            },
            fahrenheit: {
                title: 'Fahrenheit 451',
                author: 'Ray Bradbury',
                year: 1953
            }
        };

    return {
        run: function () {
            fauxServer
            .get("books", function () {
                return _(booksAttrs).map(function (bookAttrs, bookId) {
                    return _(bookAttrs).extend({ id: bookId});
                });
            })
            .get("books/:id", function (context, bookId) {
                return booksAttrs[bookId] || ("404 - no book found of id " + bookId);
            });

            // Attach `fauxServer` to the global window object, so that the console may be used to
            //  flip between BFS routes / Backbone's native transport. (use `fauxServer.enable()` /
            //  `fauxServer.enable(false)`)
            window.fauxServer = fauxServer;
        }
    };
});
