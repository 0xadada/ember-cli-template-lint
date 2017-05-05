'use strict';

/* eslint-env node */

const VersionChecker = require('ember-cli-version-checker');
const TemplateLinter = require('./broccoli-template-linter');
const PrintFailing = require('./lib/commands/print-failing');

module.exports = {
  name: 'ember-cli-template-lint',

  includedCommands: function() {
    return {
      'template-lint:print-failing': PrintFailing
    };
  },

  lintTree: function(type, tree) {
    let checker = new VersionChecker(this);
    checker.for('ember-cli', 'npm').assertAbove('2.4.1');

    if (type === 'templates') {
      let ui = this.ui;
      let mockConsole = {
        log: function(data) {
          ui.writeLine(data);
        },

        error: function(data) {
          ui.writeLine(data, 'ERROR');
        }
      };

      return new TemplateLinter(tree, {
        annotation: 'TemplateLinter',
        templatercPath: this.project.root + '/.template-lintrc',
        generateTestFile: this.project.generateTestFile,
        console: mockConsole,
        project: this.project
      });
    }
  },

  setupPreprocessorRegistry: function(type, registry) {
    let RemoveConfigurationHtmlComments = require('./lib/plugins/remove-configuration-html-comments');

    registry.add('htmlbars-ast-plugin', {
      name: 'remove-configuration-html-comments',
      plugin: RemoveConfigurationHtmlComments(),
      baseDir: function() {
        return __dirname;
      }
    });
  }
};
