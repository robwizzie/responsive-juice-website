import { randomUUID } from 'node:crypto';
import { purgeCache } from '@netlify/functions';
import { adminConfigured, changePassword, isSignedIn, signIn, signOutCookie } from './lib/auth.js';
import { deleteMessage, deleteOrder, getCopyEdits, getMessage, listMessages, saveMessage, getJuices, getOrder, getSettings, imageStore, listOrders, orderKey, saveCopy, saveJuices, saveOrder, saveSettings } from './lib/store.js';
import { cleanCopy, cleanJuices, cleanSettings } from './lib/validate.js';
import { clientIp, error, json, publicSiteUrl, readJSON } from './lib/http.js';
import { mailConfigured, ownerEmail, sendMail, testEmail } from './lib/mail.js';
import { ORDER_STAGES, isTestOrder, orderSource } from '../../assets/js/shared/order-status.js';
import { cleanSale } from './lib/sales.js';
import { syncStripePayments } from './lib/stripe-import.js';
import { startQrCheckout } from './lib/qr-checkout.js';
import { stripeConfigured } from './lib/stripe.js';
import { deliveryCenterFor } from './lib/geo.js';
import { toWebp } from './lib/webp.js';
import { visitDay, visitsBetween } from './lib/visits.js';

const IMAGE_TYPES = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' };
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
// Orders are addressed by their storage key, "<date>/<id>"
const ORDER_KEY = /^\d{4}-\d{2}-\d{2}\/[\w-]{1,64}$/;
// Messages are keyed "<ISO time>/<id>"
const MESSAGE_KEY = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z\/[\w-]{1,64}$/;

// Share images and juice pages are cached on the CDN; clear them so a change shows up in
// new link previews right away. Only works on Netlify, so a local save just skips it.
async function refreshSharePreviews() {
	try {
		await purgeCache({ tags: ['og', 'pages', 'catalog'] });
	} catch (err) {
		if (process.env.NETLIFY) console.warn('Could not refresh share previews', err.message);
	}
}

