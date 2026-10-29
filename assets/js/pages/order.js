import { ready } from '../site.js';
import { escapeHtml as e } from '../lib/catalog.js';
import { addToCart, cartLines, getCart, setQty } from '../lib/cart.js';
import { juiceLoader, money, moneyShort, pickupFaq, pickupSpot, shippingNote } from '../lib/components.js';
import { icon } from '../lib/icons.js';
import { isOrderable } from '../shared/catalog.js';
import { availableDates, cutoffDay, formatDate, formatMoney, priceOrder, weekdayName } from '../shared/order-rules.js';

const root = document.querySelector('[data-order]');
const DETAILS_KEY = 'siponpressed-details';

const state = { type: 'pickup', date: null, zone: null, submitting: false, error: '' };
let juices = [];
let settings = null;
let catalogCopy;

function savedDetails() {
	try {
		return JSON.parse(localStorage.getItem(DETAILS_KEY) || '{}');
	} catch {
		return {};
	}
}

function rememberDetails(form) {
	const { name, email, phone, line1, line2, city, zip } = Object.fromEntries(new FormData(form));
	try {
		localStorage.setItem(DETAILS_KEY, JSON.stringify({ name, email, phone, line1, line2, city, zip }));
	} catch {
		/* not essential */
	}
}

const items = () => Object.entries(getCart()).map(([slug, qty]) => ({ slug, qty }));

/*=============== LAYOUT ===============*/
function renderLayout() {
	const d = savedDetails();
	const canceled = new URLSearchParams(location.search).has('canceled');
	const { pickup, delivery } = settings;
	if (!pickup.enabled && delivery.enabled) state.type = 'delivery';

	root.innerHTML = `
		${
			canceled
				? `<div class="checkout-note" role="status" data-checkout-note>
					<span class="checkout-note__icon">${icon('info')}</span>
					<div><strong>Checkout canceled. No charge was made.</strong><p>Your cart and details are saved below, so you can finish whenever you're ready.</p></div>
					<button type="button" class="icon-btn checkout-note__close" data-dismiss-note aria-label="Dismiss">${icon('close')}</button>
				</div>`
				: ''
		}
		<div class="order">
			<form class="order__main" id="order-form" novalidate>
				<fieldset class="card order-step">
					<legend class="order-step__title"><span>1</span> How do you want it?</legend>
					<div class="choice-grid">
						${
							pickup.enabled
								? `<label class="choice">
							<input type="radio" name="type" value="pickup" ${state.type === 'pickup' ? 'checked' : ''}>
							<span class="choice__body">
								<span class="choice__icon">${icon('store')}</span>
								<span class="choice__title">Pickup</span>
								<span class="choice__text">${e(pickup.address || pickup.area)} &middot; no minimum</span>
							</span>
						</label>`
								: ''
						}
						${
							delivery.enabled
								? `<label class="choice" data-delivery-choice>
							<input type="radio" name="type" value="delivery" ${state.type === 'delivery' ? 'checked' : ''}>
							<span class="choice__body">
								<span class="choice__icon">${icon('truck')}</span>
								<span class="choice__title">${weekdayName(delivery.day)} delivery</span>
								<span class="choice__text">${e(delivery.areaLabel)} &middot; ${delivery.minBottles}+ bottles</span>
							</span>
						</label>`
								: ''
						}
					</div>
					<div class="order-step__hint" data-type-hint></div>
					${shippingNote(settings, catalogCopy)}
				</fieldset>

				<fieldset class="card order-step">
					<legend class="order-step__title"><span>2</span> <span data-date-title>Pick a day</span></legend>
					<div class="date-grid" data-dates></div>
				</fieldset>

				<fieldset class="card order-step">
					<legend class="order-step__title"><span>3</span> Your details</legend>
					<div class="field-row">
						<div class="field">
							<label for="name">Full name</label>
							<input id="name" name="name" autocomplete="name" value="${e(d.name)}" required>
						</div>
						<div class="field">
							<label for="phone">Phone</label>
							<input id="phone" name="phone" type="tel" autocomplete="tel" value="${e(d.phone)}" placeholder="For pickup and delivery texts" required>
						</div>
					</div>
					<div class="field">
						<label for="email">Email</label>
						<input id="email" name="email" type="email" autocomplete="email" value="${e(d.email)}" placeholder="Your confirmation goes here" required>
					</div>

					<div class="address" data-address hidden>
						<div class="field">
							<label for="line1">Street address</label>
							<input id="line1" name="line1" autocomplete="address-line1" value="${e(d.line1)}">
						</div>
						<div class="field">
							<label for="line2">Apt, suite, etc. <span class="optional">optional</span></label>
							<input id="line2" name="line2" autocomplete="address-line2" value="${e(d.line2)}">
						</div>
						<div class="field-row field-row--address">
							<div class="field">
								<label for="city">Town</label>
								<input id="city" name="city" autocomplete="address-level2" value="${e(d.city)}">
							</div>
							<div class="field field--state">
								<label for="state">State</label>
								<input id="state" value="NJ" disabled>
							</div>
							<div class="field">
								<label for="zip">ZIP</label>
								<input id="zip" name="zip" inputmode="numeric" maxlength="5" autocomplete="postal-code" value="${e(d.zip)}">
							</div>
						</div>
						<div class="zone" data-zone>
							<button type="button" class="btn btn--ghost btn--sm" data-check-zone>${icon('pin')} Check my address</button>
							<span class="zone__result" data-zone-result></span>
						</div>
					</div>

					<div class="field">
						<label for="notes">Notes for Hunter <span class="optional">optional</span></label>
						<textarea id="notes" name="notes" rows="3" placeholder="Gate code, preferred pickup time, anything else"></textarea>
					</div>
				</fieldset>
			</form>

			<aside class="order__summary">
				<div class="card summary" data-summary></div>
			</aside>
		</div>
		${pickupFaq(settings, catalogCopy)}`;

	const form = document.getElementById('order-form');
	form.addEventListener('change', event => {
		if (event.target.name === 'type') {
			state.type = event.target.value;
			state.date = null;
			state.error = '';
			update();
		}
		if (event.target.name === 'date') {
			state.date = event.target.value;
			renderSummary();
		}
	});
	form.addEventListener('input', event => {
		rememberDetails(form);
		if (['line1', 'city', 'zip'].includes(event.target.name)) {
			state.zone = null;
			renderZone();
		}
	});
	form.querySelector('[data-check-zone]').addEventListener('click', checkZone);
	form.zip.addEventListener('blur', () => form.zip.value.length === 5 && form.line1.value && !state.zone && checkZone());
	form.addEventListener('submit', event => event.preventDefault());
}

