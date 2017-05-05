'use strict';

/* eslint-env node */

const Filter = require('broccoli-persistent-filter');
const md5Hex = require('md5-hex');
const stringify = require('json-stable-stringify');
const chalk = require('chalk');
const jsStringEscape = require('js-string-escape');
const Linter = require('ember-template-lint');
const debug = require('debug')('template-lint:broccoli');
const projectLocalizationAddon = require('./lib/utils/project-localization-framework');

function TemplateLinter(inputNode, _options) {
  if (!(this instanceof TemplateLinter)) { return new TemplateLinter(inputNode, _options); }

  let options = _options || {};
  if (!options.hasOwnProperty('persist')) {
    options.persist = true;
  }

  Filter.call(this, inputNode, {
    annotation: options.annotation,
    persist: options.persist
  });


  this.options = options;
  this._console = this.options.console || console;
  this._templatercConfig = undefined;
  this._generateTestFile = this.options.generateTestFile || function() {
    return '';
  };
  this.linter = new Linter(options);

  debug('Linter config: %s', JSON.stringify(this.linter.config));

  this.issueLocalizationWarningIfNeeded();
}

TemplateLinter.prototype = Object.create(Filter.prototype);
TemplateLinter.prototype.constructor = TemplateLinter;

TemplateLinter.prototype.extensions = ['hbs'];
TemplateLinter.prototype.targetExtension = 'template.lint-test.js';

TemplateLinter.prototype.baseDir = function() {
  return __dirname;
};

TemplateLinter.prototype.cacheKeyProcessString = function(string, relativePath) {
  return md5Hex([
    stringify(this.linter.config),
    this._generateTestFile.toString(),
    string,
    relativePath
  ]);
};

TemplateLinter.prototype.build = function () {
  let self = this;
  self._errors = [];

  return Filter.prototype.build.apply(this, arguments)
    .finally(function() {
      if (self._errors.length > 0) {
        let label = ' Template Linting Error' + (self._errors.length > 1 ? 's' : '');
        self._console.log('\n' + self._errors.join('\n'));
        self._console.log(chalk.yellow('===== ' + self._errors.length + label + '\n'));
      }
    });
};

TemplateLinter.prototype.convertErrorToDisplayMessage = function(error) {
  let message = error.rule + ': ' + error.message + ' (' + error.moduleId;

  if (error.line && error.column) {
    message = message + ' @ L' + error.line + ':C' + error.column;
  }

  message = message + ')';

  if (error.source) {
    message = message + ': \n`' + error.source + '`';
  }

  return message;
};

TemplateLinter.prototype.processString = function(contents, relativePath) {
  let errors = this.linter.verify({
    source: contents,
    moduleId: relativePath.slice(0, -4)
  });
  errors = errors.filter(function(error) {
    return error.severity > 1;
  });
  let passed = errors.length === 0;
  let errorDisplay = errors.map(function(error) {
    return this.convertErrorToDisplayMessage(error);
  }, this)
        .join('\n');


  let output = this._generateTestFile(
    'TemplateLint - ' + relativePath,
    [{
      name: 'should pass TemplateLint',
      passed: passed,
      errorMessage: jsStringEscape(relativePath + ' should pass TemplateLint.\n' + errorDisplay)
    }]
  );

  debug('Found %s errors for %s with \ncontents: \n%s\nerrors: \n%s', errors.length, relativePath, contents, errorDisplay);

  return {
    errors: errors,
    output: output
  };
};

TemplateLinter.prototype.postProcess = function(results) {
  let errors = results.errors;

  for (let i = 0; i < errors.length; i++) {
    let errorDisplay = this.convertErrorToDisplayMessage(errors[i]);
    this._errors.push(chalk.red(errorDisplay));
  }

  return results;
};

TemplateLinter.prototype.issueLocalizationWarningIfNeeded = function() {
  if ('bare-strings' in this.linter.config.rules) {
    return;
  }

  let project = this.options.project;
  if (!project) {
    return;
  }

  let addon = projectLocalizationAddon(project);

  if (addon) {
    this._console.log(chalk.yellow(
      'The `bare-strings` rule must be configured when using a localization framework (`' + addon.name + '`). To prevent this warning, add the following to your `.template-lintrc.js`:\n\n  rules: {\n    \'bare-strings\': true\n  }'
    ));
  }
};

module.exports = TemplateLinter;
