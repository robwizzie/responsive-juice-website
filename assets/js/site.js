/**
 * Shared page chrome: announcement bar, header, cart drawer, footer, and the small
 * motion helpers. Every public page imports this first.
 */
import { loadCatalog, escapeHtml as e } from './lib/catalog.js';
import { addToCart, cartCount, cartLines, getCart, setQty } from './lib/cart.js';
import { bottleImage, flashAdded, money, moneyShort } from './lib/components.js';
import { ingredientIcon, juiceStatus } from './shared/catalog.js';
import { DEFAULT_COPY, copyText } from './shared/content.js';
import { weekdayName } from './shared/order-rules.js';
import { wordmark } from './lib/brand.js';
import { headerHTML } from './lib/header.js';
import { icon } from './lib/icons.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/*=============== HEADER ===============*/
function renderHeader() {
	// Pages ship with the header baked in so it paints right away; build it only if one doesn't
	if (!document.querySelector('.site-header')) document.body.insertAdjacentHTML('afterbegin', headerHTML(location.pathname));

	const header = document.querySelector('.site-header');
	const toggle = header.querySelector('.nav-toggle');
	const setOpen = open => {
		header.classList.toggle('is-open', open);
		toggle.setAttribute('aria-expanded', open);
		toggle.innerHTML = icon(open ? 'close' : 'menu');
		document.documentElement.classList.toggle('no-scroll', open);
	};
	toggle.addEventListener('click', () => setOpen(!header.classList.contains('is-open')));
	document.addEventListener('keydown', event => event.key === 'Escape' && header.classList.contains('is-open') && setOpen(false));

	const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
	onScroll();
	window.addEventListener('scroll', onScroll, { passive: true });
}

/** A juice in the mobile menu: its bottle standing up out of a tinted card */
const navTile = (juice, i) => `
	<a href="/juices/${juice.slug}" class="nav-tile is-${juiceStatus(juice)}" style="--c: ${juice.color}; --i: ${i}">
		<span class="nav-tile__bottle">${bottleImage(juice, { small: true })}</span>
		<span class="nav-tile__name">${e(juice.name)}</span>
		<span class="nav-tile__meta">${juiceStatus(juice) === 'available' ? moneyShort(juice.price) : juiceStatus(juice) === 'sold-out' ? 'Sold out' : 'Soon'}</span>
	</a>`;

/*=============== FOOTER ===============*/
const fan = list =>
	list
		.slice(0, 3)
		.map((juice, i) => (juice.image ? `<img src="${juice.imageSmall || juice.image}" alt="" loading="lazy" style="--i: ${i}">` : ''))
		.join('');

// Bubbles in the footer shot: [left %, size px, rise seconds, delay seconds]
const FIZZ = [
	[4, 5, 8, -1],
	[12, 8, 10, -6],
	[21, 4, 7, -3],
	[30, 6, 9, -8],
	[38, 9, 11, -2],
	[47, 5, 8, -5],
	[55, 7, 10, -9],
	[63, 4, 7, -4],
	[71, 8, 12, -7],
	[80, 5, 9, -1.5],
	[88, 6, 8, -6.5],
	[95, 4, 10, -3.5]
];

