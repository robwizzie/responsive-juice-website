/**
 * The site header markup. Pure, so the same function renders it in the browser and bakes it
 * into each page's HTML (scripts/bake-header.mjs), which lets the header paint before any JS runs.
 */
import { wordmark } from './brand.js';
import { icon } from './icons.js';

export const NAV = [
	{ href: '/', label: 'Home', match: ['/', '/index'], exact: true },
	{ href: '/juices', label: 'Juices', match: ['/juices'] },
	{ href: '/about', label: 'About', match: ['/about'] },
	{ href: '/contact', label: 'Contact', match: ['/contact'] }
];

export function headerHTML(pathname = '/') {
	const path = pathname.replace(/\.html$/, '');
	const links = NAV.map(link => {
		const active = link.match.some(m => path === m || (!link.exact && path.startsWith(`${m}/`)));
		return `<a href="${link.href}" class="nav__link${active ? ' is-active' : ''}"${active ? ' aria-current="page"' : ''}><span>${link.label}</span>${icon('arrowRight')}</a>`;
	}).join('');

	return `<a class="skip-link" href="#main">Skip to content</a>
<div class="announcement" hidden></div>
<header class="site-header">
	<div class="container site-header__inner">
		<a href="/" class="wordmark" aria-label="SiponPressed home">${wordmark('SiponPressed')}</a>
		<nav class="nav" id="site-nav" aria-label="Main">
			<div class="nav__links">${links}</div>
			<div class="nav__juices">
				<p class="nav__label">The juices</p>
				<div class="nav__tiles" data-nav-juices></div>
			</div>
			<a href="/order" class="btn btn--ink btn--lg nav__cta">Order now ${icon('arrowRight')}</a>
		</nav>
		<div class="site-header__actions">
			<a href="/order" class="btn btn--ink btn--sm site-header__order">Order now</a>
			<button type="button" class="icon-btn cart-btn" data-cart-open aria-label="Open cart">
				${icon('cart')}<span class="cart-btn__count" data-cart-count hidden>0</span>
			</button>
			<button type="button" class="icon-btn nav-toggle" aria-expanded="false" aria-controls="site-nav" aria-label="Menu">
				${icon('menu')}
			</button>
		</div>
	</div>
</header>`;
}
