/*global define:false */
define(["underscore", "backbone"], function (_, Backbone) {
    "use strict";

    var views = {

            BookListItem: Backbone.View.extend({
                tagName: 'li',
                template: _.template("<a href='/#book-details/<%-id%>'><%-title%></a>"),
                initialize: function (opts) {
                    this.$el.html(this.template(opts.book.toJSON()));
                }
            }),

            BookList: Backbone.View.extend({
                tagName: 'ul',
                initialize: function (opts) {
                    this.$el.append.apply(this.$el, opts.books.map(function (book) {
                        return (new views.BookListItem({ book: book })).el;
                    }));
                }
            }),

            BookDetails: Backbone.View.extend({
                template: _.template("<div>'<%-title%>' written by <%-author%> sometime around <%-year%></div><div><a href='/#books-list'>back</a></div>"),
                initialize: function (opts) {
                    this.$el.html(this.template(opts.book.toJSON()));
                }
            }),

            Error: Backbone.View.extend({
               template: _.template("<div>Oops, an error occured: <%-error%></div>"),
                initialize: function (opts) {
                    this.$el.html(this.template({ error: opts.error }));
                }
            })
        };

    return views;
});
