import { ingredientIcon } from '../shared/catalog.js';
import { escapeHtml as e } from './catalog.js';
import { icon } from './icons.js';

export const money = dollars => `$${Number(dollars).toFixed(2)}`;

// "$7" rather than "$7.00" for round amounts in running text
export const moneyShort = dollars => (Number.isInteger(Number(dollars)) ? `$${Number(dollars)}` : money(dollars));

/** First two ingredients that have a photo, used as the floating garnish around a bottle. */
const garnishFor = juice =>
	juice.ingredients
		.map(ingredientIcon)
		.filter(Boolean)
		.slice(0, 2);

/**
 * The "floating juice" scene: the bottle over its colour splash with ingredients and leaves
 * drifting around it. Layers with data-depth move with the pointer (see initParallax).
 */
export function bottleArt(juice, { size = 'md', eager = false, small = false } = {}) {
	const [fruitA, fruitB] = garnishFor(juice);
	const loading = eager ? 'eager' : 'lazy';
	const splash = juice.splash && juice.splash !== 'none' ? `/assets/img/splash/${juice.splash}${small ? '-sm' : ''}.webp` : null;
	return `
		<div class="bottle-art bottle-art--${size}" style="--c: ${juice.color}" data-parallax aria-hidden="true">
			<span class="bottle-art__glow"></span>
			${splash ? `<img src="${splash}" alt="" class="bottle-art__splash" data-depth="8" loading="${loading}" decoding="async">` : ''}
			${fruitA ? `<img src="${fruitA}" alt="" class="bottle-art__fruit bottle-art__fruit--a" data-depth="26" loading="${loading}" decoding="async">` : ''}
			${fruitB ? `<img src="${fruitB}" alt="" class="bottle-art__fruit bottle-art__fruit--b" data-depth="20" loading="${loading}" decoding="async">` : ''}
			<img src="/assets/img/leaf.webp" alt="" class="bottle-art__leaf bottle-art__leaf--a" data-depth="34" loading="${loading}" decoding="async">
			<img src="/assets/img/leaf.webp" alt="" class="bottle-art__leaf bottle-art__leaf--b" data-depth="28" loading="${loading}" decoding="async">
			<div class="bottle-art__float" data-depth="14">
				<img src="${small ? juice.imageSmall || juice.image : juice.image}" alt="" class="bottle-art__bottle" loading="${loading}" decoding="async" ${eager ? 'fetchpriority="high"' : ''}>
			</div>
		</div>`;
}

export function juiceCard(juice, { eager = false } = {}) {
	const soldOut = !juice.inStock;
	return `
		<article class="juice-card${soldOut ? ' is-sold-out' : ''}" style="--c: ${juice.color}" data-reveal>
			<a href="/juices/${juice.slug}" class="juice-card__art" aria-label="${e(juice.name)}">
				${bottleArt(juice, { size: 'card', eager, small: true })}
				${soldOut ? '<span class="tag tag--dark juice-card__tag">Sold out</span>' : ''}
			</a>
			<div class="juice-card__body">
				<p class="eyebrow">${juice.nutrition?.calories ? `${juice.nutrition.calories} cal &middot; ` : ''}${juice.sizeOz} fl oz</p>
				<h3 class="juice-card__name"><a href="/juices/${juice.slug}">${e(juice.name)}</a></h3>
				${juice.tagline ? `<p class="juice-card__tagline">${e(juice.tagline)}</p>` : ''}
				<p class="juice-card__ingredients">${juice.ingredients.map(e).join(' &middot; ')}</p>
				<div class="juice-card__foot">
					<span class="price">${money(juice.price)}</span>
					${
						soldOut
							? `<a href="/juices/${juice.slug}" class="btn btn--ghost btn--sm">Details</a>`
							: `<button type="button" class="btn btn--ink btn--sm" data-add="${juice.slug}">${icon('plus')} Add</button>`
					}
				</div>
			</div>
		</article>`;
}

/** Brief "added" feedback on an add-to-cart button. */
export function flashAdded(button) {
	if (!button || button.dataset.flashing) return;
	const original = button.innerHTML;
	button.dataset.flashing = '1';
	button.innerHTML = `${icon('check')} Added`;
	button.classList.add('is-added');
	setTimeout(() => {
		button.innerHTML = original;
		button.classList.remove('is-added');
		delete button.dataset.flashing;
	}, 1400);
}

const dayList = days => {
	const names = days.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]);
	return names.length === 7 ? 'every day' : names.join(', ');
};

/** The two ways to get juice (pickup and delivery), described from the live settings. */
export function waysToOrder(settings) {
	const { pickup, delivery } = settings;
	const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const cards = [];
	if (pickup.enabled) {
		cards.push(`
			<article class="way" data-reveal>
				<span class="way__icon">${icon('store')}</span>
				<h3 class="way__title">Pickup in ${e(pickup.area.split(',')[0])}</h3>
				<p class="way__text">Order online and grab your bottles fresh. Hunter confirms the spot and time once your order is pressed.</p>
				<ul class="way__list">
					<li>${icon('calendar')} Pickup ${dayList(pickup.days)}</li>
					<li>${icon('sparkle')} Order ${pickup.leadDays > 0 ? `${pickup.leadDays} day${pickup.leadDays === 1 ? '' : 's'} ahead` : 'same day'}, pressed to order</li>
					<li>${icon('check')} No minimum</li>
				</ul>
			</article>`);
	}
	if (delivery.enabled) {
		const cutoff = weekday[(delivery.day - delivery.cutoffDays + 7) % 7];
		cards.push(`
			<article class="way way--feature" data-reveal>
				<span class="way__icon">${icon('truck')}</span>
				<h3 class="way__title">${weekday[delivery.day]} delivery in ${e(delivery.areaLabel)}</h3>
				<p class="way__text">Hunter drives a fresh batch to your door every ${weekday[delivery.day]}, within ${delivery.radiusMiles} miles of ${delivery.zones.map(z => e(z.label.split(',')[0])).join(' and ')}.</p>
				<ul class="way__list">
					<li>${icon('bag')} ${delivery.minBottles} bottle minimum</li>
					<li>${icon('truck')} ${moneyShort(delivery.fee)} delivery${delivery.freeOver > 0 ? `, free over ${moneyShort(delivery.freeOver)}` : ''}</li>
					<li>${icon('calendar')} Order by end of ${cutoff}</li>
				</ul>
			</article>`);
	}
	return cards.join('');
}
