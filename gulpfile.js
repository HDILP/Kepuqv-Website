const gulp = require('gulp');
const htmlmin = require('gulp-html-minifier-terser');
const terser = require('gulp-terser');
const postcss = require('gulp-postcss');
const cssnano = require('cssnano');

// 压缩 CSS - 使用 PostCSS + cssnano
function minify_css() {
  return gulp.src(['./public/**/*.css', '!./public/{lib,libs,media}/**'], { base: './public' })
    .pipe(postcss([
      cssnano({
        preset: ['default', {
          discardComments: { removeAll: true }, // 移除所有注释
          normalizeWhitespace: true            // 极度压缩空白
        }]
      })
    ]))
    .pipe(gulp.dest('./public'));
}

// 压缩 HTML - 极致精简版
function minify_html() {
  return gulp.src(['./public/**/*.html', '!./public/{lib,libs,media}/**'], { base: './public' })
    .pipe(htmlmin({
      collapseWhitespace: true,
      removeComments: true,
      minifyJS: true,
      minifyCSS: true,
      removeAttributeQuotes: true,
      removeRedundantAttributes: true
    }))
    .pipe(gulp.dest('./public'));
}

// 压缩 JS - 针对现代浏览器优化
function minify_js() {
  return gulp.src(['./public/**/*.js', '!./public/**/*.min.js', '!./public/{lib,libs,media}/**'], { base: './public' })
    .pipe(terser({
      compress: {
        drop_console: true, // 移除 console.log
        passes: 2           // 运行两次压缩以获取最小体积
      },
      output: { comments: false }
    }))
    .pipe(gulp.dest('./public'));
}

// 并行执行
exports.default = gulp.parallel(minify_html, minify_css, minify_js);
