import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_JUICES, DEFAULT_SETTINGS, prepareJuices } from '../assets/js/shared/catalog.js';
import { fillPage } from '../netlify/functions/menu-pages.js';

const juices = prepareJuices(
	DEFAULT_JUICES.map(juice => (juice.slug === 'simply-red' ? { ...juice, name: 'Simply Blue' } : juice)),
	DEFAULT_SETTINGS
);

test('the homepage HTML names the juices on the menu today, not the ones it shipped with', () => {
	const html = fillPage('/', readFileSync('index.html', 'utf8'), juices, DEFAULT_SETTINGS);
	const hero = html.slice(html.indexOf('data-hero-trio'), html.indexOf('</section>', html.indexOf('data-hero-trio')));
	assert.match(hero, /aria-label="Simply Blue"/);
	assert.doesNotMatch(hero, /Simply Red/);
	assert.equal((hero.match(/class="hero__bottle/g) || []).length, 3);
	// The rest of the page is untouched
	assert.ok(html.includes('<!--==================== STATEMENT ====================-->'));
});

test('both menu pages carry the live menu as structured data, without hidden juices', () => {
	const withRetired = [...juices, { ...juices[0], slug: 'retired', name: 'Retired Juice', active: false }];
	const html = fillPage('/juices', readFileSync('juices.html', 'utf8'), withRetired, DEFAULT_SETTINGS);
	const data = JSON.parse(html.match(/<script type="application\/ld\+json" data-menu-ld>(.*?)<\/script>/)[1]);
	const names = data.hasMenuSection.hasMenuItem.map(item => item.name);
	assert.ok(names.includes('Simply Blue'));
	assert.ok(!names.includes('Simply Red'));
	assert.ok(!names.includes('Retired Juice'));
	assert.equal(data.hasMenuSection.hasMenuItem[0].url, 'https://siponpressed.com/juices/simply-orange');
});
