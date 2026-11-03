/**
 * Website visits, counted without cookies or third-party trackers.
 *
 * Every public page load sends a tiny "hit" (see assets/js/lib/visits.js). Each hit is saved as its
 * own blob under e/<day>/, so two visitors at once never overwrite each other. When the admin opens
 * Stats, finished days are rolled up into one summary (d/<day>) and their hits are deleted.
 *
 * A visitor is a hash of their IP address and browser, salted with the day, so the same person
 * counts once a day and can't be followed from one day to the next. Hunter's own visits (signed
 * in to the admin) and bots aren't counted.
 */
import { createHash, randomUUID } from 'node:crypto';
import { getStore } from '@netlify/blobs';

export const visitStore = () => getStore({ name: 'visits', consistency: 'strong' });

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
/** The Philadelphia calendar day of a moment, like the sales stats. */
export const visitDay = (moment = Date.now()) => dayFormat.format(new Date(moment));

const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|lighthouse|headless|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch|vercel|netlify/i;
export const isBot = userAgent => !userAgent || BOTS.test(userAgent);

export function deviceOf(userAgent = '') {
	if (/ipad|tablet|kindle|silk|playbook/i.test(userAgent) || (/android/i.test(userAgent) && !/mobile/i.test(userAgent))) return 'tablet';
	if (/mobi|iphone|ipod|android/i.test(userAgent)) return 'phone';
	return 'computer';
}

// Where a visit came from, in words Hunter knows
const SOURCES = [
	[/instagram|^l\.instagram/, 'Instagram'],
	[/google\./, 'Google'],
	[/bing\.|duckduckgo|yahoo\.|ecosia|search\.brave|chatgpt|perplexity/, 'Other search'],
	[/facebook|fb\.|messenger/, 'Facebook'],
	[/tiktok/, 'TikTok'],
	[/t\.co$|twitter|x\.com/, 'X / Twitter'],
	[/snapchat/, 'Snapchat'],
	[/linkedin|lnkd\.in/, 'LinkedIn']
];
export function sourceOf(referrer, utmSource, ownHost) {
	if (utmSource) {
		const named = SOURCES.find(([pattern]) => pattern.test(String(utmSource).toLowerCase()));
		return named ? named[1] : String(utmSource).slice(0, 30);
	}
	let host = '';
	try {
		host = new URL(referrer).hostname.replace(/^www\./, '');
	} catch {
		return 'Direct';
	}
	if (!host || host === ownHost || host.endsWith('.netlify.app')) return 'Direct';
	const named = SOURCES.find(([pattern]) => pattern.test(host));
	return named ? named[1] : host;
}

const visitorId = (day, ip, userAgent) =>
	createHash('sha256')
		.update(`${process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'siponpressed'}|${day}|${ip}|${userAgent}`)
		.digest('hex')
		.slice(0, 16);

