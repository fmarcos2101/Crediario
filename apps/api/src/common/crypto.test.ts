import { describe, expect, it } from 'vitest';
import { decryptString, encryptString, hmacSha256Hex } from './crypto';

describe('crypto', () => {
  const key = Buffer.alloc(32, 3).toString('base64');

  it('cifra e decifra com AES-256-GCM', () => {
    const packed = encryptString('segredo-totp', key);
    expect(packed).not.toContain('segredo-totp');
    expect(decryptString(packed, key)).toBe('segredo-totp');
  });

  it('computa HMAC estável para busca de CPF', () => {
    const a = hmacSha256Hex('52998224725', key);
    const b = hmacSha256Hex('52998224725', key);
    expect(a).toBe(b);
    expect(a).not.toContain('529');
    expect(a).toHaveLength(64);
    expect(hmacSha256Hex('other', key)).not.toBe(a);
  });
});
