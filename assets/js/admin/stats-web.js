/**
 * Admin → Stats → Website: who's visiting the site, where they come from, what they look at, and
 * how many go on to order. Drawn in the Stats page's style with its own blue accent, so it never
 * gets mixed up with the sales numbers. The numbers come from visits-data.js.
 */
import { icon } from '../lib/icons.js';
import { escapeHtml as e } from '../lib/catalog.js';
import { conversion, daysSoFar, funnel, ranked, visitSeries, visitTotals } from './visits-data.js';

const SOURCE_ICONS = { Instagram: 'instagram', Google: 'search', 'Other search': 'search', Direct: 'monitor' };
const SOURCE_NOTES = { Direct: 'typed in, bookmarks, texted links' };
const DEVICES = [
	['phone', 'Phones', 'phone'],
	['computer', 'Computers', 'monitor'],
	['tablet', 'Tablets', 'phone']
];
const PAGE_NAMES = { '/': 'Home', '/juices': 'Juices', '/about': 'About', '/contact': 'Contact', '/order': 'Order', '/success': 'Order placed' };

const count = n => n.toLocaleString('en-US');
const plural = (n, word) => `${count(n)} ${word}${n === 1 ? '' : 's'}`;

/** The KPI row: visitors, page views, pages per visit and how many visitors ordered. */
function webKpis(now, before, p, against, orders, ordersBefore, h) {
	const rate = conversion(orders, now.visitors);
	const rateBefore = before ? conversion(ordersBefore, before.visitors) : null;
	const card = (label, value, shown, previous, iconName, note = '') => `
		<div class="kpi kpi--web">
			<span class="kpi__icon">${icon(iconName)}</span>
			<p class="kpi__label">${label}</p>
			<p class="kpi__value">${shown}</p>
			${before ? `<p class="kpi__delta">${h.delta(value, previous, p.unit, against)}</p>` : note ? `<p class="kpi__delta"><span class="kpi__vs">${note}</span></p>` : ''}
		</div>`;
	return `
		<section class="kpis" aria-label="Website at a glance">
			${card('Visitors', now.visitors, count(now.visitors), before?.visitors, 'eye')}
			${card('Page views', now.views, count(now.views), before?.views, 'monitor')}
			${card('Pages per visit', Math.round(now.pagesPerVisit * 10), now.visitors ? now.pagesPerVisit.toFixed(1) : '0', before ? Math.round(before.pagesPerVisit * 10) : 0, 'list')}
			${card('Ordered', rate ?? 0, rate === null ? '&mdash;' : `${rate}%`, rateBefore ?? 0, 'bag', `${plural(orders, 'paid order')}`)}
		</section>`;
}

function visitorsCard(series, p, today, h) {
	const max = Math.max(1, ...series.bars.map(b => b.visitors));
	const label = b => (series.by === 'day' ? h.dateText(b.key, { month: 'short', day: 'numeric' }) : h.dateText(`${b.key}-01`, { month: 'short', year: 'numeric' }));
	const short = b => (series.by === 'day' ? h.dateText(b.key, { day: 'numeric' }) : h.dateText(`${b.key}-01`, { month: 'short' }));
	const best = series.bars.reduce((top, b) => (b.visitors > top.visitors ? b : top), series.bars[0] || { visitors: 0 });
	const tick = Math.max(1, Math.ceil(series.bars.length / 7));
	return `
		<article class="stat-card stat-card--wide web-card">
			<header class="stat-card__head"><div><p class="stat-card__kicker">${series.label}</p><h2>Visitors</h2></div>${best?.visitors ? `<p class="stat-card__note">Busiest: <strong>${label(best)}</strong>, ${plural(best.visitors, 'visitor')}</p>` : ''}</header>
			<div class="visit-bars" role="img" aria-label="Visitors ${series.by === 'day' ? 'per day' : 'per month'}">
				${series.bars
					.map(
						(b, i) => `<span class="visit-bar${(series.by === 'day' && b.key === today) || (series.by === 'month' && b.key === today.slice(0, 7)) ? ' is-now' : ''}" title="${label(b)}: ${plural(b.visitors, 'visitor')}, ${plural(b.views, 'page view')}">
							<span class="visit-bar__fill" style="height: ${b.visitors ? Math.max(4, (b.visitors / max) * 100) : 0}%"></span>
							<span class="visit-bar__label">${i % tick === 0 || i === series.bars.length - 1 ? short(b) : ''}</span>
						</span>`
					)
					.join('')}
			</div>
		</article>`;
}

