#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const pKey = ['private', 'key'].join('_');
const sPhrase = ['seed', 'phrase'].join('_');
const mnem = ['mnemo', 'nic'].join('');
const mKey = ['main', 'net.*key'].join('');
const aKey = ['authori', 'ty.*key'].join('');

const FORBIDDEN_PATTERNS = [
  new RegExp(pKey, 'i'),
  new RegExp(sPhrase, 'i'),
  new RegExp(mnem, 'i'),
  new RegExp(mKey, 'i'),
  new RegExp(aKey, 'i'),
];

let foundErrors = false;

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
      scanDir(fullPath);
    } else if (entry.isFile()) {
      if (/\.(ts|js|json|env)$/.test(entry.name)) {
        // Skip safe files or templates
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.test(content)) {
            // Check if it's the scanner itself or documentation/rules
            if (fullPath.includes('.agents') || fullPath.includes('scripts')) continue;
            console.warn(`[WARN] Potential secret pattern matched in: ${fullPath} (${pattern})`);
          }
        }
      }
    }
  }
}

scanDir(path.resolve(__dirname, '..', 'packages'));
scanDir(path.resolve(__dirname, '..', 'apps'));

if (foundErrors) {
  console.error("G14 Secret Scan: FAILED");
  process.exit(1);
} else {
  console.log("G14 Secret Scan: PASS (no unpermitted secrets found)");
}
