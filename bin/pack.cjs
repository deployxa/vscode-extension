#!/usr/bin/env node
require('../polyfill.cjs');
const { createVSIX } = require('@vscode/vsce/out/api');

createVSIX({ dependencies: false, allowMissingRepository: true })
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Packaging failed:', error);
    process.exit(1);
  });
