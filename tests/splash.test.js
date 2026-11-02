import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { DEFAULT_JUICES, splashUrl } from '../assets/js/shared/catalog.js';
import { cleanJuice } from '../netlify/functions/lib/validate.js';
import { recolorSplash } from '../netlify/functions/lib/splash.js';
import { currentLines } from '../assets/js/shared/order-status.js';
import splashFunction from '../netlify/functions/splash.js';

test('a splash keeps its own image until Hunter picks a color for it', () => {
	assert.equal(splashUrl({ splash: 'berry' }), '/assets/img/splash/berry.webp');
	assert.equal(splashUrl({ splash: 'berry' }, { small: true }), '/assets/img/splash/berry-sm.webp');
	assert.equal(splashUrl({ splash: 'berry', splashColor: '#2F6FD6' }), '/api/splash/berry/2f6fd6.webp');
	assert.equal(splashUrl({ splash: 'berry', splashColor: '#2f6fd6' }, { small: true }), '/api/splash/berry/2f6fd6-sm.webp');
	assert.equal(splashUrl({ splash: 'none', splashColor: '#2f6fd6' }), null);
	assert.equal(splashUrl({ splash: 'berry', splashColor: 'blue' }), '/assets/img/splash/berry.webp');
});

test('splash color and old page addresses are cleaned when a juice is saved', () => {
	const base = DEFAULT_JUICES[2];
	assert.equal(cleanJuice({ ...base, splashColor: '#2F6FD6' }).value.splashColor, '#2f6fd6');
	assert.equal(cleanJuice({ ...base, splashColor: 'url(evil)' }).value.splashColor, '');
	assert.equal(cleanJuice(base).value.splashColor, '');
	const moved = cleanJuice({ ...base, slug: 'simply-blue', formerSlugs: ['simply-red', 'Simply Red', 'simply-blue', ''] }).value;
	assert.deepEqual(moved.formerSlugs, ['simply-red']);
});

test('past orders show a renamed juice under its new name', () => {
	const order = {
		lines: [
			{ slug: 'simply-red', name: 'Simply Red', qty: 2, amount: 16 },
			{ slug: 'retired-juice', name: 'Retired Juice', qty: 1, amount: 8 }
		]
	};
	// Renamed, same page address
	const renamed = currentLines(order, [{ slug: 'simply-red', name: 'Simply Blue' }]);
	assert.deepEqual(renamed[0], { slug: 'simply-red', name: 'Simply Blue', qty: 2, amount: 16, orderedAs: 'Simply Red' });
	// A juice that no longer exists keeps its saved name
	assert.deepEqual(renamed[1], order.lines[1]);
	// Renamed and moved to a new page address
	const moved = currentLines(order, [{ slug: 'simply-blue', name: 'Simply Blue', formerSlugs: ['simply-red'] }]);
	assert.equal(moved[0].slug, 'simply-blue');
	assert.equal(moved[0].name, 'Simply Blue');
	// Unchanged names don't get an "ordered as" note
	assert.equal(currentLines(order, [{ slug: 'simply-red', name: 'Simply Red' }])[0].orderedAs, undefined);
});

test('recoloring keeps the splash shape and paints it the chosen color', async () => {
	const source = 'assets/img/splash/berry-sm.webp';
	const before = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	const out = await recolorSplash(source, '#2f6fd6');
	const after = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	assert.equal(after.info.width, before.info.width);
	assert.equal(after.info.height, before.info.height);

	// Same transparent areas, and the visible pixels now lean blue
	let shapeMismatch = 0;
	let blue = 0;
	let red = 0;
	for (let i = 0; i < after.data.length; i += 4) {
		if (Math.abs(after.data[i + 3] - before.data[i + 3]) > 40) shapeMismatch++;
		if (after.data[i + 3] > 128) {
			blue += after.data[i + 2];
			red += after.data[i];
		}
	}
	assert.ok(shapeMismatch / (after.data.length / 4) < 0.01, 'shape changed');
	assert.ok(blue > red * 1.5, 'not painted blue');
});

test('the splash function only answers for real shapes and colors', async () => {
	const call = (shape, file) => splashFunction(new Request(`http://localhost/api/splash/${shape}/${file}`), { params: { shape, file } });
	assert.equal((await call('berry', 'blue.webp')).status, 404);
	assert.equal((await call('berry', '2F6FD6.webp')).status, 404);
	assert.equal((await call('../secrets', '2f6fd6.webp')).status, 404);
	assert.equal((await call('berry', '2f6fd6.png')).status, 404);
});

test("featured juices: Hunter's picks first, topped up from the menu, never a hidden juice", async () => {
	const { featuredJuices } = await import('../assets/js/shared/catalog.js');
	const { cleanSettings } = await import('../netlify/functions/lib/validate.js');
	const { DEFAULT_SETTINGS } = await import('../assets/js/shared/catalog.js');
	const menu = ['a', 'b', 'c', 'd'].map(slug => ({ slug, image: `/x/${slug}.webp`, active: true }));
	const slugs = list => list.map(j => j.slug);
	assert.deepEqual(slugs(featuredJuices(menu, {})), ['a', 'b', 'c']);
	assert.deepEqual(slugs(featuredJuices(menu, { featured: ['d', 'b'] })), ['d', 'b', 'a']);
	// A picked juice that's since gone inactive is skipped
	const hidden = menu.map(j => (j.slug === 'd' ? { ...j, active: false } : j));
	assert.deepEqual(slugs(featuredJuices(hidden, { featured: ['d', 'b'] })), ['b', 'a', 'c']);
	// Teasers without a photo only where a photo isn't needed
	const teaser = [{ slug: 'soon', active: true }, ...menu];
	assert.deepEqual(slugs(featuredJuices(teaser, { featured: ['soon'] }, { needsPhoto: true })), ['a', 'b', 'c']);
	// Saved as clean slugs, three at most, and kept when other settings are saved
	const saved = cleanSettings({ ...DEFAULT_SETTINGS, featured: ['Simply Blue', 'simply-blue', 'b', 'c', 'd'] }, DEFAULT_SETTINGS).value.featured;
	assert.deepEqual(saved, ['simply-blue', 'b', 'c']);
	const { featured, ...rest } = DEFAULT_SETTINGS;
	assert.deepEqual(cleanSettings(rest, { ...DEFAULT_SETTINGS, featured: ['b'] }).value.featured, ['b']);
});