/*=============== DATES ===============*/
function renderDates() {
	const dates = availableDates(settings, state.type);
	if (!dates.includes(state.date)) state.date = dates[0] || null;
	const title = document.querySelector('[data-date-title]');
	title.textContent = state.type === 'delivery' ? `Pick a ${weekdayName(settings.delivery.day)}` : 'Pick a pickup day';

	document.querySelector('[data-dates]').innerHTML = dates.length
		? dates
				.map(date => {
					const [weekday, month, day] = [formatDate(date, { weekday: 'short' }), formatDate(date, { month: 'short' }), formatDate(date, { day: 'numeric' })];
					return `<label class="date-chip">
					<input type="radio" name="date" value="${date}" ${date === state.date ? 'checked' : ''}>
					<span><small>${weekday}</small><strong>${day}</strong><small>${month}</small></span>
				</label>`;
				})
				.join('')
		: `<p class="muted">No dates are open right now. Please check back soon.</p>`;
}

function renderTypeHint() {
	const hint = document.querySelector('[data-type-hint]');
	const { delivery, pickup } = settings;
	if (state.type === 'delivery') {
		const day = weekdayName(delivery.day);
		hint.innerHTML = `<p>${icon('info')}<span>Delivered to your door every ${day}, within ${delivery.radiusMiles} miles of ${delivery.zones.map(z => e(z.label)).join(' or ')}. <strong>Order by the end of ${weekdayName(cutoffDay(delivery))}</strong> for that ${day}. ${
			delivery.freeOver > 0 ? `${moneyShort(delivery.fee)} delivery, free on orders over ${moneyShort(delivery.freeOver)}.` : `${moneyShort(delivery.fee)} delivery.`
		}</span></p>`;
	} else {
		const when = pickup.hours ? `Pickup times are ${e(pickup.hours)}, and Hunter texts you when it's ready.` : "Hunter texts you when it's ready to grab.";
		hint.innerHTML = `${pickupSpot(pickup)}<p>${icon('info')}<span>Pressed to order, so pickups open ${pickup.leadDays} day${pickup.leadDays === 1 ? '' : 's'} out. ${when}</span></p>`;
	}
	document.querySelector('[data-address]').hidden = state.type !== 'delivery';
}

