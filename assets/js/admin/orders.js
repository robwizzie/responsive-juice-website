/**
 * Admin → Orders: what to press, who to hand it to, and one button to move each order along
 * (new → making → ready → picked up). Finished and canceled orders tuck away under their own filter.
 */
import { icon } from '../lib/icons.js';
import { escapeHtml as e } from '../lib/catalog.js';
import { juiceLoader } from '../lib/components.js';
import { formatDate, formatMoney, todayISO } from '../shared/order-rules.js';
import { currentLines, customerName, isOpen, isTestOrder, nextStep, orderSource, orderStage, paymentLabel, sourceLabel, stageLabel } from '../shared/order-status.js';
import { api, guarded, toast, updateCounts } from './admin.js';
import { openSaleForm } from './sale-form.js';

let state = null;

const FILTERS = [
	{ id: 'open', label: 'To do', test: isOpen },
	{ id: 'done', label: 'Done', test: o => orderStage(o) === 'done' },
	{ id: 'canceled', label: 'Canceled', test: o => orderStage(o) === 'canceled' },
	{ id: 'all', label: 'All', test: () => true }
];

const keyOf = order => `${order.date}/${order.id}`;
const bottles = order => order.lines.reduce((n, l) => n + l.qty, 0);
// Lines under each juice's current name (see currentLines), with the old name noted when it changed
const lines = order => currentLines(order, state.juices);
const lineName = l => `${e(l.name)}${l.orderedAs ? ` <span class="was">was ${e(l.orderedAs)}</span>` : ''}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const shortDate = iso => formatDate(iso, { weekday: 'short', month: 'short', day: 'numeric' });

function juiceColor(slug) {
	return state.juices.find(j => j.slug === slug)?.color || '#8db62f';
}

function dayLabel(date, today) {
	const days = Math.round((new Date(`${date}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) / 86400000);
	if (days === 0) return 'Today';
	if (days === 1) return 'Tomorrow';
	if (days === -1) return 'Yesterday';
	return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

