/**
 * The two carousels:
 *  - flavorCarousel: the big home-page hero. The panel takes the active juice's color and the
 *    bottles line up to the right like a shelf; swipe, arrows, dots, keys and autoplay.
 *  - rail: a row of cards that scrolls sideways with snap, drag-to-scroll and arrow buttons.
 */
import { juiceStatus } from '../shared/catalog.js';
import { escapeHtml as e } from './catalog.js';
import { bottleImage, garnishFor, money, onColor, statusStamp } from './components.js';
import { icon } from './icons.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const AUTOPLAY_MS = 6500;
const pad = n => String(n).padStart(2, '0');

function slide(juice, i, total) {
	const status = juiceStatus(juice);
	const actions =
		status === 'available'
			? `<button type="button" class="btn btn--ink btn--lg" data-add="${juice.slug}">${icon('plus')} Add &middot; ${money(juice.price)}</button>
				<a href="/juices/${juice.slug}" class="btn btn--ghost btn--lg">Details</a>`
			: `${statusStamp(juice)}<a href="/juices/${juice.slug}" class="btn btn--ghost btn--lg">Take a look</a>`;
	return `
		<div class="flavors__slide" data-slide="${i}" aria-roledescription="slide" aria-label="${i + 1} of ${total}">
			<p class="flavors__count">${pad(i + 1)} / ${pad(total)}</p>
			<h2 class="flavors__name">${e(juice.name)}</h2>
			<p class="flavors__tagline">${e(juice.tagline || juice.ingredients.join(', '))}</p>
			<div class="flavors__actions">${actions}</div>
		</div>`;
}

function item(juice, i) {
	const [fruitA, fruitB] = garnishFor(juice);
	const splash = juice.splash && juice.splash !== 'none' ? `<img src="/assets/img/splash/${juice.splash}.webp" alt="" class="flavors__splash" loading="lazy" decoding="async">` : '';
	const fruit = (src, cls) => (src ? `<span class="flavors__fruit ${cls}"><img src="${src}" alt="" decoding="async"></span>` : '');
	return `
		<div class="flavors__item is-${juiceStatus(juice)}" data-item="${i}" role="button" tabindex="-1" aria-label="Show ${e(juice.name)}">
			${splash}
			${fruit(fruitA, 'flavors__fruit--a')}
			${fruit(fruitB, 'flavors__fruit--b')}
			${bottleImage(juice, { eager: i < 2, className: 'flavors__bottle' })}
			${statusStamp(juice, { className: 'flavors__tag' })}
		</div>`;
}

