import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCityQuery, SearchValidationError } from '../js/search.js';
test('normalizes global city queries and supports disambiguating qualifiers', () => {
  assert.equal(validateCityQuery('  São   Paulo, BR  '), 'São Paulo, BR');
  for (const query of ['Dar es Salaam', '東京', 'Xi’an', "St. John's", 'Paris, France', 'LA']) assert.equal(validateCityQuery(query), query);
});
test('rejects empty, short, excessively long, control-only, and markup searches', () => {
  for (const value of ['', ' ', 'A', null, 12, 'x'.repeat(101), '<img src=x>', '....', 'Paris\u0000']) assert.throws(() => validateCityQuery(value), SearchValidationError);
});
