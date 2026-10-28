/**
 * Share cards (the 1200×630 image a link preview shows), drawn fresh from the live menu.
 *
 * Satori lays the card out like a small flexbox page and returns an SVG; sharp turns it into
 * a PNG. Photos and fonts are fetched from the site itself, so uploaded bottle photos work too.
 */
import satori from 'satori';
import sharp from 'sharp';
import { juiceStatus, onColor } from '../../../assets/js/shared/catalog.js';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const INK = '#161513';
const LIME = '#c4dd3b';
const PAPER = '#fdf6ea';
const NIGHT = '#0b0b0a';
const BAND = 92;

// A tiny hyperscript so the layouts below read like markup
const h = (type, style = {}, ...children) => {
	const kids = children.flat().filter(child => child !== null && child !== false && child !== undefined);
	return { type, props: { style: { display: 'flex', ...style }, children: kids.length === 1 ? kids[0] : kids } };
};
const img = (src, style) => ({ type: 'img', props: { src, style } });

/* ---------- assets ---------- */

const cache = new Map();
const remember = (key, load) => {
	if (!cache.has(key)) cache.set(key, load().catch(err => (cache.delete(key), Promise.reject(err))));
	return cache.get(key);
};

async function fetchBuffer(origin, path) {
	const res = await fetch(new URL(path, origin));
	if (!res.ok) throw new Error(`${path}: ${res.status}`);
	return Buffer.from(await res.arrayBuffer());
}

const fonts = origin =>
	remember('fonts', async () => {
		const [regular, bold, display] = await Promise.all(
			['archivo-500.ttf', 'archivo-700.ttf', 'archivo-expanded-900.ttf'].map(file => fetchBuffer(origin, `/assets/fonts/og/${file}`))
		);
		return [
			{ name: 'Archivo', data: regular, weight: 500, style: 'normal' },
			{ name: 'Archivo', data: bold, weight: 700, style: 'normal' },
			{ name: 'Archivo Expanded', data: display, weight: 900, style: 'normal' }
		];
	});

/** Any site image (WebP included) as a PNG data URI, scaled to `height`, with its real size. */
const picture = (origin, path, height) =>
	remember(`${path}@${height}`, async () => {
		const { data, info } = await sharp(await fetchBuffer(origin, path))
			.resize({ height, withoutEnlargement: false })
			.png({ compressionLevel: 6 })
			.toBuffer({ resolveWithObject: true });
		return { src: `data:image/png;base64,${data.toString('base64')}`, width: info.width, height: info.height };
	});

const optionalPicture = (origin, path, height) => (path ? picture(origin, path, height).catch(() => null) : Promise.resolve(null));

const wordmark = (origin, color) =>
	remember(`wordmark:${color}`, async () => {
		const svg = (await fetchBuffer(origin, '/assets/img/brand/wordmark.svg')).toString('utf8').replace(/currentColor/g, color);
		return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
	});

/* ---------- pieces ---------- */

const splashFor = juice => `/assets/img/splash/${juice.splash || 'orange'}.webp`;

const STATUS_TEXT = { 'sold-out': 'Sold out', 'coming-soon': 'Coming soon' };
const priceText = juice => (Number(juice.price) ? `$${Number(juice.price).toFixed(2)}` : '');

/** Big stacked headline; the size shrinks so the longest line fits the column. `color` can be one per line. */
function headline(lines, color, maxWidth, maxSize) {
	const colors = [].concat(color);
	const longest = Math.max(...lines.map(line => line.length));
	const size = Math.round(Math.min(maxSize, maxWidth / (longest * 0.95)));
	return h(
		'div',
		{ flexDirection: 'column', fontFamily: 'Archivo Expanded', fontWeight: 900, fontSize: size, lineHeight: 0.92, letterSpacing: -1 },
		lines.map((line, i) => h('div', { color: colors[Math.min(i, colors.length - 1)] }, line))
	);
}

