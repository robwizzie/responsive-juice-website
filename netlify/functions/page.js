import { getCopy, getSettings } from './lib/store.js';
import { applyCopy } from './lib/copy-html.js';
import { requestOrigin } from './lib/http.js';

// Public path -> the static page it's built from
const FILES = { '/': '/index.html', '/juices': '/juices.html', '/about': '/about.html', '/contact': '/contact.html', '/order': '/order.html' };
const LOOP_GUARD = 'x-siponpressed-page';

// Serves the main pages with the text Hunter set in /admin → Pages already in the HTML.
// If the saved text can't be read it serves the page as committed, and the browser fills his
// text in from /api/catalog, so an edit can never take a page down.
export default async (req, context) => {
	const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
	const file = FILES[path];
	if (!file || req.headers.get(LOOP_GUARD)) return new Response('Not found', { status: 404 });

	const origin = requestOrigin(req);
	const res = await fetch(new URL(file, origin), { headers: { [LOOP_GUARD]: '1' } }).catch(() => null);
	if (!res?.ok) return new Response('Something went wrong loading this page. Please refresh.', { status: 502 });
	const page = await res.text();

	let html = page;
	try {
		const settings = await getSettings();
		html = applyCopy(page, await getCopy(), settings);
	} catch (err) {
		console.warn('Serving page without saved text', err.message);
	}
	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'public, max-age=0, must-revalidate',
			'Netlify-CDN-Cache-Control': 'public, durable, max-age=300, stale-while-revalidate=3600',
			'Netlify-Cache-Tag': 'og,pages'
		}
	});
};

export const config = { path: ['/', '/juices', '/about', '/contact', '/order'] };
