import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assertSameTenant } from './tenant-access';

describe('assertSameTenant', () => {
  it('nega Tenant A acessar recurso de Tenant B com 404', () => {
    expect(() =>
      assertSameTenant(
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      ),
    ).toThrow(HttpException);
    try {
      assertSameTenant(
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      );
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(404);
    }
  });

  it('permite o próprio tenant', () => {
    expect(() =>
      assertSameTenant(
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      ),
    ).not.toThrow();
  });
});
