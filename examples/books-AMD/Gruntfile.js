/* global module:false */

module.exports = function (grunt) {

    "use strict";

    grunt.initConfig({

        pkg: grunt.file.readJSON("package.json"),

        connect: {
            server: {
                options: {
                    port: 3333,
                    hostname: "0.0.0.0"
                }
            }
        }

    });

    grunt.loadNpmTasks("grunt-contrib-connect");

};
