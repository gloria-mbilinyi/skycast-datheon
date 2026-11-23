import { formatAt, numberText, windCompass, dateKeyInZone, temperatureText, formatCalendarDate, convertTemperature } from './utils.js';
import { describeWeather } from './weather.js';
import { buildTemperatureChart } from './forecast.js';

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

const retryTimers = new Map();
export function configureRetry(id, until = 0, label = 'Try again') {
  const button = document.getElementById(id);
  clearInterval(retryTimers.get(id));
  function update() {
    const seconds = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    button.disabled = seconds > 0;
    button.textContent = seconds ? `${label} in ${seconds}s` : label;
    if (!seconds) { clearInterval(retryTimers.get(id)); retryTimers.delete(id); }
    return seconds;
  }
  if (update()) retryTimers.set(id, setInterval(update, 1000));
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

export function renderCurrentWeather(weather, location, fetchedAt, unit = 'celsius', { stale = false } = {}) {
  renderLocation(location, weather.timezoneKnown ? weather.timezone : 'UTC · location timezone unavailable');
  document.getElementById('location-date').textContent = formatAt(Date.now() / 1000, weather.timezone, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const temperature = document.getElementById('current-temperature');
  temperature.replaceChildren();
  if (weather.current.temperature === null) temperature.append(element('span', 'unavailable', 'Unavailable'));
  else temperature.append(document.createTextNode(Math.round(convertTemperature(weather.current.temperature, unit))), element('span', 'temp-unit', unit === 'fahrenheit' ? '°F' : '°C'));
  const condition = describeWeather(weather.current.code, weather.current.isDay);
  document.body.dataset.weather = condition.theme;
  document.getElementById('current-condition').textContent = condition.label;
  document.getElementById('current-art').replaceChildren(icon(condition.icon, true));
  document.getElementById('day-period').textContent = weather.current.isDay === true ? 'Daytime' : weather.current.isDay === false ? 'Nighttime' : 'Daylight unavailable';
  document.getElementById('model-time').textContent = `Model valid ${formatAt(weather.current.time, weather.timezone, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`;
  document.getElementById('last-updated').textContent = `Retrieved ${formatAt(fetchedAt / 1000, weather.timezone)} · ${weather.timezone}`;
  document.getElementById('data-quality').textContent = 'Current model estimates · daily forecasts';
  document.getElementById('weather-content').hidden = false;
  renderMetrics(weather, unit);
  renderDailyHighlights(weather, unit);
  renderForecast(weather, unit);
  document.getElementById('current-heading').textContent = stale ? 'SAVED MODEL ESTIMATE' : 'CURRENT MODEL ESTIMATE';
  document.getElementById('stale-notice').hidden = !stale;
  if (stale) {
    document.getElementById('stale-message').textContent = `Retrieved ${formatAt(fetchedAt / 1000, weather.timezone, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })} · ${weather.timezone}. This saved response may be out of date. Refresh when your connection is available.`;
    document.getElementById('data-quality').textContent = `Saved response · ${document.getElementById('data-quality').textContent}`;
  }
}

export function showStorageNotice(message) { const node = document.getElementById('storage-notice'); node.textContent = message; node.hidden = !message; }
export function renderRecents(locations) {
  const list = document.getElementById('recent-list'); list.replaceChildren();
  document.getElementById('recent-row').hidden = locations.length === 0;
  for (const [index, location] of locations.entries()) {
    const button = element('button'); button.type = 'button'; button.dataset.recent = index;
    const fullName = [location.name, location.admin1, location.country].filter(Boolean).join(', ');
    button.setAttribute('aria-label', `Reopen weather for ${fullName}`); button.title = fullName;
    button.append(icon('clock'), document.createTextNode([location.name, location.countryCode].filter(Boolean).join(', '))); list.append(button);
  }
}

export function renderForecast(weather, unit = 'celsius') {
  const grid = document.getElementById('forecast-grid'); grid.replaceChildren();
  const today = dateKeyInZone(Date.now() / 1000, weather.timezone);
  for (const day of weather.days) {
    const card = element('article', `forecast-card${day.date === today ? ' is-today' : ''}`);
    const condition = describeWeather(day.code, true);
    const weekday = element('h3', 'forecast-day', day.date === today ? 'Today' : formatCalendarDate(day.date, { weekday: 'short' }));
    const date = element('time', 'forecast-date', formatCalendarDate(day.date)); date.dateTime = day.date;
    const temperatures = element('div', 'forecast-temps');
    const high = element('strong'); high.append(element('span', 'sr-only', 'High '), document.createTextNode(temperatureText(day.high, unit)));
    const low = element('span'); low.append(element('span', 'sr-only', 'Low '), document.createTextNode(temperatureText(day.low, unit)));
    temperatures.append(high, low);
    card.append(weekday, date, icon(condition.icon, true), element('p', 'forecast-label', condition.label), temperatures);
    grid.append(card);
  }
  document.getElementById('forecast-nav').hidden = weather.days.length === 0;
  document.getElementById('forecast-note').textContent = !weather.days.length ? 'The service did not provide daily forecasts for this location.' : weather.days.length < 5 ? `Only ${weather.days.length} daily forecasts are available from the service.` : '';
  document.querySelector('#chart-card figcaption p').textContent = `Daily temperature outlook · °${unit === 'fahrenheit' ? 'F' : 'C'}`;
  renderTemperatureChart(weather.days.map(day => ({ ...day, high: convertTemperature(day.high, unit), low: convertTemperature(day.low, unit) })));
}

export function renderTemperatureChart(days) {
  const data = buildTemperatureChart(days);
  document.getElementById('chart-card').hidden = !data;
  const holder = document.getElementById('forecast-chart'); holder.replaceChildren();
  if (!data) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 600 165'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Daily high and low temperature trend. Exact values are in the forecast cards.');
  const draw = (tag, attributes) => { const node = document.createElementNS(svg.namespaceURI, tag); for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value); svg.append(node); };
  for (const y of [30, 85, 140]) draw('line', { x1: 20, x2: 580, y1: y, y2: y, stroke: '#e5ebf3', 'stroke-width': 1, 'stroke-dasharray': '4 5' });
  for (const [field, color] of [['high', '#3266bd'], ['low', '#819ebf']]) {
    let path = ''; let segmentStart = true;
    for (const point of data[field]) {
      if (!point) { segmentStart = true; continue; }
      path += `${segmentStart ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)} `; segmentStart = false;
    }
    draw('path', { d: path, fill: 'none', stroke: color, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    for (const point of data[field].filter(Boolean)) draw('circle', { cx: point.x, cy: point.y, r: 4, fill: '#fff', stroke: color, 'stroke-width': 2 });
  }
  const labels = element('div', 'chart-days'); labels.style.gridTemplateColumns = `repeat(${days.length}, minmax(0, 1fr))`;
  for (const day of days) labels.append(element('span', '', formatCalendarDate(day.date, { weekday: 'short' })));
  holder.append(svg, labels);
}

export function renderDailyHighlights(weather, unit = 'celsius') {
  const currentDate = dateKeyInZone(weather.current.time ?? Date.now() / 1000, weather.timezone);
  const day = weather.days.find(day => day.date === currentDate) || weather.days[0];
  document.getElementById('current-range').textContent = day ? `High ${temperatureText(day.high, unit)}  ·  Low ${temperatureText(day.low, unit)}` : 'Daily high and low unavailable';
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
export function renderMetrics(weather, unit = 'celsius') {
  const current = weather.current;
  renderMeasurement('metric-feels', convertTemperature(current.feelsLike, unit), unit === 'fahrenheit' ? '°F' : '°C');
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