/*=============== DELIVERY ZONE ===============*/
async function checkZone() {
	const form = document.getElementById('order-form');
	const address = { line1: form.line1.value, line2: form.line2.value, city: form.city.value, state: 'NJ', zip: form.zip.value };
	if (!address.line1 || !/^\d{5}$/.test(address.zip)) {
		state.zone = { status: 'incomplete' };
		return renderZone();
	}
	state.zone = { status: 'checking' };
	renderZone();
	try {
		const res = await fetch('/api/delivery-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(address) });
		state.zone = res.ok ? await res.json() : { status: 'unverified' };
	} catch {
		state.zone = { status: 'unverified' };
	}
	renderZone();
}

function renderZone() {
	const el = document.querySelector('[data-zone-result]');
	if (!el) return;
	const zone = state.zone;
	const messages = {
		checking: ['', 'Checking…'],
		incomplete: ['is-warn', 'Add your street and 5-digit ZIP.'],
		in: ['is-ok', `${icon('check')} You're in the delivery area${zone?.miles != null ? ` (${zone.miles} mi from ${e(zone.zone)})` : ''}.`],
		out: ['is-bad', `Sorry, that's about ${Math.round(zone?.miles || 0)} miles out. Delivery covers ${settings.delivery.radiusMiles} miles. Pickup is always an option.`],
		unknown: ['is-warn', "We couldn't find that address. Double-check the street and ZIP."],
		unverified: ['is-warn', "We couldn't check right now, but you can still order. Hunter will confirm."]
	};
	const [cls, text] = zone ? messages[zone.status] || ['', ''] : ['', ''];
	el.className = `zone__result ${cls}`;
	el.innerHTML = text;
}

/*=============== SUMMARY ===============*/
function renderSummary() {
	const summary = document.querySelector('[data-summary]');
	const lines = cartLines(juices);
	const priced = priceOrder({ items: items(), type: state.type, date: state.date }, juices, settings);
	const missing = juices.filter(j => isOrderable(j) && !getCart()[j.slug]);
	const blockers = priced.errors.filter(msg => !/cart is empty/.test(msg));

	summary.innerHTML = `
		<h2 class="summary__title">Your order</h2>
		${
			lines.length
				? `<div class="summary__lines" data-order-lines>
				${lines
					.map(
						({ juice, qty }) => `
					<div class="cart-line" style="--c: ${juice.color}">
						<img src="${juice.imageSmall || juice.image}" alt="" class="cart-line__img">
						<div class="cart-line__info">
							<span class="cart-line__name">${e(juice.name)}</span>
							<span class="cart-line__price">${money(juice.price)} each</span>
						</div>
						<div class="stepper" data-stepper="${juice.slug}">
							<button type="button" class="stepper__btn" data-step="-1" aria-label="Remove one ${e(juice.name)}">${icon('minus')}</button>
							<span class="stepper__value">${qty}</span>
							<button type="button" class="stepper__btn" data-step="1" aria-label="Add one ${e(juice.name)}">${icon('plus')}</button>
						</div>
					</div>`
					)
					.join('')}
			</div>`
				: `<p class="summary__empty">Your cart is empty. Add a few bottles to get started.</p>`
		}
		${
			missing.length
				? `<div class="summary__add">
				<p class="summary__add-label">${lines.length ? 'Add another flavor' : 'Pick your juice'}</p>
				${missing
					.map(
						j => `<button type="button" class="quick-add" style="--c: ${j.color}" data-quick-add="${j.slug}">
						<img src="${j.imageSmall || j.image}" alt=""><span>${e(j.name)}</span><span class="quick-add__price">${money(j.price)}</span>${icon('plus')}
					</button>`
					)
					.join('')}
			</div>`
				: ''
		}
		<dl class="summary__totals">
			<div><dt>Subtotal${priced.bottles ? ` &middot; ${priced.bottles} bottle${priced.bottles === 1 ? '' : 's'}` : ''}</dt><dd>${formatMoney(priced.subtotal)}</dd></div>
			${state.type === 'delivery' ? `<div><dt>Delivery</dt><dd>${priced.deliveryFee ? formatMoney(priced.deliveryFee) : priced.bottles ? 'Free' : '—'}</dd></div>` : `<div><dt>Pickup</dt><dd>Free</dd></div>`}
			<div class="summary__total"><dt>Total</dt><dd>${formatMoney(priced.total)}</dd></div>
		</dl>
		${state.date ? `<p class="summary__when">${icon('calendar')} ${state.type === 'delivery' ? 'Delivered' : 'Pickup'} ${formatDate(state.date)}</p>` : ''}
		${blockers.length && lines.length ? `<p class="summary__error">${e(blockers[0])}</p>` : ''}
		${state.error ? `<p class="summary__error" role="alert">${icon('info')} ${e(state.error)}</p>` : ''}
		<button type="button" class="btn btn--lime btn--lg btn--block" data-pay ${priced.ok && !state.submitting ? '' : 'disabled'}>
			${state.submitting ? 'Opening secure checkout…' : `Pay ${priced.total ? formatMoney(priced.total) : ''} ${icon('arrowRight')}`}
		</button>
		<p class="summary__secure">Secure payment by Stripe. Cards, Apple Pay and Google Pay.</p>`;

	summary.querySelector('[data-pay]').addEventListener('click', pay);
	summary.querySelectorAll('[data-quick-add]').forEach(btn => btn.addEventListener('click', () => addToCart(btn.dataset.quickAdd)));

	// Grey out delivery when the cart is under the minimum
	const deliveryChoice = document.querySelector('[data-delivery-choice]');
	if (deliveryChoice) {
		const short = settings.delivery.minBottles - priced.bottles;
		deliveryChoice.querySelector('.choice__text').innerHTML =
			short > 0 && priced.bottles > 0
				? `${e(settings.delivery.areaLabel)} &middot; add ${short} more bottle${short === 1 ? '' : 's'}`
				: `${e(settings.delivery.areaLabel)} &middot; ${settings.delivery.minBottles}+ bottles`;
	}
}

/*=============== CHECKOUT ===============*/
async function pay() {
	const form = document.getElementById('order-form');
	state.error = '';
	const required = ['name', 'phone', 'email', ...(state.type === 'delivery' ? ['line1', 'city', 'zip'] : [])];
	const empty = required.map(name => form.elements[name]).find(input => !input.value.trim());
	if (empty) {
		empty.focus();
		state.error = 'Please fill in your details before paying.';
		return renderSummary();
	}
	if (!form.email.checkValidity()) {
		form.email.focus();
		state.error = 'That email address does not look right.';
		return renderSummary();
	}

	state.submitting = true;
	renderSummary();
	showCover();
	const data = Object.fromEntries(new FormData(form));
	try {
		const res = await fetch('/api/checkout', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				items: items(),
				type: state.type,
				date: state.date,
				customer: { name: data.name, email: data.email, phone: data.phone },
				address: state.type === 'delivery' ? { line1: data.line1, line2: data.line2, city: data.city, zip: data.zip } : null,
				notes: data.notes
			})
		});
		const body = await res.json().catch(() => ({}));
		if (!res.ok || !body.url) throw new Error(body.error || 'We could not start checkout. Please try again.');
		location.href = body.url;
	} catch (err) {
		hideCover();
		state.submitting = false;
		state.error = err.message;
		renderSummary();
		document.querySelector('.summary__error')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
	}
}

