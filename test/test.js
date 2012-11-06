/*global QUnit, module, test, equal, ok, strictEqual, notStrictEqual, deepEqual, Backbone, fauxServer:true */
(function () {
	"use strict";


	//
	QUnit.module("Basics", {
		setup: function () {
			// Nada
		},
		teardown: function () {
			// Nada
		}
	});

	test("Faux-server is exposed as the fauxServer global", function () {
		ok(fauxServer);
	});

	test("noConflict removes the faux-server from global scope and returns it", function () {
		var fs = fauxServer,
			noConflictFs = fauxServer.noConflict(),
			previousFs = fauxServer;

		strictEqual(fs, noConflictFs, "Faux-server is returned");
		notStrictEqual(fs, previousFs, "Faux-server is removed from global scope");

		// Reinstate faux-server in global scope (or other tests will fail)
		fauxServer = noConflictFs;
	});

	test("Routes are added and removed", function () {
		var h = function () {};

		fauxServer.addRoute("testRoute1", "", "", h);
		fauxServer.addRoutes({
			"testRoute2": { urlExp: "", httpMethod: "", handler: h },
			"testRoute3": { urlExp: "", httpMethod: "PUT", handler: h }
		});

		ok(fauxServer.getRoute("testRoute1"), "_addRoute_ adds route");
		ok(fauxServer.getRoute("testRoute2"), "_addRoutes_ adds routes");
		ok(fauxServer.getRoute("testRoute3"), "_addRoutes_ adds routes");

		fauxServer.addRoute("testRoute3", "override", "POST", h);
		strictEqual(fauxServer.getRoute("testRoute3").httpMethod, "POST", "Adding route of same name overrides previous");

		fauxServer.removeRoute("testRoute2");
		ok(!fauxServer.getRoute("testRoute2"), "_removeRoute_ removes route");

		fauxServer.removeRoutes();

		ok(!fauxServer.getRoute("testRoute1"), "_removeRoutes_ removes routes");
		ok(!fauxServer.getRoute("testRoute3"), "_removeRoutes_ removes routes");
	});

	test("URL-expressions match", function () {
		var matchingRoute = null, i, numOfTests,
			tests = [{
				urlExp: "some/url",
				url: "some/url",
				params: []
			},
			{
				urlExp: "1/2/:param1/:param2/3/4",
				url: "1/2/hello/world/3/4",
				params: ["hello", "world"]
			}, {
				urlExp: "1/2/*param",
				url: "1/2/hello/world/3/4",
				params: ["hello/world/3/4"]
			}, {
				urlExp: "1/2/*param/3/4",
				url: "1/2/hello/world/3/4",
				params: ["hello/world"]
			}, {
				urlExp: "1/2/:param1/:param2/*param",
				url: "1/2/hello/world/3/4",
				params: ["hello", "world", "3/4"]
			}, {
				urlExp: "1/2/*param1/:param2",
				url: "1/2/hello/world/3/4",
				params: ["hello/world/3", "4"]
			}, {
				urlExp: "book-:title/page-:number",
				url: "book-do androids dream of electric sheep/page-303",
				params: ["do androids dream of electric sheep", "303"]
			}, {
				urlExp: "book::title/page::number",
				url: "book:do androids dream of electric sheep/page:303",
				params: ["do androids dream of electric sheep", "303"]
			}];
		
		for (i = 0, numOfTests = tests.length; i < numOfTests; ++i) {
			fauxServer.addRoute("testRoute", tests[i].urlExp);
			matchingRoute = fauxServer.getMatchingRoute(tests[i].url);
			ok(matchingRoute, tests[i].urlExp + " matches " + tests[i].url);
			deepEqual(matchingRoute.handlerParams, tests[i].params, "with _handerParams_: " + tests[i].params);
		}
	});

	test("Later routes take precedence over earlier routes", function () {
		var earlierHandler = function () {},
			laterHandler = function () {};
		fauxServer.addRoute("testRoute1", "some/url", "POST", earlierHandler);
		fauxServer.addRoute("testRoute2", "some/(other/)?url", "POST", laterHandler);
		strictEqual(fauxServer.getMatchingRoute("some/url", "POST").handler, laterHandler);
	});


	//
	QUnit.module("Sync", {
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

			this.Book = Book;
			this.Books = Books;
			this.createDummyBook = createDummyBook;
		},
		teardown: function () {
			delete this.Book;
			delete this.Books;
			fauxServer.removeRoutes();
			Backbone.emulateHTTP = false;
		}
	});

	test("POST-handler functions as expected when saving a new Model", 7, function () {
		var book = this.createDummyBook();
		book.urlRoot = "library-app/books";

		fauxServer.addRoute("createBook", "library-app/books", "POST", function (context) {
			ok(true, "POST-handler is called");
			ok(context, "_context_ is passed to POST-handler");
			deepEqual(context.data, book.toJSON(), "_context.data_ is set and reflects Model attributes");
			strictEqual(context.httpMethod, "POST", "_context.httpMethod_ is set to 'POST'");
			strictEqual(context.httpMethodOverride, undefined, "_context.httpMethodOverride_ is not set");

			return { id: "0123456789", creationTime: "now" };
		});

		book.save(); // Create

		strictEqual(book.id, "0123456789", "id returned by POST-handler is set on Model");
		strictEqual(book.get("creationTime"), "now", "Attributes returned by POST-handler are set on Model");
	});

	test("GET-handler functions as expected when fetching a Model", 6, function () {
		var book = new this.Book({
				id: "0123456789"
			}),
			retBookAttrs = this.createDummyBook("0123456789").toJSON();

		book.urlRoot = "library-app/books";

		// We've created a book of id 0123456789 and we'll be fetching it. The retBookAttrs hash
		//  holds the supposed attributes of the book so we'll be returning these from the GET-handler
		
		fauxServer.addRoute("readBook", "library-app/books/:id", "GET", function (context, bookId) {
			ok(true, "GET-handler is called");
			ok(context, "_context_ is passed to GET-handler");
			strictEqual(context.httpMethod, "GET", "_context.httpMethod_ is set to 'GET'");
			strictEqual(context.httpMethodOverride, undefined, "_context.httpMethodOverride_ is not set");
			strictEqual(bookId, "0123456789", "_bookId_ is passed to GET-handler and set to id of book being fetched");

			return retBookAttrs;
		});

		book.fetch(); // Read

		deepEqual(book.toJSON(), retBookAttrs, "Attributes returned by GET-handler are set on Model");
	});

	test("GET-handler functions as expected when fetching a Collection", 5, function () {
		var books = new this.Books(),
			retBooksAttrs = [this.createDummyBook("one").toJSON(), this.createDummyBook("two").toJSON()];

		// We've created an empty Collection (of url 'library-app/books') and we'll be fetching it.
		//  The retBooksAttrs is an array of attributes hashes for the supposed models in the collection
		//  so we'll be returning that from the GET-handler
		
		fauxServer.addRoute("readBooks", "library-app/books", "GET", function (context) {
			ok(true, "GET-handler is called");
			ok(context, "_context_ is passed to GET-handler");
			strictEqual(context.httpMethod, "GET", "_context.httpMethod_ is set to 'GET'");
			strictEqual(context.httpMethodOverride, undefined, "_context.httpMethodOverride_ is not set");

			return retBooksAttrs;
		});

		books.fetch(); // Read

		deepEqual(books.toJSON(), retBooksAttrs, "Model attributes returned by GET-handler are set on Collection Models");
	});

	test("PUT-handler functions as expected when saving a Model which is not new (has an id)", 7, function () {
		var book = this.createDummyBook("0123456789");
		book.urlRoot = "library-app/books";

		fauxServer.addRoute("updateBook", "library-app/books/:id", "PUT", function (context, bookId) {
			ok(true, "PUT-handler is called");
			ok(context, "_context_ is passed to PUT-handler");
			deepEqual(context.data, book.toJSON(), "_context.data_ is set and reflects Model attributes");
			strictEqual(context.httpMethod, "PUT", "_context.httpMethod_ is set to 'PUT'");
			strictEqual(context.httpMethodOverride, undefined, "_context.httpMethodOverride_ is not set");
			strictEqual(bookId, "0123456789", "_bookId_ is passed to PUT-handler and set to id of book being updated");

			return { modificationTime: "now" };
		});

		book.save(); // Update

		strictEqual(book.get("modificationTime"), "now", "Attributes returned by PUT-handler are set on Model");
	});

	test("DELETE-handler functions as expected when destroying a Model", 5, function () {
		var book = this.createDummyBook("0123456789");
		book.urlRoot = "library-app/books";
		
		fauxServer.addRoute("deleteBook", "library-app/books/:id", "DELETE", function (context, bookId) {
			ok(true, "DELETE-handler is called");
			ok(context, "_context_ is passed to DELETE-handler");
			strictEqual(context.httpMethod, "DELETE", "_context.httpMethod_ is set to 'DELETE'");
			strictEqual(context.httpMethodOverride, undefined, "_context.httpMethodOverride_ is not set");
			strictEqual(bookId, "0123456789", "_bookId_ is passed to DELETE-handler and set to id of book being deleted");
		});

		book.destroy(); // Delete
	});

	test("A POST-handler is called when creating Model and Backbone.emulateHTTP is true", 4, function () {
		Backbone.emulateHTTP = true;

		var book = this.createDummyBook();
		book.urlRoot = "library-app/books";

		fauxServer.addRoute("createBook", "library-app/books", "POST", function (context) {
			ok(true, "POST-handler is called");
			ok(context, "_context_ is passed to POST-handler");
			strictEqual(context.httpMethod, "POST", "_context.httpMethod_ is set to 'POST'");
			strictEqual(context.httpMethodOverride, "POST", "_context.httpMethodOverride_ is set to 'POST'");
		});

		book.save(); // Create
	});

	test("A POST-handler (instead of PUT) is called when updating Model and Backbone.emulateHTTP is true", 4, function () {
		Backbone.emulateHTTP = true;

		var book = this.createDummyBook("0123456789");
		book.urlRoot = "library-app/books";

		fauxServer.addRoute("updateBook", "library-app/books/:id", "POST", function (context) {
			ok(true, "POST-handler is called");
			ok(context, "_context_ is passed to POST-handler");
			strictEqual(context.httpMethod, "POST", "_context.httpMethod_ is set to 'POST'");
			strictEqual(context.httpMethodOverride, "PUT", "_context.httpMethodOverride_ is set to 'PUT'");
		});

		book.save(); // Update
	});

	test("A POST-handler (instead of DELETE) is called when destroying Model and Backbone.emulateHTTP is true", 4, function () {
		Backbone.emulateHTTP = true;

		var book = this.createDummyBook("0123456789");
		book.urlRoot = "library-app/books";
		
		fauxServer.addRoute("deleteBook", "library-app/books/:id", "POST", function (context) {
			ok(true, "POST-handler is called");
			ok(context, "_context_ is passed to POST-handler");
			strictEqual(context.httpMethod, "POST", "_context.httpMethod_ is set to 'POST'");
			strictEqual(context.httpMethodOverride, "DELETE", "_context.httpMethodOverride_ is set to 'DELETE'");
		});

		book.destroy(); // Delete
	});

	test("Returning a string from any handler is treated as an error", 5, function () {
		fauxServer.addRoutes({
			createBook: {
				urlExp: "library-app/books",
				httpMethod: "POST",
				handler: function () { return "Some error occured"; }
			},
			readBook: {
				urlExp: "library-app/books/:id",
				httpMethod: "GET",
				handler: function () { return "Some error occured"; }
			},
			readBooks: {
				urlExp: "library-app/books",
				httpMethod: "GET",
				handler: function () { return "Some error occured"; }
			},
			updateBook: {
				urlExp: "library-app/books/:id",
				httpMethod: "PUT",
				handler: function () { return "Some error occured"; }
			},
			deleteBook: {
				urlExp: "library-app/books/:id",
				httpMethod: "DELETE",
				handler: function () { return "Some error occured"; }
			}
		});

		var book = this.createDummyBook(),
			books = new this.Books();
		book.urlRoot = "library-app/books";

		book.save(null, { // Create
			error: function () { ok(true, "True when saving a new Model (a POST-handler)"); }
		});

		book.set({ id: "0123456789" });

		book.fetch({ // Read Model
			error: function () { ok(true, "True when fetching a Model (a GET-handler)"); }
		});

		books.fetch({ // Read Collection
			error: function () { ok(true, "True when fetching a Collection (a GET-handler)"); }
		});

		book.save(null, { // Update
			error: function () { ok(true, "True when updating a Model (a PUT-handler)"); }
		});

		book.destroy({ // Delete
			error: function () { ok(true, "True when destroying a Model (a DELETE-handler)"); }
		});
	});

}());

