/**
 * "Pay by QR" in Admin → Add sale: Hunter picks the juices, a Stripe Checkout page is made for
 * exactly those bottles, and the customer scans it and pays on their own phone. Unlike Tap to Pay,
 * Stripe then knows what was bought, so the order lands with its juices already filled in.
 * It goes through the same pending order + webhook path as website checkout.
 */
import QRCode from 'qrcode';
import { savePending } from './store.js';
import { stripe } from './stripe.js';
import { formatDate } from '../../../assets/js/shared/order-rules.js';

const HALF_HOUR = 30 * 60; // the shortest a Checkout page can stay open

/** Stripe line items that add up to the sale's total, even after a deal price. */
export function qrLineItems(lines) {
	return lines.map(line => {
		const even = line.amount % line.qty === 0;
		return {
			quantity: even ? line.qty : 1,
			price_data: { currency: 'usd', unit_amount: even ? line.amount / line.qty : line.amount, product_data: { name: even ? line.name : `${line.qty} × ${line.name}` } }
		};
	});
}

/** Saves the sale as pending, opens a Checkout page for it, and returns its link and a QR code. */
export async function startQrCheckout(sale, origin, now = Date.now()) {
	const order = { ...sale, source: 'stripe', stripe: { kind: 'qr' }, payment: 'stripe', status: 'pending', test: undefined, paidAt: null };
	delete order.channel;
	await savePending(order);
	const summary = order.lines.map(l => `${l.qty} ${l.name}`).join(', ');
	const session = await stripe().checkout.sessions.create({
		mode: 'payment',
		line_items: qrLineItems(order.lines),
		...(order.customer.email ? { customer_email: order.customer.email } : {}),
		client_reference_id: order.id,
		metadata: { order_id: order.id, order_type: order.type, date: order.date, source: 'qr', customer_name: order.customer.name },
		payment_intent_data: { description: `SiponPressed in person: ${summary}`.slice(0, 500), metadata: { order_id: order.id } },
		custom_text: { submit: { message: order.type === 'handoff' ? 'Thanks for grabbing a bottle!' : `For ${order.type} on ${formatDate(order.date)}.` } },
		expires_at: Math.floor(now / 1000) + HALF_HOUR + 60,
		success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${origin}/`
	});
	const qr = await QRCode.toString(session.url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111312', light: '#ffffff' } });
	return { id: order.id, url: session.url, qr, total: order.total };
}
