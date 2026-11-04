/**
 * Brings Stripe payments the website didn't start (Tap to Pay, Payment Links, charges made in the
 * Stripe app) into Orders. The webhook does it as they happen; "Check Stripe" in the admin catches
 * up on anything from before the webhook was listening for them.
 */
import { getJuices, getOrder, saveOrder } from './store.js';
import { stripe } from './stripe.js';
import { addDays } from '../../../assets/js/shared/order-rules.js';
import { mergeStripeOrders, orderFromLinkSession, orderFromPaymentIntent } from './sales.js';

// Orders are keyed by day, and the two events for one payment can straddle midnight
async function findStripeOrder(id, day) {
	for (const date of [day, addDays(day, -1), addDays(day, 1)]) {
		const order = await getOrder(`${date}/${id}`);
		if (order) return order;
	}
	return null;
}

async function lineItems(sessionId) {
	try {
		const { data } = await stripe().checkout.sessions.listLineItems(sessionId, { limit: 100 });
		return data;
	} catch (err) {
		// Saved without juices; Hunter can add them, and the Orders tab asks him to
		console.warn(`Could not list items for ${sessionId}:`, err.message);
		return [];
	}
}

/** Saves one Stripe payment as an order, or fills in the one already saved. */
export async function importStripePayment({ intent, session, livemode, created }) {
	const incoming = session
		? orderFromLinkSession(session, await lineItems(session.id), await getJuices(), { livemode, created })
		: orderFromPaymentIntent(intent, { livemode, created: created ?? intent.created });
	const existing = await findStripeOrder(incoming.id, incoming.date);
	const order = mergeStripeOrders(existing, incoming);
	if (order !== existing) await saveOrder(order);
	return { order, added: !existing };
}

/** Is this payment one of the website's own checkouts, a Payment Link checkout, or neither? */
async function checkoutFor(intent) {
	try {
		const { data } = await stripe().checkout.sessions.list({ payment_intent: intent.id, limit: 1 });
		return data[0] || null;
	} catch {
		return null;
	}
}

/**
 * Looks through recent successful Stripe payments and adds any that aren't in Orders yet.
 * Needs the Stripe key to be allowed to read PaymentIntents.
 */
export async function syncStripePayments({ days = 90, now = Date.now() } = {}) {
	const since = Math.floor(now / 1000) - days * 86400;
	const intents = [];
	try {
		for await (const intent of stripe().paymentIntents.list({ created: { gte: since }, limit: 100 })) {
			if (intent.status === 'succeeded' && !intent.metadata?.order_id) intents.push(intent);
			if (intents.length >= 300) break;
		}
	} catch (err) {
		if (err.type === 'StripePermissionError' || err.statusCode === 403) {
			const e = new Error('Your Stripe key isn\'t allowed to read payments yet. In Stripe, give the key "PaymentIntents: Read".');
			e.permission = true;
			throw e;
		}
		throw err;
	}

	let added = 0;
	for (const intent of intents) {
		if (await findStripeOrder(intent.id, orderFromPaymentIntent(intent, { livemode: intent.livemode, created: intent.created }).date)) continue;
		const session = await checkoutFor(intent);
		// A website checkout whose order was already saved some other way
		if (session?.metadata?.order_id) continue;
		const result = session?.payment_link ? await importStripePayment({ session, livemode: intent.livemode, created: intent.created }) : await importStripePayment({ intent, livemode: intent.livemode });
		if (result.added) added += 1;
	}
	return { checked: intents.length, added };
}
