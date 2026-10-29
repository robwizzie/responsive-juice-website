import { randomUUID } from 'node:crypto';
import { getJuices, getSettings, savePending } from './lib/store.js';
import { checkDeliveryAddress, formatAddress } from './lib/geo.js';
import { error, json, readJSON, requestOrigin } from './lib/http.js';
import { stripe, stripeConfigured } from './lib/stripe.js';
import { DELIVERY_STATES, formatDate, milesOutside, pickupAddress, priceOrder } from '../../assets/js/shared/order-rules.js';

const clean = (value, max = 120) => String(value ?? '').trim().slice(0, max);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Prices the cart on the server (never trusting the browser's numbers), checks the
// pickup/delivery rules, then sends the customer to Stripe Checkout.
export default async req => {
	if (req.method !== 'POST') return error('Method not allowed', 405);
	const body = await readJSON(req);
	if (!body) return error('Something went wrong reading your order. Please try again.');

	const [juices, settings] = await Promise.all([getJuices(), getSettings()]);
	const type = body.type === 'delivery' ? 'delivery' : 'pickup';
	const priced = priceOrder({ items: Array.isArray(body.items) ? body.items : [], type, date: clean(body.date, 10) }, juices, settings);
	if (!priced.ok) return error(priced.errors[0]);

	const customer = { name: clean(body.customer?.name, 80), email: clean(body.customer?.email), phone: clean(body.customer?.phone, 30) };
	if (!customer.name) return error('Please add your name.');
	if (!emailPattern.test(customer.email)) return error('Please add a valid email so we can send your confirmation.');
	if (customer.phone.replace(/\D/g, '').length < 10) return error('Please add a phone number so Hunter can reach you.');

	let address = null;
	let zoneCheck = null;
	if (type === 'delivery') {
		const a = body.address || {};
		address = { line1: clean(a.line1), line2: clean(a.line2), city: clean(a.city, 60), state: DELIVERY_STATES.includes(a.state) ? a.state : 'PA', zip: clean(a.zip, 10) };
		if (!address.line1 || !address.city || !/^\d{5}$/.test(address.zip)) return error('Please enter your full delivery address.');
		zoneCheck = await checkDeliveryAddress(address, settings);
		if (zoneCheck.status === 'out') {
			const over = milesOutside(zoneCheck.miles, settings);
			return error(`That address is about ${over} mile${over === 1 ? '' : 's'} outside our delivery area. Pickup is always an option.`);
		}
		if (zoneCheck.status === 'unknown') return error('We could not find that address. Please double-check the street and ZIP.');
	}

	if (!stripeConfigured()) return error('Online payment is not set up yet. Please message us to order.', 503);

	const origin = requestOrigin(req);
	const bySlug = new Map(juices.map(juice => [juice.slug, juice]));
	const image = path => (path ? [path.startsWith('http') ? path : `${origin}${path}`] : []);

	const line_items = priced.lines.map(line => {
		const juice = bySlug.get(line.slug);
		return {
			quantity: line.qty,
			price_data: {
				currency: 'usd',
				unit_amount: line.unit,
				// Stripe shows PNG/JPEG reliably, so prefer the PNG copy of the bottle
				product_data: { name: line.name, description: `${juice.sizeOz} fl oz cold-pressed juice`, images: image(juice.emailImage || juice.image) }
			}
		};
	});
	if (type === 'delivery' && priced.deliveryFee > 0) {
		line_items.push({
			quantity: 1,
			price_data: { currency: 'usd', unit_amount: priced.deliveryFee, product_data: { name: 'Monday delivery', description: settings.delivery.areaLabel } }
		});
	}

	const order = {
		id: randomUUID(),
		createdAt: new Date().toISOString(),
		type,
		date: clean(body.date, 10),
		customer,
		address,
		zoneCheck,
		notes: clean(body.notes, 500),
		lines: priced.lines,
		subtotal: priced.subtotal,
		deliveryFee: priced.deliveryFee,
		total: priced.total
	};

	try {
		await savePending(order);
		const when = formatDate(order.date);
		const session = await stripe().checkout.sessions.create({
			mode: 'payment',
			line_items,
			customer_email: customer.email,
			client_reference_id: order.id,
			metadata: { order_id: order.id, order_type: type, date: order.date, customer_name: customer.name, customer_phone: customer.phone, address: address ? formatAddress(address) : '' },
			payment_intent_data: { description: `SiponPressed ${type} order for ${when}`, metadata: { order_id: order.id } },
			custom_text: {
				submit: { message: type === 'delivery' ? `Delivered ${when} to ${formatAddress(address)}.` : `Ready for pickup ${when} at ${pickupAddress(settings.pickup)}. Hunter will text you when it's ready.` }
			},
			success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${origin}/order?canceled=1`
		});
		return json({ url: session.url });
	} catch (err) {
		console.error('Stripe checkout error:', err);
		return error('We could not start checkout. Please try again in a minute.', 502);
	}
};

export const config = { path: ['/api/checkout', '/create-checkout-session'] };
