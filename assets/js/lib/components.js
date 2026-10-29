import { ingredientPhoto, juiceStatus } from '../shared/catalog.js';
import { DEFAULT_COPY, copyText } from '../shared/content.js';
import { cutoffDay, pickupAddress, pickupMapUrl, weekdayName } from '../shared/order-rules.js';
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

/** Where pickup is, as a tappable address that opens maps. */
export const pickupSpot = (pickup, className = 'pickup-spot') => `
	<a class="${className}" href="${e(pickupMapUrl(pickup))}" target="_blank" rel="noopener">
		${icon('pin')}<span><strong>${e(pickup.address || pickup.area)}</strong>${pickup.address ? `<small>${e(pickup.area)}</small>` : ''}</span><span class="${className}__go">Directions ${icon('arrowRight')}</span>
	</a>`;

/** The two ways to get juice (pickup and delivery), described from the live settings. Pass the page text to use Hunter's wording. */
export function waysToOrder(settings, copy = DEFAULT_COPY) {
	const t = key => e(copyText(copy, key, settings));
	const { pickup, delivery } = settings;
	const cards = [];
	if (pickup.enabled) {
		cards.push(`
			<article class="way" data-reveal>
				<span class="way__icon">${icon('store')}</span>
				<h3 class="way__title">Pickup in ${e(pickup.area.split(',')[0])}</h3>
				<p class="way__text" data-edit="ways.pickup">${t('ways.pickup')}</p>
				${pickupSpot(pickup)}
				<ul class="way__list">
					<li>${icon('calendar')} Pickup ${dayList(pickup.days)}${pickup.hours ? `, ${e(pickup.hours)}` : ''}</li>
					<li>${icon('clock')} Order ${pickup.leadDays > 0 ? `${pickup.leadDays} day${pickup.leadDays === 1 ? '' : 's'} ahead` : 'same day'}, pressed to order</li>
					<li>${icon('check')} No minimum</li>
				</ul>
			</article>`);
	}
	if (delivery.enabled) {
		cards.push(`
			<article class="way way--feature" data-reveal>
				<span class="way__icon">${icon('truck')}</span>
				<h3 class="way__title">${weekdayName(delivery.day)} delivery in ${e(delivery.areaLabel)}</h3>
				<p class="way__text" data-edit="ways.delivery">${t('ways.delivery')}</p>
				<ul class="way__list">
					<li>${icon('calendar')} Order by end of ${weekdayName(cutoffDay(delivery))} for ${weekdayName(delivery.day)}</li>
					<li>${icon('bag')} ${delivery.minBottles} bottle minimum</li>
					<li>${icon('truck')} ${moneyShort(delivery.fee)} delivery${delivery.freeOver > 0 ? `, free over ${moneyShort(delivery.freeOver)}` : ''}</li>
				</ul>
			</article>`);
	}
	return cards.join('');
}

/** The "no shipping yet" line under the pickup and delivery options. */
export const shippingNote = (settings, copy = DEFAULT_COPY) =>
	`<p class="ways-note" data-reveal>${icon('hourglass')}<span data-edit="ways.shipping">${e(copyText(copy, 'ways.shipping', settings))}</span></p>`;

/** Common pickup and delivery questions, open-and-close style. Hunter edits the wording in Pages. */
export function pickupFaq(settings, copy = DEFAULT_COPY) {
	const t = key => e(copyText(copy, key, settings));
	const items = [1, 2, 3, 4, 5]
		.filter(n => copyText(copy, `faq.${n}.q`, settings).trim())
		.map(
			n => `
			<details class="faq__item"${n === 1 ? ' open' : ''}>
				<summary><span data-edit="faq.${n}.q">${t(`faq.${n}.q`)}</span>${icon('plus')}</summary>
				<p data-edit="faq.${n}.a">${t(`faq.${n}.a`)}</p>
			</details>`
		);
	return `
		<div class="faq" data-reveal>
			<h2 class="section-title section-title--sm faq__title" data-edit="faq.title">${t('faq.title')}</h2>
			<div class="faq__list">${items.join('')}</div>
		</div>`;
}

/** The little bottle that fills up while something loads (same markup as the juice page's static loader) */
export const juiceLoader = text => `
	<div class="juice-loader" role="status">
		<svg class="juice-loader__bottle" viewBox="0 0 60 122" aria-hidden="true">
			<defs>
				<clipPath id="juice-loader-clip"><path d="M22 16h16v8q0 4 6 10t6 14v62q0 8-8 8H18q-8 0-8-8V48q0-8 6-14t6-10z"/></clipPath>
			</defs>
			<g clip-path="url(#juice-loader-clip)">
				<rect class="juice-loader__glass" width="60" height="122"/>
				<g class="juice-loader__fill">
					<path class="juice-loader__wave" d="M0 0q7.5-4 15 0t15 0 15 0 15 0 15 0 15 0 15 0 15 0V130H0z"/>
				</g>
				<rect class="juice-loader__label" x="10" y="56" width="40" height="38"/>
				<circle class="juice-loader__ring" cx="30" cy="72" r="9"/>
			</g>
			<rect class="juice-loader__cap" x="20" y="3" width="20" height="12" rx="2.5"/>
		</svg>
		<p class="juice-loader__text">${text}</p>
	</div>`;