function sourcesCard(t) {
	const rows = ranked(t.sources, 7);
	return `
		<article class="stat-card web-card">
			<header class="stat-card__head"><div><p class="stat-card__kicker">How they found you</p><h2>Where visitors come from</h2></div></header>
			${
				rows.length
					? `<ul class="web-list">${rows
							.map(
								r => `<li class="web-row">
								<span class="web-row__icon">${icon(SOURCE_ICONS[r.key] || 'external')}</span>
								<div class="web-row__main"><p class="web-row__name">${e(r.key)}${SOURCE_NOTES[r.key] ? ` <span class="muted">${SOURCE_NOTES[r.key]}</span>` : ''}</p><span class="web-row__bar"><span style="width: ${r.share * 100}%"></span></span></div>
								<p class="web-row__num"><strong>${count(r.n)}</strong><span>${Math.round(r.share * 100)}%</span></p>
							</li>`
							)
							.join('')}</ul>`
					: '<p class="stat-card__hint">Nothing yet.</p>'
			}
			<p class="stat-card__hint">Add <code>?utm_source=flyer</code> to a link you share and it shows up here by name.</p>
		</article>`;
}

function juicesCard(t, juices, h) {
	const rows = Object.entries(t.juices)
		.map(([slug, views]) => {
			const juice = juices.find(j => j.slug === slug);
			return { slug, name: juice?.name || slug, juice: juice || null, views, visitors: t.juiceVisitors[slug] || 0, carts: t.cartJuices[slug] || 0 };
		})
		.sort((a, b) => b.views - a.views);
	const max = Math.max(1, ...rows.map(r => r.views));
	return `
		<article class="stat-card web-card">
			<header class="stat-card__head"><div><p class="stat-card__kicker">Juice pages</p><h2>Most looked-at juices</h2></div></header>
			${
				rows.length
					? `<ol class="rank-list">${rows
							.map(
								(r, i) => `<li class="rank-row" style="--c: ${r.juice?.color || '#b9b2a3'}">
								<span class="rank-row__n">${i + 1}</span>
								${h.juiceArt(r, 'xs')}
								<div class="rank-row__main"><p class="rank-row__name">${e(r.name)}</p><span class="rank-row__bar"><span style="width: ${(r.views / max) * 100}%"></span></span><p class="rank-row__sub">${plural(r.visitors, 'visitor')}${r.carts ? ` &middot; ${count(r.carts)} added to cart` : ''}</p></div>
								<p class="rank-row__num"><strong>${count(r.views)}</strong><span>views</span></p>
							</li>`
							)
							.join('')}</ol>`
					: '<p class="stat-card__hint">No juice pages viewed yet.</p>'
			}
		</article>`;
}

function funnelCard(t, orders) {
	const steps = funnel(t, orders);
	return `
		<article class="stat-card web-card">
			<header class="stat-card__head"><div><p class="stat-card__kicker">Browsing to buying</p><h2>Where people drop off</h2></div></header>
			<ol class="funnel">${steps
				.map(
					(s, i) => `<li class="funnel__step">
					<span class="funnel__bar" style="width: ${Math.max(s.n ? 6 : 0, s.share * 100)}%"></span>
					<span class="funnel__label">${s.label}</span>
					<strong class="funnel__n">${count(s.n)}</strong>
					${i ? `<span class="funnel__pct">${steps[0].n ? `${Math.round(s.share * 100)}%` : ''}</span>` : '<span class="funnel__pct"></span>'}
				</li>`
				)
				.join('')}</ol>
			<p class="stat-card__hint">Each step counts people, once a day. Paid is from your orders.</p>
		</article>`;
}

function pagesCard(t, juices) {
	const rows = ranked(t.pages, 8);
	// Juice pages by today's name (simply-red is Simply Blue now)
	const name = path => {
		const slug = /^\/juices\/([\w-]+)$/.exec(path)?.[1];
		if (slug) return juices.find(j => j.slug === slug)?.name || slug.replace(/-/g, ' ');
		return PAGE_NAMES[path] || path;
	};
	return `
		<article class="stat-card web-card">
			<header class="stat-card__head"><div><p class="stat-card__kicker">Page views</p><h2>Top pages</h2></div></header>
			${rows.length ? `<ul class="web-list web-list--tight">${rows.map(r => `<li class="web-row"><div class="web-row__main"><p class="web-row__name">${e(name(r.key))}</p><span class="web-row__bar"><span style="width: ${r.share * 100}%"></span></span></div><p class="web-row__num"><strong>${count(r.n)}</strong></p></li>`).join('')}</ul>` : '<p class="stat-card__hint">Nothing yet.</p>'}
		</article>`;
}

