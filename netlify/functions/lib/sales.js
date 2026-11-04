/**
 * Sales that didn't come through the website's checkout, so Hunter sees every bottle in one place:
 * - manual: ones he types in himself (cash, Venmo, Zelle, Instagram DMs, cafes).
 * - stripe: card payments Stripe tells us about that the site didn't start (a Payment Link, Tap to Pay).
 * Both are saved as ordinary orders, so they share the Orders list, its stages and the To press list.
 */
import { randomUUID } from 'node:crypto';
import { HANDOFF_TYPES, PAYMENT_METHODS, SALE_CHANNELS } from '../../../assets/js/shared/order-status.js';
import { addDays, todayISO, toCents } from '../../../assets/js/shared/order-rules.js';

const clean = (value, max = 120) => String(value ?? '').trim().slice(0, max);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BOTTLES = 500;
const MAX_TOTAL = 1_000_000; // $10,000 in cents

const normal = text => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Spreads a total over the lines in proportion to their menu price, so a discount or a wholesale
 * price still adds up line by line (Stats splits revenue by juice).
 */
export function spreadTotal(lines, total) {
	const subtotal = lines.reduce((sum, line) => sum + line.unit * line.qty, 0);
	if (!lines.length) return [];
	let left = total;
	return lines.map((line, i) => {
		const share = i === lines.length - 1 ? left : subtotal ? Math.round((total * line.unit * line.qty) / subtotal) : Math.round(total / lines.length);
		left -= share;
		return { ...line, amount: share };
	});
}

/** The bottles on a sale, priced from today's menu. Returns { lines } or { error }. */
function linesFrom(items, juices) {
	const counts = new Map();
	for (const item of Array.isArray(items) ? items : []) {
		const qty = Math.floor(Number(item?.qty));
		if (!qty || qty < 0) continue;
		counts.set(item.slug, (counts.get(item.slug) || 0) + qty);
	}
	const lines = [];
	for (const [slug, qty] of counts) {
		const juice = juices.find(j => j.slug === slug);
		if (!juice) return { error: 'One of those juices isn\'t on your menu anymore. Refresh and try again.' };
		const unit = toCents(juice.price);
		lines.push({ slug, name: juice.name, qty, unit, amount: unit * qty });
	}
	if (lines.reduce((n, l) => n + l.qty, 0) > MAX_BOTTLES) return { error: `That's over ${MAX_BOTTLES} bottles. Split it into a few sales.` };
	return { lines };
}

/** When a sale counts as made: now, or midday on the day he picked if that's in the past. */
const soldAtFor = (date, today, now) => (date < today ? `${date}T17:00:00.000Z` : now.toISOString());

/**
 * Checks a sale typed into the admin and turns it into an order. `existing` is the order being
 * edited, if any; its id, stage and history are kept. Returns { value } or { error }.
 */
export function cleanSale(body, juices, { existing = null, now = new Date() } = {}) {
	if (!body || typeof body !== 'object') return { error: 'Bad request' };
	const today = todayISO(now);
	const fromStripe = existing?.source === 'stripe';

	const date = clean(body.date, 10);
	if (!ISO_DATE.test(date) || date < addDays(today, -400) || date > addDays(today, 365)) return { error: 'Pick a date for this sale.' };
	const type = HANDOFF_TYPES.includes(body.type) ? body.type : 'handoff';

	const { lines, error } = linesFrom(body.items, juices);
	if (error) return { error };
	if (!lines.length && !fromStripe) return { error: 'Add at least one bottle.' };
	const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);

	// A Stripe payment's amount is what was actually charged, so it can't be changed here
	let total = fromStripe ? existing.total : subtotal;
	if (!fromStripe && body.total !== undefined && body.total !== null && body.total !== '') {
		total = Math.round(Number(body.total));
		if (!Number.isFinite(total) || total < 0 || total > MAX_TOTAL) return { error: 'Check the price. It should be a dollar amount.' };
	}

	const payment = fromStripe ? 'stripe' : PAYMENT_METHODS.some(p => p.id === body.payment) ? body.payment : 'cash';
	const paid = payment !== 'unpaid';
	const soldAt = existing?.soldAt && existing.date === date ? existing.soldAt : soldAtFor(date, today, now);
	// Keep the day it was first marked paid; a sale that's just been paid counts from now (or its past date)
	const paidAt = !paid ? null : existing?.paidAt && existing.status !== 'unpaid' ? existing.paidAt : date < today ? soldAt : now.toISOString();

	const customer = { name: clean(body.customer?.name, 80), phone: clean(body.customer?.phone, 30), email: clean(body.customer?.email) };
	const where = clean(body.address, 200);

	const order = {
		...(existing || {}),
		id: existing?.id || randomUUID(),
		createdAt: existing?.createdAt || now.toISOString(),
		source: fromStripe ? 'stripe' : 'manual',
		channel: fromStripe ? undefined : SALE_CHANNELS.some(c => c.id === body.channel) ? body.channel : 'in-person',
		payment,
		status: paid ? 'paid' : 'unpaid',
		test: fromStripe ? existing.test : false,
		type,
		date,
		customer,
		address: type === 'delivery' && where ? { line1: where } : null,
		notes: clean(body.notes, 500),
		lines: fromStripe && !lines.length ? existing.lines : spreadTotal(lines, total),
		subtotal: fromStripe ? existing.subtotal : subtotal,
		deliveryFee: 0,
		total,
		soldAt,
		paidAt,
		emails: { owner: 'off', customer: 'off' }
	};
	if (fromStripe) order.needsDetails = !order.lines.length;

	if (!existing) {
		// Something he's already handed over starts out done; anything else waits to be made
		order.stage = type === 'handoff' ? 'done' : 'new';
		order.history = [{ stage: order.stage, at: now.toISOString() }];
	}
	if (order.channel === undefined) delete order.channel;
	return { value: order };
}

