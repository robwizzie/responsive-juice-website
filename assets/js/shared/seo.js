/**
 * Titles, descriptions and share-preview tags for every page.
 *
 * Static pages get these baked into their <head> by scripts/bake-header.mjs. Juice pages are
 * served by netlify/functions/juice-page.js, which fills them from the live menu, because link
 * previews never run the page's JavaScript.
 */

export const SITE_URL = 'https://siponpressed.com';
export const SITE_NAME = 'SiponPressed';
export const INSTAGRAM_URL = 'https://instagram.com/siponpressed';

// Short looping clips for link previews that play video (iMessage, Discord, Facebook, LinkedIn).
// Made by scripts/make-og-videos.mjs; everything else shows the og:image.
export const LINEUP_VIDEO = '/assets/videos/og/lineup.mp4';
export const juiceVideo = slug => `/assets/videos/og/${slug}.mp4`;
export const OG_VIDEO_SIZE = { width: 1200, height: 630 };

const escape = value =>
	String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

const BUSINESS = {
	'@type': ['LocalBusiness', 'FoodEstablishment'],
	'@id': `${SITE_URL}/#business`,
	name: SITE_NAME,
	slogan: 'Embrace the sip.',
	description: 'Small-batch cold-pressed juice made by Hunter in Philadelphia.',
	url: `${SITE_URL}/`,
	logo: `${SITE_URL}/assets/img/brand/icon-512.png`,
	image: `${SITE_URL}/og/home.png`,
	email: 'siponpressed@yahoo.com',
	priceRange: '$',
	servesCuisine: 'Cold-pressed juice',
	address: { '@type': 'PostalAddress', addressLocality: 'Philadelphia', addressRegion: 'PA', addressCountry: 'US' },
	areaServed: ['Philadelphia, PA', 'South Jersey'],
	founder: { '@type': 'Person', name: 'Hunter' },
	sameAs: [INSTAGRAM_URL]
};

