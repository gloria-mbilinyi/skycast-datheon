import { initializeSearchForm } from './search.js';
import { searchLocations, createLatestRequest } from './api.js';
import { renderLocations, setSearchBusy, announce } from './ui.js';

const state = { locations: [], location: null, weather: null, unit: 'celsius', fetchedAt: null, lastQuery: '' };
const searchGate = createLatestRequest();
const searchInput = initializeSearchForm(runSearch);

async function runSearch(query) {
  state.lastQuery = query;
  const request = searchGate.begin();
  state.locations = [];
  renderLocations([], 'Looking for matching cities…'); setSearchBusy(true);
  try {
    const locations = await searchLocations(query, { signal: request.signal });
    if (!request.isCurrent()) return;
    state.locations = locations;
    renderLocations(locations, locations.length ? 'Choose the city and region you mean.' : `No cities found for “${query}”. Try a nearby city or add a country.`);
    announce(locations.length ? `${locations.length} matching locations found.` : 'No matching cities found.');
  } catch (error) {
    if (!request.isCurrent() || error.kind === 'cancelled') return;
    renderLocations([], error.message); announce(error.message);
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
