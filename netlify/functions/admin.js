import { randomUUID } from 'node:crypto';
import { purgeCache } from '@netlify/functions';
import { adminConfigured, changePassword, isSignedIn, signIn, signOutCookie } from './lib/auth.js';
import { deleteMessage, deleteOrder, getCopyEdits, getMessage, listMessages, saveMessage, getJuices, getOrder, getSettings, imageStore, listOrders, orderKey, saveCopy, saveJuices, saveOrder, saveSettings } from './lib/store.js';
import { cleanCopy, cleanJuices, cleanSettings } from './lib/validate.js';
import { clientIp, error, json, publicSiteUrl, readJSON } from './lib/http.js';
import { mailConfigured, ownerEmail, sendMail, testEmail } from './lib/mail.js';
import { ORDER_STAGES, isTestOrder } from '../../assets/js/shared/order-status.js';
import { stripeConfigured } from './lib/stripe.js';

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
		await purgeCache({ tags: ['og', 'pages'] });
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
		await saveSettings(value);
		await refreshSharePreviews();
		// A new bottle price changes every juice that uses it
		return json({ settings: value, juices: await getJuices(value) });
	}

	if (action === 'images' && req.method === 'POST') {
		const type = (req.headers.get('content-type') || '').split(';')[0];
		const extension = IMAGE_TYPES[type];
		if (!extension) return error('Upload a PNG, JPEG or WebP image.');
		const data = await req.arrayBuffer();
		if (data.byteLength === 0 || data.byteLength > MAX_IMAGE_BYTES) return error('That image is too large (4 MB max).');
		const key = `${randomUUID()}.${extension}`;
		await imageStore().set(key, data, { metadata: { contentType: type } });
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

	// Only Stripe test orders can be removed; real ones are kept for the books
	if (action === 'orders' && req.method === 'DELETE') {
		const body = await readJSON(req);
		if (!ORDER_KEY.test(body?.key || '')) return error('Bad request');
		const order = await getOrder(body.key);
		if (!order) return json({ ok: true });
		if (!isTestOrder(order)) return error('Real orders can\'t be deleted. Mark it canceled instead.');
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
