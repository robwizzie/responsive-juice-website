import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { sitemapXml } from '../netlify/functions/sitemap.js';
import { config as gone } from '../netlify/functions/gone.js';
import { OLD_SLUGS, RETIRED_SLUGS } from '../netlify/functions/juice-page.js';

test('the sitemap lists today’s bottle photos, never a hidden juice', () => {
	const xml = sitemapXml([
		{ slug: 'simply-red', name: 'Simply Blue', image: '/api/images/blue.png', active: true },
		{ slug: 'old-one', name: 'Old One', image: '/x.png', active: false }
	]);
	assert.match(xml, /<loc>https:\/\/siponpressed.com\/juices\/simply-red<\/loc>/);
	assert.match(xml, /<image:loc>https:\/\/siponpressed.com\/api\/images\/blue.png<\/image:loc><image:title>Simply Blue cold-pressed juice/);
	assert.doesNotMatch(xml, /old-one|Old One/);
});

test('search engines may fetch uploaded photos even though the rest of /api is off limits', () => {
	const robots = readFileSync('robots.txt', 'utf8');
	assert.match(robots, /Allow: \/api\/images\//);
	assert.match(robots, /Allow: \/api\/splash\//);
});

test('old-site addresses are gone, and none of them is something the site still uses', () => {
	for (const path of gone.path) {
		const file = path.replace(/^\//, '').replace('/*', '');
		assert.equal(existsSync(file), false, `${file} still exists but is marked gone`);
	}
	assert.ok(RETIRED_SLUGS.every(slug => !OLD_SLUGS[slug]));
});
