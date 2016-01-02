
module.exports = function(grunt) {

    var files = ['src/*.js'];

    grunt.initConfig({
        jshint: {
            files: files,
        },
        uglify: {
            options: {
                banner: "/* SHARED LOGIC GENERATED (<%= grunt.template.today('dd-mm-yyyy') %>) */\n",
                beautify: true
            },
            build: {
                files: {
                    '../server/src/shared.gen.js': files,
                    '../client/src/js/shared.gen.js': files
                }
            }
        },
        watch: {
            scripts: {
                files: files,
                tasks: ['default'],
                options: {
                    spawn: false,
                    atBegin: true,
                },
            },
        },
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('default', ['jshint', 'uglify']);
}