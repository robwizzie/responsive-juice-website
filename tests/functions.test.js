import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BlobsServer } from '@netlify/blobs/server';
import Stripe from 'stripe';

// Functions run against a local Blobs server and a fake Stripe key (no network needed).
const dir = mkdtempSync(join(tmpdir(), 'sp-blobs-'));
const server = new BlobsServer({ directory: dir, port: 0, token: 't' });
let fns;

before(async () => {
	const { port } = await server.start();
	const url = `http://localhost:${port}`;
	globalThis.netlifyBlobsContext = Buffer.from(JSON.stringify({ edgeURL: url, uncachedEdgeURL: url, token: 't', siteID: 'test' })).toString('base64');
	Object.assign(process.env, { ADMIN_PASSWORD: 'secret', STRIPE_SECRET_KEY: 'sk_test_fake', STRIPE_WEBHOOK_SECRET: 'whsec_test' });
	fns = {
		admin: (await import('../netlify/functions/admin.js')).default,
		catalog: (await import('../netlify/functions/catalog.js')).default,
		webhook: (await import('../netlify/functions/stripe-webhook.js')).default,
		store: await import('../netlify/functions/lib/store.js')
	};
});

after(async () => {
	await server.stop();
	rmSync(dir, { recursive: true, force: true });
});

const req = (path, { method = 'GET', body, headers = {} } = {}) =>
	new Request(`https://siponpressed.test${path}`, { method, body: body && JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } });

test('admin requires sign in and the admin header', async () => {
	const ctx = { ip: '1.2.3.4' };
	assert.equal((await fns.admin(req('/api/admin/data'), ctx)).status, 401);
	assert.equal((await fns.admin(req('/api/admin/login', { method: 'POST', body: { password: 'secret' } }), ctx)).status, 400);

	const bad = await fns.admin(req('/api/admin/login', { method: 'POST', body: { password: 'nope' }, headers: { 'x-admin-request': '1' } }), ctx);
	assert.equal(bad.status, 401);

	const good = await fns.admin(req('/api/admin/login', { method: 'POST', body: { password: 'secret' }, headers: { 'x-admin-request': '1' } }), ctx);
	assert.equal(good.status, 200);
	const cookie = good.headers.get('set-cookie').split(';')[0];
	assert.match(good.headers.get('set-cookie'), /HttpOnly/);

	const data = await (await fns.admin(req('/api/admin/data', { headers: { cookie } }), ctx)).json();
	assert.equal(data.juices.length, 3);

	// Hiding a juice removes it from the public menu
	const juices = data.juices.map(j => (j.slug === 'simply-red' ? { ...j, active: false } : j));
	const saved = await fns.admin(req('/api/admin/juices', { method: 'PUT', body: juices, headers: { cookie, 'x-admin-request': '1' } }), ctx);
	assert.equal(saved.status, 200);
	const menu = await (await fns.catalog(req('/api/catalog'))).json();
	assert.deepEqual(menu.juices.map(j => j.slug), ['simply-orange', 'simply-green']);
	assert.equal(menu.settings.pickup.details, undefined, 'private pickup details stay out of the public catalog');

	// Invalid input is refused
	const broken = await fns.admin(req('/api/admin/juices', { method: 'PUT', body: [{ name: '' }], headers: { cookie, 'x-admin-request': '1' } }), ctx);
	assert.equal(broken.status, 400);
});

