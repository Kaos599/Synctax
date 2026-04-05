import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const viteConfigPath = resolve(__dirname, '../vite.config.ts');

describe('vite.config.ts', () => {
  it('defines __dirname from import.meta.url for ESM compatibility', () => {
    const content = readFileSync(viteConfigPath, 'utf-8');
    // __dirname should be derived from import.meta.url, not used as a global
    expect(content).toMatch(/const __dirname.*=.*path\.dirname.*fileURLToPath.*import\.meta\.url/);
  });

  it('uses import.meta.url for path resolution', () => {
    const content = readFileSync(viteConfigPath, 'utf-8');
    expect(content).toMatch(/import\.meta\.url/);
  });
});
