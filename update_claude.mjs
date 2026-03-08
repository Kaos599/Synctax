import fs from 'fs';
let c = fs.readFileSync('src/adapters/claude.ts', 'utf8');
c = c.replace(/\/\.\\(md\|agent\|claude\\)\\$\//g, '/\\.(md|agent|agents|claude)$/');
// The above regex might have been wrong, let's just do standard string replacements.
c = c.split('/\\.(md|agent|claude)$/').join('/\\.(md|agent|agents|claude)$/');
fs.writeFileSync('src/adapters/claude.ts', c);
