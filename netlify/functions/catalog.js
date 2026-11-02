import { getCopy, getJuices, getSettings } from './lib/store.js';
import { json } from './lib/http.js';

// Everything the public pages need: the menu, the ordering rules and Hunter's page text.
// Netlify's CDN keeps a copy (tag "catalog") so pages get it fast; every save in /admin clears it,
// and it's refreshed in the background at least every five minutes in case a clear ever fails.
export default async () => {
	const settings = await getSettings();
	const [juices, copy] = await Promise.all([getJuices(settings), getCopy()]);
	const { details, ...pickup } = settings.pickup;
	return json({ juices: juices.filter(juice => juice.active), settings: { ...settings, pickup }, copy }, 200, {
		'Cache-Control': 'public, max-age=0, must-revalidate',
		'Netlify-CDN-Cache-Control': 'public, durable, max-age=300, stale-while-revalidate=86400',
		'Netlify-Cache-Tag': 'catalog'
	});
};

export const config = { path: '/api/catalog' };
