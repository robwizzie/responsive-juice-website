import JuiceShowcase from '/assets/js/components/juice-showcase.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/*=============== SHOWCASE ===============*/
new JuiceShowcase(document.querySelector('[data-juice-showcase]'), {
	juices,
	accent: document.querySelector('[data-showcase-accent]')
});

/*=============== HERO INTRO ANIMATIONS ===============*/
// Builds the "bottle drops in" timeline for a hero section. Timelines are created paused
// so the start state is applied immediately and nothing flashes before it plays.
function buildIntro(section) {
	const q = selector => section.querySelectorAll(selector);
	const drop = { opacity: 0, y: -600, ease: 'expo.out', duration: 1.4 };

	return gsap
		.timeline({ paused: true, defaults: { ease: 'expo.out', duration: 1 } })
		.from(q('.hero__eyebrow, .home__title, .home__description, .hero__actions'), { opacity: 0, y: 30, stagger: 0.1 })
		.from(q('.home__liquid'), { opacity: 0, y: 160, scale: 0.85 }, 0.2)
		.from(q('.home__juice-animate'), drop, 0.45)
		.from(q('.home__apple1, .home__apple2'), { ...drop, stagger: 0.1 }, 0.6)
		.from(q('.home__leaf'), { ...drop, rotation: 90, stagger: 0.06 }, 0.55);
}

function initIntros() {
	if (reducedMotion || typeof gsap === 'undefined') return;

	const [hero, ...rest] = document.querySelectorAll('[data-intro]');
	const heroIntro = buildIntro(hero);

	// Wait for the page loader to clear so the hero animation is actually seen
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
// Layers move by `data-depth` px per unit of pointer offset from the section centre.
function initParallax() {
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

initIntros();
initParallax();