/** Covers the page with the bottle loader while Stripe Checkout opens */
function showCover() {
	hideCover();
	document.body.insertAdjacentHTML(
		'beforeend',
		`<div class="checkout-cover" data-checkout-cover>
			<div class="checkout-cover__inner">
				${juiceLoader('Opening secure checkout&hellip;')}
				<p class="checkout-cover__secure">${icon('lock')} Payments are handled by Stripe</p>
			</div>
		</div>`
	);
}

const hideCover = () => document.querySelector('[data-checkout-cover]')?.remove();

// Coming back from Stripe with the back button restores this page from cache, cover and all
window.addEventListener('pageshow', event => {
	if (!event.persisted || !state.submitting) return;
	hideCover();
	state.submitting = false;
	renderSummary();
});

function update() {
	renderTypeHint();
	renderDates();
	renderSummary();
	renderZone();
}

ready.then(catalog => {
	juices = catalog.juices;
	settings = catalog.settings;
	catalogCopy = catalog.copy;

	if (!settings.orderingEnabled) {
		root.innerHTML = `<div class="card closed"><h2 class="section-title section-title--sm">Online ordering is paused</h2><p>Hunter isn't taking online orders right now. Message him on Instagram <a href="https://instagram.com/${e(settings.instagram)}">@${e(settings.instagram)}</a> or <a href="/contact">send a note</a>.</p></div>`;
		return;
	}

	// Drop anything that has left the menu since it was added
	Object.keys(getCart()).forEach(slug => !juices.some(j => j.slug === slug && isOrderable(j)) && setQty(slug, 0));

	renderLayout();
	update();
	// Show the canceled note once, without it coming back on a refresh
	if (new URLSearchParams(location.search).has('canceled')) {
		history.replaceState(null, '', location.pathname);
		requestAnimationFrame(() => root.querySelector('[data-checkout-note]')?.scrollIntoView({ block: 'center' }));
	}
	root.querySelector('[data-dismiss-note]')?.addEventListener('click', () => root.querySelector('[data-checkout-note]').remove());
	window.addEventListener('cart:change', renderSummary);
});
