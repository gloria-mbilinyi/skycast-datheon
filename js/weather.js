import { ApiError } from './api.js';
import { finite, validEpoch, safeTimezone, validTimezone } from './utils.js';

export function normalizeWeather(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response) || (!response.current && !response.daily)) throw new ApiError('data', 'Weather details are missing from the response. Please try again.');
  for (const [units, field, expected] of [[response.current_units, 'temperature_2m', '°C'], [response.current_units, 'apparent_temperature', '°C'], [response.current_units, 'wind_speed_10m', 'km/h'], [response.current_units, 'pressure_msl', 'hPa']]) {
    if (units?.[field] && units[field] !== expected) throw new ApiError('data', 'The weather service returned unexpected measurement units. Please try again.');
  }
  const raw = response.current || {};
  const humidity = finite(raw.relative_humidity_2m);
  const code = finite(raw.weather_code);
  return {
    timezone: safeTimezone(response.timezone), timezoneKnown: validTimezone(response.timezone),
    utcOffsetSeconds: Number.isInteger(response.utc_offset_seconds) && Math.abs(response.utc_offset_seconds) <= 86400 ? response.utc_offset_seconds : 0,
    current: { time: validEpoch(raw.time), temperature: finite(raw.temperature_2m), feelsLike: finite(raw.apparent_temperature), humidity: humidity !== null && humidity >= 0 && humidity <= 100 ? humidity : null, wind: finite(raw.wind_speed_10m) !== null && raw.wind_speed_10m >= 0 ? raw.wind_speed_10m : null, windDirection: finite(raw.wind_direction_10m), pressure: finite(raw.pressure_msl) !== null && raw.pressure_msl > 0 ? raw.pressure_msl : null, code: Number.isInteger(code) && code >= 0 ? code : null, isDay: raw.is_day === 1 ? true : raw.is_day === 0 ? false : null },
  };
}
