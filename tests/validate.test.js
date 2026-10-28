import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanCopy, cleanJuice } from '../netlify/functions/lib/validate.js';
import { DEFAULT_JUICES } from '../assets/js/shared/catalog.js';

test('a coming soon juice can be saved without a photo or price, others cannot', () => {
	const teaser = cleanJuice({ name: 'Simply Purple', status: 'coming-soon', statusNote: 'Dropping in March' });
	assert.equal(teaser.error, undefined);
	assert.equal(teaser.value.status, 'coming-soon');
	assert.equal(teaser.value.inStock, false);
	assert.equal(teaser.value.statusNote, 'Dropping in March');
	assert.match(cleanJuice({ name: 'Simply Purple', price: 7 }).error, /photo/);
	// Without its own price a juice uses the shop's bottle price, so it doesn't need one
	assert.equal(cleanJuice({ name: 'Simply Purple', image: '/assets/img/bottles/simply-red.webp' }).error, undefined);
	assert.match(cleanJuice({ name: 'Simply Purple', image: '/assets/img/bottles/simply-red.webp', customPrice: true }).error, /price/);
});

test('backdrop is a preset or an uploaded image, never an outside URL', () => {
	const base = DEFAULT_JUICES[0];
	assert.equal(cleanJuice({ ...base, backdrop: 'cream' }).value.backdrop, 'cream');
	assert.equal(cleanJuice({ ...base, backdrop: '/api/images/abc123.webp' }).value.backdrop, '/api/images/abc123.webp');
	assert.equal(cleanJuice({ ...base, backdrop: 'https://evil.example/x.jpg' }).value.backdrop, 'riverfront');
	assert.equal(cleanJuice({ ...base, status: 'nonsense', inStock: false }).value.status, 'sold-out');
});

test('ingredient photos are kept only for listed ingredients and only from our own uploads', () => {
	const juice = cleanJuice({
		...DEFAULT_JUICES[0],
		ingredients: ['Dragon Fruit', 'Mango'],
		ingredientImages: { 'dragon fruit': '/api/images/a.webp', mango: 'https://evil.example/m.png', kale: '/api/images/k.webp' }
	}).value;
	assert.deepEqual(juice.ingredientImages, { 'dragon fruit': '/api/images/a.webp' });
});

test('page text keeps only known fields that differ from the default', () => {
	const { value } = cleanCopy({ 'home.hero.line1': 'Sip up', 'home.hero.line2': 'the sip', 'not.a.field': 'x', 'footer.photo': 'javascript:alert(1)', 'about.wholesale.photo': '/api/images/w.webp' });
	assert.deepEqual(value, { 'home.hero.line1': 'Sip up', 'about.wholesale.photo': '/api/images/w.webp' });
	assert.ok(cleanCopy('nope').error);
});
