import { describe, expect, it } from 'vitest';
import { clampPercent, isIOSDevice } from '../progress';

describe('clampPercent', () => {
  it('passes through 0–100 percentages unchanged', () => {
    expect(clampPercent(0)).toBe(0);
    expect(clampPercent(88)).toBe(88);
    expect(clampPercent(100)).toBe(100);
  });

  it('converts 0–1 fractions to percent', () => {
    expect(clampPercent(0.5)).toBe(50);
    expect(clampPercent(1)).toBe(100);
  });

  it('clamps out-of-range and non-numeric input', () => {
    expect(clampPercent(10000)).toBe(100); // the v2→v4 double-scale bug
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(undefined)).toBe(0);
    expect(clampPercent(NaN)).toBe(0);
    expect(clampPercent('50')).toBe(0);
  });
});

describe('isIOSDevice', () => {
  it('detects iPhone/iPad user agents', () => {
    expect(isIOSDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)', 'iPhone', 3)).toBe(true);
    expect(isIOSDevice('Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X)', 'iPad', 2)).toBe(true);
  });

  it('detects iPadOS masquerading as MacIntel', () => {
    expect(isIOSDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 'MacIntel', 5)).toBe(true);
  });

  it('does not flag real desktops', () => {
    expect(isIOSDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 'MacIntel', 0)).toBe(false);
    expect(isIOSDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 0)).toBe(false);
    expect(isIOSDevice('Mozilla/5.0 (Linux; Android 14)', 'Linux armv8l', 10)).toBe(false);
  });
});
