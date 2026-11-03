/**
 * Addresses from the old site (pages, juice photos, nutrition labels, share images) that no longer
 * exist. They answer "410 Gone" rather than a plain 404 so Google drops them from search and
 * Google Images quickly instead of showing the old bottles. Nothing on today's site uses these.
 */
export default async () =>
	new Response('This page is no longer on SiponPressed. See the menu at https://siponpressed.com/juices', {
		status: 410,
		headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'public, max-age=86400' }
	});

// Written out in full: Netlify reads this without running the code, so it must be a plain list
export const config = {
	path: [
		'/assets/img/juices/*',
		'/assets/img/nutrition-facts/*',
		'/assets/img/og-images/*',
		'/assets/img/athletes/*',
		'/assets/img/branding/*',
		'/assets/img/favicon.png',
		'/assets/img/hunter.webp',
		'/assets/img/hunter-sm.webp',
		'/assets/img/juice-og-image.png',
		'/assets/img/leaf.png',
		'/assets/img/nav-img.png',
		'/assets/img/nav-img.webp',
		'/assets/img/shape-bg.png',
		'/assets/img/shape-bg.webp',
		'/all-juices.html',
		'/juice-details.html',
		'/athletes.html',
		'/checkout.html',
		'/cancel.html',
		'/sour-punch.html',
		'/strawberry-banana.html',
		'/electric-berry-lemonade.html',
		'/midnight-rush.html',
		'/cinnamon-green-apple.html',
		'/strawberry-lemonade.html',
		'/sweet-green.html',
		'/tropical-storm.html'
	]
};
