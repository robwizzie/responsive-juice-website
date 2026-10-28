import { getSettings } from './lib/store.js';
import { checkDeliveryAddress } from './lib/geo.js';
import { error, json, readJSON } from './lib/http.js';

// Lets the order page tell a customer up front whether their address is in the delivery area.
export default async req => {
	if (req.method !== 'POST') return error('Method not allowed', 405);
	const address = await readJSON(req);
	if (!address?.line1 || !address?.zip) return error('Enter a street address and ZIP code.');
	const settings = await getSettings();
	return json(await checkDeliveryAddress(address, settings));
};

export const config = { path: '/api/delivery-check' };
