import { finite, validEpoch, dateKeyInZone, safeTimezone } from './utils.js';
import { ApiError } from './api.js';

export function normalizeForecast(response) {
  for (const field of ['temperature_2m_max', 'temperature_2m_min']) if (response.daily_units?.[field] && response.daily_units[field] !== '°C') throw new ApiError('data', 'The daily forecast returned unexpected temperature units.');
  const daily = response.daily;
  if (!daily || !Array.isArray(daily.time)) return [];
  const seen = new Set(); const days = [];
  const offset = Number.isInteger(response.utc_offset_seconds) && Math.abs(response.utc_offset_seconds) <= 86400 ? response.utc_offset_seconds : null;
  for (const [index, epoch] of daily.time.entries()) {
    if (validEpoch(epoch) === null) continue;
    // Daily timestamps mark the API's calendar boundaries at its returned fixed offset.
    // Use that boundary for the date label; actual events format in the IANA timezone.
    const shifted = offset === null ? null : validEpoch(epoch + offset);
    const date = shifted !== null ? new Date(shifted * 1000).toISOString().slice(0, 10) : dateKeyInZone(epoch, safeTimezone(response.timezone));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || seen.has(date)) continue;
    seen.add(date);
    let high = finite(daily.temperature_2m_max?.[index]); let low = finite(daily.temperature_2m_min?.[index]);
    if (high !== null && low !== null && high < low) { high = null; low = null; }
    const code = daily.weather_code?.[index];
    const solar = value => validEpoch(value) !== null && value >= epoch - 3600 && value <= epoch + 129600 ? value : null;
    days.push({ date, high, low, code: Number.isInteger(code) && code >= 0 ? code : null, sunrise: solar(daily.sunrise?.[index]), sunset: solar(daily.sunset?.[index]) });
  }
  return days.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
}
