import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_JUICES } from '../assets/js/shared/catalog.js';
import { PAGE_META, juiceMetaTags, metaTags, pageMetaTags } from '../assets/js/shared/seo.js';

test('every static page has share tags pointing at its drawn card', () => {
	for (const path of Object.keys(PAGE_META)) {
		const html = pageMetaTags(path);
		assert.match(html, /<title>.+<\/title>/);
		assert.match(html, new RegExp(`og:image" content="https://siponpressed.com/og/${PAGE_META[path].og}.png"`));
		assert.match(html, /twitter:card" content="summary_large_image"/);
	}
	assert.match(pageMetaTags('/'), /og:video" content="https:\/\/siponpressed.com\/assets\/videos\/og\/lineup.mp4"/);
	assert.match(pageMetaTags('/404'), /name="robots" content="noindex"/);
});

test('text is escaped and structured data cannot close its script tag', () => {
	const html = metaTags({ path: '/x', title: 'A "quoted" <b>', description: '</script>', image: '/og/home.png', jsonLd: [{ name: '</script>' }] });
	assert.match(html, /<title>A &quot;quoted&quot; &lt;b&gt;<\/title>/);
	assert.equal(html.match(/<\/script>/g).length, 1);
});

test('juice pages get a versioned card, product data and preview-relative links', () => {
	const juice = { ...DEFAULT_JUICES[0], status: 'sold-out' };
	const html = juiceMetaTags(juice, { site: 'https://preview.netlify.app', status: 'sold-out', version: 'abc123', hasVideo: true });
	assert.match(html, /og:image" content="https:\/\/preview.netlify.app\/og\/juices\/simply-orange.png\?v=abc123"/);
	assert.match(html, /og:video" content="https:\/\/preview.netlify.app\/assets\/videos\/og\/simply-orange.mp4"/);
	assert.match(html, /<link rel="canonical" href="https:\/\/siponpressed.com\/juices\/simply-orange">/);
	assert.match(html, /schema.org\/OutOfStock/);
});
