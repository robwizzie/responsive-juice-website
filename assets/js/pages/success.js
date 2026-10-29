import { ready } from '../site.js';
import { escapeHtml as e } from '../lib/catalog.js';
import { clearCart } from '../lib/cart.js';
import { bottleImage } from '../lib/components.js';
import { icon } from '../lib/icons.js';
import { formatDate, formatMoney } from '../shared/order-rules.js';

const root = document.querySelector('[data-confirm]');
const sessionId = new URLSearchParams(location.search).get('session_id');

/** Up to three of the ordered bottles, fanned out behind the check mark */
function bottleFan(order, juices) {
	const picks = order.lines.map(line => juices.find(j => j.slug === line.slug)).filter(j => j?.image).slice(0, 3);
	if (!picks.length) return `<span class="confirm__badge confirm__badge--solo">${icon('check')}</span>`;
	return `
		<div class="confirm__fan confirm__fan--${picks.length}">
			${picks.map((juice, i) => `<div class="confirm__fan-bottle" style="--i: ${i}; --c: ${juice.color}">${bottleImage(juice, { small: true, eager: true })}</div>`).join('')}
			<span class="confirm__badge">${icon('check')}</span>
		</div>`;
}

function receipt(order, juices) {
	const thumb = line => {
		const juice = juices.find(j => j.slug === line.slug);
		return `<span class="receipt__thumb" style="--c: ${juice?.color || 'var(--lime)'}">${juice?.image ? bottleImage(juice, { small: true }) : ''}</span>`;
	};
	return `
		<div class="card receipt">
			<div class="receipt__head">
				<h2 class="receipt__title">${icon('receipt')} Your order</h2>
				<span class="receipt__status${order.paid === false ? ' receipt__status--pending' : ''}">${order.paid === false ? `${icon('clock')} Processing` : `${icon('check')} Paid`}</span>
			</div>
			<ul class="receipt__lines">
				${order.lines
					.map(
						line => `
					<li class="receipt__line">
						${thumb(line)}
						<span class="receipt__name">${e(line.name)}<small>${line.qty} &times; ${formatMoney(line.unit ?? line.amount / line.qty)}</small></span>
						<span class="receipt__amount">${formatMoney(line.amount)}</span>
					</li>`
					)
					.join('')}
			</ul>
			<div class="receipt__totals">
				${order.type === 'delivery' ? `<div class="receipt__row"><span>Delivery</span><span>${order.deliveryFee ? formatMoney(order.deliveryFee) : 'Free'}</span></div>` : ''}
				<div class="receipt__row receipt__row--total"><span>${order.paid === false ? 'Total' : 'Total paid'}</span><span>${formatMoney(order.total)}</span></div>
			</div>
			<p class="receipt__note">${icon('mail')} Receipt sent to <strong>${e(order.email)}</strong></p>
		</div>`;
}

function nextSteps(order, settings) {
	const pickup = order.type !== 'delivery';
	const steps = [
		{ icon: 'check', title: 'Order placed', text: 'Hunter has your order and it is on the list.', done: true },
		{ icon: 'drop', title: `Pressed fresh ${formatDate(order.date)}`, text: 'Your bottles are cold-pressed that morning, never before.' },
		pickup
			? { icon: 'pin', title: 'Pick it up', text: `Pickup is in ${e(settings.pickup.area)}. Hunter will text you the spot and time.` }
			: { icon: 'truck', title: 'Delivered to you', text: 'Hunter will text you when he is on the way.' }
	];
	return `
		<div class="card next-steps">
			<h2 class="next-steps__title">What happens next</h2>
			<ol class="next-steps__list">
				${steps
					.map(
						step => `
					<li class="next-steps__item${step.done ? ' is-done' : ''}">
						<span class="next-steps__icon">${icon(step.icon)}</span>
						<div><strong>${step.title}</strong><p>${step.text}</p></div>
					</li>`
					)
					.join('')}
			</ol>
			<p class="next-steps__help">Questions? Email <a href="mailto:${e(settings.contactEmail)}">${e(settings.contactEmail)}</a> or DM <a href="https://instagram.com/${e(settings.instagram)}" target="_blank" rel="noopener">@${e(settings.instagram)}</a>.</p>
		</div>`;
}

const actions = settings => `
	<div class="confirm__actions">
		<a href="/juices" class="btn btn--ink btn--lg">Back to the menu ${icon('arrowRight')}</a>
		<a href="https://instagram.com/${e(settings.instagram)}" class="btn btn--ghost btn--lg" target="_blank" rel="noopener">${icon('instagram')} Follow along</a>
	</div>`;

function render(order, { settings, juices }) {
	const pending = order.paid === false;
	root.innerHTML = `
		<header class="confirm__hero">
			${bottleFan(order, juices)}
			<p class="confirm__kicker${pending ? ' confirm__kicker--pending' : ''}">${pending ? 'Payment processing' : 'Order confirmed'}</p>
			<h1 class="confirm__title">Thanks${order.firstName ? `, ${e(order.firstName)}` : ''}!<span>${pending ? 'Almost there.' : "You're all set."}</span></h1>
			<p class="confirm__lede">${
				pending
					? `Your bank is still confirming the payment. We'll email <strong>${e(order.email)}</strong> as soon as it clears.`
					: `Your juice gets pressed fresh for ${order.type === 'delivery' ? 'delivery' : 'pickup'} on <strong>${formatDate(order.date)}</strong>.`
			}</p>
		</header>
		<div class="confirm__grid">
			${receipt(order, juices)}
			${nextSteps(order, settings)}
		</div>
		${actions(settings)}`;
}

/** Stripe sent them here but we couldn't look the order up: the payment still went through */
function renderFallback({ settings }) {
	root.innerHTML = `
		<header class="confirm__hero">
			<span class="confirm__badge confirm__badge--solo">${icon('check')}</span>
			<p class="confirm__kicker">Payment received</p>
			<h1 class="confirm__title">Your order is in.<span>Thank you!</span></h1>
			<p class="confirm__lede">We couldn't load the details on this page, but your order went through. Your receipt and confirmation are on their way to your email.</p>
		</header>
		<div class="card confirm__help">
			<span class="confirm__help-icon">${icon('mail')}</span>
			<p>Didn't get an email in a few minutes? Check your spam folder, or email <a href="mailto:${e(settings.contactEmail)}">${e(settings.contactEmail)}</a> and Hunter will sort it out.</p>
		</div>
		${actions(settings)}`;
}

ready.then(async catalog => {
	if (!sessionId) return location.replace('/');
	clearCart();
	try {
		const res = await fetch(`/api/order-summary?session_id=${encodeURIComponent(sessionId)}`);
		if (!res.ok) throw new Error();
		render(await res.json(), catalog);
	} catch {
		renderFallback(catalog);
	}
});