/** Bottles fanned out with their splashes behind, sized to fill a `width × height` box. */
async function bottleFan(origin, juices, width, height) {
	const shown = juices.filter(juice => juice.image).slice(0, 3);
	if (!shown.length) return h('div', { width, height });
	const bottleH = Math.round(height * (shown.length === 1 ? 0.92 : 0.84));
	const [bottles, splashes] = await Promise.all([
		Promise.all(shown.map(juice => optionalPicture(origin, juice.image, bottleH))),
		Promise.all(shown.map(juice => optionalPicture(origin, splashFor(juice), Math.round(bottleH * 0.95))))
	]);
	const step = shown.length === 1 ? 0 : Math.min(width / shown.length, 175);
	const mid = (shown.length - 1) / 2;
	const layer = (items, isSplash) =>
		items.map((item, i) => {
			if (!item) return null;
			const centerX = width / 2 + (i - mid) * step;
			const top = isSplash ? height - item.height - bottleH * 0.06 : height - item.height - (i === Math.round(mid) && shown.length > 1 ? 26 : 0);
			return img(item.src, {
				position: 'absolute',
				left: Math.round(centerX - item.width / 2),
				top: Math.round(top),
				width: item.width,
				height: item.height,
				opacity: isSplash ? 0.85 : 1,
				transform: `rotate(${(i - mid) * 6}deg)`
			});
		});
	return h('div', { position: 'relative', width, height }, layer(splashes, true), layer(bottles, false));
}

/* ---------- cards ---------- */

const SITE = 'siponpressed.com';

/** Copy for each page's card. `juices` is the live, active menu. */
function pageCopy(page, juices, settings) {
	const orderable = juices.filter(juice => juiceStatus(juice) === 'available');
	const prices = orderable.map(juice => Number(juice.price)).filter(Boolean);
	const from = prices.length ? `From $${Math.min(...prices).toFixed(2)}` : 'Fresh every week';
	switch (page) {
		case 'juices':
			return { lines: ['PRESSED', 'THIS WEEK'], note: juices.map(juice => juice.name).slice(0, 4).join(' · ') || 'Cold-pressed juice', cta: from };
		case 'order':
			return { lines: ['ORDER', 'FRESH'], note: `Pickup in ${settings.pickup?.area || 'Philadelphia'} or delivery`, cta: 'Order online' };
		case 'about':
			return { lines: ["HEY, I'M", 'HUNTER'], note: 'One guy, one press, every bottle', cta: 'Meet the maker', photo: true };
		case 'contact':
			return { lines: ['SAY', 'HELLO'], note: 'Questions, big orders and wholesale', cta: 'Get in touch' };
		default:
			return { lines: ['EMBRACE', 'THE SIP'], note: 'Small-batch cold-pressed juice, made by Hunter in Philly', cta: from };
	}
}

// Page cards sit on black with a lime band along the bottom: iMessage tints the link bar under
// the preview from the image's bottom edge, so the band keeps that bar in the brand green
async function pageCard(origin, page, juices, settings) {
	const copy = pageCopy(page, juices, settings);
	const left = 620;
	const artH = OG_HEIGHT - BAND;
	const art = copy.photo ? await portrait(origin, settings, artH) : await bottleFan(origin, juices, OG_WIDTH - left - 20, artH - 50);
	return h(
		'div',
		{ width: OG_WIDTH, height: OG_HEIGHT, background: NIGHT, position: 'relative', fontFamily: 'Archivo', overflow: 'hidden' },
		h(
			'div',
			{ flexDirection: 'column', justifyContent: 'space-between', width: left, height: artH, padding: '52px 0 44px 64px' },
			img(await wordmark(origin, PAPER), { width: 300, height: 48 }),
			h(
				'div',
				{ flexDirection: 'column', gap: 22 },
				headline(copy.lines, [PAPER, LIME], left - 84, 124),
				h('div', { fontSize: 28, fontWeight: 500, color: 'rgba(253,246,234,0.72)', maxWidth: 500, lineHeight: 1.25 }, copy.note)
			)
		),
		h('div', { position: 'absolute', right: 0, bottom: BAND }, art),
		h(
			'div',
			{ position: 'absolute', left: 0, bottom: 0, width: OG_WIDTH, height: BAND, background: LIME, color: INK, alignItems: 'center', justifyContent: 'space-between', padding: '0 64px' },
			h('div', { fontFamily: 'Archivo Expanded', fontWeight: 900, fontSize: 26, letterSpacing: 1 }, copy.cta.toUpperCase()),
			h('div', { fontSize: 28, fontWeight: 700 }, SITE)
		)
	);
}

