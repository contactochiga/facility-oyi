export function formatNumber(n: number) {
  return new Intl.NumberFormat().format(n);
}

export function formatMoney(n: number, currency: string = "NGN") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}