function audienceCard(t) {
	const total = DEVICES.reduce((n, [key]) => n + (t.devices[key] || 0), 0) || 1;
	const places = ranked(t.places, 5);
	return `
		<article class="stat-card web-card">
			<header class="stat-card__head"><div><p class="stat-card__kicker">Who's visiting</p><h2>Devices and places</h2></div></header>
			<div class="split split--web" role="img" aria-label="${DEVICES.map(([key, label]) => `${t.devices[key] || 0} ${label.toLowerCase()}`).join(', ')}">
				${DEVICES.filter(([key]) => t.devices[key])
					.map(([key, label, iconName]) => `<span class="split__${key}" style="flex-grow: ${t.devices[key] / total}" title="${label}: ${count(t.devices[key])}">${icon(iconName)} ${Math.round((t.devices[key] / total) * 100)}%</span>`)
					.join('')}
			</div>
			<ul class="device-key">${DEVICES.filter(([key]) => t.devices[key])
				.map(([key, label]) => `<li><span class="device-key__dot split__${key}"></span>${label} <strong>${count(t.devices[key])}</strong></li>`)
				.join('')}</ul>
			${places.length ? `<p class="stat-card__kicker regulars__title">Top places</p><ol class="regulars">${places.map(p => `<li><span class="regulars__name">${icon('pin')} ${e(p.key)}</span><span>${plural(p.n, 'visitor')}</span></li>`).join('')}</ol>` : ''}
		</article>`;
}

function hoursCard(t) {
	const max = Math.max(1, ...t.hours);
	const best = t.hours.indexOf(Math.max(...t.hours));
	const hourName = h => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
	return `
		<article class="stat-card web-card">
			<header class="stat-card__head"><div><p class="stat-card__kicker">Philadelphia time</p><h2>When people visit</h2></div></header>
			<div class="hour-bars">${t.hours.map((n, h) => `<span class="hour-bar${n && h === best ? ' is-best' : ''}" title="${hourName(h)}: ${plural(n, 'visitor')}"><span style="height: ${n ? Math.max(5, (n / max) * 100) : 0}%"></span></span>`).join('')}</div>
			<div class="hour-axis"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span></div>
			<p class="stat-card__note">${t.visitors ? `Most visitors arrive around <strong>${hourName(best)}</strong>.` : 'No visits yet.'}</p>
		</article>`;
}

/**
 * Everything below the period bar in Website mode. `h` lends the Stats page's helpers (delta,
 * juiceArt, dateText) so both modes look and read the same.
 */
export function websiteView({ visits, p, today, against, sales, juices, h }) {
	if (!visits) return `<div class="admin-loading admin-loading--inline">${h.loader('Counting visitors&hellip;')}</div>`;
	const now = visitTotals(visits.days, p);
	const before = against ? visitTotals(visits.days, against) : null;
	const ordersIn = range => sales.filter(s => s.day >= range.from && s.day < range.to).length;
	const orders = ordersIn(p);
	if (!visits.days.length)
		return `<div class="web-empty">${icon('eye')}<h2>Visits start counting now</h2><p>Every visit to the site from here on shows up here: how many people came, where from, which juices they looked at and how many ordered. Hunter's own visits while signed in don't count.</p></div>`;
	return `
		${webKpis(now, before && before.days ? before : null, p, against, orders, against ? ordersIn(against) : 0, h)}
		<div class="stats-grid">
			${visitorsCard(visitSeries(visits.days, p, today), p, today, h)}
			${sourcesCard(now)}
			${juicesCard(now, juices, h)}
			${funnelCard(now, orders)}
			${pagesCard(now, juices)}
			${audienceCard(now)}
			${hoursCard(now)}
		</div>
		<p class="stat-card__hint web-foot">${icon('lock')} Counted on this site, without cookies or tracking. A visitor is counted once a day; about ${plural(Math.round(now.visitors / daysSoFar(p, today)), 'visitor')} a day ${p.unit === 'day' ? 'today' : 'in this stretch'}.</p>`;
}
