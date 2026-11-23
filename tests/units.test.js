import test from 'node:test';
import assert from 'node:assert/strict';
import { convertTemperature, temperatureText } from '../js/utils.js';
test('temperature conversion uses Celsius as source and covers zero and negative values', () => {
  assert.equal(convertTemperature(0, 'fahrenheit'), 32); assert.equal(convertTemperature(100, 'fahrenheit'), 212); assert.equal(convertTemperature(-40, 'fahrenheit'), -40); assert.equal(convertTemperature(26.4, 'celsius'), 26.4);
  assert.equal(temperatureText(26.4, 'fahrenheit'), '80°F'); assert.equal(temperatureText(-3, 'celsius'), '-3°C');
});
test('missing temperatures stay unavailable rather than turning into 32 degrees', () => {
  for (const value of [null, undefined, NaN, '25']) { assert.equal(convertTemperature(value, 'fahrenheit'), null); assert.equal(temperatureText(value, 'fahrenheit'), 'Unavailable'); }
  assert.throws(() => convertTemperature(10, 'kelvin'));
});
