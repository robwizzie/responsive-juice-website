/**
 * Persistent data for the shop, kept in Netlify Blobs (built into every Netlify site,
 * no database to set up). Until Hunter saves something in /admin, the defaults in
 * assets/js/shared/catalog.js are used.
 */
import { getStore } from '@netlify/blobs';
import { DEFAULT_JUICES, DEFAULT_SETTINGS } from '../../../assets/js/shared/catalog.js';

const shop = () => getStore({ name: 'shop', consistency: 'strong' });
export const imageStore = () => getStore({ name: 'images' });
const orderStore = () => getStore({ name: 'orders', consistency: 'strong' });

const isObject = value => value && typeof value === 'object' && !Array.isArray(value);

// Saved values override defaults; nested groups (pickup, delivery) merge so that settings
// added in a later version of the site still get their default.
export function mergeDeep(base, override) {
	if (!isObject(override)) return base;
	const out = { ...base };
	for (const [key, value] of Object.entries(override)) {
		out[key] = isObject(value) && isObject(base[key]) ? mergeDeep(base[key], value) : value;
	}
	return out;
}

export async function getJuices() {
	const saved = await shop().get('juices', { type: 'json' });
	return Array.isArray(saved) ? saved : DEFAULT_JUICES;
}

export const saveJuices = juices => shop().setJSON('juices', juices);

export async function getSettings() {
	return mergeDeep(DEFAULT_SETTINGS, await shop().get('settings', { type: 'json' }));
}

export const saveSettings = settings => shop().setJSON('settings', settings);

/* Orders are keyed by fulfilment date so they list in pickup/delivery order */
export const orderKey = order => `${order.date}/${order.id}`;

export const getOrder = key => orderStore().get(key, { type: 'json' });

export const saveOrder = order => orderStore().setJSON(orderKey(order), order);

export async function listOrders() {
	const { blobs } = await orderStore().list();
	const keys = blobs.map(blob => blob.key).sort().reverse().slice(0, 200);
	const orders = await Promise.all(keys.map(key => getOrder(key)));
	return orders.filter(Boolean);
}

/* Lightweight per-key counters, used to slow down password guessing */
const security = () => getStore({ name: 'security', consistency: 'strong' });
export const getCounter = async key => (await security().get(key, { type: 'json' })) || { count: 0, since: Date.now() };
export const setCounter = (key, value) => security().setJSON(key, value);
export const clearCounter = key => security().delete(key);

/* Order details are saved before payment and promoted to a real order once Stripe confirms it */
const pendingStore = () => getStore({ name: 'pending-orders', consistency: 'strong' });
export const savePending = order => pendingStore().setJSON(order.id, order);
export const getPending = id => pendingStore().get(id, { type: 'json' });
export const deletePending = id => pendingStore().delete(id);