/* ---------- Stripe payments the site didn't start ---------- */

const ET_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
export const stripeDay = seconds => ET_DAY.format(new Date(seconds * 1000));

// One id per payment, so the payment and its Payment Link checkout (two Stripe events) land on one order
export const stripeOrderId = (paymentIntent, fallback) => String(paymentIntent || fallback).slice(0, 64);

/** Matches a Stripe line ("Simply Orange", "simply orange 16oz") to a juice on the menu. */
export function matchJuice(description, juices) {
	const text = normal(description);
	if (!text) return null;
	return juices.find(j => normal(j.name) === text) || juices.find(j => text.includes(normal(j.name))) || null;
}

const NUMBER_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12 };

/**
 * Words that pick out one juice: its whole name, plus each word of it no other juice shares
 * ("orange" for Simply Orange, since every juice is "Simply" something).
 */
function juiceKeywords(juices) {
	const words = juices.map(j => normal(j.name).split(' ').filter(Boolean));
	const count = new Map();
	words.flat().forEach(w => count.set(w, (count.get(w) || 0) + 1));
	return juices.map((juice, i) => ({ juice, full: words[i].join(' '), own: words[i].filter(w => count.get(w) === 1 && w.length > 2) }));
}

const quantityOf = token => {
	if (/^\d{1,3}$/.test(token)) return Number(token);
	const x = token.match(/^(?:(\d{1,3})x|x(\d{1,3}))$/);
	if (x) return Number(x[1] || x[2]);
	return NUMBER_WORDS[token] ?? null;
};

/**
 * Reads the juices out of the note Hunter types on a Tap to Pay charge in the Stripe app:
 * "2 orange 1 green", "Simply Red x3", "orange, green", or just "green" (the count then comes from
 * the amount). Returns priced lines that add up to what Stripe charged, or [] if it can't tell.
 */
export function juicesFromNote(note, juices, total) {
	const tokens = normal(note).split(' ').filter(Boolean);
	if (!tokens.length || !juices.length) return [];
	const keys = juiceKeywords(juices);
	const juiceAt = i => {
		const rest = tokens.slice(i).join(' ');
		const whole = keys.find(k => rest === k.full || rest.startsWith(`${k.full} `));
		if (whole) return { juice: whole.juice, span: whole.full.split(' ').length };
		// "reds", "oranges"
		const word = tokens[i];
		const own = word && keys.find(k => k.own.includes(word) || (word.endsWith('s') && k.own.includes(word.slice(0, -1))));
		return own ? { juice: own.juice, span: 1 } : null;
	};
	const found = [];
	let pending = null;
	for (let i = 0; i < tokens.length; i++) {
		const qty = quantityOf(tokens[i]);
		if (qty !== null) {
			// "2 orange": the count goes with the juice after it. "orange 2", "orange x2": with the one before.
			const last = found[found.length - 1];
			if (!juiceAt(i + 1) && last && last.qty === null) last.qty = qty;
			else pending = qty;
			continue;
		}
		const match = juiceAt(i);
		if (!match) continue;
		i += match.span - 1;
		const same = found.find(f => f.juice === match.juice);
		if (same) same.qty = (same.qty || 1) + (pending || 1);
		else found.push({ juice: match.juice, qty: pending });
		pending = null;
	}
	if (!found.length) return [];

	const price = juice => toCents(juice.price);
	// One juice and no count: work it out from the amount, if that comes to whole bottles
	if (found.length === 1 && found[0].qty === null) {
		const bottles = total / price(found[0].juice);
		found[0].qty = Number.isInteger(bottles) && bottles > 0 ? bottles : 1;
	}
	const lines = found.map(({ juice, qty }) => ({ slug: juice.slug, name: juice.name, qty: Math.min(qty || 1, MAX_BOTTLES), unit: price(juice), amount: price(juice) * (qty || 1) }));
	return spreadTotal(lines, total);
}

