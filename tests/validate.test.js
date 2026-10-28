import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanCopy, cleanJuice, cleanSettings } from '../netlify/functions/lib/validate.js';
import { DEFAULT_JUICES, DEFAULT_SETTINGS, ingredientPhoto, prepareJuices } from '../assets/js/shared/catalog.js';

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

test('ingredient photos live in one shared library, only from our own uploads', () => {
	// A juice never stores its own copy, so a photo change can't miss a juice
	assert.equal(cleanJuice({ ...DEFAULT_JUICES[0], ingredientImages: { mango: '/api/images/m.webp' } }).value.ingredientImages, undefined);
	const { value } = cleanSettings({ ...DEFAULT_SETTINGS, ingredientPhotos: { 'Dragon Fruit': '/api/images/a.webp', Oranges: '/api/images/o.webp', kiwi: 'https://evil.example/k.png' } }, DEFAULT_SETTINGS);
	assert.deepEqual(value.ingredientPhotos, { 'dragon fruit': '/api/images/a.webp', orange: '/api/images/o.webp' });
	// Saving other settings leaves the library alone
	const { ingredientPhotos, ...rest } = DEFAULT_SETTINGS;
	assert.deepEqual(cleanSettings(rest, { ...DEFAULT_SETTINGS, ingredientPhotos: { mango: '/api/images/m.webp' } }).value.ingredientPhotos, { mango: '/api/images/m.webp' });
});

test('one photo per ingredient, whatever the spelling', () => {
	const juice = prepareJuices([DEFAULT_JUICES[0]], { ...DEFAULT_SETTINGS, ingredientPhotos: { orange: '/api/images/o.webp', 'dragon fruit': '/api/images/d.webp' } })[0];
	assert.equal(ingredientPhoto(juice, 'Oranges'), '/api/images/o.webp');
	assert.equal(ingredientPhoto(juice, 'orange '), '/api/images/o.webp');
	assert.equal(ingredientPhoto(juice, 'Dragon  Fruit'), '/api/images/d.webp');
	assert.equal(ingredientPhoto(juice, 'Mangoes'), '/assets/img/ingredients/mango.webp');
	assert.equal(ingredientPhoto(juice, 'Yuzu'), null);
});

test('page text keeps only known fields that differ from the default', () => {
	const { value } = cleanCopy({ 'home.hero.line1': 'Sip up', 'home.hero.line2': 'the sip', 'not.a.field': 'x', 'footer.photo': 'javascript:alert(1)', 'about.wholesale.photo': '/api/images/w.webp' });
	assert.deepEqual(value, { 'home.hero.line1': 'Sip up', 'about.wholesale.photo': '/api/images/w.webp' });
	assert.ok(cleanCopy('nope').error);
});
