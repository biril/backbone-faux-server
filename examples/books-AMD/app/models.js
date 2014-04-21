/*global define:false */
define(["underscore", "backbone"], function (_, Backbone) {
    "use strict";

    var Book = Backbone.Model.extend({
            defaults: {
                title: '',
                author: '',
                year: 0
            }
        }),

        Books = Backbone.Collection.extend({
            model: Book,
            url: 'books'
        });

    return {
        Book: Book,
        Books: Books
    };
});