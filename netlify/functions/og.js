import { getJuices, getSettings } from './lib/store.js';
import { renderCard } from './lib/og.js';
import { requestOrigin } from './lib/http.js';

const PAGES = new Set(['home', 'juices', 'order', 'about', 'contact']);

// Share images, drawn from the live menu: /og/home.png, /og/juices.png, /og/juices/simply-red.png …
// Netlify's CDN keeps a copy for an hour, and saving in /admin clears it (cache tag "og").
export default async (req, context) => {
	const name = (value = '') => value.replace(/\.png$/, '');
	const [juices, settings] = await Promise.all([getJuices(), getSettings()]);
	const active = juices.filter(juice => juice.active);
	let juice = null;
	let page = 'home';
	if (context.params.slug) {
		juice = juices.find(item => item.slug === name(context.params.slug));
		if (!juice) return new Response('Not found', { status: 404 });
	} else if (PAGES.has(name(context.params.page))) {
		page = name(context.params.page);
	}

	const png = await renderCard({ origin: requestOrigin(req), page, juice, juices: active, settings });
	return new Response(png, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=600',
			'Netlify-CDN-Cache-Control': 'public, durable, max-age=3600, stale-while-revalidate=86400',
			'Netlify-Cache-Tag': 'og'
		}
	});
};

export const config = { path: ['/og/juices/:slug', '/og/:page'] };
