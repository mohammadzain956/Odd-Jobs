const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function money(value: number): string {
  return 'Rs ' + Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function timeLabel(timestamp: number): string {
  if (timestamp <= 0) {
    return 'Just now';
  }
  const date = new Date(timestamp);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function shorten(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return value.slice(0, limit - 3).trimEnd() + '...';
}

export function parsePay(value: string): number {
  const cleaned = value.replace(/rs/gi, '').replace(/,/g, '').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
