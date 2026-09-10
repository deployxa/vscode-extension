// Polyfill globalThis.File for @vscode/vsce under Node.js 18
if (typeof globalThis.File === 'undefined') {
  const { File } = require('node:buffer');
  if (File) {
    globalThis.File = File;
  }
}
