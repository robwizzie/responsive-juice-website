/**
 * Addresses from the old site (pages, juice photos, nutrition labels, share images) that no longer
 * exist. They answer "410 Gone" rather than a plain 404 so Google drops them from search and
 * Google Images quickly instead of showing the old bottles. Nothing on today's site uses these.
 */
const OLD_PAGES = ['all-juices', 'juice-details', 'athletes', 'checkout', 'cancel', 'sour-punch', 'strawberry-banana', 'electric-berry-lemonade', 'midnight-rush', 'cinnamon-green-apple', 'strawberry-lemonade', 'sweet-green', 'tropical-storm'];
const OLD_FILES = ['favicon.png', 'hunter.webp', 'hunter-sm.webp', 'juice-og-image.png', 'leaf.png', 'nav-img.png', 'nav-img.webp', 'shape-bg.png', 'shape-bg.webp'];

export default async () =>
	new Response('This page is no longer on SiponPressed. See the menu at https://siponpressed.com/juices', {
		status: 410,
		headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'public, max-age=86400' }
	});

export const config = {
	path: [
		'/assets/img/juices/*',
		'/assets/img/nutrition-facts/*',
		'/assets/img/og-images/*',
		'/assets/img/athletes/*',
		'/assets/img/branding/*',
		...OLD_FILES.map(file => `/assets/img/${file}`),
		...OLD_PAGES.map(page => `/${page}.html`)
	]
};
