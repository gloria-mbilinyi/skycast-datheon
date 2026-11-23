import { formatAt, numberText, windCompass, dateKeyInZone, temperatureText } from './utils.js';
import { describeWeather } from './weather.js';

export function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '' && text !== null && text !== undefined) node.textContent = String(text);
  return node;
}
export function icon(name, weather = false) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS(node.namespaceURI, 'use');
  use.setAttribute('href', `#${weather ? 'w' : 'i'}-${name}`);
  node.setAttribute('aria-hidden', 'true');
  if (weather) node.classList.add('weather-icon');
  node.append(use); return node;
}
export function announce(message) {
  const node = document.getElementById('announcements');
  node.textContent = '';
  requestAnimationFrame(() => { node.textContent = message; });
}

export function setSearchBusy(busy) {
  document.getElementById('search-section')?.setAttribute('aria-busy', busy);
  document.getElementById('search-form').setAttribute('aria-busy', busy);
  document.getElementById('search-submit').textContent = busy ? 'Searching…' : 'Find forecast';
}

export function renderLocations(locations, status = '') {
  const list = document.getElementById('search-results');
  list.setAttribute('role', 'listbox');
  list.replaceChildren();
  for (const [index, location] of locations.entries()) {
    const row = element('li', 'search-result'); row.dataset.index = index;
    row.setAttribute('role', 'option'); row.setAttribute('aria-selected', 'false'); row.tabIndex = 0;
    const details = element('div');
    details.append(element('strong', '', location.name), element('span', '', [location.admin1, location.country].filter(Boolean).join(', ') || 'Region information unavailable'));
    row.append(icon('pin'), details, element('span', 'result-country', location.countryCode));
    list.append(row);
  }
  document.getElementById('search-panel').hidden = false;
  document.getElementById('result-count').textContent = locations.length ? `${locations.length} ${locations.length === 1 ? 'match' : 'matches'}` : '';
  document.getElementById('search-status').textContent = status;
}

export function renderLocation(location, timezone = location.timezone) {
  document.getElementById('location-name').textContent = location.name;
  document.getElementById('location-region').textContent = [location.admin1, location.country].filter(Boolean).join(' · ') || 'Region information unavailable';
  document.getElementById('location-timezone').textContent = timezone || 'Timezone information unavailable';
  document.getElementById('location-date').textContent = 'Forecast for your selected location';
  document.getElementById('welcome').hidden = true;
  document.getElementById('weather-shell').hidden = false;
}

export function renderCurrentWeather(weather, location, fetchedAt) {
  renderLocation(location, weather.timezoneKnown ? weather.timezone : 'UTC · location timezone unavailable');
  document.getElementById('location-date').textContent = formatAt(Date.now() / 1000, weather.timezone, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const temperature = document.getElementById('current-temperature');
  temperature.replaceChildren();
  if (weather.current.temperature === null) temperature.append(element('span', 'unavailable', 'Unavailable'));
  else temperature.append(document.createTextNode(Math.round(weather.current.temperature)), element('span', 'temp-unit', '°C'));
  const condition = describeWeather(weather.current.code, weather.current.isDay);
  document.getElementById('current-condition').textContent = condition.label;
  document.getElementById('current-art').replaceChildren(icon(condition.icon, true));
  document.getElementById('day-period').textContent = weather.current.isDay === true ? 'Daytime' : weather.current.isDay === false ? 'Nighttime' : 'Daylight unavailable';
  document.getElementById('model-time').textContent = `Model valid ${formatAt(weather.current.time, weather.timezone, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`;
  document.getElementById('last-updated').textContent = `Retrieved ${formatAt(fetchedAt / 1000, weather.timezone)} · ${weather.timezone}`;
  document.getElementById('data-quality').textContent = 'Current model estimates · daily forecasts';
  document.getElementById('weather-content').hidden = false;
  renderMetrics(weather);
  renderDailyHighlights(weather);
}

export function renderDailyHighlights(weather) {
  const currentDate = dateKeyInZone(weather.current.time ?? Date.now() / 1000, weather.timezone);
  const day = weather.days.find(day => day.date === currentDate) || weather.days[0];
  document.getElementById('current-range').textContent = day ? `High ${temperatureText(day.high)}  ·  Low ${temperatureText(day.low)}` : 'Daily high and low unavailable';
  document.getElementById('sunrise-time').textContent = formatAt(day?.sunrise ?? null, weather.timezone);
  document.getElementById('sunset-time').textContent = formatAt(day?.sunset ?? null, weather.timezone);
  if (weather.days.length < 5) document.getElementById('data-quality').textContent += ` · ${weather.days.length} daily forecasts available`;
}

export function renderMeasurement(id, value, unit, digits = 0) {
  const node = document.getElementById(id);
  node.replaceChildren();
  if (value === null) node.append(element('span', 'unavailable', 'Unavailable'));
  else node.append(document.createTextNode(numberText(value, digits)), element('span', 'value-unit', unit));
}
export function renderMetrics(weather) {
  const current = weather.current;
  renderMeasurement('metric-feels', current.feelsLike, '°C');
  renderMeasurement('metric-humidity', current.humidity, '%');
  renderMeasurement('metric-wind', current.wind, 'km/h', 1);
  renderMeasurement('metric-pressure', current.pressure, 'hPa');
  const direction = windCompass(current.windDirection);
  document.getElementById('wind-description').textContent = direction ? `${direction} · wind at 10 m` : 'Wind at 10 m above ground';
  const facts = [];
  if (current.wind !== null) facts.push(`Wind is estimated at ${numberText(current.wind, 1)} km/h.`);
  if (current.humidity !== null) facts.push(`Relative humidity is ${numberText(current.humidity)}%.`);
  if (current.pressure !== null) facts.push(`Sea-level pressure is ${numberText(current.pressure)} hPa.`);
  document.getElementById('conditions-summary').textContent = facts.length ? `${describeWeather(current.code, current.isDay).label}. ${facts.join(' ')}` : 'Some weather details are unavailable from the service. Refresh to request a new estimate.';
  document.getElementById('data-quality').textContent = [current.temperature, current.feelsLike, current.humidity, current.wind, current.pressure, current.code].some(value => value === null) ? 'Some current fields are unavailable' : 'Current model estimates · daily forecasts';
  if (!weather.timezoneKnown) document.getElementById('data-quality').textContent += ' · UTC fallback';
}