function renderFooter(settings) {
	const main = document.querySelector('main');
	const year = new Date().getFullYear();
	const photo = t('footer.photo');
	const scene = photo
		? `<img src="${e(photo)}" alt="" class="site-footer__scene" loading="lazy" decoding="async">`
		: `<picture>
					<source media="(max-width: 760px)" srcset="/assets/img/brand/footer-scene-mobile.webp">
					<img src="/assets/img/brand/footer-scene.webp" srcset="/assets/img/brand/footer-scene-sm.webp 960w, /assets/img/brand/footer-scene.webp 1916w" sizes="100vw" alt="" class="site-footer__scene" loading="lazy" decoding="async">
				</picture>`;
	(main || document.body).insertAdjacentHTML(
		main ? 'afterend' : 'beforeend',
		`<footer class="site-footer" data-reveal>
			<div class="site-footer__hero" data-edit="footer.photo">
				${scene}
				<span class="site-footer__glow" aria-hidden="true"></span>
				<span class="site-footer__fizz" aria-hidden="true">${FIZZ.map(([x, size, time, delay]) => `<i style="--x: ${x}%; --s: ${size}px; --t: ${time}s; --d: ${delay}s"></i>`).join('')}</span>
				<div class="container site-footer__intro">
					<p class="site-footer__tag"><span data-edit="footer.tag1">${e(t('footer.tag1'))}</span> <span data-edit="footer.tag2">${e(t('footer.tag2'))}</span></p>
					<p class="site-footer__note" data-edit="footer.note">${e(t('footer.note'))}</p>
					<div class="site-footer__chips">
						<a href="mailto:${e(settings.contactEmail)}" class="footer-chip">${icon('mail')}<span>${e(settings.contactEmail)}</span></a>
						<a href="https://instagram.com/${e(settings.instagram)}" target="_blank" rel="noopener" class="footer-chip">${icon('instagram')}<span>@${e(settings.instagram)}</span></a>
					</div>
				</div>
			</div>
			<div class="container">
				<div class="site-footer__row">
					<a href="/" class="site-footer__mark" aria-label="SiponPressed home">${wordmark('SiponPressed')}</a>
					<nav class="site-footer__links" aria-label="Footer">
						<a href="/">Home</a>
						<a href="/juices">Juices</a>
						<a href="/order">Order</a>
						<a href="/about">About Hunter</a>
						<a href="/contact?topic=wholesale">Wholesale</a>
						<a href="/contact">Contact</a>
					</nav>
				</div>
				<div class="site-footer__bottom">
					<p>&copy; ${year} SiponPressed &middot; Philadelphia, PA</p>
					<p data-edit="footer.bottom">${e(t('footer.bottom'))}</p>
				</div>
			</div>
		</footer>`
	);
}

/** Decorative fruit baked into the pages switches to Hunter's own photo when he's replaced one. */
function applyIngredientPhotos(root = document) {
	for (const [key, url] of Object.entries(settings?.ingredientPhotos || {})) {
		const bundled = ingredientIcon(key);
		if (bundled) root.querySelectorAll(`img[src="${bundled}"]`).forEach(img => (img.src = url));
	}
}

/*=============== ANNOUNCEMENT ===============*/
function renderAnnouncement(settings) {
	const bar = document.querySelector('.announcement');
	const message = !settings.orderingEnabled ? t('banner.paused') : settings.announcement;
	if (!message) return;
	bar.textContent = message;
	if (!settings.orderingEnabled) bar.dataset.edit = 'banner.paused';
	bar.hidden = false;
}

/*=============== CART DRAWER ===============*/
let juices = [];
let settings = null;
let copy = DEFAULT_COPY;

/** Page text from /admin → Pages (or the default), with {tokens} filled in from the live settings. */
export const t = (key, extra) => copyText(copy, key, settings, extra);

/** Puts Hunter's text into every element marked data-copy. The server usually has already. */
export function applyCopy(root = document) {
	root.querySelectorAll('[data-copy]').forEach(el => {
		const value = t(el.dataset.copy);
		if (el.textContent !== value) el.textContent = value;
	});
}

function renderDrawerShell() {
	document.body.insertAdjacentHTML(
		'beforeend',
		`<div class="drawer" id="cart-drawer" hidden>
			<div class="drawer__backdrop" data-cart-close></div>
			<aside class="drawer__panel" role="dialog" aria-modal="true" aria-labelledby="cart-title">
				<div class="drawer__head">
					<h2 id="cart-title" class="drawer__title">Your cart</h2>
					<button type="button" class="icon-btn" data-cart-close aria-label="Close cart">${icon('close')}</button>
				</div>
				<div class="drawer__body" data-cart-body></div>
				<div class="drawer__foot" data-cart-foot></div>
			</aside>
		</div>
		<div class="toast" role="status" aria-live="polite" hidden></div>`
	);
}

