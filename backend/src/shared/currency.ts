export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function fromPaise(paise: number): number {
  return paise / 100;
}

export function isValidCurrencyAmount(rupees: number): boolean {
  return Math.abs(rupees * 100 - Math.round(rupees * 100)) < 1e-6;
}
