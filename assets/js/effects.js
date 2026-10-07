/**
 * Shared motion helpers for the homepage and juice pages.
 * Everything here is skipped when the visitor prefers reduced motion.
 */

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/*=============== HERO INTROS ===============*/
// Builds the "bottle drops in" timeline for a hero section. Timelines are created paused
// so the start state is applied immediately and nothing flashes before it plays.
function buildIntro(section) {
	const q = selector => section.querySelectorAll(selector);
	const drop = { opacity: 0, y: -600, ease: 'expo.out', duration: 1.4 };

	return gsap
		.timeline({ paused: true, defaults: { ease: 'expo.out', duration: 1 } })
		.from(q('.hero__eyebrow, .home__title, .home__description, .hero__actions, [data-intro-item]'), { opacity: 0, y: 30, stagger: 0.1 })
		.from(q('.home__liquid'), { opacity: 0, y: 160, scale: 0.85 }, 0.2)
		.from(q('.home__juice-animate'), drop, 0.45)
		.from(q('.home__apple1, .home__apple2'), { ...drop, stagger: 0.1 }, 0.6)
		.from(q('.home__leaf'), { ...drop, rotation: 90, stagger: 0.06 }, 0.55);
}

// The first [data-intro] section plays once the page loader clears; the rest play when scrolled to.
export function initIntros() {
	if (reducedMotion || typeof gsap === 'undefined') return;

	const [hero, ...rest] = document.querySelectorAll('[data-intro]');
	if (!hero) return;
	const heroIntro = buildIntro(hero);

	if (document.documentElement.classList.contains('page-loading')) {
		window.addEventListener('page:ready', () => heroIntro.play(), { once: true });
	} else {
		heroIntro.play();
	}

	const observer = new IntersectionObserver(
		entries => {
			entries.forEach(entry => {
				if (!entry.isIntersecting) return;
				entry.target.intro.play();
				observer.unobserve(entry.target);
			});
		},
		{ threshold: 0.3 }
	);

	rest.forEach(section => {
		section.intro = buildIntro(section);
		observer.observe(section);
	});
}

/*=============== POINTER PARALLAX ===============*/
// Layers with a `--depth` style move by that many px per unit of pointer offset from the section centre.
export function initParallax() {
	if (reducedMotion || !finePointer) return;

	document.querySelectorAll('[data-parallax]').forEach(scene => {
		const section = scene.closest('section');
		let frame = null;

		section.addEventListener('pointermove', event => {
			if (frame) return;
			frame = requestAnimationFrame(() => {
				const rect = section.getBoundingClientRect();
				scene.style.setProperty('--px', ((event.clientX - rect.left) / rect.width - 0.5).toFixed(3));
				scene.style.setProperty('--py', ((event.clientY - rect.top) / rect.height - 0.5).toFixed(3));
				frame = null;
			});
		});

		section.addEventListener('pointerleave', () => {
			scene.style.setProperty('--px', 0);
			scene.style.setProperty('--py', 0);
		});
	});
}

/*=============== SCROLL REVEAL ===============*/
// Adds `is-revealed` as elements scroll into view; CSS owns the actual animation.
// Elements revealed together get a stagger index (--reveal-i) for cascading delays.
export function revealOnScroll(elements) {
	const list = [...elements];
	if (reducedMotion || !('IntersectionObserver' in window)) {
		list.forEach(el => el.classList.add('is-revealed'));
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
		{ threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
	);
	list.forEach(el => observer.observe(el));
}

/*=============== CARD TILT ===============*/
// Subtle 3D tilt that follows the pointer; CSS reads --tilt-x / --tilt-y (in degrees).
export function tiltOnHover(cards, maxDegrees = 6) {
	if (reducedMotion || !finePointer) return;

	[...cards].forEach(card => {
		let frame = null;
		card.addEventListener('pointermove', event => {
			if (frame) return;
			frame = requestAnimationFrame(() => {
				const rect = card.getBoundingClientRect();
				const x = (event.clientX - rect.left) / rect.width - 0.5;
				const y = (event.clientY - rect.top) / rect.height - 0.5;
				card.style.setProperty('--tilt-x', `${(-y * maxDegrees).toFixed(2)}deg`);
				card.style.setProperty('--tilt-y', `${(x * maxDegrees).toFixed(2)}deg`);
				frame = null;
			});
		});
		card.addEventListener('pointerleave', () => {
			card.style.setProperty('--tilt-x', '0deg');
			card.style.setProperty('--tilt-y', '0deg');
		});
	});
}
