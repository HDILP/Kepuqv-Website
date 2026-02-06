const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const htmlmin = require('gulp-html-minifier-terser');
const terser = require('gulp-terser');

// 路径配置（排除库文件）
const paths = ['./public/**/*.{css,html,js}', '!./public/{lib,lib/**}', '!./public/{libs,libs/**}', '!./public/{media,media/**}'];

// 压缩 CSS
const postcss = require('gulp-postcss');
const cssnano = require('cssnano');

function minify_css() {
  return gulp.src('./public/**/*.css', { base: './public', allowEmpty: true })
    .pipe(postcss([
      cssnano({
        preset: ['default', {
          discardComments: { removeAll: true },
        }]
      })
    ]))
    .pipe(gulp.dest('./public'));
}


// 压缩 HTML
function minify_html() {
  return gulp.src('./public/**/*.html', { base: './public' })
    .pipe(htmlmin({
      collapseWhitespace: true,      // 移除空格
      removeComments: true,          // 移除注释
      minifyJS: true,                // 同时压缩 HTML 里的内联 JS
      minifyCSS: true,               // 同时压缩 HTML 里的内联 CSS
      removeAttributeQuotes: true,   // 移除属性引号（极致瘦身）
      removeRedundantAttributes: true // 移除冗余属性
    }))
    .pipe(gulp.dest('./public'));
}

// 压缩 JS (直接用 Terser 压缩现代 JS)
function minify_js() {
  return gulp.src(['./public/**/*.js', '!./public/**/*.min.js'], { base: './public' })
    .pipe(terser({
      compress: {
        drop_console: true, // 移除 console
        drop_debugger: true,
        passes: 2           // 压缩两次，压榨空间
      },
      mangle: true,         // 混淆变量名
      output: { comments: false }
    }))
    .pipe(gulp.dest('./public'));
}

exports.default = gulp.parallel(minify_html, minify_css, minify_js);
