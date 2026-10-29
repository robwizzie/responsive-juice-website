/**
 * Default menu and shop settings, shared by the browser and the Netlify functions.
 *
 * These are the starting values. Once Hunter saves anything in /admin, the saved copy
 * (kept in Netlify Blobs) wins and this file is only used as a fallback.
 */

export const SPLASH_STYLES = ['orange', 'green', 'red', 'purple', 'berry', 'pink', 'lime', 'crimson'];

/** Whether a juice can be ordered. Hunter sets this per juice in /admin. */
export const JUICE_STATUSES = {
	available: 'Available',
	'sold-out': 'Sold out',
	'coming-soon': 'Coming soon'
};

/** Older saved menus only had an inStock flag, so fall back to it. */
export const juiceStatus = juice => (JUICE_STATUSES[juice?.status] ? juice.status : juice?.inStock === false ? 'sold-out' : 'available');
/** Dark or light text, whichever reads better on a juice's color. */
export function onColor(hex = '#000000') {
	const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
	const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	return luminance > 0.24 ? '#161513' : '#ffffff';
}

export const isOrderable = juice => juiceStatus(juice) === 'available';

/**
 * Backgrounds for a juice's page. Hunter can pick one of these or upload his own photo,
 * in which case `backdrop` holds the photo's path instead of one of these keys.
 */
export const BACKDROPS = {
	riverfront: {
		label: 'Philly riverfront',
		image: '/assets/img/backdrops/riverfront.webp',
		imageSmall: '/assets/img/backdrops/riverfront-sm.webp'
	},
	color: { label: 'Juice color' },
	cream: { label: 'Clean cream' }
};
export const DEFAULT_BACKDROP = 'riverfront';

// Ingredient photos that ship with the site, keyed by file name in /assets/img/ingredients.
export const INGREDIENT_ICONS = [
	'agave',
	'banana',
	'black-grape',
	'blue-spirulina',
	'blueberry',
	'carrot',
	'cinnamon',
	'coconut',
	'cucumber',
	'gala-apple',
	'ginger',
	'green-apple',
	'kale',
	'kiwi',
	'lemon',
	'mango',
	'orange',
	'pear',
	'pineapple',
	'spinach',
	'strawberry',
	'turmeric'
];

const ICON_ALIASES = {
	apple: 'gala-apple',
	apples: 'gala-apple',
	'coconut water': 'coconut',
	oranges: 'orange',
	bananas: 'banana',
	strawberries: 'strawberry',
	carrots: 'carrot',
	blueberries: 'blueberry',
	grapes: 'black-grape',
	'black grapes': 'black-grape',
	lemons: 'lemon',
	limes: 'lemon',
	lime: 'lemon',
	pears: 'pear',
	kiwis: 'kiwi',
	mangoes: 'mango',
	cucumbers: 'cucumber',
	tumeric: 'turmeric',
	spirulina: 'blue-spirulina'
};

/**
 * One id per ingredient, so "Oranges", "orange" and "Orange " share a photo. Ingredients the site
 * has a picture of use that picture's file name; anything else is its name in lower case.
 */
export function ingredientKey(name = '') {
	const key = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
	const file = ICON_ALIASES[key] || key.replace(/ /g, '-');
	if (INGREDIENT_ICONS.includes(file)) return file;
	const singular = file.replace(/(es|s)$/, '');
	return INGREDIENT_ICONS.includes(singular) ? singular : key;
}

/** Path of the bundled photo for an ingredient name, or null when there isn't one. */
export function ingredientIcon(name = '') {
	const key = ingredientKey(name);
	return INGREDIENT_ICONS.includes(key) ? `/assets/img/ingredients/${key}.webp` : null;
}

/**
 * The photo for an ingredient: Hunter's upload from Admin → Ingredients first, then the bundled one.
 * The upload library comes with each juice (see prepareJuices), so every page can look it up.
 */
export const ingredientPhoto = (juice, name) => juice?.ingredientImages?.[ingredientKey(name)] || ingredientIcon(name);

/**
 * Every bottle costs the shop's bottle price unless Hunter gave that juice its own price.
 * The saved menu and the defaults both go through this, so one edit reprices the whole site:
 * cards, cart, checkout, share images and emails.
 */
export function priceJuice(juice, settings) {
	const shop = Number(settings?.bottlePrice);
	if (juice.customPrice || !(shop > 0)) return juice;
	return { ...juice, price: shop };
}
export const priceJuices = (juices, settings) => juices.map(juice => priceJuice(juice, settings));

/** The menu as the site shows it: live prices, plus the shared ingredient photo library on each juice. */
export const prepareJuices = (juices, settings) => priceJuices(juices, settings).map(juice => ({ ...juice, ingredientImages: settings?.ingredientPhotos || {} }));

export const slugify = text =>
	String(text || '')
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);

