import { formatAt } from './utils.js';

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
  document.getElementById('current-condition').textContent = weather.current.code === null ? 'Condition unavailable' : `Weather code ${weather.current.code}`;
  document.getElementById('current-art').replaceChildren(icon('unknown', true));
  document.getElementById('day-period').textContent = weather.current.isDay === true ? 'Daytime' : weather.current.isDay === false ? 'Nighttime' : 'Daylight unavailable';
  document.getElementById('model-time').textContent = `Model valid ${formatAt(weather.current.time, weather.timezone, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`;
  document.getElementById('last-updated').textContent = `Retrieved ${formatAt(fetchedAt / 1000, weather.timezone)} · ${weather.timezone}`;
  document.getElementById('data-quality').textContent = 'Current model estimates · daily forecasts';
  document.getElementById('weather-content').hidden = false;
}
