/**
 * Admin → Stats: how the juices are selling. Best sellers (as a podium or a ranked list) for any
 * day, week, month or year, money by month, today against a typical day, simple forecasts, juice
 * trends, the busiest days and the regulars. The numbers come from stats-data.js.
 */
import { icon } from '../lib/icons.js';
import { escapeHtml as e } from '../lib/catalog.js';
import { bottleImage, juiceLoader } from '../lib/components.js';
import { splashUrl } from '../shared/catalog.js';
import { formatMoney } from '../shared/order-rules.js';
import { isTestOrder } from '../shared/order-status.js';
import { addDays, booked, change, comparison, dailySeries, fulfillmentSplit, inRange, juiceRanking, localDay, monthlySeries, period, predictions, regulars, salesFrom, todayVsOthers, totals, weekdayPattern, weeklyJuiceSeries } from './stats-data.js';
import { updateCounts } from './admin.js';

let state = null;
// What Hunter is looking at; kept while he moves between tabs
const view = { unit: 'month', offset: 0, includeTest: null, layout: 'podium' };

const UNITS = [
	{ id: 'day', label: 'Day' },
	{ id: 'week', label: 'Week' },
	{ id: 'month', label: 'Month' },
	{ id: 'year', label: 'Year' },
	{ id: 'all', label: 'All time' }
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ---------- formatting ---------- */

const dollars = cents => `$${Math.round(cents / 100).toLocaleString('en-US')}`;
const plural = (n, word) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
const dateText = (iso, options) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', ...options });
const monthShort = key => dateText(`${key}-01`, { month: 'short' });

function periodLabel(p) {
	if (p.unit === 'all') return 'All time';
	if (p.unit === 'day') return p.offset === 0 ? 'Today' : p.offset === -1 ? 'Yesterday' : dateText(p.from, { weekday: 'short', month: 'short', day: 'numeric' });
	if (p.unit === 'week') return p.offset === 0 ? 'This week' : p.offset === -1 ? 'Last week' : `${dateText(p.from, { month: 'short', day: 'numeric' })} – ${dateText(addDays(p.to, -1), { month: 'short', day: 'numeric' })}`;
	if (p.unit === 'month') return dateText(p.from, { month: 'long', year: 'numeric' });
	return p.from.slice(0, 4);
}
/** What a period is compared with, in a few words: "Oct 1–2", "October", "last week"… */
function versusText(unit, against) {
	const last = addDays(against.to, -1);
	const short = iso => dateText(iso, { month: 'short', day: 'numeric' });
	if (unit === 'day') return dateText(against.from, { weekday: 'short', month: 'short', day: 'numeric' });
	if (against.sameDays) return against.from === last ? short(last) : `${short(against.from)}–${against.from.slice(0, 7) === last.slice(0, 7) ? dateText(last, { day: 'numeric' }) : short(last)}`;
	if (unit === 'month') return dateText(against.from, { month: 'long' });
	if (unit === 'year') return against.from.slice(0, 4);
	return `${short(against.from)}–${short(last)}`;
}

/** ↑ 12% / ↓ 8% against the period before (or the same days of it, while this one is under way). */
function delta(now, before, unit, against) {
	const pct = change(now, before);
	const versus = `<span class="kpi__vs">vs ${versusText(unit, against)}</span>`;
	if (pct === null) return now ? `<span class="delta delta--new">New</span>${versus}` : '';
	const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
	return `<span class="delta delta--${dir}">${dir === 'up' ? icon('arrowUp') : dir === 'down' ? icon('arrowDown') : ''}${Math.abs(pct)}%</span>${versus}`;
}

/** A bottle standing on its splash; a plain dot for a juice that's no longer on the menu. */
function juiceArt(row, size = 'md') {
	const juice = row.juice;
	if (!juice) return `<span class="stat-art stat-art--${size} stat-art--gone" aria-hidden="true">${icon('archive')}</span>`;
	const splash = splashUrl(juice, { small: true });
	return `<span class="stat-art stat-art--${size}" style="--c: ${juice.color}" aria-hidden="true">${splash ? `<img src="${splash}" alt="" class="stat-art__splash" loading="lazy">` : ''}${bottleImage(juice, { small: true, className: 'stat-art__bottle' })}</span>`;
}
const colorOf = row => row.juice?.color || '#b9b2a3';

/* ---------- sections ---------- */

function kpis(sales, p, today) {
	const now = totals(inRange(sales, p));
	const against = comparison(p, today);
	const before = against ? totals(inRange(sales, against)) : null;
	const card = (label, value, key, iconName, money = false) => `
		<div class="kpi">
			<span class="kpi__icon">${icon(iconName)}</span>
			<p class="kpi__label">${label}</p>
			<p class="kpi__value">${money ? dollars(value) : value.toLocaleString('en-US')}</p>
			${before ? `<p class="kpi__delta">${delta(value, before[key], p.unit, against)}</p>` : ''}
		</div>`;
	return `
		<section class="kpis" aria-label="${e(periodLabel(p))} at a glance">
			${card('Money made', now.revenue, 'revenue', 'receipt', true)}
			${card('Bottles sold', now.bottles, 'bottles', 'drop')}
			${card('Orders', now.orders, 'orders', 'bag')}
			${card('Average order', now.average, 'average', 'heart', true)}
		</section>`;
}

function podium(ranking) {
	const top = ranking.filter(r => r.bottles > 0).slice(0, 3);
	const place = (row, rank) =>
		row
			? `<li class="podium__place podium__place--${rank}" style="--c: ${colorOf(row)}">
				<div class="podium__juice">
					${rank === 1 ? `<span class="podium__crown">${icon('crown')}</span>` : ''}
					${juiceArt(row, 'lg')}
					<p class="podium__name">${e(row.name)}</p>
					<p class="podium__stat"><strong>${plural(row.bottles, 'bottle')}</strong> &middot; ${dollars(row.revenue)}</p>
				</div>
				<div class="podium__block"><span>${rank}</span></div>
			</li>`
			: `<li class="podium__place podium__place--${rank} podium__place--empty"><div class="podium__juice"><span class="stat-art stat-art--lg stat-art--gone">${icon('plus')}</span><p class="podium__name">Up for grabs</p></div><div class="podium__block"><span>${rank}</span></div></li>`;
	// Shown 2 · 1 · 3, like a real podium
	return `<ol class="podium">${place(top[1], 2)}${place(top[0], 1)}${place(top[2], 3)}</ol>`;
}

function rankList(ranking) {
	const max = Math.max(1, ...ranking.map(r => r.bottles));
	const last = ranking.length - 1;
	return `<ol class="rank-list">${ranking
		.map(
			(row, i) => `
		<li class="rank-row" style="--c: ${colorOf(row)}">
			<span class="rank-row__n">${i + 1}</span>
			${juiceArt(row, 'sm')}
			<div class="rank-row__main">
				<p class="rank-row__name">${e(row.name)}${i === 0 && row.bottles ? ` <span class="tag tag--gold">${icon('crown')} Top seller</span>` : ''}${i === last && last > 0 ? ' <span class="tag">Needs some love</span>' : ''}${row.juice && row.juice.active === false ? ' <span class="tag">Inactive</span>' : ''}</p>
				<span class="rank-row__bar"><span style="width: ${(row.bottles / max) * 100}%"></span></span>
			</div>
			<p class="rank-row__num"><strong>${row.bottles}</strong><span>${dollars(row.revenue)} &middot; ${Math.round(row.share * 100)}%</span></p>
		</li>`
		)
		.join('')}</ol>`;
}

function bestSellers(sales, p) {
	const ranking = juiceRanking(inRange(sales, p), state.juices);
	const sold = ranking.some(r => r.bottles > 0);
	const body = !sold
		? `<div class="stats-empty"><span class="stats-empty__icon">${icon('drop')}</span><p>No bottles sold ${p.unit === 'all' ? 'yet' : `in ${e(periodLabel(p).toLowerCase() === 'today' ? 'today' : periodLabel(p))}`}. Try another ${p.unit === 'all' ? 'view' : p.unit}.</p></div>`
		: view.layout === 'podium'
			? podium(ranking) +
				(ranking.length > 3
					? `<p class="podium__rest">${ranking
							.slice(3)
							.map((r, i) => `<span><strong>${i + 4}.</strong> ${e(r.name)} &middot; ${r.bottles}</span>`)
							.join('')}</p>`
					: '')
			: rankList(ranking);
	return `
		<article class="stat-card stat-card--wide stat-card--best">
			<header class="stat-card__head">
				<div><p class="stat-card__kicker">${e(periodLabel(p))}</p><h2>Best sellers</h2></div>
				<div class="segmented" role="radiogroup" aria-label="Show as">
					<label><input type="radio" name="layout" value="podium" ${view.layout === 'podium' ? 'checked' : ''}><span>${icon('crown')} Podium</span></label>
					<label><input type="radio" name="layout" value="list" ${view.layout === 'list' ? 'checked' : ''}><span>${icon('list')} Full list</span></label>
				</div>
			</header>
			${body}
		</article>`;
}

function todayCard(sales, today) {
	const t = todayVsOthers(sales, today);
	const days = dailySeries(sales, today, 14);
	const max = Math.max(1, ...days.map(d => d.revenue), t.average);
	const vsAverage = t.average ? Math.round((t.today.revenue / t.average) * 100) : null;
	const verdict =
		t.today.revenue === 0
			? 'Nothing yet today. The day is young.'
			: vsAverage === null
				? 'Your first sales in a while. Nice.'
				: vsAverage >= 100
					? `That's ${vsAverage === 100 ? 'right at' : `${vsAverage - 100}% above`} your average day.`
					: `That's ${vsAverage}% of an average day so far.`;
	return `
		<article class="stat-card stat-card--today">
			<header class="stat-card__head"><div><p class="stat-card__kicker">${dateText(today, { weekday: 'long', month: 'short', day: 'numeric' })}</p><h2>Today so far</h2></div></header>
			<p class="today__big">${dollars(t.today.revenue)}</p>
			<p class="today__sub">${plural(t.today.bottles, 'bottle')} &middot; ${plural(t.today.orders, 'order')}</p>
			<p class="today__verdict">${verdict}</p>
			<div class="spark-bars" style="--avg: ${(t.average / max) * 100}%" role="img" aria-label="Money made each of the last 14 days">
				${days.map(d => `<span class="spark-bars__bar${d.day === today ? ' is-today' : ''}" style="height: ${Math.max(3, (d.revenue / max) * 100)}%" title="${dateText(d.day, { weekday: 'short', month: 'short', day: 'numeric' })}: ${formatMoney(d.revenue)}"></span>`).join('')}
				${t.average ? '<span class="spark-bars__avg" title="Your average day"></span>' : ''}
			</div>
			<dl class="mini-facts">
				<div><dt>Average day</dt><dd>${dollars(t.average)}</dd></div>
				<div><dt>Best day ever</dt><dd>${t.best.day ? `${dollars(t.best.revenue)} <span>${dateText(t.best.day, { month: 'short', day: 'numeric' })}</span>` : '&mdash;'}</dd></div>
			</dl>
		</article>`;
}

function monthsCard(sales, today) {
	const months = monthlySeries(sales, today, 12);
	const max = Math.max(1, ...months.map(m => m.revenue));
	const best = months.reduce((top, m) => (m.revenue > top.revenue ? m : top), months[0]);
	const juiceRows = state.juices;
	const segment = (slug, cents, total) => {
		const juice = juiceRows.find(j => j.slug === slug);
		return `<span style="--c: ${juice?.color || '#b9b2a3'}; flex-grow: ${cents / total}" title="${e(juice?.name || slug)}: ${formatMoney(cents)}"></span>`;
	};
	return `
		<article class="stat-card stat-card--wide stat-card--months">
			<header class="stat-card__head"><div><p class="stat-card__kicker">Last 12 months</p><h2>Money by month</h2></div>${best.revenue ? `<p class="stat-card__note">Best month: <strong>${dateText(best.from, { month: 'long' })}</strong>, ${dollars(best.revenue)}</p>` : ''}</header>
			<div class="month-bars">
				${months
					.map((m, i) => {
						const isNow = i === months.length - 1;
						const selected = view.unit === 'month' && view.offset === i - (months.length - 1);
						return `<button type="button" class="month-bar${isNow ? ' is-now' : ''}${selected ? ' is-selected' : ''}" data-month="${i - (months.length - 1)}" aria-label="${dateText(m.from, { month: 'long', year: 'numeric' })}: ${formatMoney(m.revenue)}, ${plural(m.bottles, 'bottle')}">
							<span class="month-bar__value">${m.revenue ? dollars(m.revenue) : ''}</span>
							<span class="month-bar__stack" style="height: ${(m.revenue / max) * 100}%">
								${[...m.byJuice]
									.sort((a, b) => b[1] - a[1])
									.map(([slug, cents]) => segment(slug, cents, m.revenue))
									.join('')}
								${m.other ? `<span class="is-other" style="flex-grow: ${m.other / m.revenue}" title="Delivery fees: ${formatMoney(m.other)}"></span>` : ''}
							</span>
							<span class="month-bar__label">${monthShort(m.month)}</span>
						</button>`;
					})
					.join('')}
			</div>
			<p class="stat-card__hint">Each bar is split by juice. Tap a month to see its best sellers.</p>
		</article>`;
}

function forecastCard(sales, today) {
	const f = predictions(sales, state.juices, today);
	const b = booked(sales, today);
	const monthName = dateText(today, { month: 'long' });
	const progress = f.monthForecast ? Math.min(100, (f.monthSoFar / f.monthForecast) * 100) : 0;
	const chip = row => `<li style="--c: ${colorOf(row)}">${juiceArt({ ...row, juice: row.juice || state.juices.find(j => j.slug === row.slug) || null }, 'xs')}<span>${e(row.name)}</span><strong>${row.expected ?? row.bottles}</strong></li>`;
	return `
		<article class="stat-card stat-card--forecast">
			<header class="stat-card__head"><div><p class="stat-card__kicker">Crystal ball</p><h2>Coming up</h2></div></header>
			<div class="forecast">
				<p class="forecast__label">${monthName} is on pace for</p>
				<p class="forecast__big">${dollars(f.monthForecast)}</p>
				<span class="forecast__track"><span style="width: ${progress}%"></span></span>
				<p class="forecast__sub">${dollars(f.monthSoFar)} so far, about ${dollars(f.dailyPace)} a day lately</p>
			</div>
			<div class="forecast">
				<p class="forecast__label">Next week, expect about</p>
				<p class="forecast__big forecast__big--sm">${plural(f.nextWeekBottles, 'bottle')}</p>
				${
					f.nextWeek.some(r => r.expected)
						? `<ul class="juice-chips">${f.nextWeek
								.filter(r => r.expected)
								.map(chip)
								.join('')}</ul>`
						: ''
				}
			</div>
			${b.bottles ? `<div class="forecast"><p class="forecast__label">Already booked to press</p><p class="forecast__big forecast__big--sm">${plural(b.bottles, 'bottle')}</p><ul class="juice-chips">${b.byJuice.map(chip).join('')}</ul></div>` : ''}
			<p class="stat-card__hint">${f.confident ? 'Based on the last four weeks of sales.' : 'Based on the sales so far. These get sharper after a few weeks of orders.'}</p>
		</article>`;
}

function trendsCard(sales, today) {
	const { weeks, series } = weeklyJuiceSeries(sales, state.juices, today, 12);
	const ranking = juiceRanking(inRange(sales, { from: weeks[0], to: addDays(today, 1) }), state.juices).filter(r => r.bottles > 0 || r.juice?.active !== false);
	const max = Math.max(1, ...[...series.values()].flat());
	const line = values => values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - (v / max) * 28}`).join(' ');
	return `
		<article class="stat-card stat-card--trends">
			<header class="stat-card__head"><div><p class="stat-card__kicker">Last 12 weeks</p><h2>Juice trends</h2></div></header>
			<ul class="trend-list">
				${ranking
					.map(row => {
						const values = series.get(row.slug) || weeks.map(() => 0);
						const thisWeek = values[values.length - 1];
						const lastWeek = values[values.length - 2];
						return `<li class="trend" style="--c: ${colorOf(row)}">
							${juiceArt(row, 'xs')}
							<span class="trend__name">${e(row.name)}</span>
							<svg class="trend__line" viewBox="0 0 100 32" preserveAspectRatio="none" role="img" aria-label="${e(row.name)}: ${values.join(', ')} bottles a week"><polyline points="${line(values)}" /></svg>
							<span class="trend__now" title="This week (last week: ${lastWeek})">${thisWeek}${thisWeek > lastWeek ? icon('arrowUp') : thisWeek < lastWeek ? icon('arrowDown') : ''}</span>
						</li>`;
					})
					.join('')}
			</ul>
			<p class="stat-card__hint">Bottles a week. The number is this week so far.</p>
		</article>`;
}

function weekdayCard(sales) {
	const days = weekdayPattern(sales);
	const order = [1, 2, 3, 4, 5, 6, 0];
	const max = Math.max(1, ...days.map(d => d.orders));
	const best = days.reduce((top, d) => (d.orders > top.orders ? d : top), days[0]);
	return `
		<article class="stat-card stat-card--weekdays">
			<header class="stat-card__head"><div><p class="stat-card__kicker">All time</p><h2>When people order</h2></div></header>
			<div class="weekday-bars">
				${order.map(i => `<span class="weekday-bar${best.orders && i === best.day ? ' is-best' : ''}" title="${WEEKDAYS[i]}: ${plural(days[i].orders, 'order')}, ${formatMoney(days[i].revenue)}"><span class="weekday-bar__fill" style="height: ${Math.max(4, (days[i].orders / max) * 100)}%"></span><span class="weekday-bar__label">${WEEKDAYS[i][0]}</span></span>`).join('')}
			</div>
			<p class="stat-card__note">${best.orders ? `<strong>${WEEKDAYS[best.day]}</strong> is the busiest day for orders.` : 'No orders yet.'}</p>
		</article>`;
}

function peopleCard(sales) {
	const r = regulars(sales);
	const split = fulfillmentSplit(sales);
	const total = split.pickup + split.delivery || 1;
	return `
		<article class="stat-card stat-card--people">
			<header class="stat-card__head"><div><p class="stat-card__kicker">All time</p><h2>Your people</h2></div></header>
			<dl class="mini-facts mini-facts--big">
				<div><dt>Customers</dt><dd>${r.customers}</dd></div>
				<div><dt>Came back</dt><dd>${r.customers ? Math.round((r.returning / r.customers) * 100) : 0}%</dd></div>
			</dl>
			<div class="split" role="img" aria-label="${split.pickup} pickup and ${split.delivery} delivery orders">
				<span class="split__pickup" style="flex-grow: ${split.pickup / total}">${split.pickup ? `${icon('bag')} ${split.pickup} pickup` : ''}</span>
				<span class="split__delivery" style="flex-grow: ${split.delivery / total}">${split.delivery ? `${icon('truck')} ${split.delivery} delivery` : ''}</span>
			</div>
			${
				r.top.length
					? `<p class="stat-card__kicker regulars__title">Regulars</p><ol class="regulars">${r.top.map(p => `<li><span class="regulars__name">${e(p.name)}</span><span>${plural(p.orders, 'order')} &middot; ${dollars(p.revenue)}</span></li>`).join('')}</ol>`
					: '<p class="stat-card__hint">Repeat customers will show up here.</p>'
			}
		</article>`;
}

/* ---------- page ---------- */

function render() {
	const box = document.querySelector('[data-stats]');
	if (!box || !state.orders) return;
	const hasReal = state.orders.some(o => !isTestOrder(o));
	const includeTest = view.includeTest ?? !hasReal;
	const sales = salesFrom(state.orders, state.juices, { includeTest });
	const today = localDay(Date.now());
	const p = period(view.unit, today, view.offset, sales[0]?.day || today);
	const testOnly = includeTest && !hasReal;

	box.innerHTML = `
		<div class="stats-bar">
			<div class="segmented" role="radiogroup" aria-label="Time span">
				${UNITS.map(u => `<label><input type="radio" name="unit" value="${u.id}" ${view.unit === u.id ? 'checked' : ''}><span>${u.label}</span></label>`).join('')}
			</div>
			${
				view.unit === 'all'
					? ''
					: `<div class="stats-nav">
				<button type="button" class="icon-btn" data-step="-1" aria-label="Earlier">${icon('caretLeft')}</button>
				<strong>${e(periodLabel(p))}</strong>
				<button type="button" class="icon-btn" data-step="1" aria-label="Later" ${view.offset >= 0 ? 'disabled' : ''}>${icon('caretRight')}</button>
			</div>`
			}
			<label class="toggle stats-test"><input type="checkbox" data-include-test ${includeTest ? 'checked' : ''}><span></span> Include test orders</label>
		</div>
		${testOnly ? `<p class="stats-banner">${icon('info')} <span>No real sales yet, so these numbers are from <strong>test orders</strong>. They'll switch to real sales as soon as the first paid order comes in.</span></p>` : ''}
		${kpis(sales, p, today)}
		<div class="stats-grid">
			${bestSellers(sales, p)}
			${todayCard(sales, today)}
			${monthsCard(sales, today)}
			${forecastCard(sales, today)}
			${trendsCard(sales, today)}
			${weekdayCard(sales)}
			${peopleCard(sales)}
		</div>`;
}

function bind(box) {
	box.addEventListener('change', event => {
		const { name, value } = event.target;
		if (name === 'unit') {
			view.unit = value;
			view.offset = 0;
		} else if (name === 'layout') view.layout = value;
		else if (event.target.matches('[data-include-test]')) view.includeTest = event.target.checked;
		else return;
		render();
	});
	box.addEventListener('click', event => {
		const step = event.target.closest('[data-step]');
		const month = event.target.closest('[data-month]');
		if (step) view.offset = Math.min(0, view.offset + Number(step.dataset.step));
		else if (month) {
			view.unit = 'month';
			view.offset = Number(month.dataset.month);
		} else return;
		render();
	});
}

export async function renderStats(adminState) {
	state = adminState;
	const main = document.getElementById('admin-main');
	main.innerHTML = `
		<div class="admin-head"><div><h1 class="admin-title">Stats</h1><p class="muted">How the juices are selling. Every number comes from paid orders; canceled ones don't count.</p></div></div>
		<div class="stats" data-stats>${state.orders ? '' : `<div class="admin-loading admin-loading--inline">${juiceLoader('Adding up your sales&hellip;')}</div>`}</div>`;
	bind(main.querySelector('[data-stats]'));
	if (!state.orders) await updateCounts({ reload: true });
	render();
}

/** Called when fresh orders arrive while Stats is open. */
export function refreshStats(adminState) {
	state = adminState;
	render();
}