test('one bottle price reprices the whole menu, and page text edits reach the public catalog', async () => {
	const ctx = { ip: '5.6.7.8' };
	const login = await fns.admin(req('/api/admin/login', { method: 'POST', body: { password: 'secret' }, headers: { 'x-admin-request': '1' } }), ctx);
	const headers = { cookie: login.headers.get('set-cookie').split(';')[0], 'x-admin-request': '1' };
	const call = (path, method, body) => fns.admin(req(`/api/admin/${path}`, { method, body, headers }), ctx).then(res => res.json());

	// A menu saved back when bottles were $7.50 picks up the $8 shop price
	const { juices, settings } = await call('data', 'GET');
	await fns.store.saveJuices(juices.map(j => ({ ...j, price: 7.5, customPrice: undefined })));
	let menu = await (await fns.catalog(req('/api/catalog'))).json();
	assert.ok(menu.juices.every(j => j.price === 8));

	// Changing the bottle price changes every juice, except one with its own price
	await call('juices', 'PUT', juices.map(j => (j.slug === 'simply-green' ? { ...j, customPrice: true, price: 9.5 } : j)));
	const saved = await call('settings', 'PUT', { ...settings, bottlePrice: 8.5 });
	assert.deepEqual(saved.juices.map(j => j.price), [8.5, 9.5, 8.5]);
	menu = await (await fns.catalog(req('/api/catalog'))).json();
	assert.deepEqual(menu.juices.map(j => j.price), [8.5, 9.5]);

	// Page text: saved edits show up in the catalog the pages read, defaults fill the rest
	const copy = await call('copy', 'PUT', { 'home.hero.line1': 'Sip on', 'home.hero.line2': 'the sip' });
	assert.deepEqual(copy.copy, { 'home.hero.line1': 'Sip on' });
	menu = await (await fns.catalog(req('/api/catalog'))).json();
	assert.equal(menu.copy['home.hero.line1'], 'Sip on');
	assert.equal(menu.copy['home.hero.line2'], 'the sip');
	assert.deepEqual((await call('data', 'GET')).copy, { 'home.hero.line1': 'Sip on' });

	// A replaced ingredient photo reaches every juice in the public menu
	await call('settings', 'PUT', { ...saved.settings, ingredientPhotos: { orange: '/api/images/orange.webp' } });
	menu = await (await fns.catalog(req('/api/catalog'))).json();
	assert.ok(menu.juices.every(j => j.ingredientImages.orange === '/api/images/orange.webp'));
});

test('Hunter can change his password, and the Netlify password still works as a backup', async () => {
	const ctx = { ip: '9.9.9.9' };
	const login = password => fns.admin(req('/api/admin/login', { method: 'POST', body: { password }, headers: { 'x-admin-request': '1' } }), ctx);
	const cookieOf = res => res.headers.get('set-cookie').split(';')[0];
	const change = (cookie, body) => fns.admin(req('/api/admin/password', { method: 'PUT', body, headers: { cookie, 'x-admin-request': '1' } }), ctx);
	const signedIn = async cookie => (await (await fns.admin(req('/api/admin/session', { headers: { cookie } }), ctx)).json()).signedIn;

	const phone = cookieOf(await login('secret'));
	const laptop = cookieOf(await login('secret'));
	assert.equal((await change(laptop, { current: 'wrong', next: 'fresh-squeezed' })).status, 400);
	assert.equal((await change(laptop, { current: 'secret', next: 'short' })).status, 400);

	const changed = await change(laptop, { current: 'secret', next: 'fresh-squeezed' });
	assert.equal(changed.status, 200);
	const saved = await fns.store.getSavedPassword();
	assert.ok(saved.hash && saved.salt && !JSON.stringify(saved).includes('fresh-squeezed'), 'only a salted hash is stored');

	assert.equal(await signedIn(cookieOf(changed)), true, 'the device that changed it stays signed in');
	assert.equal(await signedIn(phone), false, 'other devices are signed out');
	assert.equal((await login('fresh-squeezed')).status, 200);
	assert.equal((await login('secret')).status, 200, 'ADMIN_PASSWORD still works');
	assert.equal((await login('not-it')).status, 401);

	await fns.store.savePassword(null);
});

test('paid Stripe session turns a pending order into a saved order, once', async () => {
	const order = { id: 'order-1', type: 'pickup', date: '2026-11-03', customer: { name: 'Pat Doe', email: 'pat@example.com', phone: '2155550100' }, lines: [{ slug: 'simply-green', name: 'Simply Green', qty: 2, unit: 750, amount: 1500 }], subtotal: 1500, deliveryFee: 0, total: 1500 };
	await fns.store.savePending(order);

	const payload = JSON.stringify({ id: 'evt_1', object: 'event', type: 'checkout.session.completed', data: { object: { id: 'cs_test_1', payment_status: 'paid', amount_total: 1500, metadata: { order_id: 'order-1' } } } });
	const signature = new Stripe('sk_test_fake').webhooks.generateTestHeaderString({ payload, secret: 'whsec_test' });
	const send = () => fns.webhook(new Request('https://siponpressed.test/webhook/stripe', { method: 'POST', body: payload, headers: { 'stripe-signature': signature } }));

	assert.equal((await send()).status, 200);
	assert.equal((await send()).status, 200);
	const orders = await fns.store.listOrders();
	assert.equal(orders.length, 1);
	assert.equal(orders[0].status, 'paid');

	const forged = await fns.webhook(new Request('https://siponpressed.test/webhook/stripe', { method: 'POST', body: payload, headers: { 'stripe-signature': 't=1,v1=bad' } }));
	assert.equal(forged.status, 400);
});
