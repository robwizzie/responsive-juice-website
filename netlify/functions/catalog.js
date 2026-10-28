import { getCopy, getJuices, getSettings } from './lib/store.js';
import { json } from './lib/http.js';

// Everything the public pages need: the menu, the ordering rules and Hunter's page text.
export default async () => {
	const settings = await getSettings();
	const [juices, copy] = await Promise.all([getJuices(settings), getCopy()]);
	const { details, ...pickup } = settings.pickup;
	return json({ juices: juices.filter(juice => juice.active), settings: { ...settings, pickup }, copy }, 200, {
		'Cache-Control': 'public, max-age=0, must-revalidate'
	});
};

export const config = { path: '/api/catalog' };
