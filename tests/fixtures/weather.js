export const berlin = { id: 2950159, name: 'Berlin', admin1: 'Berlin', country: 'Germany', country_code: 'DE', latitude: 52.52, longitude: 13.41, timezone: 'Europe/Berlin' };
export const otherBerlin = { id: 5083330, name: 'Berlin', admin1: 'New Hampshire', country: 'United States', country_code: 'US', latitude: 44.47, longitude: -71.19, timezone: 'America/New_York' };
export const tokyo = { id: 1850147, name: 'Tokyo', admin1: 'Tokyo', country: 'Japan', country_code: 'JP', latitude: 35.69, longitude: 139.69, timezone: 'Asia/Tokyo' };
export function weatherFixture({ timezone = 'Europe/Berlin', offset = 3600, temperature = 12, code = 2, isDay = 1 } = {}) {
  const midnight = Date.UTC(2026, 10, 23) / 1000 - offset;
  return {
    timezone, utc_offset_seconds: offset,
    current_units: { temperature_2m: '°C', apparent_temperature: '°C', relative_humidity_2m: '%', wind_speed_10m: 'km/h', pressure_msl: 'hPa' },
    current: { time: Date.UTC(2026, 10, 23, 12) / 1000, temperature_2m: temperature, apparent_temperature: temperature - 1, relative_humidity_2m: 64, wind_speed_10m: 14.4, wind_direction_10m: 225, pressure_msl: 1015.2, weather_code: code, is_day: isDay },
    daily_units: { temperature_2m_max: '°C', temperature_2m_min: '°C' },
    daily: { time: Array.from({ length: 5 }, (_, index) => midnight + index * 86400), temperature_2m_max: [14,15,13,12,16], temperature_2m_min: [6,7,5,4,8], weather_code: [2,0,61,3,0], sunrise: Array.from({ length: 5 }, (_, index) => midnight + index * 86400 + 25200), sunset: Array.from({ length: 5 }, (_, index) => midnight + index * 86400 + 57600) },
  };
}
