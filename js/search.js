export class SearchValidationError extends Error {}
export function normalizeLocation(value) {
  if (!value || typeof value.name !== 'string' || !value.name.trim() || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude) || Math.abs(value.latitude) > 90 || Math.abs(value.longitude) > 180) return null;
  const text = (value, maximum) => typeof value === 'string' ? value.trim().slice(0, maximum) : '';
  return { id: String(value.id ?? `${value.latitude},${value.longitude}`).slice(0, 100), name: text(value.name, 160), admin1: text(value.admin1, 120), country: text(value.country, 120), countryCode: /^[A-Z]{2}$/.test(value.country_code || value.countryCode || '') ? value.country_code || value.countryCode : '', latitude: value.latitude, longitude: value.longitude, timezone: text(value.timezone, 100) };
}
export function locationKey(location) {
  return `${location.latitude.toFixed(5)},${location.longitude.toFixed(5)}`;
}
export function chooseLocation(locations, index) {
  return Number.isInteger(index) && index >= 0 && index < locations.length ? locations[index] : null;
}
export function validateCityQuery(value) {
  if (typeof value !== 'string') throw new SearchValidationError('Enter a city to find its forecast.');
  const query = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (query.length < 2) throw new SearchValidationError('Use at least 2 characters, like “Oslo” or “Paris, France”.');
  if (query.length > 100) throw new SearchValidationError('Keep your search to 100 characters or fewer.');
  if (/[<>\u0000-\u001f\u007f]/.test(query) || !/[\p{L}\p{N}]/u.test(query)) throw new SearchValidationError('Enter a city name using ordinary letters, numbers, and punctuation.');
  return query;
}

export function initializeSearchForm(onSearch) {
  const form = document.getElementById('search-form');
  const input = document.getElementById('city-search');
  const error = document.getElementById('search-error');
  input.disabled = false;
  document.getElementById('search-submit').disabled = typeof onSearch !== 'function';
  input.addEventListener('input', () => { error.textContent = ''; input.removeAttribute('aria-invalid'); });
  form.addEventListener('submit', event => {
    event.preventDefault(); error.textContent = ''; input.removeAttribute('aria-invalid');
    try { const query = validateCityQuery(input.value); if (onSearch) onSearch(query); }
    catch (failure) { error.textContent = failure.message; input.setAttribute('aria-invalid', 'true'); input.focus(); }
  });
  return input;
}

export function initializeCombobox(input, { getLocations, onSelect, onDismiss }) {
  let active = -1;
  const list = document.getElementById('search-results');
  const panel = document.getElementById('search-panel');
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', 'search-results'); input.setAttribute('aria-expanded', 'false');
  function synchronize() {
    active = -1; input.removeAttribute('aria-activedescendant');
    input.setAttribute('aria-expanded', !panel.hidden && getLocations().length > 0);
    for (const [index, row] of [...list.children].entries()) { row.id = `city-option-${index}`; row.tabIndex = -1; row.setAttribute('aria-selected', 'false'); }
  }
  function setActive(index) {
    active = index;
    for (const [position, row] of [...list.children].entries()) {
      const selected = position === active; row.classList.toggle('is-active', selected); row.setAttribute('aria-selected', selected);
      if (selected) { input.setAttribute('aria-activedescendant', row.id); row.scrollIntoView({ block: 'nearest' }); }
    }
  }
  input.addEventListener('keydown', event => {
    const locations = getLocations();
    if (event.key === 'Escape') { onDismiss(); event.preventDefault(); return; }
    if (panel.hidden || !locations.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = active === -1 ? event.key === 'ArrowDown' ? 0 : locations.length - 1 : (active + (event.key === 'ArrowDown' ? 1 : -1) + locations.length) % locations.length;
      setActive(next);
    } else if (event.key === 'Enter' && active !== -1) { event.preventDefault(); onSelect(locations[active]); }
    else if ((event.key === 'Home' || event.key === 'End') && active !== -1) { event.preventDefault(); setActive(event.key === 'Home' ? 0 : locations.length - 1); }
    else if (event.key === 'Tab') onDismiss();
  });
  synchronize();
  return { synchronize };
}
