Backbone Faux Server Books example
==================================

An example app that displays books attributes, fetched over an imaginary, mocked API. BFS (as
well as other dependencies, JQuery, Underscore and Backbone) are included through plain `<script>`
tags in `index.html` - see the 'books-AMD' example for a use case where BFS is treated as an AMD
module.) Application code lives in `app.js` whereas BFS routes are defined in `faux-server.js`.


Running
-------

In the example folder, `bower install` to get all dependencies. You can serve the application using
your own web server or use Grunt's connect plugin: `npm install` to get dev-dependencies and then
`grunt connect:server:keepalive` to run a local connect server listening on `localhost:3333`.