export function flavorCarousel(root, juices) {
	if (!juices.length) return;
	const n = juices.length;
	root.innerHTML = `
		<div class="flavors__panel">
			<div class="flavors__copy" aria-live="polite">${juices.map((j, i) => slide(j, i, n)).join('')}</div>
			<div class="flavors__controls"${n < 2 ? ' hidden' : ''}>
				<button type="button" class="icon-btn flavors__arrow" data-prev aria-label="Previous juice">${icon('arrowLeft')}</button>
				<button type="button" class="icon-btn flavors__arrow" data-next aria-label="Next juice">${icon('arrowRight')}</button>
				<div class="flavors__dots">${juices.map((j, i) => `<button type="button" class="flavors__dot" data-dot="${i}" aria-label="${e(j.name)}"></button>`).join('')}</div>
			</div>
		</div>
		<p class="flavors__word" aria-hidden="true"></p>
		<div class="flavors__stage">
			<span class="flavors__disc" aria-hidden="true"></span>
			${juices.map(item).join('')}
		</div>`;
	root.setAttribute('aria-roledescription', 'carousel');
	root.style.setProperty('--autoplay', `${AUTOPLAY_MS}ms`);

	const word = root.querySelector('.flavors__word');
	const items = [...root.querySelectorAll('[data-item]')];
	const slides = [...root.querySelectorAll('[data-slide]')];
	const dots = [...root.querySelectorAll('[data-dot]')];
	const offsets = items.map((_, i) => i);
	const pending = new Map();
	let active = 0;

	const offsetOf = i => (i - active + n) % n;

	function place(el, o) {
		el.dataset.o = o;
		el.style.setProperty('--o', o);
		el.classList.toggle('is-far', o > 3);
		el.tabIndex = o > 0 && o <= 2 ? 0 : -1;
	}

	/** Moves without animating, then lets it fade/slide from there. */
	function snap(el, from, to) {
		el.classList.add('no-anim');
		el.style.opacity = '0';
		place(el, from);
		void el.offsetWidth;
		el.classList.remove('no-anim');
		el.style.opacity = '';
		place(el, to);
	}

	function render(dir) {
		const juice = juices[active];
		root.style.setProperty('--flavor', juice.color);
		root.style.setProperty('--on-flavor', onColor(juice.color));
		// The flavor's last word set huge behind the bottles ("ORANGE"), re-stamped on every change
		word.textContent = juice.name.split(' ').pop();
		word.style.setProperty('--len', word.textContent.length);
		word.classList.remove('is-in');
		void word.offsetWidth;
		word.classList.add('is-in');
		slides.forEach((s, i) => {
			s.classList.toggle('is-active', i === active);
			s.setAttribute('aria-hidden', i !== active);
		});
		dots.forEach((d, i) => {
			d.classList.toggle('is-active', i === active);
			d.setAttribute('aria-current', i === active);
			// Restart the autoplay fill
			if (i === active) {
				d.classList.remove('is-active');
				void d.offsetWidth;
				d.classList.add('is-active');
			}
		});

		items.forEach((el, i) => {
			clearTimeout(pending.get(el));
			const prev = offsets[i];
			const next = offsetOf(i);
			offsets[i] = next;
			if (dir > 0 && prev === 0 && next === n - 1 && n > 1) {
				// The bottle that was in front slides away to the left, then rejoins the end of the line
				place(el, -1);
				pending.set(
					el,
					setTimeout(() => snap(el, n - 1, n - 1), 650)
				);
			} else if (dir < 0 && prev === n - 1 && next === 0 && n > 1) {
				snap(el, -1, 0);
			} else {
				place(el, next);
			}
		});
	}

	function step(dir) {
		active = (active + dir + n) % n;
		render(dir);
	}

	let hopTimer;
	function go(target) {
		clearInterval(hopTimer);
		const forward = (target - active + n) % n;
		const dir = forward <= n / 2 ? 1 : -1;
		let hops = dir > 0 ? forward : n - forward;
		if (!hops) return;
		step(dir);
		hops--;
		if (hops) hopTimer = setInterval(() => (step(dir), --hops || clearInterval(hopTimer)), 160);
	}

	/* Autoplay: pauses on hover, focus, when off screen or the tab is hidden */
	let timer;
	let visible = true;
	const paused = () => root.matches(':hover, :focus-within') || !visible || document.hidden;
	function schedule() {
		clearTimeout(timer);
		if (reducedMotion || n < 2) return root.classList.add('no-autoplay');
		timer = setTimeout(function tick() {
			if (paused()) {
				root.classList.add('is-paused');
				timer = setTimeout(tick, 400);
				return;
			}
			root.classList.remove('is-paused');
			step(1);
			schedule();
		}, AUTOPLAY_MS);
	}
	root.addEventListener('pointerenter', () => root.classList.add('is-paused'));
	root.addEventListener('pointerleave', () => root.classList.remove('is-paused'));
	new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { threshold: 0.3 }).observe(root);

	const user = fn => (...args) => {
		fn(...args);
		schedule();
	};

	root.querySelector('[data-prev]').addEventListener('click', user(() => step(-1)));
	root.querySelector('[data-next]').addEventListener('click', user(() => step(1)));
	dots.forEach(dot => dot.addEventListener('click', user(() => go(Number(dot.dataset.dot)))));
	items.forEach((el, i) => {
		const pick = user(() => offsets[i] !== 0 && go(i));
		el.addEventListener('click', pick);
		el.addEventListener('keydown', event => (event.key === 'Enter' || event.key === ' ') && (event.preventDefault(), pick()));
	});
	root.addEventListener(
		'keydown',
		user(event => {
			if (event.target.closest('input, textarea')) return;
			if (event.key === 'ArrowRight') step(1);
			if (event.key === 'ArrowLeft') step(-1);
		})
	);

	/* Swipe / drag */
	let startX = null;
	let startY = 0;
	root.addEventListener('pointerdown', event => {
		if (event.button !== 0 || event.target.closest('button, a')) return;
		startX = event.clientX;
		startY = event.clientY;
	});
	window.addEventListener('pointerup', event => {
		if (startX === null) return;
		const dx = event.clientX - startX;
		const dy = event.clientY - startY;
		startX = null;
		if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) user(() => step(dx < 0 ? 1 : -1))();
	});

	render(0);
	schedule();
}

/** Sideways card row: arrows scroll by a card, mouse users can drag it. */
export function rail(root) {
	const track = root.querySelector('.rail__track');
	const prev = root.querySelector('[data-rail-prev]');
	const next = root.querySelector('[data-rail-next]');
	if (!track) return;

	const by = () => (track.firstElementChild?.getBoundingClientRect().width || 300) + 20;
	prev?.addEventListener('click', () => track.scrollBy({ left: -by(), behavior: 'smooth' }));
	next?.addEventListener('click', () => track.scrollBy({ left: by(), behavior: 'smooth' }));

	const update = () => {
		const max = track.scrollWidth - track.clientWidth - 4;
		if (prev) prev.disabled = track.scrollLeft <= 4;
		if (next) next.disabled = track.scrollLeft >= max;
		root.classList.toggle('is-static', max <= 0);
	};
	track.addEventListener('scroll', update, { passive: true });
	window.addEventListener('resize', update);
	update();

	// Drag to scroll with a mouse (touch already scrolls natively)
	let down = null;
	let moved = false;
	track.addEventListener('pointerdown', event => {
		if (event.pointerType !== 'mouse' || event.button !== 0) return;
		down = { x: event.clientX, left: track.scrollLeft };
		moved = false;
	});
	window.addEventListener('pointermove', event => {
		if (!down) return;
		const dx = event.clientX - down.x;
		if (!moved && Math.abs(dx) < 6) return;
		moved = true;
		track.classList.add('is-dragging');
		track.scrollLeft = down.left - dx;
	});
	window.addEventListener('pointerup', () => {
		if (!down) return;
		down = null;
		if (!moved) return;
		// Let it settle onto the nearest card
		track.classList.remove('is-dragging');
		const width = by();
		track.scrollTo({ left: Math.round(track.scrollLeft / width) * width, behavior: 'smooth' });
	});
	track.addEventListener('click', event => moved && (event.preventDefault(), event.stopPropagation(), (moved = false)), true);
}
