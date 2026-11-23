import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCityQuery, SearchValidationError, normalizeLocation, locationKey, chooseLocation } from '../js/search.js';
test('normalizes global city queries and supports disambiguating qualifiers', () => {
  assert.equal(validateCityQuery('  São   Paulo, BR  '), 'São Paulo, BR');
  for (const query of ['Dar es Salaam', '東京', 'Xi’an', "St. John's", 'Paris, France', 'LA']) assert.equal(validateCityQuery(query), query);
});
test('rejects empty, short, excessively long, control-only, and markup searches', () => {
  for (const value of ['', ' ', 'A', null, 12, 'x'.repeat(101), '<img src=x>', '....', 'Paris\u0000']) assert.throws(() => validateCityQuery(value), SearchValidationError);
});
test('location selection distinguishes identical names by validated coordinates', () => {
  const first = normalizeLocation({ id: 1, name: 'Springfield', country: 'United States', latitude: 39.8, longitude: -89.6 });
  const second = normalizeLocation({ id: 2, name: 'Springfield', latitude: 44, longitude: -123 });
  assert.notEqual(locationKey(first), locationKey(second));
  assert.equal(chooseLocation([first, second], 1), second);
  assert.equal(chooseLocation([first], -1), null); assert.equal(chooseLocation([first], 0.5), null);
  assert.equal(normalizeLocation({ name: 'Bad', latitude: 999, longitude: 2 }), null);
});
