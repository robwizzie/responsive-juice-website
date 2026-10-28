import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_SETTINGS } from '../assets/js/shared/catalog.js';
import { COPY_FIELDS, DEFAULT_COPY, copyText, fillTokens } from '../assets/js/shared/content.js';
import { applyCopy } from '../netlify/functions/lib/copy-html.js';

const PAGES = ['index.html', 'juices.html', 'about.html', 'contact.html', 'order.html'];
const decode = html => html.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const marked = html => [...html.matchAll(/<([a-z][a-z0-9]*)\s[^>]*?\bdata-copy="([^"]+)"[^>]*>([^<]*)<\/\1>/g)].map(([, , key, inner]) => ({ key, inner }));

test('every editable spot on the pages is a known field, and the page ships its default text', () => {
	const seen = new Set();
	for (const file of PAGES) {
		const html = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
		const marks = marked(html);
		assert.equal(marks.length, (html.match(/data-copy="/g) || []).length, `${file}: every data-copy element holds plain text`);
		for (const { key, inner } of marks) {
			assert.ok(key in DEFAULT_COPY, `${file}: ${key} is a field in shared/content.js`);
			assert.equal(decode(inner).trim(), copyText(DEFAULT_COPY, key, DEFAULT_SETTINGS), `${file}: ${key}`);
			seen.add(key);
		}
	}
	assert.equal(new Set(COPY_FIELDS.map(f => f.key)).size, COPY_FIELDS.length, 'field keys are unique');
});

test('saved text is written into the page HTML, escaped, with tokens filled in', () => {
	const html = '<h1 class="t" data-copy="home.hero.line1">Embrace</h1><p data-copy="home.ways.title">x</p><p>other</p>';
	const settings = { ...DEFAULT_SETTINGS, delivery: { ...DEFAULT_SETTINGS.delivery, day: 3 } };
	const out = applyCopy(html, { ...DEFAULT_COPY, 'home.hero.line1': 'Sip <b>loud</b>' }, settings);
	assert.equal(out, '<h1 class="t" data-copy="home.hero.line1">Sip &lt;b&gt;loud&lt;/b&gt;</h1><p data-copy="home.ways.title">Pickup in Philadelphia or Wednesday delivery</p><p>other</p>');
});

test('tokens', () => {
	assert.equal(fillTokens('Only {price} a bottle', DEFAULT_SETTINGS), 'Only $8 a bottle');
	assert.equal(fillTokens('{price}', { ...DEFAULT_SETTINGS, bottlePrice: 8.5 }), '$8.50');
	assert.equal(fillTokens('{count} things, {nope}', DEFAULT_SETTINGS, { count: 4 }), '4 things, {nope}');
	// An emptied field falls back to the default rather than leaving a hole in the page
	assert.equal(copyText({ 'home.hero.line1': '  ' }, 'home.hero.line1', DEFAULT_SETTINGS), 'Embrace');
});
