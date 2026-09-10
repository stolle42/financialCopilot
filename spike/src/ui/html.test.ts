import { test } from 'node:test';
import assert from 'node:assert/strict';

import { html, raw, renderToString, formatMinor } from './html.ts';

test('interpolated values are escaped by default', () => {
  const nasty = '<script>alert(1)</script>';
  const out = renderToString(html`<p>${nasty}</p>`);
  assert.equal(out, '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
});

test('raw() opts out deliberately', () => {
  const out = renderToString(html`<div>${raw('<b>bold</b>')}</div>`);
  assert.equal(out, '<div><b>bold</b></div>');
});

test('nested templates and arrays compose', () => {
  const items = ['a', 'b'].map((x) => html`<li>${x}</li>`);
  assert.equal(renderToString(html`<ul>${items}</ul>`), '<ul><li>a</li><li>b</li></ul>');
});

test('minor units format without floating point', () => {
  assert.equal(formatMinor(1250), '12.50');
  assert.equal(formatMinor(5), '0.05');
  assert.equal(formatMinor(100000), '1000.00');
});
