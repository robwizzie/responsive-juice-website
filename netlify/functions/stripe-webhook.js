import { deletePending, getJuices, getOrder, getPending, getSettings, orderKey, saveOrder } from './lib/store.js';
import { customerConfirmation, ownerEmail, ownerNotification, sendMail } from './lib/mail.js';
import { publicSiteUrl } from './lib/http.js';
import { stripe } from './lib/stripe.js';
import { formatDate } from '../../assets/js/shared/order-rules.js';

// Stripe calls this after a successful payment. We turn the saved order into a confirmed
// one and email Hunter and the customer. Stripe may retry, so this is safe to run twice.
export default async req => {
	if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

	let event;
	try {
		event = await stripe().webhooks.constructEventAsync(await req.text(), req.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET);
	} catch (err) {
		console.error('Webhook signature failed:', err.message);
		return new Response(`Webhook Error: ${err.message}`, { status: 400 });
	}

	if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') {
		return new Response('Ignored', { status: 200 });
	}

	const session = event.data.object;
	if (session.payment_status !== 'paid') return new Response('Awaiting payment', { status: 200 });

	const id = session.metadata?.order_id || session.client_reference_id;
	const pending = id && (await getPending(id));
	if (!pending) {
		// Already processed (pending copy removed) or not one of ours
		console.warn(`No pending order for session ${session.id}`);
		return new Response('OK', { status: 200 });
	}

	const order = { ...pending, status: 'paid', paidAt: new Date().toISOString(), stripeSessionId: session.id, total: session.amount_total ?? pending.total };
	const alreadySaved = await getOrder(orderKey(order));
	await saveOrder(alreadySaved || order);

	if (!alreadySaved) {
		const [settings, juices] = await Promise.all([getSettings(), getJuices()]);
		const siteUrl = publicSiteUrl(req);
		const images = Object.fromEntries(juices.map(juice => [juice.slug, juice.emailImage || '']));
		const when = formatDate(order.date, { weekday: 'short', month: 'short', day: 'numeric' });
		const results = await Promise.allSettled([
			sendMail({ to: ownerEmail(settings), replyTo: order.customer.email, subject: `New ${order.type} order: ${order.customer.name} (${when})`, html: ownerNotification(order, settings, siteUrl, images) }),
			sendMail({ to: order.customer.email, replyTo: ownerEmail(settings), subject: `Your SiponPressed order for ${when}`, html: customerConfirmation(order, settings, siteUrl, images) })
		]);
		results.filter(r => r.status === 'rejected').forEach(r => console.error('Order email failed:', r.reason));
	}

	await deletePending(id);
	return new Response('OK', { status: 200 });
};

// Same address the old site used, so the Stripe webhook doesn't need to change
export const config = { path: ['/webhook/stripe', '/api/stripe-webhook'] };
