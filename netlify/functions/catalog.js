import { getJuices, getSettings } from './lib/store.js';
import { json } from './lib/http.js';

// Everything the public pages need: the menu and the ordering rules.
export default async () => {
	const [juices, settings] = await Promise.all([getJuices(), getSettings()]);
	const { details, ...pickup } = settings.pickup;
	return json({ juices: juices.filter(juice => juice.active), settings: { ...settings, pickup } }, 200, {
		'Cache-Control': 'public, max-age=0, must-revalidate'
	});
};

export const config = { path: '/api/catalog' };