async function portrait(origin, settings, height) {
	const photo = (await optionalPicture(origin, settings.aboutPhoto, 560)) || (await optionalPicture(origin, '/assets/img/hunter-portrait.webp', 560));
	if (!photo) return h('div', {});
	return h(
		'div',
		{ padding: '0 90px 0 0', height, alignItems: 'center' },
		h(
			'div',
			{ width: 340, height: 425, borderRadius: 32, overflow: 'hidden', border: `6px solid ${LIME}`, transform: 'rotate(3deg)' },
			img(photo.src, { width: 340, height: 425, objectFit: 'cover' })
		)
	);
}

// Same dark band as the page cards, so the link bar iMessage tints from the bottom edge
// contrasts with the juice color instead of blending into it
async function juiceCard(origin, juice) {
	const color = /^#[0-9a-f]{6}$/i.test(juice.color || '') ? juice.color : LIME;
	const fg = onColor(color);
	const status = juiceStatus(juice);
	const left = 660;
	const artH = OG_HEIGHT - BAND;
	const words = juice.name.toUpperCase().split(/\s+/);
	const watermark = words[words.length - 1];
	const badge = STATUS_TEXT[status] || priceText(juice) || 'Cold-pressed in Philly';
	const size = juice.sizeOz ? `${juice.sizeOz} OZ` : '';
	return h(
		'div',
		{ width: OG_WIDTH, height: OG_HEIGHT, background: color, position: 'relative', fontFamily: 'Archivo', overflow: 'hidden' },
		h(
			'div',
			{
				position: 'absolute',
				left: -10,
				bottom: BAND - 60,
				fontFamily: 'Archivo Expanded',
				fontWeight: 900,
				fontSize: Math.min(300, Math.round(1250 / (watermark.length * 0.84))),
				color: fg,
				opacity: 0.12,
				letterSpacing: -4
			},
			watermark
		),
		h(
			'div',
			{ flexDirection: 'column', justifyContent: 'space-between', width: left, height: artH, padding: '52px 0 44px 64px' },
			img(await wordmark(origin, fg), { width: 280, height: 45 }),
			h(
				'div',
				{ flexDirection: 'column', gap: 20 },
				h('div', { fontSize: 24, fontWeight: 700, color: fg, opacity: 0.75, letterSpacing: 3 }, ['COLD-PRESSED', size].filter(Boolean).join(' · ')),
				headline(words, fg, left - 90, 118),
				juice.tagline ? h('div', { fontSize: 30, fontWeight: 500, color: fg, maxWidth: 540, lineHeight: 1.25 }, juice.tagline) : null
			)
		),
		h('div', { position: 'absolute', right: 30, bottom: BAND }, await bottleFan(origin, [juice], OG_WIDTH - left - 30, artH - 20)),
		h(
			'div',
			{ position: 'absolute', left: 0, bottom: 0, width: OG_WIDTH, height: BAND, background: NIGHT, color: PAPER, alignItems: 'center', justifyContent: 'space-between', padding: '0 64px' },
			h('div', { fontFamily: 'Archivo Expanded', fontWeight: 900, fontSize: 26, letterSpacing: 1, color }, badge.toUpperCase()),
			h('div', { fontSize: 28, fontWeight: 700 }, SITE)
		)
	);
}

/**
 * Draw a card. `page` is home / juices / order / about / contact, or a juice to draw that juice.
 * Returns PNG bytes.
 */
export async function renderCard({ origin, page, juice, juices, settings }) {
	const tree = juice ? await juiceCard(origin, juice) : await pageCard(origin, page, juices, settings);
	const svg = await satori(tree, { width: OG_WIDTH, height: OG_HEIGHT, fonts: await fonts(origin) });
	return sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toBuffer();
}
