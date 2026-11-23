import { ApiError } from './api.js';
import { finite, validEpoch, safeTimezone, validTimezone } from './utils.js';
import { normalizeForecast } from './forecast.js';

const conditions = new Map([
  [0, ['Clear sky', 'sun', 'clear']], [1, ['Mainly clear', 'sun', 'clear']], [2, ['Partly cloudy', 'partly', 'cloud']], [3, ['Overcast', 'cloud', 'cloud']],
  [45, ['Fog', 'fog', 'cloud']], [48, ['Depositing rime fog', 'fog', 'cloud']],
  [51, ['Light drizzle', 'rain', 'rain']], [53, ['Moderate drizzle', 'rain', 'rain']], [55, ['Dense drizzle', 'rain', 'rain']], [56, ['Light freezing drizzle', 'rain', 'rain']], [57, ['Dense freezing drizzle', 'rain', 'rain']],
  [61, ['Slight rain', 'rain', 'rain']], [63, ['Moderate rain', 'rain', 'rain']], [65, ['Heavy rain', 'rain', 'rain']], [66, ['Light freezing rain', 'rain', 'rain']], [67, ['Heavy freezing rain', 'rain', 'rain']],
  [71, ['Slight snowfall', 'snow', 'snow']], [73, ['Moderate snowfall', 'snow', 'snow']], [75, ['Heavy snowfall', 'snow', 'snow']], [77, ['Snow grains', 'snow', 'snow']],
  [80, ['Slight rain showers', 'rain', 'rain']], [81, ['Moderate rain showers', 'rain', 'rain']], [82, ['Violent rain showers', 'rain', 'rain']], [85, ['Slight snow showers', 'snow', 'snow']], [86, ['Heavy snow showers', 'snow', 'snow']],
  [95, ['Thunderstorm', 'storm', 'rain']], [96, ['Thunderstorm with slight hail', 'storm', 'rain']], [97, ['Heavy thunderstorm', 'storm', 'rain']], [99, ['Thunderstorm with heavy hail', 'storm', 'rain']],
]);
export function describeWeather(code, isDay) {
  const value = conditions.get(code);
  if (!value) return { label: 'Condition unavailable', icon: 'unknown', theme: isDay === false ? 'night' : 'neutral' };
  const [label, originalIcon, group] = value;
  const icon = isDay === false && originalIcon === 'sun' ? 'moon' : isDay === false && ['partly', 'cloud'].includes(originalIcon) ? 'night-cloud' : originalIcon;
  return { label, icon, theme: isDay === false ? 'night' : isDay === true ? group : 'neutral' };
}

export function normalizeWeather(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response) || (!response.current && !response.daily)) throw new ApiError('data', 'Weather details are missing from the response. Please try again.');
  for (const [units, field, expected] of [[response.current_units, 'temperature_2m', '°C'], [response.current_units, 'apparent_temperature', '°C'], [response.current_units, 'wind_speed_10m', 'km/h'], [response.current_units, 'pressure_msl', 'hPa']]) {
    if (units?.[field] && units[field] !== expected) throw new ApiError('data', 'The weather service returned unexpected measurement units. Please try again.');
  }
  const raw = response.current || {};
  const humidity = finite(raw.relative_humidity_2m);
  const code = finite(raw.weather_code);
  return {
    days: normalizeForecast(response),
    timezone: safeTimezone(response.timezone), timezoneKnown: validTimezone(response.timezone),
    utcOffsetSeconds: Number.isInteger(response.utc_offset_seconds) && Math.abs(response.utc_offset_seconds) <= 86400 ? response.utc_offset_seconds : 0,
    current: { time: validEpoch(raw.time), temperature: finite(raw.temperature_2m), feelsLike: finite(raw.apparent_temperature), humidity: humidity !== null && humidity >= 0 && humidity <= 100 ? humidity : null, wind: finite(raw.wind_speed_10m) !== null && raw.wind_speed_10m >= 0 ? raw.wind_speed_10m : null, windDirection: finite(raw.wind_direction_10m), pressure: finite(raw.pressure_msl) !== null && raw.pressure_msl > 0 ? raw.pressure_msl : null, code: Number.isInteger(code) && code >= 0 ? code : null, isDay: raw.is_day === 1 ? true : raw.is_day === 0 ? false : null },
  };
}
