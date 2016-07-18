import * as gulp from 'gulp';
import * as postcss from 'gulp-postcss';
import * as sourcemaps from 'gulp-sourcemaps';
import * as sass from 'gulp-sass';
import * as autoprefixer from 'autoprefixer';
import * as cssnano from 'cssnano';

import * as project from '../aurelia.json';
import {build} from 'aurelia-cli';

export default function processCSS() {
    let processors = [
        autoprefixer({ browsers: ['last 1 version'] }),
        cssnano
    ];

  return gulp.src(project.cssProcessor.source)
    .pipe(sourcemaps.init())
    .pipe(postcss(processors))
    .pipe(sass().on('error', sass.logError))
    .pipe(build.bundle());
};
