// gulpfile.js - http://jsua.co/mm-gulp

'use strict'; // http://www.w3schools.com/js/js_strict.asp

// 1. LOAD PLUGINS

var gulp = require('gulp');
var p    = require('gulp-load-plugins')({ // This loads all the other plugins.
  DEBUG: false,
  pattern: ['gulp-*', 'gulp.*', 'del', 'run-*', 'browser*', 'vinyl-*'],
  rename: {
    'vinyl-source-stream': 'source',
    'vinyl-buffer': 'buffer',
    'gulp-util': 'gutil'
  },
});

// 2. CONFIGURATION

var
  src  = './',
  dest = 'dist/',

  development = p.environments.development,

  js = {
    in: src + './*.{js,coffee}',
    out: dest
  },

  uglifyOpts = {
    preserveComments: 'license'
  };


// 3. WORKER TASKS

// Javascript Bundling
gulp.task('js', function() {

  var a = p.browserify({
    entries: src,
    insertGlobals : true,
    standalone: 'Octobat',
    debug: true
  });

  a.bundle().on('error', handleError)
    .pipe(p.source('octobat-form.min.js'))
    .pipe(p.buffer())
    .pipe(p.stripDebug())
    .pipe(p.uglify(uglifyOpts))
    .pipe(gulp.dest(js.out));


  var b = p.browserify({
    entries: src,
    insertGlobals : true,
    standalone: 'Octobat',
    debug: true
  });

  b.bundle().on('error', handleError)
    .pipe(p.source('octobat-form.js'))
    .pipe(p.buffer())
    .pipe(p.stripDebug())
    .pipe(gulp.dest(js.out));

});




// Clean dest/
gulp.task('clean', function() {
  p.del([
    dest + '*'
  ]);
});


// 4. SUPER TASKS

// Development Task
gulp.task('development', function(done) {
  p.runSequence('clean', 'js', done);
});


// Default Task
// This is the task that will be invoked by Middleman's exteranal pipeline when
// running 'middleman server'
gulp.task('build', ['development'], function() {
  gulp.watch(js.in, ['js']);
});


function handleError(err) {
  console.log(err.toString());
  this.emit('end');
}
