import { Decimal } from 'decimal.js';

Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
});

export const MONEY_DECIMAL_PLACES = 2;

export type MoneyString = string;

export function money(value: string | number | Decimal): Decimal {
  return new Decimal(value);
}

export function formatMoney(value: string | number | Decimal): MoneyString {
  return money(value).toFixed(MONEY_DECIMAL_PLACES);
}

export function assertMoneyNonNegative(value: Decimal, field: string): void {
  if (value.isNegative()) {
    throw new Error(`${field} não pode ser negativo.`);
  }
}

/**
 * Divide o saldo em N parcelas. As primeiras N-1 usam half-up;
 * a última absorve o residual para a soma bater exatamente no saldo.
 */
export function splitInstallments(balance: Decimal, count: number): Decimal[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('Quantidade de parcelas inválida.');
  }
  assertMoneyNonNegative(balance, 'saldo');

  if (count === 1) {
    return [balance.toDecimalPlaces(MONEY_DECIMAL_PLACES)];
  }

  const base = balance.div(count).toDecimalPlaces(MONEY_DECIMAL_PLACES);
  const amounts: Decimal[] = [];
  let allocated = new Decimal(0);

  for (let i = 0; i < count - 1; i += 1) {
    amounts.push(base);
    allocated = allocated.plus(base);
  }

  amounts.push(balance.minus(allocated).toDecimalPlaces(MONEY_DECIMAL_PLACES));
  return amounts;
}
