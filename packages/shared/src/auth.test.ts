import { describe, expect, it } from 'vitest';
import { MIN_PASSWORD_LENGTH, assertPasswordPolicy, normalizeEmail } from './auth';

describe('normalizeEmail', () => {
  it('trim e lowercase', () => {
    expect(normalizeEmail('  Admin@CrediPlus.local ')).toBe('admin@crediplus.local');
  });
});

describe('assertPasswordPolicy', () => {
  it('rejeita senha curta', () => {
    expect(() => assertPasswordPolicy('curta')).toThrow(String(MIN_PASSWORD_LENGTH));
  });

  it('aceita senha com 12 caracteres', () => {
    expect(() => assertPasswordPolicy('dozechars!!a')).not.toThrow();
  });
});
