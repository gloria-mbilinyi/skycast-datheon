export const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
export function numberText(value, digits = 0) { return finite(value) === null ? 'Unavailable' : new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(value); }
export function windCompass(value) {
  return finite(value) === null || value < 0 || value > 360 ? null : ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(value / 22.5) % 16];
}
export function validTimezone(value) {
  if (typeof value !== 'string' || !value) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(0); return true; } catch { return false; }
}
export function safeTimezone(value) { return validTimezone(value) ? value : 'UTC'; }
export function validEpoch(value) { return finite(value) !== null && Number.isFinite(new Date(value * 1000).getTime()) ? value : null; }
export function formatAt(seconds, timezone, options = { hour: 'numeric', minute: '2-digit', hour12: true }) {
  if (validEpoch(seconds) === null) return 'Unavailable';
  return new Intl.DateTimeFormat('en', { timeZone: safeTimezone(timezone), ...options }).format(new Date(seconds * 1000));
}
export function dateKeyInZone(seconds = Date.now() / 1000, timezone = 'UTC') {
  if (validEpoch(seconds) === null) return null;
  const parts = new Intl.DateTimeFormat('en', { timeZone: safeTimezone(timezone), year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(seconds * 1000));
  const part = name => parts.find(value => value.type === name)?.value;
  return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`;
}
export function formatCalendarDate(value, options = { month: 'short', day: 'numeric' }) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Unavailable';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0); date.setUTCFullYear(year, month - 1, day); date.setUTCHours(12, 0, 0, 0);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return 'Unavailable';
  return new Intl.DateTimeFormat('en', { timeZone: 'UTC', ...options }).format(date);
}
export function convertTemperature(value, unit = 'celsius') {
  if (!['celsius', 'fahrenheit'].includes(unit)) throw new RangeError('Unsupported temperature unit');
  return finite(value) === null ? null : unit === 'fahrenheit' ? value * 9 / 5 + 32 : value;
}
export function temperatureText(value, unit = 'celsius') {
  const converted = convertTemperature(value, unit);
  return converted === null ? 'Unavailable' : `${Math.round(converted)}°${unit === 'fahrenheit' ? 'F' : 'C'}`;
}
