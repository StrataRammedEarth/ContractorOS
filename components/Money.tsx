export const formatMoney = (value: number) =>
  `R ${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

export function Money({ value }: { value: number }) {
  return <span className="money">{formatMoney(value)}</span>;
}