function renderDrawer() {
	const body = document.querySelector('[data-cart-body]');
	const foot = document.querySelector('[data-cart-foot]');
	if (!body) return;
	const lines = cartLines(juices);

	if (lines.length === 0) {
		body.innerHTML = `<div class="drawer__empty"><div class="drawer__empty-bottles" aria-hidden="true">${fan(juices)}</div><p>Your cart is empty. Let's fix that.</p><a href="/juices" class="btn btn--ink">See the juices</a></div>`;
		foot.innerHTML = '';
		return;
	}

	body.innerHTML = lines
		.map(
			({ juice, qty }) => `
			<div class="cart-line" style="--c: ${juice.color}">
				<img src="${juice.imageSmall || juice.image}" alt="" class="cart-line__img">
				<div class="cart-line__info">
					<a href="/juices/${juice.slug}" class="cart-line__name">${e(juice.name)}</a>
					<span class="cart-line__price">${money(juice.price)}</span>
				</div>
				${stepper(juice.slug, qty)}
			</div>`
		)
		.join('');

	const bottles = lines.reduce((n, l) => n + l.qty, 0);
	const subtotal = lines.reduce((n, l) => n + l.qty * l.juice.price, 0);
	const min = settings?.delivery?.minBottles || 0;
	const day = weekdayName(settings?.delivery?.day ?? 1);
	const deliveryNote =
		settings?.delivery?.enabled && bottles < min
			? `<p class="drawer__hint">${icon('truck')} Add ${min - bottles} more bottle${min - bottles === 1 ? '' : 's'} to unlock ${day} delivery.</p><div class="drawer__progress"><span style="--w: ${Math.round((bottles / min) * 100)}%"></span></div>`
			: settings?.delivery?.enabled
				? `<p class="drawer__hint drawer__hint--ok">${icon('check')} Your order qualifies for ${day} delivery.</p>`
				: '';

	foot.innerHTML = `
		${deliveryNote}
		<div class="drawer__total"><span>Subtotal &middot; ${bottles} bottle${bottles === 1 ? '' : 's'}</span><strong>${money(subtotal)}</strong></div>
		<a href="/order" class="btn btn--lime btn--block">Checkout ${icon('arrowRight')}</a>`;
}

export function stepper(slug, qty) {
	return `
		<div class="stepper" data-stepper="${slug}">
			<button type="button" class="stepper__btn" data-step="-1" aria-label="Remove one">${icon('minus')}</button>
			<span class="stepper__value" aria-live="polite">${qty}</span>
			<button type="button" class="stepper__btn" data-step="1" aria-label="Add one">${icon('plus')}</button>
		</div>`;
}

export function openCart() {
	const drawer = document.getElementById('cart-drawer');
	drawer.hidden = false;
	requestAnimationFrame(() => drawer.classList.add('is-open'));
	document.documentElement.classList.add('no-scroll');
	drawer.querySelector('.drawer__panel button')?.focus();
}

function closeCart() {
	const drawer = document.getElementById('cart-drawer');
	drawer.classList.remove('is-open');
	document.documentElement.classList.remove('no-scroll');
	setTimeout(() => (drawer.hidden = true), 300);
}

let toastTimer;
export function toast(html, variant = '') {
	const el = document.querySelector('.toast');
	el.innerHTML = html;
	el.className = `toast${variant ? ` toast--${variant}` : ''}${el.classList.contains('is-visible') ? ' is-visible' : ''}`;
	el.hidden = false;
	requestAnimationFrame(() => el.classList.add('is-visible'));
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		el.classList.remove('is-visible');
		setTimeout(() => (el.hidden = true), 300);
	}, 2600);
}

/** Sends a little bottle from the button into the cart icon. */
function flyToCart(button) {
	const juice = juices.find(j => j.slug === button.dataset.add);
	const target = document.querySelector('.cart-btn');
	if (reducedMotion || !juice?.image || !target || !button.animate) return;
	const from = button.getBoundingClientRect();
	const to = target.getBoundingClientRect();
	const img = document.createElement('img');
	img.src = juice.imageSmall || juice.image;
	img.className = 'fly-bottle';
	img.style.left = `${from.left + from.width / 2 - 14}px`;
	img.style.top = `${from.top - 40}px`;
	document.body.append(img);
	const dx = to.left + to.width / 2 - (from.left + from.width / 2);
	const dy = to.top - from.top + 20;
	img
		.animate(
			[
				{ transform: 'translate(0, 0) scale(0.6) rotate(0deg)', opacity: 0 },
				{ transform: `translate(${dx * 0.35}px, ${Math.min(dy, 0) - 90}px) scale(1) rotate(-12deg)`, opacity: 1, offset: 0.35 },
				{ transform: `translate(${dx}px, ${dy}px) scale(0.25) rotate(20deg)`, opacity: 0.9 }
			],
			{ duration: 850, easing: 'cubic-bezier(0.5, 0, 0.3, 1)' }
		)
		.finished.then(() => {
			img.remove();
			target.classList.remove('is-bumped');
			void target.offsetWidth;
			target.classList.add('is-bumped');
		});
}

function updateBadge() {
	const count = cartCount();
	document.querySelectorAll('[data-cart-count]').forEach(badge => {
		badge.textContent = count;
		badge.hidden = count === 0;
	});
}

