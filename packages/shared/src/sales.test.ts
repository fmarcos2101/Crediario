import { describe, expect, it } from 'vitest';
import { buildInstallmentPlan } from './sales';

describe('buildInstallmentPlan', () => {
  it('reparte centavos na última parcela e espaça meses', () => {
    const plan = buildInstallmentPlan({
      financed: '1000.00',
      count: 3,
      firstDueDate: '2026-01-31',
      frequency: 'monthly',
    });
    expect(plan).toEqual([
      { sequence: 1, dueDate: '2026-01-31', amount: '333.33' },
      { sequence: 2, dueDate: '2026-02-28', amount: '333.33' },
      { sequence: 3, dueDate: '2026-03-31', amount: '333.34' },
    ]);
  });
});
