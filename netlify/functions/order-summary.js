import { getPending, getOrder, orderKey } from './lib/store.js';
import { error, json } from './lib/http.js';
import { stripe, stripeConfigured } from './lib/stripe.js';

// Powers the thank-you page: looks up the order behind a Stripe Checkout session.
export default async req => {
	const sessionId = new URL(req.url).searchParams.get('session_id');
	if (!sessionId?.startsWith('cs_') || !stripeConfigured()) return error('Order not found', 404);

	try {
		const session = await stripe().checkout.sessions.retrieve(sessionId);
		const id = session.metadata?.order_id;
		const pending = id && (await getPending(id));
		const saved = !pending && id && session.metadata?.date ? await getOrder(orderKey({ id, date: session.metadata.date })) : null;
		const order = saved || pending;
		if (!order) return error('Order not found', 404);
		return json({
			paid: session.payment_status === 'paid',
			firstName: order.customer.name.split(' ')[0],
			email: order.customer.email,
			type: order.type,
			date: order.date,
			lines: order.lines,
			deliveryFee: order.deliveryFee,
			total: order.total
		});
	} catch (err) {
		console.error('Order summary failed:', err.message);
		return error('Order not found', 404);
	}
};

export const config = { path: '/api/order-summary' };
