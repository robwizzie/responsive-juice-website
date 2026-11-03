/**
 * The numbers behind Admin → Stats → Website, worked out from the day summaries the server keeps
 * (netlify/functions/lib/visits.js). No drawing here, so it can be tested on its own.
 *
 * Visitors are counted once a day (the server can't tell yesterday's visitor from today's, by
 * design), so a week's visitors is the sum of its days.
 */
import { addDays, daysBetween, monthKey } from './stats-data.js';

const merge = (into, counts) => {
	for (const [key, n] of Object.entries(counts || {})) into[key] = (into[key] || 0) + n;
	return into;
};

/** Every day summary within { from, to } (to exclusive) added together. */
export function visitTotals(days, { from, to }) {
	const t = { visitors: 0, views: 0, pages: {}, juices: {}, juiceVisitors: {}, cartJuices: {}, sources: {}, devices: {}, places: {}, hours: Array(24).fill(0), carts: 0, cartVisitors: 0, checkoutVisitors: 0, orderVisitors: 0, juiceBrowsers: 0, days: 0 };
	for (const d of days) {
		if (d.day < from || d.day >= to) continue;
		t.days += 1;
		t.visitors += d.visitors;
		t.views += d.views;
		t.carts += d.carts || 0;
		t.cartVisitors += d.cartVisitors || 0;
		t.checkoutVisitors += d.checkoutVisitors || 0;
		t.orderVisitors += d.orderVisitors || 0;
		t.juiceBrowsers += d.juiceBrowsers || 0;
		for (const key of ['pages', 'juices', 'juiceVisitors', 'cartJuices', 'sources', 'devices', 'places']) merge(t[key], d[key]);
		(d.hours || []).forEach((n, h) => (t.hours[h] += n));
	}
	t.pagesPerVisit = t.visitors ? t.views / t.visitors : 0;
	return t;
}

/** A count map as [{ key, n, share }], biggest first. */
export const ranked = (counts, limit = Infinity) => {
	const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
	return Object.entries(counts)
		.map(([key, n]) => ({ key, n, share: n / total }))
		.sort((a, b) => b.n - a.n || a.key.localeCompare(b.key))
		.slice(0, limit);
};

/**
 * Bars for the visitors chart: one per day for a week or a month, one per month for a year or all
 * time (the last 12 months, or since the first visit if that's sooner).
 */
export function visitSeries(days, p, today) {
	const byDay = new Map(days.map(d => [d.day, d]));
	if (p.unit === 'week' || p.unit === 'month' || p.unit === 'day') {
		// A day, or the week/month still under way, shows the run of days up to now, so the chart
		// isn't nearly empty on the 2nd of the month; a finished week or month shows just its days
		const current = p.to > today;
		const span = p.unit === 'day' ? 14 : p.unit === 'week' ? 14 : 30;
		const from = current || p.unit === 'day' ? addDays(current ? today : addDays(p.to, -1), -(span - 1)) : p.from;
		const to = current ? addDays(today, 1) : p.to;
		const out = [];
		for (let day = from; day < to; day = addDays(day, 1)) out.push({ key: day, visitors: byDay.get(day)?.visitors || 0, views: byDay.get(day)?.views || 0 });
		return { by: 'day', bars: out, label: current || p.unit === 'day' ? `Last ${span} days` : 'Each day' };
	}
	const months = new Map();
	for (const d of days) {
		if (d.day < p.from || d.day >= p.to) continue;
		const m = months.get(monthKey(d.day)) || { key: monthKey(d.day), visitors: 0, views: 0 };
		m.visitors += d.visitors;
		m.views += d.views;
		months.set(m.key, m);
	}
	// Every month in the span up to now, so a quiet month shows as a gap rather than disappearing
	const nextMonth = key => {
		const [y, m] = key.split('-').map(Number);
		return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
	};
	const start = (p.unit === 'year' ? p.from : days.find(d => d.day >= p.from)?.day || today).slice(0, 7);
	const last = (p.to > today ? today : addDays(p.to, -1)).slice(0, 7);
	const out = [];
	for (let key = start; key <= last; key = nextMonth(key)) out.push(months.get(key) || { key, visitors: 0, views: 0 });
	return { by: 'month', bars: out.slice(-24), label: 'Each month' };
}

/** Browsing to buying: visitors, juice page viewers, cart, checkout, paid orders. */
export function funnel(t, paidOrders) {
	const steps = [
		{ key: 'visitors', label: 'Visited the site', n: t.visitors },
		{ key: 'juice', label: 'Looked at a juice', n: t.juiceBrowsers },
		{ key: 'cart', label: 'Added to cart', n: t.cartVisitors },
		{ key: 'checkout', label: 'Started checkout', n: t.checkoutVisitors },
		{ key: 'paid', label: 'Paid', n: paidOrders }
	];
	const top = steps[0].n || 1;
	return steps.map(step => ({ ...step, share: step.n / top }));
}

/** Paid orders as a share of visitors, as a percent with one decimal (null with no visitors). */
export const conversion = (orders, visitors) => (visitors ? Math.round((orders / visitors) * 1000) / 10 : null);

/** Days the period covers that have already happened, for "a day on average" figures. */
export const daysSoFar = (p, today) => Math.max(1, daysBetween(p.from, today < p.to ? addDays(today, 1) : p.to));
