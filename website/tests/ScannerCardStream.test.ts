import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scannerCardStreamPath = resolve(__dirname, '../src/components/ui/ScannerCardStream.tsx');

describe('ScannerCardStream', () => {
  it('uses card.id from data attribute instead of NodeList index for scramble lookup', () => {
    const content = readFileSync(scannerCardStreamPath, 'utf-8');
    // Should read card id from data-card-id attribute, not from forEach index
    expect(content).toMatch(/data-card-id/);
  });

  it('does not use forEach idx parameter for runScramble or originalAscii lookup', () => {
    const content = readFileSync(scannerCardStreamPath, 'utf-8');
    // Should NOT pass idx (from NodeList forEach) to runScramble
    // The pattern "runScramble(pre, idx)" is the bug
    expect(content).not.toMatch(/runScramble\(pre,\s*idx\)/);
  });

  it('adds data-card-id to card wrapper elements', () => {
    const content = readFileSync(scannerCardStreamPath, 'utf-8');
    // Card wrapper should have data-card-id={card.id}
    expect(content).toMatch(/data-card-id/);
  });
});
