/*global $, _, Backbone, fauxServer:true */
$(function () {

    "use strict";

    var Book,
        Books,
        BookListItemView,
        BookListView,
        BookDetailsView,
        ErrorView,
        currentView,
        setCurrentView,
        router;

    currentView = { remove: function () {} };

    setCurrentView = function (view) {
        currentView.remove();
        currentView = view;
        $('body').append(currentView.el);
    };

    Book = Backbone.Model.extend({
        defaults: {
            title: '',
            author: '',
            year: 0
        }
    });

    Books = Backbone.Collection.extend({
        model: Book,
        url: 'books'
    });

    BookListItemView = Backbone.View.extend({
        tagName: 'li',
        template: _.template("<a href='/#book-details/<%-id%>'><%-title%></a>"),
        initialize: function (opts) {
            this.$el.html(this.template(opts.book.toJSON()));
        }
    });

    BookListView = Backbone.View.extend({
        tagName: 'ul',
        initialize: function (opts) {
            this.$el.append.apply(this.$el, opts.books.map(function (book) {
                return (new BookListItemView({ book: book })).el;
            }));
        }
    });

    BookDetailsView = Backbone.View.extend({
        template: _.template("<div>'<%-title%>' written by <%-author%> sometime around <%-year%></div><div><a href='/#books-list'>back</a></div>"),
        initialize: function (opts) {
            this.$el.html(this.template(opts.book.toJSON()));
        }
    });

    ErrorView = Backbone.View.extend({
       template: _.template("<div>Oops, an error occured: <%-error%></div>"),
        initialize: function (opts) {
            this.$el.html(this.template({ error: opts.error }));
        }
    });

    router = new (Backbone.Router.extend({

        routes: {
            "books-list":       "showBooksList",
            "book-details/:id": "showBookDetails"
        },

        showBooksList: function () {
            var books = new Books();
            books.fetch({
                success: function () {
                    setCurrentView(new BookListView({ books: books }));
                }
            });
        },

        showBookDetails: function (bookId) {
            var book = new Book({ id: bookId });
            book.urlRoot = 'books';
            book.fetch({
                success: function () {
                    setCurrentView(new BookDetailsView({ book: book }));
                },
                error: function (model, error) {
                    setCurrentView(new ErrorView({ error: error }));
                }
            });
        }

    }))();

    if(!Backbone.history.start()) {
        router.navigate('books-list', { trigger: true });
    }
});
