import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanJuice } from '../netlify/functions/lib/validate.js';
import { DEFAULT_JUICES } from '../assets/js/shared/catalog.js';

test('a coming soon juice can be saved without a photo or price, others cannot', () => {
	const teaser = cleanJuice({ name: 'Simply Purple', status: 'coming-soon', statusNote: 'Dropping in March' });
	assert.equal(teaser.error, undefined);
	assert.equal(teaser.value.status, 'coming-soon');
	assert.equal(teaser.value.inStock, false);
	assert.equal(teaser.value.statusNote, 'Dropping in March');
	assert.match(cleanJuice({ name: 'Simply Purple', price: 7 }).error, /photo/);
	assert.match(cleanJuice({ name: 'Simply Purple', image: '/assets/img/bottles/simply-red.webp' }).error, /price/);
});

test('backdrop is a preset or an uploaded image, never an outside URL', () => {
	const base = DEFAULT_JUICES[0];
	assert.equal(cleanJuice({ ...base, backdrop: 'cream' }).value.backdrop, 'cream');
	assert.equal(cleanJuice({ ...base, backdrop: '/api/images/abc123.webp' }).value.backdrop, '/api/images/abc123.webp');
	assert.equal(cleanJuice({ ...base, backdrop: 'https://evil.example/x.jpg' }).value.backdrop, 'riverfront');
	assert.equal(cleanJuice({ ...base, status: 'nonsense', inStock: false }).value.status, 'sold-out');
});
