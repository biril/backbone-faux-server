/*global define:false */
define(["jquery", "backbone", "models", "views"], function ($, Backbone, models, views) {

    "use strict";

    var currentView, setCurrentView, router;

    // An initial dummy-view
    currentView = { remove: function () {} };

    setCurrentView = function (view) {
        currentView.remove();
        currentView = view;
        $('body').append(currentView.el);
    };

    router = new (Backbone.Router.extend({

        routes: {
            "books-list":       "showBooksList",
            "book-details/:id": "showBookDetails"
        },

        showBooksList: function () {
            var books = new models.Books();
            books.fetch({
                success: function () {
                    setCurrentView(new views.BookList({ books: books }));
                }
            });
        },

        showBookDetails: function (bookId) {
            var book = new models.Book({ id: bookId });
            book.urlRoot = 'books';
            book.fetch({
                success: function () {
                    setCurrentView(new views.BookDetails({ book: book }));
                },
                error: function (model, error) {
                    setCurrentView(new views.Error({ error: error }));
                }
            });
        }

    }))();

    return {
        run: function () {
            if(!Backbone.history.start()) {
                router.navigate('books-list', { trigger: true });
            }
        }
    };
});
