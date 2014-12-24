/*global QUnit, fauxServer, test, strictEqual */

(function () {
    "use strict";

    //
    QUnit.module("version");

    test("reports version", function () {
        strictEqual(fauxServer.getVersion(), "0.10.5");
    });

}());
