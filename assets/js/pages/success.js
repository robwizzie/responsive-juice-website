import { ready } from '../site.js';
import { escapeHtml as e } from '../lib/catalog.js';
import { clearCart } from '../lib/cart.js';
import { icon } from '../lib/icons.js';
import { formatDate, formatMoney } from '../shared/order-rules.js';

const root = document.querySelector('[data-confirm]');
const sessionId = new URLSearchParams(location.search).get('session_id');

function render(order, settings) {
	const pickup = order.type !== 'delivery';
	root.innerHTML = `
		<span class="confirm__check">${icon('check')}</span>
		<p class="kicker">Order confirmed</p>
		<h1 class="section-title">Thanks${order.firstName ? `, ${e(order.firstName)}` : ''}! You're all set.</h1>
		<p class="section-lede">A confirmation is on its way to ${e(order.email)}. Your juice gets pressed fresh for ${pickup ? 'pickup' : 'delivery'} on <strong>${formatDate(order.date)}</strong>.</p>
		<div class="card confirm__card">
			${order.lines.map(l => `<div class="confirm__line"><span>${l.qty} &times; ${e(l.name)}</span><span>${formatMoney(l.amount)}</span></div>`).join('')}
			${order.type === 'delivery' ? `<div class="confirm__line"><span>Delivery</span><span>${order.deliveryFee ? formatMoney(order.deliveryFee) : 'Free'}</span></div>` : ''}
			<div class="confirm__line confirm__line--total"><span>Total paid</span><span>${formatMoney(order.total)}</span></div>
		</div>
		<p class="muted">${pickup ? `Pickup is in ${e(settings.pickup.area)}. Hunter will text you the spot and time.` : 'Hunter will text you when he is on the way.'} Questions? Email <a href="mailto:${e(settings.contactEmail)}">${e(settings.contactEmail)}</a>.</p>
		<div class="confirm__actions">
			<a href="/juices" class="btn btn--ink btn--lg">Back to the menu</a>
			<a href="https://instagram.com/${e(settings.instagram)}" class="btn btn--ghost btn--lg" target="_blank" rel="noopener">${icon('instagram')} Follow along</a>
		</div>`;
}

function renderFallback(settings) {
	root.innerHTML = `
		<span class="confirm__check">${icon('check')}</span>
		<p class="kicker">Thank you</p>
		<h1 class="section-title">Your order is in.</h1>
		<p class="section-lede">Check your email for the confirmation. Questions? Email <a href="mailto:${e(settings.contactEmail)}">${e(settings.contactEmail)}</a>.</p>
		<div class="confirm__actions"><a href="/juices" class="btn btn--ink btn--lg">Back to the menu</a></div>`;
}

ready.then(async ({ settings }) => {
	if (!sessionId) return location.replace('/');
	clearCart();
	try {
		const res = await fetch(`/api/order-summary?session_id=${encodeURIComponent(sessionId)}`);
		if (!res.ok) throw new Error();
		render(await res.json(), settings);
	} catch {
		renderFallback(settings);
	}
});
