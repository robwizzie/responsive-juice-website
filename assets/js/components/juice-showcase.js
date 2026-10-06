/**
 * JuiceShowcase
 * An infinite, swipeable juice carousel used on the homepage and juice detail pages.
 *
 * Every bottle is absolutely positioned and gets a `data-pos` attribute describing its
 * distance from the active bottle (-2 … 2, or "hidden"). CSS turns that into the layout,
 * so moving the carousel only means updating attributes – no clones, no pixel maths.
 *
 * Usage:
 *   new JuiceShowcase(element, { juices, exclude: 'tropical-storm', accent: headingSpan });
 */

const AUTOPLAY_MS = 5000;
const SWIPE_THRESHOLD = 50;
const VISIBLE_RANGE = 2;

const ingredientIcon = name => `/assets/img/ingredients/${name.toLowerCase().replace(/ /g, '-')}.svg`;
const pad = n => String(n).padStart(2, '0');
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default class JuiceShowcase {
	constructor(root, { juices = [], exclude = null, accent = null } = {}) {
		this.root = root;
		this.juices = juices.filter(juice => juice.slug !== exclude);
		this.accent = accent;
		this.index = 0;
		this.autoplay = !prefersReducedMotion();

		if (!this.root || this.juices.length === 0) return;

		this.render();
		this.bindEvents();
		this.goTo(0, { direction: 0 });
	}

	/*=============== RENDERING ===============*/

	render() {
		this.root.classList.add('showcase');
		this.root.setAttribute('role', 'region');
		this.root.setAttribute('aria-roledescription', 'carousel');
		this.root.setAttribute('aria-label', 'Juice showcase');
		this.root.tabIndex = 0;

		this.root.innerHTML = `
			<p class="showcase__backdrop" aria-hidden="true"></p>

			<div class="showcase__stage">
				<div class="showcase__splashes" aria-hidden="true">
					${this.juices.map(juice => `<img src="/assets/img/splash/${juice.slug}-splash.svg" alt="" class="showcase__splash" loading="lazy" decoding="async">`).join('')}
				</div>
				<ul class="showcase__track">
					${this.juices.map(juice => this.itemTemplate(juice)).join('')}
				</ul>
			</div>

			<div class="showcase__info" aria-live="polite"></div>

			<div class="showcase__controls">
				<button type="button" class="showcase__arrow" data-step="-1" aria-label="Previous juice">
					<i class="ri-arrow-left-line"></i>
				</button>
				<div class="showcase__dots">
					${this.juices.map((juice, i) => `<button type="button" class="showcase__dot" data-index="${i}" aria-label="Show ${juice.name}"><span></span></button>`).join('')}
				</div>
				<button type="button" class="showcase__arrow" data-step="1" aria-label="Next juice">
					<i class="ri-arrow-right-line"></i>
				</button>
			</div>
		`;

		this.root.style.setProperty('--autoplay-ms', `${AUTOPLAY_MS}ms`);
		this.root.classList.toggle('is-autoplay', this.autoplay);

		this.backdrop = this.root.querySelector('.showcase__backdrop');
		this.stage = this.root.querySelector('.showcase__stage');
		this.track = this.root.querySelector('.showcase__track');
		this.info = this.root.querySelector('.showcase__info');
		this.items = [...this.root.querySelectorAll('.showcase__item')];
		this.splashes = [...this.root.querySelectorAll('.showcase__splash')];
		this.dots = [...this.root.querySelectorAll('.showcase__dot')];
	}

	itemTemplate(juice) {
		const garnish = juice.ingredients
			.slice(0, 2)
			.map((name, i) => `<img src="${ingredientIcon(name)}" alt="" class="showcase__garnish showcase__garnish--${i + 1}" loading="lazy" decoding="async">`)
			.join('');

		return `
			<li class="showcase__item">
				<a href="/juices/${juice.slug}" class="showcase__link" draggable="false">
					${garnish}
					<img src="${juice.imageUrl}" alt="${juice.name}" class="showcase__bottle" draggable="false" decoding="async">
				</a>
			</li>
		`;
	}

	infoTemplate(juice) {
		return `
			<p class="showcase__count">${pad(this.index + 1)} <span>/ ${pad(this.juices.length)}</span></p>
			<h3 class="showcase__name">${juice.name}</h3>
			<ul class="showcase__ingredients">
				${juice.ingredients
					.map(
						(name, i) => `
					<li class="showcase__ingredient" style="--i: ${i}">
						<img src="${ingredientIcon(name)}" alt="" loading="lazy" decoding="async">
						${name}
					</li>`
					)
					.join('')}
			</ul>
			<a href="/juices/${juice.slug}" class="showcase__cta">
				Explore ${juice.name} <i class="ri-arrow-right-up-line"></i>
			</a>
		`;
	}

	/*=============== STATE ===============*/

	// Shortest signed distance from the active index, so the carousel wraps both ways.
	offsetOf(i) {
		const count = this.juices.length;
		let offset = (i - this.index + count) % count;
		if (offset > count / 2) offset -= count;
		return offset;
	}

	goTo(index, { direction = 1 } = {}) {
		const count = this.juices.length;
		this.index = (index + count) % count;
		const juice = this.juices[this.index];

		this.items.forEach((item, i) => {
			const offset = this.offsetOf(i);
			const visible = Math.abs(offset) <= VISIBLE_RANGE;
			item.dataset.pos = visible ? offset : offset < 0 ? 'hidden-left' : 'hidden-right';
			item.setAttribute('aria-hidden', String(offset !== 0));
			item.querySelector('a').tabIndex = offset === 0 ? 0 : -1;
		});

		this.splashes.forEach((splash, i) => splash.classList.toggle('is-active', i === this.index));
		this.dots.forEach((dot, i) => {
			dot.classList.toggle('is-active', i === this.index);
			dot.setAttribute('aria-current', String(i === this.index));
		});

		this.root.style.setProperty('--juice-color', juice.color);
		this.root.dataset.direction = direction < 0 ? 'prev' : 'next';
		this.backdrop.textContent = juice.name;
		this.info.innerHTML = this.infoTemplate(juice);

		// Restart the enter animations on the freshly rendered info + backdrop
		this.root.classList.remove('is-changing');
		void this.root.offsetWidth;
		this.root.classList.add('is-changing');

		if (this.accent) this.accent.style.color = juice.color;
	}

	step(delta) {
		this.goTo(this.index + delta, { direction: delta });
	}

	/*=============== EVENTS ===============*/

	bindEvents() {
		this.root.addEventListener('click', event => {
			const arrow = event.target.closest('.showcase__arrow');
			const dot = event.target.closest('.showcase__dot');
			const item = event.target.closest('.showcase__item');
			const wasDrag = this.dragged;
			this.dragged = false;

			if (arrow) this.step(Number(arrow.dataset.step));
			else if (dot) {
				const target = Number(dot.dataset.index);
				this.goTo(target, { direction: target - this.index });
			} else if (item && (wasDrag || item.dataset.pos !== '0')) {
				// A swipe never follows the link; side bottles bring themselves to the front instead
				event.preventDefault();
				if (!wasDrag) this.step(Number(item.dataset.pos));
			}
		});

		this.root.addEventListener('keydown', event => {
			if (event.key === 'ArrowLeft') this.step(-1);
			else if (event.key === 'ArrowRight') this.step(1);
			else return;
			event.preventDefault();
		});

		this.bindDrag();
		this.bindAutoplay();
	}

	bindDrag() {
		let startX = 0;
		let startY = 0;
		let pointerId = null;

		const reset = () => {
			pointerId = null;
			this.root.classList.remove('is-dragging');
			this.track.style.removeProperty('--drag');
		};

		this.stage.addEventListener('pointerdown', event => {
			if (event.button !== 0) return;
			pointerId = event.pointerId;
			startX = event.clientX;
			startY = event.clientY;
			this.dragged = false;
		});

		this.stage.addEventListener('pointermove', event => {
			if (event.pointerId !== pointerId) return;
			const dx = event.clientX - startX;
			const dy = event.clientY - startY;

			if (!this.dragged) {
				// Let vertical scrolling win until the gesture is clearly horizontal
				if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
				this.dragged = true;
				this.root.classList.add('is-dragging');
				this.stage.setPointerCapture(pointerId);
			}
			this.track.style.setProperty('--drag', `${dx * 0.6}px`);
		});

		const end = event => {
			if (event.pointerId !== pointerId) return;
			const dx = event.clientX - startX;
			if (this.dragged && Math.abs(dx) > SWIPE_THRESHOLD) this.step(dx < 0 ? 1 : -1);
			reset();
		};

		this.stage.addEventListener('pointerup', end);
		this.stage.addEventListener('pointercancel', reset);
	}

	bindAutoplay() {
		if (!this.autoplay) return;

		// The active dot's fill animation doubles as the autoplay timer,
		// so pausing is just pausing that animation via the `is-paused` class.
		this.root.addEventListener('animationend', event => {
			if (event.animationName === 'showcase-progress') this.step(1);
		});

		const pauseReasons = new Set();
		const setPaused = (reason, paused) => {
			paused ? pauseReasons.add(reason) : pauseReasons.delete(reason);
			const isPaused = pauseReasons.size > 0;
			this.root.classList.toggle('is-paused', isPaused);
			// Only announce slide changes the user caused, not timed ones
			this.info.setAttribute('aria-live', isPaused ? 'polite' : 'off');
		};

		this.root.addEventListener('pointerenter', event => event.pointerType === 'mouse' && setPaused('hover', true));
		this.root.addEventListener('pointerleave', () => setPaused('hover', false));
		this.root.addEventListener('focusin', () => setPaused('focus', true));
		this.root.addEventListener('focusout', event => !this.root.contains(event.relatedTarget) && setPaused('focus', false));

		new IntersectionObserver(([entry]) => setPaused('offscreen', !entry.isIntersecting), { threshold: 0.35 }).observe(this.root);
	}
}
