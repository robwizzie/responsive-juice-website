import { juiceStatus } from '../../assets/js/shared/catalog.js';
import { juiceMetaTags, juiceVideo } from '../../assets/js/shared/seo.js';
import { getJuices } from './lib/store.js';
import { requestOrigin } from './lib/http.js';

// Juices from the previous menu, sent to their closest new flavor
const OLD_SLUGS = {
	'tropical-storm': '/juices/simply-orange',
	'sweet-green': '/juices/simply-green',
	'strawberry-lemonade': '/juices/simply-red',
	'sour-punch': '/juices',
	'strawberry-banana': '/juices',
	'electric-berry-lemonade': '/juices',
	'midnight-rush': '/juices',
	'cinnamon-green-apple': '/juices'
};

const META = /<!-- meta:start[^>]*-->[\s\S]*?<!-- meta:end -->/;

// A short hash so a changed juice gets a new share-image address (link previews cache by URL)
async function versionOf(juice) {
	const key = JSON.stringify([juice.name, juice.tagline, juice.price, juice.color, juice.image, juice.splash, juiceStatus(juice), juice.statusNote]);
	const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(key));
	return Buffer.from(digest).toString('hex').slice(0, 8);
}

async function exists(url) {
	try {
		const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(1500) });
		return res.ok;
	} catch {
		return false;
	}
}

// Serves juice.html for /juices/<slug> with that juice's title, description and share tags
// already in the <head>, since link previews and most crawlers don't run JavaScript.
export default async (req, context) => {
	const slug = context.params.slug;
	if (OLD_SLUGS[slug]) return new Response(null, { status: 301, headers: { Location: OLD_SLUGS[slug] } });

	const origin = requestOrigin(req);
	const [page, juices] = await Promise.all([fetch(new URL('/juice.html', origin)).then(res => res.text()), getJuices()]);
	const juice = juices.find(item => item.slug === slug && item.active);
	if (!juice) {
		// The page shows its own "not found" message
		return new Response(page, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
	}

	const [version, hasVideo] = await Promise.all([versionOf(juice), exists(new URL(juiceVideo(slug), origin))]);
	// Deploy previews point share tags at themselves so they can be tested before going live
	const site = context.deploy?.context === 'production' ? undefined : origin;
	const tags = juiceMetaTags(juice, { site, hasVideo, status: juiceStatus(juice), version });
	const html = page.replace(META, () => `<!-- meta:start -->\n    ${tags.replace(/\n/g, '\n    ')}\n    <!-- meta:end -->`);
	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'public, max-age=0, must-revalidate',
			'Netlify-CDN-Cache-Control': 'public, durable, max-age=300, stale-while-revalidate=3600',
			'Netlify-Cache-Tag': 'og'
		}
	});
};

export const config = { path: '/juices/:slug' };
