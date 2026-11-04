/**
 * Admin → Orders → Add sale: a quick form for sales made off the website (cash, Venmo, Instagram
 * DMs, cafes), built to fill in one-handed on a phone. Also used to fix one up later, and to add
 * the juices to a Stripe payment (Tap to Pay doesn't say what was bought).
 */
import { icon } from '../lib/icons.js';
import { escapeHtml as e } from '../lib/catalog.js';
import { formatMoney, toCents, todayISO } from '../shared/order-rules.js';
import { PAYMENT_METHODS, SALE_CHANNELS, currentLines, orderSource } from '../shared/order-status.js';
import { api, guarded } from './admin.js';

const HOW = [
	{ id: 'handoff', label: 'Handed over', hint: 'Already done' },
	{ id: 'pickup', label: 'Pickup', hint: 'Shows in To do' },
	{ id: 'delivery', label: 'Delivery', hint: 'Shows in To do' }
];

const chips = (name, options, current) =>
	`<div class="segmented segmented--wrap" role="radiogroup">${options
		.map(o => `<label><input type="radio" name="${name}" value="${o.id}" ${o.id === current ? 'checked' : ''}><span>${e(o.label)}</span></label>`)
		.join('')}</div>`;

/**
 * Opens the form. `order` is an existing outside sale or Stripe payment to edit (with its `key`).
 * Resolves with { order, key, previousKey } once saved, or null if closed.
 */