// Everything behind /admin. Requests that change data must carry the X-Admin-Request
// header, which other websites can't add, on top of the SameSite session cookie.
export default async (req, context) => {
	const action = new URL(req.url).pathname.replace(/^\/api\/admin\/?/, '');
	const mutating = req.method !== 'GET';
	if (mutating && req.headers.get('x-admin-request') !== '1') return error('Bad request', 400);

	if (action === 'session' && req.method === 'GET') {
		return json({ configured: adminConfigured(), signedIn: await isSignedIn(req) });
	}

	if (action === 'login' && req.method === 'POST') {
		const body = await readJSON(req);
		const result = await signIn(req, body?.password, clientIp(req, context));
		return result.ok ? json({ ok: true }, 200, { 'Set-Cookie': result.cookie }) : error(result.error, 401);
	}

	if (action === 'logout' && req.method === 'POST') {
		return json({ ok: true }, 200, { 'Set-Cookie': signOutCookie(req) });
	}

	if (!(await isSignedIn(req))) return error('Please sign in again.', 401);

	if (action === 'password' && req.method === 'PUT') {
		const body = await readJSON(req);
		const result = await changePassword(req, body?.current, body?.next, clientIp(req, context));
		return result.ok ? json({ ok: true }, 200, { 'Set-Cookie': result.cookie }) : error(result.error, 400);
	}

	if (action === 'data' && req.method === 'GET') {
		const settings = await getSettings();
		const [juices, copy] = await Promise.all([getJuices(settings), getCopyEdits()]);
		return json({ juices, settings, copy, status: { stripe: stripeConfigured(), email: mailConfigured(), emailTo: ownerEmail(settings), webhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET) } });
	}

	// Website visits for Stats → Website: day summaries from ?from= to ?to= (YYYY-MM-DD)
	if (action === 'visits' && req.method === 'GET') {
		const params = new URL(req.url).searchParams;
		const iso = /^\d{4}-\d{2}-\d{2}$/;
		const to = iso.test(params.get('to') || '') ? params.get('to') : visitDay();
		const from = iso.test(params.get('from') || '') ? params.get('from') : to;
		return json(await visitsBetween(from, to));
	}

	if (action === 'juices' && req.method === 'PUT') {
		const { value, error: problem } = cleanJuices(await readJSON(req));
		if (problem) return error(problem);
		await saveJuices(value);
		await refreshSharePreviews();
		return json({ juices: await getJuices() });
	}

	if (action === 'copy' && req.method === 'PUT') {
		const { value, error: problem } = cleanCopy(await readJSON(req));
		if (problem) return error(problem);
		await saveCopy(value);
		await refreshSharePreviews();
		return json({ copy: value });
	}

	if (action === 'settings' && req.method === 'PUT') {
		const { value, error: problem } = cleanSettings((await readJSON(req)) || {}, await getSettings());
		if (problem) return error(problem);
		// The delivery radius follows the pickup spot, so a new pickup address moves it too
		const { center, warning } = await deliveryCenterFor(value.pickup, value.delivery.center);
		value.delivery.center = center;
		await saveSettings(value);
		await refreshSharePreviews();
		// A new bottle price changes every juice that uses it
		return json({ settings: value, juices: await getJuices(value), warning });
	}

	if (action === 'images' && req.method === 'POST') {
		const type = (req.headers.get('content-type') || '').split(';')[0];
		const extension = IMAGE_TYPES[type];
		if (!extension) return error('Upload a PNG, JPEG or WebP image.');
		const data = await req.arrayBuffer();
		if (data.byteLength === 0 || data.byteLength > MAX_IMAGE_BYTES) return error('That image is too large (4 MB max).');
		// Stored as WebP (much smaller), except where a PNG is asked for: emails and Stripe need one
		const keep = new URL(req.url).searchParams.has('original') || type === 'image/webp';
		const body = keep ? data : await toWebp(data);
		const key = `${randomUUID()}.${keep ? extension : 'webp'}`;
		await imageStore().set(key, body, { metadata: { contentType: keep ? type : 'image/webp' } });
		return json({ url: `/api/images/${key}` });
	}

	if (action === 'orders' && req.method === 'GET') {
		return json({ orders: await listOrders() });
	}

	// Move an order along (making, ready, picked up…). Each change is kept with its time.
	if (action === 'orders' && req.method === 'PUT') {
		const body = await readJSON(req);
		if (!ORDER_KEY.test(body?.key || '') || !ORDER_STAGES.includes(body?.stage)) return error('Bad request');
		const order = await getOrder(body.key);
		if (!order) return error('That order is gone. Refresh the page.', 404);
		const history = [...(order.history || []), { stage: body.stage, at: new Date().toISOString() }].slice(-30);
		const updated = { ...order, stage: body.stage, history };
		await saveOrder(updated);
		return json({ order: updated, key: orderKey(updated) });
	}

	// A sale made outside the website (cash, Venmo, Instagram…), typed in by Hunter
	if (action === 'sales' && req.method === 'POST') {
		const { value, error: problem } = cleanSale(await readJSON(req), await getJuices());
		if (problem) return error(problem);
		await saveOrder(value);
		return json({ order: value, key: orderKey(value) });
	}

	// Pay by QR: the customer scans and pays on their phone; the order arrives through the webhook
	if (action === 'sales-qr' && req.method === 'POST') {
		if (!stripeConfigured()) return error('Stripe isn\'t set up yet.', 503);
		const body = await readJSON(req);
		const { value, error: problem } = cleanSale({ ...body, payment: 'card' }, await getJuices());
		if (problem) return error(problem);
		if (value.total < 50) return error('Card payments need to be at least $0.50.');
		try {
			return json(await startQrCheckout(value, publicSiteUrl(req)));
		} catch (err) {
			console.error('QR checkout failed:', err);
			return error(`Stripe couldn't make the payment page: ${err.message}`, 502);
		}
	}

	// Fix up an outside sale, or add the juices to a Stripe payment. Moving its date moves its key.
	if (action === 'sales' && req.method === 'PUT') {
		const body = await readJSON(req);
		if (!ORDER_KEY.test(body?.key || '')) return error('Bad request');
		const existing = await getOrder(body.key);
		if (!existing) return error('That order is gone. Refresh the page.', 404);
		if (orderSource(existing) === 'website') return error('Website orders can\'t be edited here.');
		const { value, error: problem } = cleanSale(body, await getJuices(), { existing });
		if (problem) return error(problem);
		await saveOrder(value);
		if (orderKey(value) !== body.key) await deleteOrder(body.key);
		return json({ order: value, key: orderKey(value) });
	}

	// Catch up on Stripe payments the website didn't start (Tap to Pay, Payment Links)
	if (action === 'stripe-sync' && req.method === 'POST') {
		if (!stripeConfigured()) return error('Stripe isn\'t set up yet.', 503);
		try {
			const result = await syncStripePayments();
			return json({ ...result, orders: await listOrders() });
		} catch (err) {
			console.error('Stripe sync failed:', err);
			return error(err.permission ? err.message : `Couldn't reach Stripe: ${err.message}`, err.permission ? 403 : 502);
		}
	}

	// Test orders and sales Hunter typed in himself can be removed; real Stripe ones are kept for the books
	if (action === 'orders' && req.method === 'DELETE') {
		const body = await readJSON(req);
		if (!ORDER_KEY.test(body?.key || '')) return error('Bad request');
		const order = await getOrder(body.key);
		if (!order) return json({ ok: true });
		if (!isTestOrder(order) && orderSource(order) !== 'manual') return error('Real orders can\'t be deleted. Mark it canceled instead.');
		await deleteOrder(body.key);
		return json({ ok: true });
	}

	if (action === 'messages' && req.method === 'GET') {
		return json({ messages: await listMessages() });
	}

	// Mark a message read or unread, or file it away
	if (action === 'messages' && req.method === 'PUT') {
		const body = await readJSON(req);
		const message = MESSAGE_KEY.test(body?.key || '') && (await getMessage(body.key));
		if (!message) return error('That message is gone. Refresh the page.', 404);
		const updated = { ...message, read: typeof body.read === 'boolean' ? body.read : message.read, archived: typeof body.archived === 'boolean' ? body.archived : message.archived };
		await saveMessage(updated);
		return json({ message: updated });
	}

	if (action === 'messages' && req.method === 'DELETE') {
		const body = await readJSON(req);
		if (!MESSAGE_KEY.test(body?.key || '')) return error('Bad request');
		await deleteMessage(body.key);
		return json({ ok: true });
	}

	if (action === 'test-email' && req.method === 'POST') {
		if (!mailConfigured()) return error('Email isn\'t set up yet, so nothing can be sent.', 503);
		const settings = await getSettings();
		const to = ownerEmail(settings);
		try {
			await sendMail({ to, subject: 'SiponPressed test email', html: testEmail(settings, publicSiteUrl(req)) });
		} catch (err) {
			console.error('Test email failed:', err);
			return error(`The email didn't send: ${err.message}`, 502);
		}
		return json({ ok: true, to });
	}

	return error('Not found', 404);
};

export const config = { path: '/api/admin/*' };
