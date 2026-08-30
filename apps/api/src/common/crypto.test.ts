import { describe, expect, it } from 'vitest';
import { decryptString, encryptString } from './crypto';

describe('crypto', () => {
  it('cifra e decifra com AES-256-GCM', () => {
    const key = Buffer.alloc(32, 3).toString('base64');
    const packed = encryptString('segredo-totp', key);
    expect(packed).not.toContain('segredo-totp');
    expect(decryptString(packed, key)).toBe('segredo-totp');
  });
});