export function openSaleForm(state, { order = null, key = null } = {}) {
	return new Promise(resolve => {
		document.getElementById('sale-sheet')?.remove();
		const stripe = orderSource(order) === 'stripe';
		const counts = new Map((order ? currentLines(order, state.juices) : []).map(l => [l.slug, l.qty]));
		// Juices on the menu, plus any on this sale that have since been hidden
		const juices = state.juices.filter(j => j.active !== false || counts.has(j.slug));
		const priceOf = slug => toCents(state.juices.find(j => j.slug === slug)?.price || 0);
		const c = order?.customer || {};
		const customTotal = order && !stripe && order.total !== order.lines.reduce((s, l) => s + priceOf(l.slug) * l.qty, 0) ? order.total : null;
		const title = stripe ? 'Add what they bought' : order ? 'Edit sale' : 'Add a sale';

		document.body.insertAdjacentHTML(
			'beforeend',
			`<dialog class="sheet sale-sheet" id="sale-sheet" aria-labelledby="sale-sheet-title">
				<div class="sheet__head">
					<div>
						<h2 class="sheet__title" id="sale-sheet-title">${title}</h2>
						<p class="muted">${stripe ? `${formatMoney(order.total)} paid by card through Stripe. Pick the juices so they count in your stats.` : 'For sales off the website: cash, Venmo, Instagram, cafes.'}</p>
					</div>
					<button type="button" class="icon-btn icon-btn--light" data-close aria-label="Close">${icon('close')}</button>
				</div>
				<form class="sheet__body sale-form" novalidate>
					<section class="sheet__section">
						<h3>Bottles</h3>
						<ul class="sale-juices">
							${juices
								.map(
									j => `<li class="sale-juice${counts.get(j.slug) ? ' has-qty' : ''}" style="--c:${e(j.color || '#8db62f')}" data-slug="${e(j.slug)}">
										<span class="sale-juice__dot"></span>
										<span class="sale-juice__name">${e(j.name)}<small>${formatMoney(priceOf(j.slug))}</small></span>
										<div class="stepper">
											<button type="button" class="stepper__btn" data-step="-1" aria-label="One less ${e(j.name)}">${icon('minus')}</button>
											<span class="stepper__value" aria-live="polite">${counts.get(j.slug) || 0}</span>
											<button type="button" class="stepper__btn" data-step="1" aria-label="One more ${e(j.name)}">${icon('plus')}</button>
										</div>
									</li>`
								)
								.join('')}
						</ul>
					</section>

					${
						stripe
							? ''
							: `<section class="sheet__section">
						<h3>Price</h3>
						<div class="sale-price">
							<div class="input-prefix"><span>$</span><input name="total" type="number" inputmode="decimal" min="0" step="0.01" value="${customTotal !== null ? (customTotal / 100).toFixed(2) : ''}" aria-label="What they paid"></div>
							<p class="hint" data-menu-price></p>
						</div>
					</section>
					<section class="sheet__section">
						<h3>Paid with</h3>
						${chips('payment', PAYMENT_METHODS, order?.payment || 'cash')}
					</section>
					<section class="sheet__section">
						<h3>Where they found you</h3>
						${chips('channel', SALE_CHANNELS, order?.channel || 'in-person')}
					</section>`
					}

					<section class="sheet__section">
						<h3>Getting it to them</h3>
						${chips('type', HOW, order?.type || 'handoff')}
						<div class="field sale-form__date"><label for="sale-date" data-date-label>Date</label><input id="sale-date" name="date" type="date" value="${e(order?.date || todayISO())}" required></div>
						<div class="field" data-address ${order?.type === 'delivery' ? '' : 'hidden'}><label for="sale-address">Deliver to <span class="optional">optional</span></label><input id="sale-address" name="address" value="${e(order?.address?.line1 || '')}" placeholder="Street, city" autocomplete="off"></div>
					</section>

					<section class="sheet__section">
						<h3>Customer <span class="optional">optional</span></h3>
						<div class="field"><label for="sale-name">Name</label><input id="sale-name" name="name" value="${e(c.name || '')}" maxlength="80" placeholder="Leave blank for a walk-up" autocomplete="off"></div>
						<div class="field-row">
							<div class="field"><label for="sale-phone">Phone</label><input id="sale-phone" name="phone" type="tel" inputmode="tel" value="${e(c.phone || '')}" maxlength="30" autocomplete="off"></div>
							<div class="field"><label for="sale-email">Email</label><input id="sale-email" name="email" type="email" inputmode="email" value="${e(c.email || '')}" autocomplete="off"></div>
						</div>
						<div class="field"><label for="sale-notes">Notes</label><textarea id="sale-notes" name="notes" rows="2" maxlength="500" placeholder="@handle, cafe name, anything to remember">${e(order?.notes || '')}</textarea></div>
					</section>

					<div class="sale-form__foot">
						<p class="sale-form__error" role="alert" data-error hidden></p>
						<button type="submit" class="btn btn--ink sale-form__save" data-save>Save</button>
					</div>
				</form>
			</dialog>`
		);

		const sheet = document.getElementById('sale-sheet');
		const form = sheet.querySelector('form');
		let done = false;
		const finish = result => {
			if (done) return;
			done = true;
			resolve(result);
			if (sheet.open) sheet.close();
			sheet.remove();
		};

		const field = name => form.elements[name];
		const picked = name => form.querySelector(`input[name="${name}"]:checked`)?.value;
		const items = () => [...counts].filter(([, qty]) => qty > 0).map(([slug, qty]) => ({ slug, qty }));
		const bottles = () => items().reduce((n, i) => n + i.qty, 0);
		const menuTotal = () => items().reduce((sum, i) => sum + priceOf(i.slug) * i.qty, 0);
		const total = () => {
			const typed = field('total')?.value;
			return stripe ? order.total : typed !== '' && typed !== undefined && Number.isFinite(Number(typed)) ? Math.round(Number(typed) * 100) : menuTotal();
		};

		function refresh() {
			const n = bottles();
			const menuPrice = sheet.querySelector('[data-menu-price]');
			if (menuPrice) {
				field('total').placeholder = (menuTotal() / 100).toFixed(2);
				menuPrice.textContent = n ? `Menu price is ${formatMoney(menuTotal())}. Type a different amount for a deal or wholesale price.` : 'Add bottles above and the menu price fills in.';
			}
			const type = picked('type');
			sheet.querySelector('[data-address]').hidden = type !== 'delivery';
			sheet.querySelector('[data-date-label]').textContent = { handoff: 'Sold on', pickup: 'Pickup day', delivery: 'Delivery day' }[type] || 'Date';
			const save = sheet.querySelector('[data-save]');
			save.innerHTML = stripe ? `${icon('check')} Save` : `${icon('check')} Save sale${n ? ` &middot; ${n} bottle${n === 1 ? '' : 's'} &middot; ${formatMoney(total())}` : ''}`;
		}

		sheet.addEventListener('click', event => {
			if (event.target === sheet || event.target.closest('[data-close]')) return finish(null);
			const step = event.target.closest('[data-step]');
			if (!step) return;
			const row = step.closest('[data-slug]');
			const qty = Math.max(0, Math.min(500, (counts.get(row.dataset.slug) || 0) + Number(step.dataset.step)));
			counts.set(row.dataset.slug, qty);
			row.querySelector('.stepper__value').textContent = qty;
			row.classList.toggle('has-qty', qty > 0);
			refresh();
		});
		form.addEventListener('input', refresh);
		form.addEventListener('change', refresh);
		sheet.addEventListener('close', () => finish(null));

		form.addEventListener('submit', async event => {
			event.preventDefault();
			if (!stripe && !bottles()) {
				sheet.querySelector('.sale-juices').scrollIntoView({ behavior: 'smooth', block: 'center' });
				const error = sheet.querySelector('[data-error]');
				error.textContent = 'Tap + on at least one juice.';
				error.hidden = false;
				return;
			}
			const save = sheet.querySelector('[data-save]');
			save.disabled = true;
			const body = {
				key,
				items: items(),
				total: stripe ? undefined : total(),
				payment: picked('payment'),
				channel: picked('channel'),
				type: picked('type'),
				date: field('date').value,
				address: field('address').value,
				customer: { name: field('name').value, phone: field('phone').value, email: field('email').value },
				notes: field('notes').value
			};
			const error = sheet.querySelector('[data-error]');
			error.hidden = true;
			// The toast sits under an open dialog, so problems are shown in the form too
			const data = await guarded(() => api('sales', { method: order ? 'PUT' : 'POST', json: body })).catch(err => {
				error.textContent = err.message;
				error.hidden = false;
				return null;
			});
			save.disabled = false;
			if (data) finish({ order: data.order, key: data.key, previousKey: key });
		});

		refresh();
		sheet.showModal();
	});
}
