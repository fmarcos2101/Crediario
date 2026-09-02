import { describe, expect, it } from 'vitest';
import { formatCpf, isValidCpf, maskCpf, normalizeCpf } from './cpf';

describe('cpf', () => {
  it('aceita CPF válido e rejeita repetido', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });

  it('mascara e formata', () => {
    expect(normalizeCpf('529.982.247-25')).toBe('52998224725');
    expect(maskCpf('52998224725')).toBe('***.***.***-25');
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
  });
});