function bindCart() {
	document.addEventListener('click', event => {
		const add = event.target.closest('[data-add]');
		if (add) {
			const qty = Number(add.dataset.qty || 1);
			addToCart(add.dataset.add, qty);
			flashAdded(add);
			flyToCart(add);
			const juice = juices.find(j => j.slug === add.dataset.add);
			toast(
				`${juice?.image ? `<img class="toast__thumb" src="${e(juice.image)}" alt="">` : `<span class="toast__thumb">${icon('check')}</span>`}
				<span class="toast__text"><small>${icon('check')} Added to cart</small><strong>${qty > 1 ? `${qty} &times; ` : ''}${e(juice?.name || 'Juice')}</strong></span>
				<button type="button" class="toast__link" data-cart-open>View cart ${icon('arrowRight')}</button>`,
				'cart'
			);
			return;
		}
		if (event.target.closest('[data-cart-open]')) return openCart();
		if (event.target.closest('[data-cart-close]')) return closeCart();

		const step = event.target.closest('[data-stepper] [data-step]');
		if (step && step.closest('#cart-drawer, [data-order-lines]')) {
			const slug = step.closest('[data-stepper]').dataset.stepper;
			setQty(slug, (getCart()[slug] || 0) + Number(step.dataset.step));
		}
	});

	document.addEventListener('keydown', event => {
		if (event.key === 'Escape' && !document.getElementById('cart-drawer').hidden) closeCart();
	});

	window.addEventListener('cart:change', () => {
		updateBadge();
		renderDrawer();
	});
	updateBadge();
}

/*=============== MOTION ===============*/
/** Adds `is-revealed` as elements scroll into view; CSS owns the animation. */
export function revealOnScroll(root = document) {
	const items = [...root.querySelectorAll('[data-reveal]:not(.is-revealed)')];
	if (reducedMotion || !('IntersectionObserver' in window)) {
		items.forEach(el => el.classList.add('is-revealed'));
		return;
	}
	const observer = new IntersectionObserver(
		entries => {
			entries
				.filter(entry => entry.isIntersecting)
				.forEach((entry, i) => {
					entry.target.style.setProperty('--reveal-i', i);
					entry.target.classList.add('is-revealed');
					observer.unobserve(entry.target);
				});
		},
		{ threshold: 0.01, rootMargin: '0px 0px -6% 0px' }
	);
	items.forEach(el => observer.observe(el));
}

/** Layers with data-depth drift by that many px as the pointer moves over their section. */
export function initParallax(root = document) {
	if (reducedMotion || !finePointer) return;
	root.querySelectorAll('[data-parallax]').forEach(scene => {
		if (scene.dataset.parallaxBound) return;
		scene.dataset.parallaxBound = '1';
		const area = scene.closest('section, article') || scene;
		let frame = null;
		area.addEventListener('pointermove', event => {
			if (frame) return;
			frame = requestAnimationFrame(() => {
				const rect = area.getBoundingClientRect();
				scene.style.setProperty('--px', ((event.clientX - rect.left) / rect.width - 0.5).toFixed(3));
				scene.style.setProperty('--py', ((event.clientY - rect.top) / rect.height - 0.5).toFixed(3));
				frame = null;
			});
		});
		area.addEventListener('pointerleave', () => {
			scene.style.setProperty('--px', 0);
			scene.style.setProperty('--py', 0);
		});
	});
}

/*=============== BOOT ===============*/
// Static markup can ask for an icon with <span data-icon="name"></span>
export const fillIcons = (root = document) => root.querySelectorAll('[data-icon]:empty').forEach(el => (el.innerHTML = icon(el.dataset.icon)));

document.documentElement.classList.add('js');
renderHeader();
fillIcons();
renderDrawerShell();
bindCart();

/** Resolves with the catalog once the shared chrome has been rendered with it. */
export const ready = loadCatalog().then(catalog => {
	juices = catalog.juices;
	settings = catalog.settings;
	copy = catalog.copy || DEFAULT_COPY;
	applyCopy();
	applyIngredientPhotos();
	renderAnnouncement(settings);
	renderFooter(settings);
	renderDrawer();
	const navJuices = document.querySelector('[data-nav-juices]');
	if (navJuices) navJuices.innerHTML = juices.map(navTile).join('');
	return catalog;
});

// Wait a frame so each page's own ready handler has rendered its content first
ready.then(() =>
	requestAnimationFrame(() => {
		fillIcons();
		applyIngredientPhotos();
		revealOnScroll();
		initParallax();
		document.documentElement.classList.add('is-ready');
	})
);
