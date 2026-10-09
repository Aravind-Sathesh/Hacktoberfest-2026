/** "Crown Flower / Madar (Calotropis gigantea)" → "Crown Flower / Madar". */
export function commonName(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, '').trim() || label;
}

/** Match strength in words; people read "Strong match" faster than "97.3%". */
export function matchLabel(score: number): string {
  if (score >= 0.9) return 'Strong match';
  if (score >= 0.6) return 'Likely match';
  return 'Weak match';
}

/** 2139 → "2.1 s", 485 → "0.5 s". */
export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Today", "Yesterday", else "Mon 6 Oct", in local time. */
export function dayLabel(t: number, now: number): string {
  const d = new Date(t);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(new Date(now)) - startOf(d)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "7:05", "16:40". */
export function timeOfDay(t: number): string {
  const d = new Date(t);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
