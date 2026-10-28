/**
 * Cleans what the admin page sends before it is saved, so a typo can't break the site.
 * Each function returns { value } or { error }.
 */
import { BACKDROPS, DEFAULT_BACKDROP, JUICE_STATUSES, SPLASH_STYLES, ingredientKey, juiceStatus, slugify } from '../../../assets/js/shared/catalog.js';
import { COPY_FIELDS, DEFAULT_COPY } from '../../../assets/js/shared/content.js';

const text = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const number = (value, { min = 0, max = 100000, fallback = 0 } = {}) => {
	const n = Number(value);
	return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const imagePath = value => {
	const path = text(value, 300);
	return /^\/(assets\/img|api\/images)\/[\w\-./]+$/.test(path) && !path.includes('..') ? path : '';
};
const color = value => (/^#[0-9a-f]{6}$/i.test(String(value)) ? String(value).toLowerCase() : '#b6d43a');

export function cleanJuice(input) {
	const name = text(input?.name, 60);
	if (!name) return { error: 'Every juice needs a name.' };
	const slug = slugify(input.slug || name);
	if (!slug) return { error: `"${name}" needs a name with letters or numbers.` };

	// A "coming soon" juice can be teased before it has a price or a photo
	const status = JUICE_STATUSES[input.status] ? input.status : juiceStatus(input);
	const teaser = status === 'coming-soon';
	// Without its own price a juice uses the shop's bottle price (see priceJuice)
	const customPrice = input.customPrice === true;
	const price = number(input.price, { min: 0, max: 500, fallback: 0 });
	if (customPrice && !(price >= 0.5) && !teaser) return { error: `${name} needs a price of at least $0.50.` };

	const image = imagePath(input.image);
	if (!image && !teaser) return { error: `${name} needs a bottle photo.` };

	const n = input.nutrition || {};
	const ingredients = (Array.isArray(input.ingredients) ? input.ingredients : String(input.ingredients || '').split(','))
		.map(item => text(item, 40))
		.filter(Boolean)
		.slice(0, 12);
	// Photos Hunter uploaded for ingredients the site has no picture of, kept only for ones still listed
	const ingredientImages = {};
	for (const item of ingredients) {
		const photo = imagePath(input.ingredientImages?.[ingredientKey(item)]);
		if (photo) ingredientImages[ingredientKey(item)] = photo;
	}
	return {
		value: {
			slug,
			name,
			tagline: text(input.tagline, 80),
			description: text(input.description, 600),
			ingredients,
			ingredientImages,
			price: Math.round(price * 100) / 100,
			customPrice,
			color: color(input.color),
			splash: SPLASH_STYLES.includes(input.splash) ? input.splash : 'none',
			image,
			imageSmall: imagePath(input.imageSmall) || image,
			backdrop: BACKDROPS[input.backdrop] ? input.backdrop : imagePath(input.backdrop) || DEFAULT_BACKDROP,
			emailImage: imagePath(input.emailImage) || '',
			sizeOz: number(input.sizeOz, { min: 1, max: 64, fallback: 16 }),
			nutrition: {
				calories: number(n.calories, { max: 2000 }),
				totalFat: number(n.totalFat, { max: 200 }),
				totalFatDv: number(n.totalFatDv, { max: 1000 }),
				sodium: number(n.sodium, { max: 5000 }),
				sodiumDv: number(n.sodiumDv, { max: 1000 }),
				carbs: number(n.carbs, { max: 500 }),
				carbsDv: number(n.carbsDv, { max: 1000 }),
				sugars: number(n.sugars, { max: 500 }),
				protein: number(n.protein, { max: 200 })
			},
			vitamins: (Array.isArray(input.vitamins) ? input.vitamins : [])
				.map(v => ({ name: text(v?.name, 30), dv: number(v?.dv, { max: 5000 }) }))
				.filter(v => v.name)
				.slice(0, 8),
			active: input.active !== false,
			status,
			statusNote: text(input.statusNote, 40),
			// Kept for anything still reading the old flag
			inStock: status === 'available'
		}
	};
}

export function cleanJuices(list) {
	if (!Array.isArray(list)) return { error: 'Expected a list of juices.' };
	const juices = [];
	for (const item of list.slice(0, 40)) {
		const { value, error } = cleanJuice(item);
		if (error) return { error };
		if (juices.some(j => j.slug === value.slug)) return { error: `Two juices share the link name "${value.slug}". Rename one of them.` };
		juices.push(value);
	}
	return { value: juices };
}

const days = list => [...new Set((Array.isArray(list) ? list : []).map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort();

export function cleanSettings(input, current) {
	const p = input?.pickup || {};
	const d = input?.delivery || {};
	const pickupDays = days(p.days);
	if (p.enabled !== false && pickupDays.length === 0) return { error: 'Pick at least one pickup day, or turn pickup off.' };

	return {
		value: {
			...current,
			orderingEnabled: input.orderingEnabled !== false,
			bottlePrice: Math.round(number(input.bottlePrice, { min: 0.5, max: 500, fallback: current.bottlePrice }) * 100) / 100,
			announcement: text(input.announcement, 160),
			contactEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail || '') ? text(input.contactEmail, 120) : current.contactEmail,
			instagram: text(input.instagram, 40).replace(/^@/, '') || current.instagram,
			pickup: {
				...current.pickup,
				enabled: p.enabled !== false,
				area: text(p.area, 80) || current.pickup.area,
				details: text(p.details, 400),
				days: pickupDays,
				leadDays: number(p.leadDays, { min: 0, max: 14, fallback: current.pickup.leadDays })
			},
			delivery: {
				...current.delivery,
				enabled: d.enabled !== false,
				day: days([d.day])[0] ?? current.delivery.day,
				minBottles: number(d.minBottles, { min: 1, max: 100, fallback: current.delivery.minBottles }),
				fee: number(d.fee, { min: 0, max: 100, fallback: current.delivery.fee }),
				freeOver: number(d.freeOver, { min: 0, max: 1000, fallback: current.delivery.freeOver }),
				radiusMiles: number(d.radiusMiles, { min: 1, max: 200, fallback: current.delivery.radiusMiles }),
				cutoffDays: number(d.cutoffDays, { min: 0, max: 6, fallback: current.delivery.cutoffDays }),
				areaLabel: text(d.areaLabel, 60) || current.delivery.areaLabel
			},
			aboutPhoto: input.aboutPhoto === '' ? '' : imagePath(input.aboutPhoto) || current.aboutPhoto || '',
			maxBottlesPerOrder: number(input.maxBottlesPerOrder, { min: 1, max: 500, fallback: current.maxBottlesPerOrder })
		}
	};
}

/** Page text from /admin → Pages. Only known fields are kept, and only where they differ from the default. */
export function cleanCopy(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Expected page text.' };
	const value = {};
	for (const field of COPY_FIELDS) {
		if (!(field.key in input)) continue;
		const saved = field.type === 'image' ? imagePath(input[field.key]) : text(input[field.key], field.max || (field.long ? 800 : 160));
		if (saved && saved !== DEFAULT_COPY[field.key]) value[field.key] = saved;
	}
	return { value };
}
