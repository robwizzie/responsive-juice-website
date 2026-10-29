import { ingredientPhoto, juiceStatus } from '../shared/catalog.js';
import { DEFAULT_COPY, copyText } from '../shared/content.js';
import { escapeHtml as e } from './catalog.js';
import { icon } from './icons.js';

export const money = dollars => `$${Number(dollars).toFixed(2)}`;

// "$7" rather than "$7.00" for round amounts in running text
export const moneyShort = dollars => (Number.isInteger(Number(dollars)) ? `$${Number(dollars)}` : money(dollars));

/** First two ingredients that have a photo, used as the floating garnish around a bottle. */
export const garnishFor = juice =>
	juice.ingredients
		.map(name => ingredientPhoto(juice, name))
		.filter(Boolean)
		.slice(0, 2);

/** The bottle photo, or a shimmering "?" bottle for a coming-soon juice that has no photo yet. */
export function bottleImage(juice, { small = false, eager = false, className = '' } = {}) {
	if (!juice.image) return `<span class="mystery-bottle ${className}" style="--c: ${juice.color}" role="img" aria-label="${e(juice.name)}, coming soon"></span>`;
	const src = small ? juice.imageSmall || juice.image : juice.image;
	return `<img src="${src}" alt="" class="${className}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"${eager ? ' fetchpriority="high"' : ''}>`;
}

export function statusStamp(juice, { className = '' } = {}) {
	const status = juiceStatus(juice);
	if (status === 'available') return '';
	const label = juice.statusNote || (status === 'sold-out' ? 'Sold out' : 'Coming soon');
	return `<span class="stamp stamp--${status} ${className}">${icon(status === 'sold-out' ? 'prohibit' : 'hourglass')}${e(label)}</span>`;
}

/**
 * The "floating juice" scene: the bottle over its colour splash with ingredients and leaves
 * drifting around it. Layers move a little with the pointer (see initParallax).
 */
export function bottleArt(juice, { size = 'md', eager = false, small = false } = {}) {
	const [fruitA, fruitB] = garnishFor(juice);
	const loading = eager ? 'eager' : 'lazy';
	const splash = juice.splash && juice.splash !== 'none' ? `/assets/img/splash/${juice.splash}${small ? '-sm' : ''}.webp` : null;
	const layer = (cls, src) => `<span class="${cls}"><img src="${src}" alt="" loading="${loading}" decoding="async"></span>`;
	return `
		<div class="bottle-art bottle-art--${size}" style="--c: ${juice.color}" data-parallax aria-hidden="true">
			<span class="bottle-art__glow"></span>
			${splash ? `<img src="${splash}" alt="" class="bottle-art__splash" loading="${loading}" decoding="async">` : ''}
			${fruitA ? layer('bottle-art__fruit bottle-art__fruit--a', fruitA) : ''}
			${fruitB ? layer('bottle-art__fruit bottle-art__fruit--b', fruitB) : ''}
			${layer('bottle-art__leaf bottle-art__leaf--a', '/assets/img/leaf.webp')}
			${layer('bottle-art__leaf bottle-art__leaf--b', '/assets/img/leaf.webp')}
			<div class="bottle-art__float">${bottleImage(juice, { small, eager, className: 'bottle-art__bottle' })}</div>
		</div>`;
}

/** Add-to-cart for an available juice, otherwise a quiet note about when it's back. */
export function buyButton(juice, { size = 'sm', label = 'Add' } = {}) {
	if (juiceStatus(juice) !== 'available') return `<a href="/juices/${juice.slug}" class="btn btn--ghost btn--${size}">Details</a>`;
	return `<button type="button" class="btn btn--ink btn--${size}" data-add="${juice.slug}">${icon('plus')} ${label}</button>`;
}

export function juiceCard(juice, { eager = false } = {}) {
	const status = juiceStatus(juice);
	const calories = juice.nutrition?.calories;
	return `
		<article class="juice-card is-${status}" style="--c: ${juice.color}" data-reveal>
			<div class="juice-card__art">
				${bottleArt(juice, { size: 'card', eager, small: true })}
				${statusStamp(juice, { className: 'juice-card__stamp' })}
			</div>
			<div class="juice-card__body">
				<p class="juice-card__meta">${juice.sizeOz} fl oz${calories ? ` &middot; ${calories} cal` : ''}</p>
				<h3 class="juice-card__name"><a href="/juices/${juice.slug}">${e(juice.name)}</a></h3>
				${juice.tagline ? `<p class="juice-card__tagline">${e(juice.tagline)}</p>` : ''}
				${juice.ingredients.length ? `<ul class="juice-card__ingredients" aria-label="Ingredients">${juice.ingredients.map(item => `<li>${e(item)}</li>`).join('')}</ul>` : ''}
				<div class="juice-card__foot">
					${status === 'coming-soon' ? `<span class="juice-card__note">${juice.price ? `${money(juice.price)} when it lands` : 'Price soon'}</span>` : `<span class="price">${money(juice.price)}</span>`}
					${buyButton(juice)}
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

/** The two ways to get juice (pickup and delivery), described from the live settings. Pass the page text to use Hunter's wording. */
export function waysToOrder(settings, copy = DEFAULT_COPY) {
	const t = key => e(copyText(copy, key, settings));
	const { pickup, delivery } = settings;
	const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const cards = [];
	if (pickup.enabled) {
		cards.push(`
			<article class="way" data-reveal>
				<span class="way__icon">${icon('store')}</span>
				<h3 class="way__title">Pickup in ${e(pickup.area.split(',')[0])}</h3>
				<p class="way__text" data-edit="ways.pickup">${t('ways.pickup')}</p>
				<ul class="way__list">
					<li>${icon('calendar')} Pickup ${dayList(pickup.days)}</li>
					<li>${icon('clock')} Order ${pickup.leadDays > 0 ? `${pickup.leadDays} day${pickup.leadDays === 1 ? '' : 's'} ahead` : 'same day'}, pressed to order</li>
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
				<p class="way__text" data-edit="ways.delivery">${t('ways.delivery')}</p>
				<ul class="way__list">
					<li>${icon('bag')} ${delivery.minBottles} bottle minimum</li>
					<li>${icon('truck')} ${moneyShort(delivery.fee)} delivery${delivery.freeOver > 0 ? `, free over ${moneyShort(delivery.freeOver)}` : ''}</li>
					<li>${icon('calendar')} Order by end of ${cutoff}</li>
				</ul>
			</article>`);
	}
	return cards.join('');
}
