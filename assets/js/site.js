/**
 * Shared page chrome: announcement bar, header, cart drawer, footer, and the small
 * motion helpers. Every public page imports this first.
 */
import { loadCatalog, escapeHtml as e } from './lib/catalog.js';
import { addToCart, cartCount, cartLines, getCart, setQty } from './lib/cart.js';
import { flashAdded, money } from './lib/components.js';
import { icon } from './lib/icons.js';

const NAV = [
	{ href: '/juices', label: 'Menu', match: ['/juices'] },
	{ href: '/about', label: 'About', match: ['/about'] },
	{ href: '/contact', label: 'Contact', match: ['/contact'] }
];

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/*=============== HEADER ===============*/
function renderHeader() {
	const path = location.pathname.replace(/\.html$/, '');
	const links = NAV.map(link => {
		const active = link.match.some(m => path === m || path.startsWith(`${m}/`));
		return `<a href="${link.href}" class="nav__link${active ? ' is-active' : ''}"${active ? ' aria-current="page"' : ''}>${link.label}</a>`;
	}).join('');

	document.body.insertAdjacentHTML(
		'afterbegin',
		`<a class="skip-link" href="#main">Skip to content</a>
		<div class="announcement" hidden></div>
		<header class="site-header">
			<div class="container site-header__inner">
				<a href="/" class="wordmark" aria-label="SiponPressed home">SiponPressed</a>
				<nav class="nav" id="site-nav" aria-label="Main">
					${links}
					<a href="/order" class="nav__link nav__link--order">Order</a>
				</nav>
				<div class="site-header__actions">
					<a href="/order" class="btn btn--lime btn--sm site-header__order">Order now</a>
					<button type="button" class="icon-btn cart-btn" data-cart-open aria-label="Open cart">
						${icon('cart')}<span class="cart-btn__count" data-cart-count hidden>0</span>
					</button>
					<button type="button" class="icon-btn nav-toggle" aria-expanded="false" aria-controls="site-nav" aria-label="Menu">
						${icon('menu')}
					</button>
				</div>
			</div>
		</header>`
	);

	const header = document.querySelector('.site-header');
	const toggle = header.querySelector('.nav-toggle');
	toggle.addEventListener('click', () => {
		const open = header.classList.toggle('is-open');
		toggle.setAttribute('aria-expanded', open);
		toggle.innerHTML = icon(open ? 'close' : 'menu');
	});

	const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
	onScroll();
	window.addEventListener('scroll', onScroll, { passive: true });
}

/*=============== FOOTER ===============*/
function renderFooter(settings) {
	const main = document.querySelector('main');
	const year = new Date().getFullYear();
	(main || document.body).insertAdjacentHTML(
		main ? 'afterend' : 'beforeend',
		`<footer class="site-footer">
			<div class="container">
				<div class="site-footer__top">
					<div class="site-footer__brand">
						<a href="/" class="wordmark wordmark--lg">SiponPressed</a>
						<p class="site-footer__tag">Embrace the sip.</p>
						<p class="site-footer__note">Real juice. Real health. Real you. Cold-pressed in small batches by Hunter in Philadelphia.</p>
					</div>
					<div class="site-footer__cols">
						<div>
							<h2 class="site-footer__title">Shop</h2>
							<a href="/juices">The menu</a>
							<a href="/order">Order pickup or delivery</a>
							<a href="/contact?topic=wholesale">Wholesale for cafes &amp; studios</a>
						</div>
						<div>
							<h2 class="site-footer__title">SiponPressed</h2>
							<a href="/about">About Hunter</a>
							<a href="/contact">Contact</a>
							<a href="https://instagram.com/${e(settings.instagram)}" target="_blank" rel="noopener">Instagram</a>
						</div>
						<div>
							<h2 class="site-footer__title">Say hi</h2>
							<a href="mailto:${e(settings.contactEmail)}" class="site-footer__contact">${icon('mail')} ${e(settings.contactEmail)}</a>
							<a href="https://instagram.com/${e(settings.instagram)}" target="_blank" rel="noopener" class="site-footer__contact">${icon('instagram')} @${e(settings.instagram)}</a>
						</div>
					</div>
				</div>
				<div class="site-footer__badges">
					<span>${icon('snow')} Cold pressed</span>
					<span>${icon('drop')} No added sugar</span>
					<span>${icon('leaf')} 100% plant based</span>
				</div>
				<div class="site-footer__bottom">
					<p>&copy; ${year} SiponPressed &middot; Philadelphia, PA</p>
					<p>Keep refrigerated &middot; Shake well</p>
				</div>
			</div>
		</footer>`
	);
}

/*=============== ANNOUNCEMENT ===============*/
function renderAnnouncement(settings) {
	const bar = document.querySelector('.announcement');
	const message = !settings.orderingEnabled ? 'Online ordering is paused for now. Message us on Instagram to grab a bottle.' : settings.announcement;
	if (!message) return;
	bar.textContent = message;
	bar.hidden = false;
}

/*=============== CART DRAWER ===============*/
let juices = [];
let settings = null;

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
		body.innerHTML = `<div class="drawer__empty"><p>Your cart is empty.</p><a href="/juices" class="btn btn--ink">Browse the menu</a></div>`;
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
	const deliveryNote =
		settings?.delivery?.enabled && bottles < min
			? `<p class="drawer__hint">${icon('truck')} Add ${min - bottles} more bottle${min - bottles === 1 ? '' : 's'} to unlock Monday delivery.</p>`
			: settings?.delivery?.enabled
				? `<p class="drawer__hint drawer__hint--ok">${icon('check')} Your order qualifies for Monday delivery.</p>`
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
export function toast(html) {
	const el = document.querySelector('.toast');
	el.innerHTML = html;
	el.hidden = false;
	requestAnimationFrame(() => el.classList.add('is-visible'));
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		el.classList.remove('is-visible');
		setTimeout(() => (el.hidden = true), 300);
	}, 2600);
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
			const juice = juices.find(j => j.slug === add.dataset.add);
			toast(`${icon('check')} <span>${qty > 1 ? `${qty} &times; ` : ''}${e(juice?.name || 'Juice')} added</span> <button type="button" class="toast__link" data-cart-open>View cart</button>`);
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
		{ threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
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

renderHeader();
fillIcons();
renderDrawerShell();
bindCart();

/** Resolves with the catalog once the shared chrome has been rendered with it. */
export const ready = loadCatalog().then(catalog => {
	juices = catalog.juices;
	settings = catalog.settings;
	renderAnnouncement(settings);
	renderFooter(settings);
	renderDrawer();
	return catalog;
});

// Wait a frame so each page's own ready handler has rendered its content first
ready.then(() =>
	requestAnimationFrame(() => {
		fillIcons();
		revealOnScroll();
		initParallax();
		document.documentElement.classList.add('is-ready');
	})
);
