#!/usr/bin/env node
require('../polyfill.cjs');
const { publishVSIX } = require('@vscode/vsce/out/api');
const path = require('node:path');
const pkg = require('../package.json');

const vsixPath = path.resolve(__dirname, `../${pkg.name}-${pkg.version}.vsix`);
const pat = process.env.VSCE_PAT;

if (!pat) {
  console.error('Error: VSCE_PAT environment variable is required to publish to the Visual Studio Code Marketplace.');
  console.error('Provide your Personal Access Token via: VSCE_PAT="<token>" npm run publish');
  process.exit(1);
}

publishVSIX(vsixPath, { pat })
  .then(() => {
    console.log(`Successfully published ${pkg.name}@${pkg.version} to Marketplace!`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Publishing failed:', error);
    process.exit(1);
  });
