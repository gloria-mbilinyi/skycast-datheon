import { initializeSearchForm, chooseLocation } from './search.js';
import { searchLocations, fetchWeather, createLatestRequest, ApiError, errorDetails } from './api.js';
import { normalizeWeather } from './weather.js';
import { renderLocations, renderLocation, renderCurrentWeather, setSearchBusy, announce, configureRetry } from './ui.js';

const state = { locations: [], location: null, weather: null, unit: 'celsius', fetchedAt: null, lastQuery: '' };
const searchGate = createLatestRequest();
const weatherGate = createLatestRequest();
let searchRetryAt = 0; let weatherRetryAt = 0;
const searchInput = initializeSearchForm(runSearch);

async function runSearch(query) {
  document.getElementById('search-error').textContent = ''; searchInput.removeAttribute('aria-invalid');
  document.getElementById('search-retry').hidden = true;
  state.lastQuery = query;
  const request = searchGate.begin();
  state.locations = [];
  renderLocations([], 'Looking for matching cities…'); setSearchBusy(true);
  try {
    if (Date.now() < searchRetryAt) throw new ApiError('rate-limit', 'Please wait for the search rate limit to clear.', { retryAt: searchRetryAt });
    const locations = await searchLocations(query, { signal: request.signal });
    if (!request.isCurrent()) return;
    state.locations = locations;
    renderLocations(locations, locations.length ? 'Choose the city and region you mean.' : `No cities found for “${query}”. Try a nearby city or add a country.`);
    announce(locations.length ? `${locations.length} matching locations found.` : 'No matching cities found.');
  } catch (error) {
    if (!request.isCurrent() || error.kind === 'cancelled') return;
    const details = errorDetails(error); searchRetryAt = details.retryAt;
    renderLocations([], `${details.title} ${details.message}`);
    document.getElementById('search-retry').hidden = false;
    configureRetry('search-retry', searchRetryAt, 'Try search again');
    configureRetry('search-submit', searchRetryAt, 'Find forecast');
    announce(details.message);
  } finally { if (request.isCurrent()) setSearchBusy(false); }
}

searchInput.addEventListener('input', () => {
  searchGate.cancel(); state.locations = [];
  document.getElementById('search-panel').hidden = true; setSearchBusy(false);
});
for (const button of document.querySelectorAll('[data-example]')) {
  button.disabled = false;
  button.addEventListener('click', () => { searchInput.value = button.dataset.example; runSearch(button.dataset.example); searchInput.focus(); });
}

function selectLocation(location) {
  searchGate.cancel(); setSearchBusy(false);
  state.location = location; state.weather = null;
  searchInput.value = [location.name, location.countryCode].filter(Boolean).join(', ');
  document.getElementById('search-panel').hidden = true;
  document.getElementById('weather-content').hidden = true;
  document.getElementById('weather-error').hidden = true;
  renderLocation(location);
  document.getElementById('location-name').focus();
  announce(`Selected ${location.name}, ${location.country || location.admin1 || 'region unavailable'}.`);
  loadWeather(location);
}

async function loadWeather(location) {
  const request = weatherGate.begin();
  state.weather = null;
  document.body.dataset.weather = 'neutral';
  document.getElementById('forecast-nav').hidden = true;
  document.getElementById('stale-notice').hidden = true;
  document.getElementById('weather-content').hidden = true;
  document.getElementById('weather-error').hidden = true;
  document.getElementById('weather-loading').hidden = false;
  document.getElementById('weather-shell').setAttribute('aria-busy', 'true');
  document.getElementById('refresh-weather').disabled = false;
  try {
    if (Date.now() < weatherRetryAt) throw new ApiError('rate-limit', 'Please wait for the forecast rate limit to clear.', { retryAt: weatherRetryAt });
    const response = await fetchWeather(location, { signal: request.signal });
    if (!request.isCurrent()) return;
    state.response = response; state.weather = normalizeWeather(response); state.fetchedAt = Date.now();
    renderCurrentWeather(state.weather, location, state.fetchedAt);
    announce(`Weather estimates loaded for ${location.name}.`);
  } catch (error) {
    if (!request.isCurrent() || error.kind === 'cancelled') return;
    const details = errorDetails(error); weatherRetryAt = details.retryAt;
    document.getElementById('weather-error-title').textContent = details.title;
    document.getElementById('weather-error-message').textContent = details.message;
    document.getElementById('weather-error').hidden = false;
    configureRetry('weather-retry', weatherRetryAt);
    configureRetry('refresh-weather', weatherRetryAt, 'Refresh');
    announce(details.message);
  } finally {
    if (request.isCurrent()) { document.getElementById('weather-loading').hidden = true; document.getElementById('weather-shell').setAttribute('aria-busy', 'false'); }
  }
}
document.getElementById('refresh-weather').addEventListener('click', () => { if (state.location) loadWeather(state.location); });
document.getElementById('weather-retry').addEventListener('click', () => { if (state.location) loadWeather(state.location); });
document.getElementById('search-retry').addEventListener('click', () => { if (state.lastQuery) runSearch(state.lastQuery); });

const resultList = document.getElementById('search-results');
function activateResult(event) {
  const row = event.target.closest('.search-result');
  if (!row) return;
  const location = chooseLocation(state.locations, Number(row.dataset.index));
  if (location) selectLocation(location);
}
resultList.addEventListener('click', activateResult);
resultList.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activateResult(event); } });
