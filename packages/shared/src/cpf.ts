export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function normalizeCpf(value: string): string {
  return digitsOnly(value);
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11) {
    return false;
  }
  if (/^(\d)\1{10}$/.test(cpf)) {
    return false;
  }
  const check = (base: string, factor: number): number => {
    let sum = 0;
    for (const char of base) {
      sum += Number(char) * factor;
      factor -= 1;
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const d1 = check(cpf.slice(0, 9), 10);
  const d2 = check(cpf.slice(0, 10), 11);
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

export function maskCpf(value: string): string {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11) {
    return '***.***.***-**';
  }
  return `***.***.***-${cpf.slice(9)}`;
}

export function formatCpf(value: string): string {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11) {
    return value;
  }
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}
