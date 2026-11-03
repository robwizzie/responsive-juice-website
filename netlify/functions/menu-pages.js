import { featuredJuices, juiceStatus } from '../../assets/js/shared/catalog.js';
import { SITE_URL } from '../../assets/js/shared/seo.js';
import { heroBottle } from '../../assets/js/lib/components.js';
import { getJuices, getSettings } from './lib/store.js';
import { requestOrigin } from './lib/http.js';

/**
 * Serves the homepage and the Juices page with today's menu already in the HTML.
 *
 * Search engines, AI answers and link previews often read a page without running its JavaScript,
 * so the static files alone would show whatever juices they were written with (a renamed juice
 * would live on there). This fills in the homepage's three bottles and adds the current menu as
 * structured data on both pages. The browser code then finds the right bottles already in place.
 */
const FILES = { '/': '/index.html', '/juices': '/juices.html' };
const TRIO = /(<div class="hero__stage" data-hero-trio>)[\s\S]*?(<\/div>\s*<\/div>\s*<\/div>\s*<\/section>)/;

const escapeJson = value => JSON.stringify(value).replace(/</g, '\\u003c');

/** The menu as schema.org data: every juice that's on the site, with its price and page. */
export function menuJsonLd(juices) {
	const items = juices
		.filter(juice => juice.active !== false)
		.map(juice => {
			const status = juiceStatus(juice);
			const item = {
				'@type': 'MenuItem',
				name: juice.name,
				url: `${SITE_URL}/juices/${juice.slug}`,
				description: juice.description || juice.tagline || ''
			};
			if (juice.image) item.image = `${SITE_URL}${juice.image}`;
			if (juice.price)
				item.offers = {
					'@type': 'Offer',
					price: Number(juice.price).toFixed(2),
					priceCurrency: 'USD',
					availability: `https://schema.org/${status === 'available' ? 'InStock' : status === 'sold-out' ? 'SoldOut' : 'PreOrder'}`
				};
			return item;
		});
	return `<script type="application/ld+json" data-menu-ld>${escapeJson({
		'@context': 'https://schema.org',
		'@type': 'Menu',
		'@id': `${SITE_URL}/juices#menu`,
		name: 'SiponPressed juice menu',
		url: `${SITE_URL}/juices`,
		hasMenuSection: { '@type': 'MenuSection', name: 'Cold-pressed juice', hasMenuItem: items }
	})}</script>`;
}

/** Puts the live menu into a page's HTML. */
export function fillPage(path, page, juices, settings) {
	let html = page.replace('</head>', `    ${menuJsonLd(juices)}\n</head>`);
	if (path === '/') {
		const shown = featuredJuices(juices, settings);
		if (shown.length) html = html.replace(TRIO, (_, open, close) => `${open}${shown.map(heroBottle).join('')}\n                    ${close}`);
	}
	return html;
}

export default async (req, context) => {
	const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
	const file = FILES[path];
	// The page file, the settings and the menu all load at once (getJuices waits on the settings itself)
	const pageText = fetch(new URL(file, requestOrigin(req))).then(res => res.text());
	const settings = getSettings();
	const menu = Promise.all([getJuices(settings), settings]);
	menu.catch(() => {});
	const page = await pageText;
	let html = page;
	try {
		const [juices, shopSettings] = await menu;
		html = fillPage(path, page, juices, shopSettings);
	} catch (err) {
		// The page still works without it: the browser fills in the menu as before
		console.warn('Could not add the menu to', path, err.message);
	}
	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'public, max-age=0, must-revalidate',
			'Netlify-CDN-Cache-Control': 'public, durable, max-age=300, stale-while-revalidate=3600',
			// Cleared whenever Hunter saves in the admin
			'Netlify-Cache-Tag': 'pages'
		}
	});
};

export const config = { path: ['/', '/juices', '/juices/'] };
