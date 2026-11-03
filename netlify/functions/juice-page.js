import { juiceStatus } from '../../assets/js/shared/catalog.js';
import { juiceMetaTags, juiceVideo } from '../../assets/js/shared/seo.js';
import { getJuices } from './lib/store.js';
import { requestOrigin } from './lib/http.js';

// Juices from the previous menu that became one of today's, sent to that flavor
export const OLD_SLUGS = {
	'tropical-storm': '/juices/simply-orange',
	'sweet-green': '/juices/simply-green',
	'strawberry-lemonade': '/juices/simply-red'
};

// Juices from the previous menu with no replacement. They answer "410 Gone" so search engines
// drop them (a redirect to the menu keeps the old listing alive as a near-duplicate); people
// still land on the menu, since the page sends anyone without a juice there.
export const RETIRED_SLUGS = ['sour-punch', 'strawberry-banana', 'electric-berry-lemonade', 'midnight-rush', 'cinnamon-green-apple'];

const NOINDEX = '<!-- meta:start -->\n    <meta name="robots" content="noindex">\n    <title>Not on the menu | SiponPressed</title>\n    <!-- meta:end -->';

const META = /<!-- meta:start[^>]*-->[\s\S]*?<!-- meta:end -->/;

// A short hash so a changed juice gets a new share-image address (link previews cache by URL)
async function versionOf(juice) {
	const key = JSON.stringify([juice.name, juice.tagline, juice.price, juice.color, juice.image, juice.splash, juice.splashColor, juiceStatus(juice), juice.statusNote]);
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
	const gone = () => page.replace(META, () => NOINDEX);
	if (!juice) {
		// A juice whose page address Hunter changed: send old links to its new page
		const moved = juices.find(item => item.active && item.formerSlugs?.includes(slug));
		if (moved) return new Response(null, { status: 301, headers: { Location: `/juices/${moved.slug}` } });
		// Not a juice (any more): kept out of search results; the page sends visitors to the menu
		const status = RETIRED_SLUGS.includes(slug) ? 410 : 404;
		return new Response(gone(), { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' } });
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