/** Lines for a Payment Link checkout, from Stripe's list of what was bought. */
export function linesFromStripe(items, juices) {
	return (items || []).map(item => {
		const juice = matchJuice(item.description, juices);
		const qty = item.quantity || 1;
		const amount = item.amount_total ?? item.amount_subtotal ?? 0;
		return { slug: juice?.slug || `stripe-${normal(item.description).replace(/ /g, '-').slice(0, 40) || 'item'}`, name: juice?.name || clean(item.description, 80) || 'Item', qty, unit: Math.round(amount / qty), amount };
	});
}

/** A Payment Link checkout as an order. `items` are its line items (may be empty if Stripe wouldn't list them). */
export function orderFromLinkSession(session, items, juices, { livemode, created }) {
	const lines = linesFromStripe(items, juices);
	const day = stripeDay(created);
	const at = new Date(created * 1000).toISOString();
	const c = session.customer_details || {};
	return {
		id: stripeOrderId(session.payment_intent, session.id),
		createdAt: at,
		source: 'stripe',
		stripe: { kind: 'link', paymentIntent: session.payment_intent || null, session: session.id, paymentLink: session.payment_link },
		payment: 'stripe',
		status: 'paid',
		test: !livemode,
		type: 'pickup',
		date: day,
		customer: { name: clean(c.name, 80), email: clean(c.email), phone: clean(c.phone, 30) },
		address: null,
		notes: '',
		lines,
		subtotal: session.amount_subtotal ?? session.amount_total ?? 0,
		deliveryFee: 0,
		total: session.amount_total ?? 0,
		soldAt: at,
		paidAt: at,
		needsDetails: !lines.length,
		stage: 'new',
		history: [{ stage: 'new', at }],
		emails: { owner: 'off', customer: 'off' }
	};
}

/** Any other successful Stripe payment (Tap to Pay, a charge made in the Stripe app). No juices yet. */
export function orderFromPaymentIntent(intent, { livemode, created, juices = [] }) {
	const tap = (intent.payment_method_types || []).some(t => t === 'card_present' || t === 'interac_present');
	const day = stripeDay(created);
	const at = new Date(created * 1000).toISOString();
	const stage = tap ? 'done' : 'new';
	const total = intent.amount_received ?? intent.amount ?? 0;
	// Stripe's app only takes an amount, so the juices come from the note Hunter typed, if any
	const lines = juicesFromNote(intent.description, juices, total);
	return {
		id: stripeOrderId(intent.id),
		createdAt: at,
		source: 'stripe',
		stripe: { kind: tap ? 'tap' : 'payment', paymentIntent: intent.id },
		payment: 'stripe',
		status: 'paid',
		test: !livemode,
		// Tap to Pay happens face to face, so the bottles are already handed over
		type: tap ? 'handoff' : 'pickup',
		date: day,
		customer: { name: clean(intent.shipping?.name, 80), email: clean(intent.receipt_email), phone: '' },
		address: null,
		notes: clean(intent.description, 500),
		lines,
		subtotal: intent.amount_received ?? intent.amount ?? 0,
		deliveryFee: 0,
		total: intent.amount_received ?? intent.amount ?? 0,
		soldAt: at,
		paidAt: at,
		needsDetails: !lines.length,
		stage,
		history: [{ stage, at }],
		emails: { owner: 'off', customer: 'off' }
	};
}

/**
 * The two Stripe events for one Payment Link payment can arrive in either order. The checkout
 * knows what was bought, so it fills in the order; Hunter's own progress and edits are kept.
 */
export function mergeStripeOrders(existing, incoming) {
	if (!existing) return incoming;
	if (incoming.stripe?.kind !== 'link' || existing.stripe?.kind === 'link') return existing;
	const filled = !existing.lines?.length && incoming.lines.length;
	return {
		...existing,
		stripe: { ...existing.stripe, ...incoming.stripe },
		customer: existing.customer?.name ? existing.customer : incoming.customer,
		lines: filled ? incoming.lines : existing.lines,
		needsDetails: filled ? false : existing.needsDetails
	};
}
