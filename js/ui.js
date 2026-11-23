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