const cleanPath = path => {
	const value = String(path || '/').split(/[?#]/)[0].slice(0, 100);
	return /^\/[\w\-./]*$/.test(value) && !value.startsWith('/admin') ? value.replace(/(.)\/$/, '$1') : null;
};

const EVENTS = ['view', 'cart', 'checkout'];

/** Turns a hit from the browser into the event that gets saved (or null to skip it). */
export function makeEvent(body, { ip, userAgent, geo, ownHost, now = Date.now() }) {
	if (isBot(userAgent)) return null;
	const path = cleanPath(body?.p);
	const type = EVENTS.includes(body?.e) ? body.e : 'view';
	if (!path) return null;
	const day = visitDay(now);
	const place = geo?.city ? `${geo.city}${geo.subdivision?.code ? `, ${geo.subdivision.code}` : ''}` : geo?.country?.name || '';
	return {
		t: now,
		day,
		v: visitorId(day, ip, userAgent),
		e: type,
		p: path,
		s: sourceOf(body?.r, body?.u, ownHost),
		d: deviceOf(userAgent),
		c: place.slice(0, 60),
		...(type === 'cart' && typeof body?.j === 'string' ? { j: body.j.slice(0, 60) } : {})
	};
}

export async function saveEvent(event) {
	await visitStore().setJSON(`e/${event.day}/${event.t}-${randomUUID().slice(0, 8)}`, event);
}

const bump = (counts, key, by = 1) => {
	if (key) counts[key] = (counts[key] || 0) + by;
};

/**
 * One day's events as a summary: visitors (once each), page views, pages, juices looked at, where
 * visitors came from (their first page of the day), devices and places, plus the shopping steps.
 */
export function summarize(day, events, earlier = null) {
	const s = earlier
		? structuredClone(earlier)
		: { day, views: 0, ids: [], pages: {}, juices: {}, sources: {}, devices: {}, places: {}, hours: Array(24).fill(0), carts: 0, cartJuices: {}, cartIds: [], checkoutIds: [], juiceIds: {}, orderIds: [] };
	const seen = new Set(s.ids);
	const sets = { cartIds: new Set(s.cartIds), checkoutIds: new Set(s.checkoutIds), orderIds: new Set(s.orderIds) };
	const juiceIds = Object.fromEntries(Object.entries(s.juiceIds).map(([slug, ids]) => [slug, new Set(ids)]));
	const hour = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' });
	for (const event of [...events].sort((a, b) => a.t - b.t)) {
		if (event.e === 'cart') {
			s.carts += 1;
			bump((s.cartJuices ||= {}), event.j);
			sets.cartIds.add(event.v);
			continue;
		}
		if (event.e === 'checkout') {
			sets.checkoutIds.add(event.v);
			continue;
		}
		s.views += 1;
		bump(s.pages, event.p);
		const juice = /^\/juices\/([\w-]+)$/.exec(event.p)?.[1];
		if (juice) {
			bump(s.juices, juice);
			(juiceIds[juice] ||= new Set()).add(event.v);
		}
		if (event.p === '/order') sets.orderIds.add(event.v);
		if (!seen.has(event.v)) {
			seen.add(event.v);
			bump(s.sources, event.s || 'Direct');
			bump(s.devices, event.d);
			bump(s.places, event.c);
			s.hours[Number(hour.format(new Date(event.t))) % 24] += 1;
		}
	}
	s.ids = [...seen];
	for (const key of Object.keys(sets)) s[key] = [...sets[key]];
	s.juiceIds = Object.fromEntries(Object.entries(juiceIds).map(([slug, ids]) => [slug, [...ids]]));
	return s;
}

/** What the admin gets for a day: the counts, without the visitor ids. */
export const publicSummary = s => ({
	day: s.day,
	visitors: s.ids.length,
	views: s.views,
	pages: s.pages,
	juices: s.juices,
	juiceVisitors: Object.fromEntries(Object.entries(s.juiceIds).map(([slug, ids]) => [slug, ids.length])),
	sources: s.sources,
	devices: s.devices,
	places: s.places,
	hours: s.hours,
	carts: s.carts,
	cartJuices: s.cartJuices || {},
	cartVisitors: s.cartIds.length,
	checkoutVisitors: s.checkoutIds.length,
	orderVisitors: s.orderIds.length,
	juiceBrowsers: new Set(Object.values(s.juiceIds).flat()).size
});

/**
 * Summaries for every day from `from` to `to` (inclusive) that had visits. Finished days are rolled
 * up and their hits deleted; today is worked out fresh each time. Also returns who's on the site now.
 */
export async function visitsBetween(from, to, now = Date.now()) {
	const store = visitStore();
	const today = visitDay(now);
	const inRange = day => day >= from && day <= to;
	// Two listings say which days have anything, so empty days cost nothing
	const [{ blobs: summaries }, { blobs: hits }] = await Promise.all([store.list({ prefix: 'd/' }), store.list({ prefix: 'e/' })]);
	const saved = new Set(summaries.map(blob => blob.key.slice(2)).filter(inRange));
	const pending = new Map();
	for (const { key } of hits) {
		const day = key.split('/')[1];
		if (!inRange(day)) continue;
		if (!pending.has(day)) pending.set(day, []);
		pending.get(day).push(key);
	}
	const days = [...new Set([...saved, ...pending.keys()])].sort();

	let live = 0;
	const results = [];
	// A few days at a time keeps Netlify Blobs happy
	for (let i = 0; i < days.length; i += 16) {
		const chunk = await Promise.all(
			days.slice(i, i + 16).map(async day => {
				const keys = pending.get(day) || [];
				const earlier = saved.has(day) ? await store.get(`d/${day}`, { type: 'json' }).catch(() => null) : null;
				if (!keys.length) return earlier;
				const events = (await Promise.all(keys.map(key => store.get(key, { type: 'json' }).catch(() => null)))).filter(Boolean);
				const summary = summarize(day, events, earlier);
				if (day === today) {
					live = new Set(events.filter(event => now - event.t < 5 * 60 * 1000).map(event => event.v)).size;
				} else {
					// A finished day: keep the summary, drop its hits
					await store.setJSON(`d/${day}`, summary);
					await Promise.all(keys.map(key => store.delete(key)));
				}
				return summary;
			})
		);
		results.push(...chunk);
	}
	return { days: results.filter(Boolean).map(publicSummary), live };
}
