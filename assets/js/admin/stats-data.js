/**
 * The numbers behind Admin → Stats, worked out from the saved orders. No drawing here, so it can
 * be tested on its own (tests/stats.test.js).
 *
 * - A sale is a paid order that wasn't canceled. Stripe test orders count only when asked for.
 * - A sale happens on the day it was paid, in Philadelphia time (not the pickup/delivery day).
 * - Money is in cents. Revenue is what customers paid, delivery fees included.
 * - Juices are matched to today's menu, so a renamed juice keeps its history (see currentLines).
 */
import { currentLines, isTestOrder, orderStage } from '../shared/order-status.js';

export const TIME_ZONE = 'America/New_York';
const DAY_MS = 86400000;

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** The Philadelphia calendar day (YYYY-MM-DD) of a moment. */
export const localDay = moment => dayFormat.format(new Date(moment));

// Plain calendar maths on YYYY-MM-DD strings (noon UTC keeps clear of time zone edges)
const toDate = iso => new Date(`${iso}T12:00:00Z`);
const toIso = date => date.toISOString().slice(0, 10);
export const addDays = (iso, n) => toIso(new Date(toDate(iso).getTime() + n * DAY_MS));
export const daysBetween = (from, to) => Math.round((toDate(to) - toDate(from)) / DAY_MS);
export const weekday = iso => toDate(iso).getUTCDay();
const monthStart = iso => `${iso.slice(0, 7)}-01`;
const addMonths = (iso, n) => {
	const d = toDate(monthStart(iso));
	d.setUTCMonth(d.getUTCMonth() + n);
	return toIso(d);
};
export const monthKey = iso => iso.slice(0, 7);

