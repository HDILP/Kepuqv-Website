const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const htmlmin = require('gulp-html-minifier-terser');
const htmlclean = require('gulp-htmlclean');
const terser = require('gulp-terser');
const sourcemaps = require('gulp-sourcemaps');
const babel = require('gulp-babel');

// 压缩css文件
function minify_css() {
  return gulp.src(['./public/**/*.css', '!./public/{lib,lib/**}', '!./public/{libs,libs/**}', '!./public/{media,media/**}'])
    .pipe(sourcemaps.init())
    .pipe(cleanCSS({ compatibility: 'ie8' }))
    .pipe(sourcemaps.write('./maps'))
    .pipe(gulp.dest('./public'));
}

// 压缩html文件
function minify_html() {
  return gulp.src(['./public/**/*.html', '!./public/{lib,lib/**}', '!./public/{libs,libs/**}', '!./public/{media,media/**}'])
    .pipe(htmlclean())
    .pipe(htmlmin({
      removeComments: true,
      minifyJS: true,
      minifyCSS: true,
      minifyURLs: true,
    }))
    .pipe(gulp.dest('./public'));
}

// 压缩js文件
function minify_js() {
  return gulp.src(['./public/**/*.js', '!./public/**/*.min.js', '!./public/{lib,lib/**}', '!./public/{libs,libs/**}', '!./public/{media,media/**}'])
    .pipe(sourcemaps.init())
    .pipe(babel({
      presets: ['@babel/preset-env']
    }))
    .pipe(terser({
      ecma: 2015,
      ie8: true,
      safari10: true,
      output: { comments: false }
    }))
    .pipe(sourcemaps.write('./maps'))
    .pipe(gulp.dest('./public'));
}

// 并行执行所有压缩任务
const minify = gulp.parallel(minify_html, minify_css, minify_js);

// 默认任务
exports.default = minify;