function timeText(iso) {
	if (!iso) return '';
	return new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const TYPE_TAGS = { delivery: ['truck', 'Delivery'], handoff: ['heart', 'Handed over'], pickup: ['bag', 'Pickup'] };
const typeTag = o => {
	const type = TYPE_TAGS[o.type] ? o.type : 'pickup';
	return `<span class="order-type order-type--${type}">${icon(TYPE_TAGS[type][0])}${TYPE_TAGS[type][1]}</span>`;
};
// Website orders need no tag; everything else says where it came from (Instagram, Cash, Tap to Pay…)
const SOURCE_ICONS = { instagram: 'instagram', text: 'phone', wholesale: 'store', event: 'sparkle' };
const sourceTag = o => {
	const source = orderSource(o);
	if (source === 'website') return '';
	const glyph = source === 'stripe' ? 'receipt' : SOURCE_ICONS[o.channel] || 'heart';
	return `<span class="order-source order-source--${source}">${icon(glyph)}${e(sourceLabel(o))}</span>`;
};
const unpaidTag = o => (o.status === 'unpaid' ? '<span class="order-unpaid">Not paid</span>' : '');
// A sale already handed over says so once, not twice
const stageTag = o => (o.type === 'handoff' && orderStage(o) === 'done' ? '' : `<span class="order-stage order-stage--${orderStage(o)}">${stageLabel(orderStage(o), o.type)}</span>`);
const testTag = o => (isTestOrder(o) ? '<span class="order-test" title="Paid with a Stripe test card. No real money.">Test</span>' : '');

// Outside sales keep the address as he typed it, in line1
const addressLine = a => [a.line1, a.line2, a.city ? `${a.city}, ${a.state || 'PA'} ${a.zip}` : ''].filter(Boolean).join(', ');
const mapsLink = a => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine(a))}`;

// Real orders not made yet. Test orders never count toward what to press.
const toMake = o => ['new', 'making'].includes(orderStage(o)) && !isTestOrder(o);

/** Bottles still to press for a set of orders (ready ones are already made). */
function pressList(orders) {
	const counts = new Map();
	orders
		.filter(toMake)
		.forEach(o => lines(o).forEach(l => counts.set(l.slug, { name: l.name, qty: (counts.get(l.slug)?.qty || 0) + l.qty })));
	return [...counts].map(([slug, { name, qty }]) => ({ slug, name, qty })).sort((a, b) => b.qty - a.qty);
}

function pressBlock(orders) {
	const list = pressList(orders);
	const total = list.reduce((n, j) => n + j.qty, 0);
	if (!total) return `<div class="press press--done">${icon('check')}<span>${orders.some(o => isOpen(o) && !isTestOrder(o)) ? 'Everything for this day is made' : 'Only test orders this day, nothing to press'}</span></div>`;
	return `
		<div class="press">
			<p class="press__label">To press <strong>${plural(total, 'bottle')}</strong></p>
			<ul class="press__list">
				${list.map(j => `<li style="--c:${e(juiceColor(j.slug))}"><strong>${j.qty}</strong><span>${e(j.name)}</span></li>`).join('')}
			</ul>
		</div>`;
}

function orderCard(o) {
	const step = nextStep(o);
	return `
		<article class="order-card order-card--${orderStage(o)}${isTestOrder(o) ? ' order-card--test' : ''}" data-order="${e(keyOf(o))}">
			<div class="order-card__tags">${typeTag(o)}${stageTag(o)}${sourceTag(o)}${unpaidTag(o)}${testTag(o)}<strong class="order-card__total">${formatMoney(o.total)}</strong></div>
			<h3 class="order-card__name">${e(customerName(o))}</h3>
			<p class="order-card__meta">${o.lines.length ? plural(bottles(o), 'bottle') : 'Juices not added yet'}${o.address ? ` &middot; ${e(o.address.city || o.address.line1)}` : ''}</p>
			${
				o.lines.length
					? `<ul class="order-card__items">${lines(o).map(l => `<li style="--c:${e(juiceColor(l.slug))}"><strong>${l.qty}</strong> <span>${lineName(l)}</span></li>`).join('')}</ul>`
					: `<p class="order-card__needs">${icon('info')}<span>Stripe says ${formatMoney(o.total)} was paid but not what for. Add the juices so they count.</span></p>`
			}
			${o.notes ? `<p class="order-card__notes">${icon('info')}<span>${e(o.notes)}</span></p>` : ''}
			<div class="order-card__actions">
				${o.needsDetails ? `<button type="button" class="btn btn--ink btn--sm" data-edit>${icon('plus')} Add juices</button>` : step ? `<button type="button" class="btn btn--ink btn--sm order-card__next" data-stage="${step.stage}">${step.stage === 'done' ? icon('check') : ''}${step.label}</button>` : ''}
				<button type="button" class="btn btn--outline btn--sm" data-open>Details</button>
			</div>
		</article>`;
}

function dayBlock(date, orders, today, withPress) {
	const total = orders.reduce((sum, o) => sum + o.total, 0);
	const late = date < today && orders.some(isOpen);
	return `
		<section class="order-day${late ? ' order-day--late' : ''}">
			<header class="order-day__head">
				<div>
					<p class="order-day__eyebrow">${late ? 'Past due, not marked done' : dayLabel(date, today)}</p>
					<h2>${formatDate(date, { month: 'long', day: 'numeric' })}<span>${formatDate(date, { weekday: 'long' })}</span></h2>
				</div>
				<p class="order-day__sum">${plural(orders.length, 'order')} &middot; ${formatMoney(total)}</p>
			</header>
			${withPress ? pressBlock(orders) : ''}
			<div class="order-cards">${orders.map(orderCard).join('')}</div>
		</section>`;
}

function summary(open) {
	const making = open.filter(toMake).reduce((n, o) => n + bottles(o), 0);
	const fresh = open.filter(o => orderStage(o) === 'new').length;
	const ready = open.filter(o => orderStage(o) === 'ready').length;
	const stat = (value, label, tone = '') => `<div class="order-stat${tone}"><strong>${value}</strong><span>${label}</span></div>`;
	return `<div class="order-stats">${stat(fresh, fresh === 1 ? 'new order' : 'new orders', fresh ? ' order-stat--hot' : '')}${stat(making, making === 1 ? 'bottle to make' : 'bottles to make')}${stat(ready, 'ready to hand off')}</div>`;
}

function renderList() {
	const box = document.querySelector('[data-orders]');
	if (!box || !state.orders) return;
	const today = todayISO();
	const filter = FILTERS.find(f => f.id === state.orderFilter) || FILTERS[0];
	const shown = state.orders.filter(filter.test);
	const count = f => state.orders.filter(f.test).length;

	const byDate = new Map();
	shown.forEach(o => byDate.set(o.date, [...(byDate.get(o.date) || []), o]));
	// To do runs soonest first (late ones on top); finished lists run newest first
	const dates = [...byDate.keys()].sort();
	if (filter.id !== 'open') dates.reverse();
	// Within a day, unfinished orders come before finished ones
	const rank = o => ['new', 'making', 'ready', 'done', 'canceled'].indexOf(orderStage(o));
	byDate.forEach(list => list.sort((a, b) => rank(a) - rank(b) || (a.createdAt || '').localeCompare(b.createdAt || '')));

	const empty = {
		open: 'Nothing to do right now. New paid orders show up here and in your inbox. Sold some in person? Tap Add sale.',
		done: 'Orders you mark picked up or delivered land here.',
		canceled: 'No canceled orders.',
		all: 'No orders yet.'
	}[filter.id];

	box.innerHTML = `
		<div class="order-filters" role="tablist" aria-label="Show orders">
			${FILTERS.filter(f => f.id !== 'canceled' || count(f))
				.map(f => `<button type="button" role="tab" class="order-filter${f.id === filter.id ? ' is-active' : ''}" aria-selected="${f.id === filter.id}" data-filter="${f.id}">${f.label}<span>${count(f)}</span></button>`)
				.join('')}
		</div>
		${filter.id === 'open' && shown.length ? summary(shown) : ''}
		${dates.length ? dates.map(d => dayBlock(d, byDate.get(d), today, filter.id === 'open')).join('') : `<p class="empty">${empty}</p>`}`;
}

async function setStage(key, stage, { quiet = false } = {}) {
	const data = await guarded(() => api('orders', { method: 'PUT', json: { key, stage } })).catch(() => null);
	if (!data) return null;
	state.orders = state.orders.map(o => (keyOf(o) === key ? data.order : o));
	updateCounts();
	renderList();
	if (!quiet) toast(`${data.order.customer?.name ? `${data.order.customer.name.split(' ')[0]}'s order` : 'Sale'}: ${stageLabel(stage, data.order.type).toLowerCase()}`);
	return data.order;
}

/*=============== DETAILS ===============*/
function openDetails(key) {
	const o = state.orders.find(order => keyOf(order) === key);
	if (!o) return;
	document.getElementById('order-sheet')?.remove();
	const stage = orderStage(o);
	const steps = ['new', 'making', 'ready', 'done'];
	const at = steps.indexOf(stage);
	const c = o.customer || {};
	const outside = orderSource(o) !== 'website';
	const phone = (c.phone || '').replace(/[^\d+]/g, '');
	const emailNote = who => ({ sent: `${icon('check')} Emailed`, failed: `${icon('info')} Email failed`, off: 'Email not set up' })[o.emails?.[who]] || 'Not recorded';

	document.body.insertAdjacentHTML(
		'beforeend',
		`<dialog class="sheet" id="order-sheet" aria-labelledby="order-sheet-title">
			<div class="sheet__head">
				<div>
					<div class="order-card__tags">${typeTag(o)}${stageTag(o)}${sourceTag(o)}${unpaidTag(o)}${testTag(o)}</div>
					<h2 class="sheet__title" id="order-sheet-title">${e(customerName(o))}</h2>
					<p class="muted">${{ delivery: 'Delivery', handoff: 'Sold' }[o.type] || 'Pickup'} ${formatDate(o.date)}</p>
				</div>
				<button type="button" class="icon-btn icon-btn--light" data-close aria-label="Close">${icon('close')}</button>
			</div>
			<div class="sheet__body">
				${isTestOrder(o) ? `<p class="sheet__test">${icon('info')} Test order. It was paid with a Stripe test card, so no real money moved and nothing needs making.</p>` : ''}
				${o.needsDetails ? `<p class="sheet__test">${icon('info')} Stripe doesn't say what this ${formatMoney(o.total)} payment was for. <button type="button" class="link-btn" data-edit>Add the juices</button> so it counts in To press and Stats.</p>` : ''}
				<section class="sheet__section">
					<h3>Progress</h3>
					${
						stage === 'canceled'
							? `<p class="muted">This order is canceled.${o.source === 'manual' ? '' : ' Refund it in Stripe if the customer was charged.'}</p><button type="button" class="btn btn--outline btn--sm" data-set="new">Restore order</button>`
							: `<ol class="stage-steps">${steps
									.map((s, i) => `<li><button type="button" class="stage-steps__step${i < at ? ' is-past' : ''}${i === at ? ' is-current' : ''}" data-set="${s}" aria-pressed="${i === at}"><span class="stage-steps__dot">${i < at ? icon('check') : i + 1}</span>${stageLabel(s, o.type)}</button></li>`)
									.join('')}</ol>`
					}
				</section>
				<section class="sheet__section">
					<h3>Customer</h3>
					<div class="contact-actions">
						${phone ? `<a class="btn btn--outline btn--sm" href="sms:${e(phone)}">${icon('phone')} Text</a><a class="btn btn--outline btn--sm" href="tel:${e(phone)}">Call</a>` : ''}
						${c.email ? `<a class="btn btn--outline btn--sm" href="mailto:${e(c.email)}?subject=${encodeURIComponent(`Your SiponPressed order for ${shortDate(o.date)}`)}">${icon('mail')} Email</a>` : ''}
					</div>
					<dl class="sheet__facts">
						${c.phone ? `<div><dt>Phone</dt><dd>${e(c.phone)}</dd></div>` : ''}
						${c.email ? `<div><dt>Email</dt><dd>${e(c.email)}</dd></div>` : ''}
						${!c.phone && !c.email ? `<div><dt>Contact</dt><dd class="muted">None saved${outside ? ' <button type="button" class="link-btn" data-edit>Add</button>' : ''}</dd></div>` : ''}
						${
							o.address
								? `<div><dt>Deliver to</dt><dd>${e(addressLine(o.address))}<br><a href="${mapsLink(o.address)}" target="_blank" rel="noopener">Open in Maps</a>${outside ? '' : o.zoneCheck?.status === 'in' ? ` <span class="muted">&middot; ${o.zoneCheck.miles} mi from ${e(o.zoneCheck.zone)}</span>` : ' <span class="pill pill--warn">check distance</span>'}</dd></div>`
								: o.type === 'pickup'
									? `<div><dt>Pickup</dt><dd>${e(state.settings.pickup.area)}</dd></div>`
									: ''
						}
					</dl>
					${o.notes ? `<p class="order-card__notes">${icon('info')}<span>${e(o.notes)}</span></p>` : ''}
				</section>
				<section class="sheet__section">
					<h3>Bottles</h3>
					<table class="sheet__items">
						${lines(o)
							.map(l => `<tr><td><span class="dot" style="--c:${e(juiceColor(l.slug))}"></span>${l.qty} &times; ${lineName(l)}</td><td>${formatMoney(l.amount)}</td></tr>`)
							.join('')}
						${o.type === 'delivery' ? `<tr class="is-muted"><td>Delivery</td><td>${o.deliveryFee ? formatMoney(o.deliveryFee) : 'Free'}</td></tr>` : ''}
						<tr class="is-total"><td>${o.status === 'unpaid' ? 'Owed' : 'Paid'}</td><td>${formatMoney(o.total)}</td></tr>
					</table>
				</section>
				<section class="sheet__section">
					<h3>Details</h3>
					<dl class="sheet__facts">
						<div><dt>${outside ? 'Sold' : 'Ordered'}</dt><dd>${e(timeText(o.soldAt || o.paidAt || o.createdAt))}</dd></div>
						<div><dt>Came from</dt><dd>${e(sourceLabel(o))}</dd></div>
						<div><dt>Payment</dt><dd>${e(paymentLabel(o))}${o.status === 'unpaid' ? ' <button type="button" class="link-btn" data-edit>Mark paid</button>' : ''}</dd></div>
						${outside ? '' : `<div><dt>You</dt><dd>${emailNote('owner')}</dd></div><div><dt>Customer</dt><dd>${emailNote('customer')}</dd></div>`}
						<div><dt>Order #</dt><dd><code>${e(o.id.slice(0, 8))}</code></dd></div>
					</dl>
					${o.history?.length ? `<ul class="sheet__history">${o.history.map(h => `<li><strong>${stageLabel(h.stage, o.type)}</strong> ${e(timeText(h.at))}</li>`).join('')}</ul>` : ''}
				</section>
				<div class="sheet__danger">
					${outside ? `<button type="button" class="btn btn--outline btn--sm" data-edit>${icon('edit')} ${o.source === 'stripe' ? 'Edit details' : 'Edit sale'}</button>` : ''}
					${stage !== 'canceled' ? '<button type="button" class="btn btn--ghost btn--sm" data-set="canceled">Cancel order</button>' : ''}
					${isTestOrder(o) || o.source === 'manual' ? `<button type="button" class="btn btn--danger btn--sm" data-delete>${icon('trash')} ${o.source === 'manual' ? 'Delete sale' : 'Delete test order'}</button>` : ''}
				</div>
			</div>
		</dialog>`
	);

	const sheet = document.getElementById('order-sheet');
	const close = () => {
		sheet.close();
		sheet.remove();
	};
	sheet.addEventListener('close', () => sheet.remove());
	sheet.addEventListener('click', async event => {
		if (event.target === sheet || event.target.closest('[data-close]')) return close();
		const set = event.target.closest('[data-set]');
		if (set) {
			if (set.dataset.set === 'canceled' && !confirm(o.source === 'manual' ? 'Cancel this sale? It moves to Canceled and comes out of your stats.' : 'Cancel this order? It moves to Canceled. Refunds are done in Stripe.')) return;
			set.disabled = true;
			const updated = await setStage(key, set.dataset.set);
			if (updated) openDetails(key);
			return;
		}
		if (event.target.closest('[data-edit]')) {
			close();
			return editSale(key);
		}
		if (event.target.closest('[data-delete]')) {
			if (!confirm(o.source === 'manual' ? 'Delete this sale for good? It comes out of your stats too.' : 'Delete this test order for good?')) return;
			const ok = await guarded(() => api('orders', { method: 'DELETE', json: { key } })).catch(() => null);
			if (!ok) return;
			state.orders = state.orders.filter(order => keyOf(order) !== key);
			updateCounts();
			renderList();
			close();
			toast(o.source === 'manual' ? 'Sale deleted' : 'Test order deleted');
		}
	});
	sheet.showModal();
}

/*=============== OUTSIDE SALES ===============*/
// Puts a saved sale into the list (replacing the old copy if its date, and so its key, moved)
function placeSale(result) {
	state.orders = [result.order, ...state.orders.filter(o => keyOf(o) !== result.previousKey && keyOf(o) !== result.key)];
	updateCounts();
	renderList();
}

async function addSale() {
	const result = await openSaleForm(state);
	if (!result) return;
	// Show it where it landed: To do for a pickup or delivery, Done for one already handed over
	state.orderFilter = isOpen(result.order) ? 'open' : 'done';
	placeSale(result);
	toast(`Sale added${result.order.lines.length ? `: ${plural(bottles(result.order), 'bottle')}` : ''}`);
}

async function editSale(key) {
	const order = state.orders.find(o => keyOf(o) === key);
	if (!order) return;
	const result = await openSaleForm(state, { order, key });
	if (!result) return openDetails(key);
	placeSale(result);
	toast('Saved');
	openDetails(result.key);
}

// Pulls in Stripe payments the website didn't start, like Tap to Pay
async function checkStripe(button) {
	button.disabled = true;
	const data = await guarded(() => api('stripe-sync', { method: 'POST' })).catch(() => null);
	button.disabled = false;
	if (!data) return;
	state.orders = data.orders;
	updateCounts();
	renderList();
	toast(data.added ? `Added ${plural(data.added, 'Stripe payment')}` : 'Everything from Stripe is already here');
}

/*=============== TAB ===============*/
export async function renderOrders(adminState) {
	state = adminState;
	state.orderFilter ||= 'open';
	const main = document.getElementById('admin-main');
	main.innerHTML = `
		<div class="admin-head"><div><h1 class="admin-title">Orders</h1><p class="muted">Tap the button on an order to move it along. Finished orders tuck away under <strong>Done</strong>.</p></div>
			<div class="admin-head__actions orders-actions">
				<button type="button" class="btn btn--ink" data-add-sale>${icon('plus')} Add sale</button>
				${state.status?.stripe ? `<button type="button" class="btn btn--ghost" data-check-stripe title="Bring in Tap to Pay and Payment Link sales">${icon('receipt')} Check Stripe</button>` : ''}
				<button type="button" class="btn btn--ghost" data-refresh>Refresh</button>
			</div>
		</div>
		<div data-orders>${state.orders ? '' : `<div class="admin-loading admin-loading--inline">${juiceLoader('Getting your orders&hellip;')}</div>`}</div>`;
	main.querySelector('[data-refresh]').addEventListener('click', async event => {
		event.currentTarget.disabled = true;
		await updateCounts({ reload: true });
		event.currentTarget.disabled = false;
	});
	main.querySelector('[data-add-sale]').addEventListener('click', addSale);
	main.querySelector('[data-check-stripe]')?.addEventListener('click', event => checkStripe(event.currentTarget));
	main.querySelector('[data-orders]').addEventListener('click', async event => {
		const filter = event.target.closest('[data-filter]');
		if (filter) {
			state.orderFilter = filter.dataset.filter;
			return renderList();
		}
		const card = event.target.closest('[data-order]');
		if (!card) return;
		if (event.target.closest('[data-edit]')) return editSale(card.dataset.order);
		const next = event.target.closest('[data-stage]');
		if (next) {
			next.disabled = true;
			return setStage(card.dataset.order, next.dataset.stage);
		}
		// The whole card opens the details, except its own buttons
		if (event.target.closest('[data-open]') || !event.target.closest('button, a')) openDetails(card.dataset.order);
	});

	if (!state.orders) await updateCounts({ reload: true });
	else renderList();
}

/** Re-draws the list after new orders arrive, unless Hunter is looking at one. */
export function refreshOrders(adminState) {
	state = adminState;
	if (!document.getElementById('order-sheet')) renderList();
}