/** The static pages. `og` is the share card at /og/<og>.png; `video` adds the lineup clip. */
export const PAGE_META = {
	'/': {
		title: 'SiponPressed | Cold-Pressed Juice in Philadelphia',
		shareTitle: 'SiponPressed | Embrace the sip',
		description:
			'Small-batch cold-pressed juice made by Hunter in Philadelphia from whole fruit and greens. Order for pickup in Philly or Monday delivery in South Jersey.',
		og: 'home',
		imageAlt: 'SiponPressed cold-pressed juice bottles on a lime background',
		video: true,
		jsonLd: [{ '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: SITE_NAME, url: `${SITE_URL}/` }, BUSINESS]
	},
	'/juices': {
		title: 'The Menu | SiponPressed',
		shareTitle: "This week's juices | SiponPressed",
		description:
			'Cold-pressed juice made from whole fruit and greens in Philadelphia. See every bottle on the menu with ingredients, calories and nutrition.',
		og: 'juices',
		imageAlt: "This week's SiponPressed juices",
		video: true
	},
	'/order': {
		title: 'Order | SiponPressed',
		shareTitle: 'Order fresh juice | SiponPressed',
		description: 'Order SiponPressed cold-pressed juice for pickup in Philadelphia or Monday delivery in South Jersey.',
		og: 'order',
		imageAlt: 'Order SiponPressed cold-pressed juice',
		video: true
	},
	'/about': {
		title: 'About Hunter | SiponPressed',
		shareTitle: "Hey, I'm Hunter | SiponPressed",
		description: 'SiponPressed is a one-person cold-pressed juice company. Meet Hunter, the guy pressing every bottle in Philadelphia.',
		og: 'about',
		imageAlt: 'Hunter, the founder of SiponPressed',
		jsonLd: [{ '@type': 'AboutPage', url: `${SITE_URL}/about`, about: { '@id': `${SITE_URL}/#business` } }]
	},
	'/contact': {
		title: 'Contact | SiponPressed',
		shareTitle: 'Say hello | SiponPressed',
		description: 'Questions, wholesale for your studio or cafe, or an order? Get in touch with SiponPressed.',
		og: 'contact',
		imageAlt: 'Get in touch with SiponPressed',
		jsonLd: [{ '@type': 'ContactPage', url: `${SITE_URL}/contact`, about: { '@id': `${SITE_URL}/#business` } }]
	},
	'/success': { title: 'Order confirmed | SiponPressed', description: 'Thanks for your SiponPressed order.', og: 'home', noindex: true },
	'/404': { title: 'Page not found | SiponPressed', description: 'That page could not be found.', og: 'home', noindex: true },
	// Placeholder for juice.html; the juice-page function swaps in the real juice
	'/juices/juice': { title: 'Juice | SiponPressed', description: 'Cold-pressed juice made by Hunter in Philadelphia.', og: 'juices', noindex: true }
};

/**
 * The <head> tags for a page. `image` and `video` are site paths; `site` is the origin to
 * make them absolute with (the live domain, or a deploy preview's own address).
 */
export function metaTags({ path, title, shareTitle, description, image, imageAlt, video, type = 'website', noindex, jsonLd, site = SITE_URL }) {
	const abs = value => new URL(value, site).href;
	const canonical = `${SITE_URL}${path === '/' ? '/' : path}`;
	const tags = [
		`<title>${escape(title)}</title>`,
		`<meta name="description" content="${escape(description)}">`,
		noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${canonical}">`,
		`<meta property="og:type" content="${type}">`,
		`<meta property="og:site_name" content="${SITE_NAME}">`,
		`<meta property="og:locale" content="en_US">`,
		`<meta property="og:url" content="${canonical}">`,
		`<meta property="og:title" content="${escape(shareTitle || title)}">`,
		`<meta property="og:description" content="${escape(description)}">`,
		`<meta property="og:image" content="${abs(image)}">`,
		`<meta property="og:image:type" content="image/png">`,
		`<meta property="og:image:width" content="1200">`,
		`<meta property="og:image:height" content="630">`,
		`<meta property="og:image:alt" content="${escape(imageAlt || shareTitle || title)}">`
	];
	if (video) {
		tags.push(
			`<meta property="og:video" content="${abs(video)}">`,
			`<meta property="og:video:secure_url" content="${abs(video)}">`,
			`<meta property="og:video:type" content="video/mp4">`,
			`<meta property="og:video:width" content="${OG_VIDEO_SIZE.width}">`,
			`<meta property="og:video:height" content="${OG_VIDEO_SIZE.height}">`
		);
	}
	tags.push(
		`<meta name="twitter:card" content="summary_large_image">`,
		`<meta name="twitter:title" content="${escape(shareTitle || title)}">`,
		`<meta name="twitter:description" content="${escape(description)}">`,
		`<meta name="twitter:image" content="${abs(image)}">`,
		`<meta name="twitter:image:alt" content="${escape(imageAlt || shareTitle || title)}">`
	);
	if (jsonLd?.length) {
		const graph = JSON.stringify({ '@context': 'https://schema.org', '@graph': jsonLd }).replace(/</g, '\\u003c');
		tags.push(`<script type="application/ld+json">${graph}</script>`);
	}
	return tags.join('\n');
}

/** Head tags for one of the static pages in PAGE_META. `site` points the images at a deploy preview. */
export const pageMetaTags = (path, site = SITE_URL) => {
	const page = PAGE_META[path];
	return metaTags({ path, ...page, site, image: `/og/${page.og}.png`, video: page.video ? LINEUP_VIDEO : null });
};

/** Head tags and structured data for a juice's page. */
export function juiceMetaTags(juice, { site, hasVideo, status, version } = {}) {
	const path = `/juices/${juice.slug}`;
	const ingredients = juice.ingredients?.length ? `${juice.ingredients.join(', ')}. ` : '';
	const description = `${juice.tagline ? `${juice.tagline}. ` : ''}${ingredients}Cold-pressed in Philadelphia by SiponPressed.`;
	const image = `/og/juices/${juice.slug}.png${version ? `?v=${version}` : ''}`;
	const availability = { available: 'InStock', 'sold-out': 'OutOfStock', 'coming-soon': 'PreOrder' }[status] || 'InStock';
	const product = {
		'@type': 'Product',
		name: juice.name,
		description: juice.description || description,
		image: [`${SITE_URL}${image}`],
		brand: { '@type': 'Brand', name: SITE_NAME },
		url: `${SITE_URL}${path}`,
		...(Number(juice.price) && status !== 'coming-soon'
			? {
					offers: {
						'@type': 'Offer',
						price: Number(juice.price).toFixed(2),
						priceCurrency: 'USD',
						availability: `https://schema.org/${availability}`,
						url: `${SITE_URL}/order`,
						seller: { '@id': `${SITE_URL}/#business` }
					}
				}
			: {}),
		...(juice.nutrition?.calories ? { nutrition: { '@type': 'NutritionInformation', calories: `${juice.nutrition.calories} calories` } } : {})
	};
	return metaTags({
		path,
		site,
		title: `${juice.name} | SiponPressed`,
		shareTitle: `${juice.name} | SiponPressed`,
		description,
		image,
		imageAlt: `A bottle of ${juice.name} cold-pressed juice`,
		video: hasVideo ? juiceVideo(juice.slug) : null,
		jsonLd: [product]
	});
}