export const DEFAULT_JUICES = [
	{
		slug: 'simply-orange',
		name: 'Simply Orange',
		tagline: 'Bright citrus with a ginger kick',
		description:
			'Sunny oranges, pineapple and mango, grounded with carrot and a warming hit of fresh ginger and turmeric. Our brightest bottle, and a big dose of vitamin C.',
		ingredients: ['Oranges', 'Pineapple', 'Mango', 'Carrots', 'Ginger', 'Turmeric'],
		price: 8,
		customPrice: false,
		color: '#f59e1b',
		splash: 'orange',
		image: '/assets/img/bottles/simply-orange.webp',
		imageSmall: '/assets/img/bottles/simply-orange-sm.webp',
		emailImage: '/assets/img/bottles/simply-orange.png',
		sizeOz: 16,
		nutrition: { calories: 145, totalFat: 0, totalFatDv: 0, sodium: 55, sodiumDv: 2, carbs: 35, carbsDv: 13, sugars: 28, protein: 2 },
		vitamins: [
			{ name: 'Vitamin C', dv: 250 },
			{ name: 'Vitamin A', dv: 90 },
			{ name: 'Manganese', dv: 75 },
			{ name: 'Vitamin K', dv: 20 }
		],
		active: true,
		status: 'available',
		statusNote: '',
		backdrop: 'riverfront'
	},
	{
		slug: 'simply-green',
		name: 'Simply Green',
		tagline: 'Greens that actually taste good',
		description:
			'A full handful of spinach blended with sweet oranges, banana and pineapple. Smooth, fruity and loaded with vitamin K, so you get your greens without tasting like a salad.',
		ingredients: ['Spinach', 'Oranges', 'Bananas', 'Pineapple'],
		price: 8,
		customPrice: false,
		color: '#8db62f',
		splash: 'green',
		image: '/assets/img/bottles/simply-green.webp',
		imageSmall: '/assets/img/bottles/simply-green-sm.webp',
		emailImage: '/assets/img/bottles/simply-green.png',
		sizeOz: 16,
		nutrition: { calories: 215, totalFat: 0, totalFatDv: 0, sodium: 35, sodiumDv: 2, carbs: 50, carbsDv: 18, sugars: 41, protein: 3 },
		vitamins: [
			{ name: 'Vitamin K', dv: 300 },
			{ name: 'Vitamin C', dv: 220 },
			{ name: 'Vitamin A', dv: 60 },
			{ name: 'Vitamin B9', dv: 40 }
		],
		active: true,
		status: 'available',
		statusNote: '',
		backdrop: 'riverfront'
	},
	{
		slug: 'simply-red',
		name: 'Simply Red',
		tagline: 'Strawberry lemonade, the real way',
		description:
			'Ripe strawberries and crisp apples pressed with fresh lemon and coconut water. Light, tart and hydrating, the easiest bottle to finish.',
		ingredients: ['Strawberries', 'Apples', 'Lemon', 'Coconut Water'],
		price: 8,
		customPrice: false,
		color: '#e0322f',
		splash: 'red',
		image: '/assets/img/bottles/simply-red.webp',
		imageSmall: '/assets/img/bottles/simply-red-sm.webp',
		emailImage: '/assets/img/bottles/simply-red.png',
		sizeOz: 16,
		nutrition: { calories: 105, totalFat: 0, totalFatDv: 0, sodium: 50, sodiumDv: 2, carbs: 26, carbsDv: 9, sugars: 21, protein: 1 },
		vitamins: [
			{ name: 'Potassium', dv: 300 },
			{ name: 'Vitamin C', dv: 145 },
			{ name: 'Magnesium', dv: 10 },
			{ name: 'Vitamin A', dv: 10 }
		],
		active: true,
		status: 'available',
		statusNote: '',
		backdrop: 'riverfront'
	}
];

export const DEFAULT_SETTINGS = {
	orderingEnabled: true,
	// What one bottle costs. Every juice uses it unless it has its own price set in /admin.
	bottlePrice: 8,
	// Ingredient photos Hunter uploaded in /admin → Ingredients, keyed by ingredientKey(). They
	// replace the bundled photo (or fill in for an ingredient the site has no photo of) everywhere.
	ingredientPhotos: {},
	// Optional banner shown across the top of every page (e.g. "Back in stock Monday!")
	announcement: '',
	contactEmail: 'siponpressed@yahoo.com',
	instagram: 'siponpressed',
	pickup: {
		enabled: true,
		// Street address of the pickup spot, shown on every page next to the area
		address: '1903 Jackson Street',
		// Town and state, shown publicly on the site
		area: 'Philadelphia, PA 19145',
		// Optional pickup times shown on the site, e.g. "4pm to 7pm". Empty means Hunter texts a time.
		hours: '',
		// Only sent in the order confirmation email
		details: 'Hunter will text you when your order is ready to grab.',
		// 0 = Sunday … 6 = Saturday
		days: [1, 2, 3, 4, 5, 6],
		// Juice is pressed to order, so pickups need 48 hours' notice (the earliest pickup is two days out)
		leadDays: 2,
		// Fewest bottles a pickup order can have. 0 means no minimum.
		minBottles: 7
	},
	delivery: {
		enabled: true,
		day: 1, // Monday
		minBottles: 7,
		fee: 7,
		freeOver: 50,
		radiusMiles: 30,
		// Same South Jersey area as before: within 30 miles of Blackwood or Woodbury
		zones: [
			{ label: 'Blackwood, NJ', lat: 39.8021, lng: -75.0649 },
			{ label: 'Woodbury, NJ', lat: 39.8187, lng: -75.16145 }
		],
		areaLabel: 'South Jersey',
		// Monday orders close at the end of Thursday (Monday minus 4 days)
		cutoffDays: 4
	},
	maxBottlesPerOrder: 60,
	// Hunter's photo on the About page (uploaded in /admin). Empty shows a placeholder.
	aboutPhoto: ''
};
