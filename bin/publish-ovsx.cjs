#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const pkg = require('../package.json');

const vsixPath = path.resolve(__dirname, `../${pkg.name}-${pkg.version}.vsix`);
const pat = process.env.OVSX_PAT || process.env.OPEN_VSX_PAT;

if (!pat) {
  console.error('Error: OVSX_PAT (or OPEN_VSX_PAT) environment variable is required to publish to Open VSX.');
  console.error('Provide your Personal Access Token via: OVSX_PAT="<token>" npm run publish:ovsx');
  process.exit(1);
}

if (!fs.existsSync(vsixPath)) {
  console.error(`Error: VSIX package not found at ${vsixPath}. Run npm run package first.`);
  process.exit(1);
}

const stats = fs.statSync(vsixPath);
console.log(`Publishing ${pkg.name}@${pkg.version} (${(stats.size / 1024 / 1024).toFixed(2)} MB) to Open VSX...`);

const url = new URL(`https://open-vsx.org/api/-/publish?token=${encodeURIComponent(pat)}`);
const req = https.request(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/octet-stream',
    'Content-Length': stats.size,
  },
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      if (res.statusCode >= 200 && res.statusCode < 300 && !data.error) {
        console.log(`🚀 Successfully published ${pkg.name}@${pkg.version} to Open VSX!`);
        console.log(`View at: https://open-vsx.org/extension/${pkg.publisher}/${pkg.name}`);
        process.exit(0);
      } else {
        console.error('Open VSX publishing failed:', data.error || data.message || body);
        process.exit(1);
      }
    } catch {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`🚀 Successfully published ${pkg.name}@${pkg.version} to Open VSX!`);
        process.exit(0);
      } else {
        console.error(`Open VSX publishing failed with HTTP ${res.statusCode}:`, body);
        process.exit(1);
      }
    }
  });
});

req.on('error', (err) => {
  console.error('Publishing request failed:', err.message);
  process.exit(1);
});

const readStream = fs.createReadStream(vsixPath);
readStream.pipe(req);
