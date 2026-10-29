/**
 * Ordering rules shared by the order page and the checkout function, so the price and
 * dates a customer sees are exactly what the server will charge and accept.
 * All money is handled in cents; all dates are YYYY-MM-DD in Philadelphia time.
 */
import { juiceStatus } from './catalog.js';

export const TIME_ZONE = 'America/New_York';
const DAY_MS = 86400000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const weekdayName = day => WEEKDAYS[day];

/** The last weekday orders are taken for a delivery day (Thursday for Monday with the default 4-day cutoff). */
export const cutoffDay = delivery => (delivery.day - delivery.cutoffDays + 7) % 7;

/** The pickup spot as one line, e.g. "1903 Jackson Street, Philadelphia, PA". Just the area when no address is set. */
export const pickupAddress = pickup => [pickup?.address, pickup?.area].map(part => String(part || '').trim()).filter(Boolean).join(', ');

/** A maps link for the pickup spot that opens the right app on phones. */
export const pickupMapUrl = pickup => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickupAddress(pickup))}`;

/** Today's date in Philadelphia, as YYYY-MM-DD. */
export function todayISO(now = new Date()) {
	return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const toUTC = iso => new Date(`${iso}T00:00:00Z`);
const fromUTC = date => date.toISOString().slice(0, 10);
export const addDays = (iso, n) => fromUTC(new Date(toUTC(iso).getTime() + n * DAY_MS));
export const weekdayOf = iso => toUTC(iso).getUTCDay();

export function formatDate(iso, options = { weekday: 'long', month: 'long', day: 'numeric' }) {
	return toUTC(iso).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
}

/** The dates a customer can pick for this order type, soonest first. */
export function availableDates(settings, type, now = new Date(), count = type === 'delivery' ? 6 : 14) {
	const today = todayISO(now);
	const dates = [];

	if (type === 'delivery') {
		const { day, cutoffDays } = settings.delivery;
		// Walk forward until we find delivery days whose cutoff hasn't passed yet
		for (let i = 0; dates.length < count && i < 400; i++) {
			const date = addDays(today, i);
			if (weekdayOf(date) === day && addDays(date, -cutoffDays) >= today) dates.push(date);
		}
	} else {
		const { days, leadDays } = settings.pickup;
		for (let i = leadDays; dates.length < count && i < 400; i++) {
			const date = addDays(today, i);
			if (days.includes(weekdayOf(date))) dates.push(date);
		}
	}
	return dates;
}

export const toCents = dollars => Math.round(Number(dollars) * 100);
export const formatMoney = cents => `$${(cents / 100).toFixed(2)}`;

/** Delivery fee in cents for a given bottle subtotal. */
export function deliveryFeeFor(subtotalCents, settings) {
	const { fee, freeOver } = settings.delivery;
	if (freeOver > 0 && subtotalCents >= toCents(freeOver)) return 0;
	return toCents(fee);
}

/**
 * Prices a cart against the live menu and checks it against the shop rules.
 * `items` is [{ slug, qty }]. Returns totals plus a list of problems (empty when the order is good).
 * Pass `date` to also validate the chosen pickup/delivery date.
 */
export function priceOrder({ items = [], type = 'pickup', date = null }, juices, settings, now = new Date()) {
	const errors = [];
	const lines = [];
	const bySlug = new Map(juices.map(juice => [juice.slug, juice]));

	for (const { slug, qty } of items) {
		const juice = bySlug.get(slug);
		const quantity = Math.floor(Number(qty));
		if (!juice || !juice.active) {
			errors.push('One of the juices in your cart is no longer on the menu.');
			continue;
		}
		const status = juiceStatus(juice);
		if (status !== 'available') {
			errors.push(status === 'coming-soon' ? `${juice.name} isn't available yet.` : `${juice.name} is sold out right now.`);
			continue;
		}
		if (!(quantity > 0)) continue;
		const unit = toCents(juice.price);
		lines.push({ slug, name: juice.name, qty: quantity, unit, amount: unit * quantity });
	}

	const bottles = lines.reduce((sum, line) => sum + line.qty, 0);
	const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);

	if (!settings.orderingEnabled) errors.push('Online ordering is paused right now.');
	if (bottles === 0) errors.push('Your cart is empty.');
	if (bottles > settings.maxBottlesPerOrder) errors.push(`For orders over ${settings.maxBottlesPerOrder} bottles, please reach out directly.`);

	let deliveryFee = 0;
	if (type === 'delivery') {
		if (!settings.delivery.enabled) errors.push('Delivery is not available right now.');
		if (bottles < settings.delivery.minBottles) errors.push(`Delivery needs at least ${settings.delivery.minBottles} bottles.`);
		deliveryFee = deliveryFeeFor(subtotal, settings);
	} else if (type === 'pickup') {
		if (!settings.pickup.enabled) errors.push('Pickup is not available right now.');
		if (bottles < (settings.pickup.minBottles || 0)) errors.push(`Pickup needs at least ${settings.pickup.minBottles} bottles.`);
	} else {
		errors.push('Choose pickup or delivery.');
	}

	if (date !== null && !availableDates(settings, type, now).includes(date)) {
		errors.push(type === 'delivery' ? 'Pick one of the listed delivery dates.' : 'Pick one of the listed pickup dates.');
	}

	return { ok: errors.length === 0, errors: [...new Set(errors)], lines, bottles, subtotal, deliveryFee, total: subtotal + deliveryFee };
}

/** Great-circle distance in miles. */
export function milesBetween(a, b) {
	const rad = deg => (deg * Math.PI) / 180;
	const dLat = rad(b.lat - a.lat);
	const dLng = rad(b.lng - a.lng);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
	return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

/** Distance in miles from a point to the delivery centre, which is the pickup spot. */
export const milesFromCenter = (point, settings) => milesBetween(point, settings.delivery.center);

/** Delivery addresses can be in any state the radius reaches from Philly. */
export const DELIVERY_STATES = ['PA', 'NJ', 'DE'];
