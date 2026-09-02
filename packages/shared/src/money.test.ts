import { describe, expect, it } from 'vitest';
import { formatMoney, money, splitInstallments } from './money';

describe('splitInstallments', () => {
  it('reparte 4000 em 8 parcelas iguais', () => {
    const parts = splitInstallments(money('4000'), 8);
    expect(parts.map(formatMoney)).toEqual(Array.from({ length: 8 }, () => '500.00'));
  });

  it('absorve centavos na última parcela', () => {
    const parts = splitInstallments(money('1000'), 3);
    expect(parts.map(formatMoney)).toEqual(['333.33', '333.33', '333.34']);
    const sum = parts.reduce((acc, value) => acc.plus(value), money(0));
    expect(formatMoney(sum)).toBe('1000.00');
  });

  it('rejeita quantidade inválida', () => {
    expect(() => splitInstallments(money('10'), 0)).toThrow(/parcelas/);
  });
});