/** Every sale as { day, total, bottles, lines, order }, oldest first. */
export function salesFrom(orders, juices, { includeTest = false } = {}) {
	return (orders || [])
		.filter(order => order.status !== 'pending' && orderStage(order) !== 'canceled' && (includeTest || !isTestOrder(order)))
		.map(order => {
			const lines = currentLines(order, juices);
			return {
				day: localDay(order.paidAt || order.createdAt || `${order.date}T12:00:00Z`),
				total: Number(order.total) || 0,
				bottles: lines.reduce((n, line) => n + line.qty, 0),
				lines,
				order
			};
		})
		.sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * A stretch of time: `unit` is day, week (Monday to Sunday), month, year or all. `offset` steps back
 * (-1 is the one before). Returns { from, to } with `to` exclusive, plus the same-length stretch before.
 */
export function period(unit, today, offset = 0, firstDay = today) {
	let from;
	let to;
	if (unit === 'day') {
		from = addDays(today, offset);
		to = addDays(from, 1);
	} else if (unit === 'week') {
		from = addDays(today, -((weekday(today) + 6) % 7) + offset * 7);
		to = addDays(from, 7);
	} else if (unit === 'month') {
		from = addMonths(today, offset);
		to = addMonths(from, 1);
	} else if (unit === 'year') {
		from = `${Number(today.slice(0, 4)) + offset}-01-01`;
		to = `${Number(from.slice(0, 4)) + 1}-01-01`;
	} else {
		from = firstDay < today ? firstDay : today;
		to = addDays(today, 1);
	}
	const previous = unit === 'all' ? null : unit === 'month' ? { from: addMonths(from, -1), to: from } : unit === 'year' ? { from: `${Number(from.slice(0, 4)) - 1}-01-01`, to: from } : { from: addDays(from, -daysBetween(from, to)), to: from };
	return { unit, offset, from, to, previous };
}

export const inRange = (sales, { from, to }) => sales.filter(sale => sale.day >= from && sale.day < to);

/**
 * The stretch to compare a period against. A period still under way (this week, this month…) is
 * compared with the same number of days at the start of the one before, so two days of November
 * aren't measured against all of October. `sameDays` says whether it was cut short.
 */
export function comparison(p, today) {
	if (!p.previous) return null;
	if (today < p.from || today >= p.to) return { ...p.previous, sameDays: false };
	const elapsed = daysBetween(p.from, today) + 1;
	const to = addDays(p.previous.from, elapsed);
	return to < p.previous.to ? { from: p.previous.from, to, sameDays: true } : { ...p.previous, sameDays: false };
}

/** Revenue, bottles, orders and average order for a set of sales. */
export function totals(sales) {
	const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
	const bottles = sales.reduce((sum, sale) => sum + sale.bottles, 0);
	return { revenue, bottles, orders: sales.length, average: sales.length ? Math.round(revenue / sales.length) : 0 };
}

/** Percent change from `before` to `now`; null when there's nothing to compare against. */
export const change = (now, before) => (before ? Math.round(((now - before) / before) * 100) : null);

/**
 * Every juice ranked by bottles sold (then revenue). Juices on the site that sold nothing are
 * included at zero, so the least popular shows too. Retired juices appear only if they sold.
 */
export function juiceRanking(sales, juices) {
	const rows = new Map();
	const row = (slug, name) => {
		if (!rows.has(slug)) {
			const juice = juices.find(j => j.slug === slug);
			rows.set(slug, { slug, name: juice?.name || name, juice: juice || null, bottles: 0, revenue: 0, orders: 0 });
		}
		return rows.get(slug);
	};
	juices.filter(juice => juice.active !== false).forEach(juice => row(juice.slug, juice.name));
	for (const sale of sales) {
		for (const line of sale.lines) {
			const r = row(line.slug, line.name);
			r.bottles += line.qty;
			r.revenue += Number(line.amount) || 0;
			r.orders += 1;
		}
	}
	const total = [...rows.values()].reduce((n, r) => n + r.bottles, 0);
	return [...rows.values()].map(r => ({ ...r, share: total ? r.bottles / total : 0 })).sort((a, b) => b.bottles - a.bottles || b.revenue - a.revenue || a.name.localeCompare(b.name));
}

/** Revenue per calendar day for the `count` days ending `today`, oldest first. */
export function dailySeries(sales, today, count) {
	const byDay = new Map();
	for (const sale of sales) byDay.set(sale.day, (byDay.get(sale.day) || 0) + sale.total);
	return Array.from({ length: count }, (_, i) => {
		const day = addDays(today, i - count + 1);
		return { day, revenue: byDay.get(day) || 0 };
	});
}

/** Revenue per month for the `count` months ending this one, split by juice, oldest first. */
export function monthlySeries(sales, today, count = 12) {
	return Array.from({ length: count }, (_, i) => {
		const from = addMonths(today, i - count + 1);
		const month = inRange(sales, { from, to: addMonths(from, 1) });
		const byJuice = new Map();
		let juiceRevenue = 0;
		for (const sale of month)
			for (const line of sale.lines) {
				byJuice.set(line.slug, (byJuice.get(line.slug) || 0) + (Number(line.amount) || 0));
				juiceRevenue += Number(line.amount) || 0;
			}
		const { revenue, bottles, orders } = totals(month);
		// Whatever isn't bottles (delivery fees, rounding) is kept separate so the bars add up
		return { month: monthKey(from), from, revenue, bottles, orders, byJuice, other: Math.max(0, revenue - juiceRevenue) };
	});
}

/** Bottles of each juice per week (Monday start) for the `count` weeks ending this one. */
export function weeklyJuiceSeries(sales, juices, today, count = 12) {
	const thisWeek = period('week', today).from;
	const weeks = Array.from({ length: count }, (_, i) => addDays(thisWeek, (i - count + 1) * 7));
	const series = new Map(juiceRanking(sales, juices).map(r => [r.slug, weeks.map(() => 0)]));
	for (const sale of sales) {
		const at = Math.floor(daysBetween(weeks[0], sale.day) / 7);
		if (at < 0 || at >= count) continue;
		for (const line of sale.lines) if (series.has(line.slug)) series.get(line.slug)[at] += line.qty;
	}
	return { weeks, series };
}

/** Orders and revenue by day of the week (0 Sunday … 6 Saturday). */
export function weekdayPattern(sales) {
	const days = Array.from({ length: 7 }, (_, day) => ({ day, orders: 0, revenue: 0 }));
	for (const sale of sales) {
		const d = days[weekday(sale.day)];
		d.orders += 1;
		d.revenue += sale.total;
	}
	return days;
}

/**
 * How today compares: revenue so far, the average day over the last 30 days (days with no sales
 * count as $0, since those are real days too) and the best single day ever.
 */
export function todayVsOthers(sales, today) {
	const recent = dailySeries(sales, addDays(today, -1), 30);
	const average = Math.round(recent.reduce((sum, d) => sum + d.revenue, 0) / recent.length);
	const all = dailySeries(sales, today, Math.max(1, daysBetween(sales[0]?.day || today, today) + 1));
	const best = all.reduce((top, d) => (d.revenue > top.revenue ? d : top), { day: null, revenue: 0 });
	const todays = inRange(sales, { from: today, to: addDays(today, 1) });
	return { today: totals(todays), average, best };
}

/**
 * Simple, explainable forecasts:
 * - This month: what's sold so far plus the recent daily average (last 28 days) for each day left.
 * - Next week, per juice: the average of the last four full weeks.
 */
export function predictions(sales, juices, today) {
	const month = period('month', today);
	const soFar = totals(inRange(sales, { from: month.from, to: addDays(today, 1) })).revenue;
	const recent = inRange(sales, { from: addDays(today, -28), to: today });
	const dailyPace = totals(recent).revenue / 28;
	const daysLeft = daysBetween(today, month.to) - 1;
	const monthForecast = Math.round(soFar + dailyPace * Math.max(0, daysLeft));

	const thisWeek = period('week', today).from;
	const lastFour = inRange(sales, { from: addDays(thisWeek, -28), to: thisWeek });
	const nextWeek = juiceRanking(lastFour, juices)
		.map(r => ({ ...r, expected: Math.round(r.bottles / 4) }))
		.filter(r => r.expected > 0 || (r.juice && r.juice.active !== false));
	const weeksOfHistory = sales.length ? daysBetween(sales[0].day, today) / 7 : 0;
	return {
		monthForecast,
		monthSoFar: soFar,
		dailyPace: Math.round(dailyPace),
		nextWeek,
		nextWeekBottles: nextWeek.reduce((n, r) => n + r.expected, 0),
		// Forecasts need a few weeks of sales before they mean much
		confident: weeksOfHistory >= 4
	};
}

/** Bottles already ordered for upcoming pickup/delivery days, per juice (orders not made yet). */
export function booked(sales, today) {
	const upcoming = sales.filter(sale => sale.order.date >= today && ['new', 'making'].includes(orderStage(sale.order)));
	const byJuice = new Map();
	for (const sale of upcoming)
		for (const line of sale.lines) {
			const r = byJuice.get(line.slug) || { slug: line.slug, name: line.name, bottles: 0 };
			r.bottles += line.qty;
			byJuice.set(line.slug, r);
		}
	return { orders: upcoming.length, bottles: upcoming.reduce((n, s) => n + s.bottles, 0), byJuice: [...byJuice.values()].sort((a, b) => b.bottles - a.bottles) };
}

/** Customers who've ordered more than once, most orders first. */
export function regulars(sales, count = 5) {
	const people = new Map();
	for (const sale of sales) {
		const email = (sale.order.customer?.email || '').toLowerCase();
		if (!email) continue;
		const p = people.get(email) || { name: sale.order.customer.name, orders: 0, bottles: 0, revenue: 0 };
		p.orders += 1;
		p.bottles += sale.bottles;
		p.revenue += sale.total;
		people.set(email, p);
	}
	const all = [...people.values()];
	return {
		customers: all.length,
		returning: all.filter(p => p.orders > 1).length,
		top: all
			.filter(p => p.orders > 1)
			.sort((a, b) => b.orders - a.orders || b.revenue - a.revenue)
			.slice(0, count)
	};
}

/** Pickup vs delivery orders. */
export function fulfillmentSplit(sales) {
	const delivery = sales.filter(sale => sale.order.type === 'delivery').length;
	return { pickup: sales.length - delivery, delivery };
}
