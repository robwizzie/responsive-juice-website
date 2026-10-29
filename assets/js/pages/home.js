import { ready, t } from '../site.js';
import { flavorCarousel } from '../lib/carousel.js';
import { bottleImage, garnishFor, statusStamp, shippingNote, waysToOrder } from '../lib/components.js';
import { escapeHtml as e } from '../lib/catalog.js';
import { juiceStatus } from '../shared/catalog.js';

/** One bottle in the hero, standing over its splash with two ingredients floating by. */
function heroBottle(juice, i) {
	const [fruitA, fruitB] = garnishFor(juice);
	const fruit = (src, cls) => (src ? `<span class="hero__fruit ${cls}"><img src="${src}" alt="" decoding="async"></span>` : '');
	const splash = juice.splash && juice.splash !== 'none' ? `<img src="/assets/img/splash/${juice.splash}.webp" alt="" class="hero__splash" decoding="async">` : '';
	return `
		<a href="/juices/${juice.slug}" class="hero__bottle is-${juiceStatus(juice)}" style="--c: ${juice.color}; --i: ${i}" aria-label="${e(juice.name)}">
			${splash}
			${fruit(fruitA, 'hero__fruit--a')}
			${fruit(fruitB, 'hero__fruit--b')}
			${bottleImage(juice, { eager: true, className: 'hero__img' })}
			${statusStamp(juice, { className: 'hero__stamp' })}
		</a>`;
}

/** Plays the hero entrance once the bottle photos are ready, on every load. */
function playHero(hero) {
	hero.classList.remove('is-in');
	const imgs = [...hero.querySelectorAll('.hero__img')].filter(img => img.tagName === 'IMG');
	const ready = imgs.map(img => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()));
	const timeout = new Promise(resolve => setTimeout(resolve, 1500));
	Promise.race([Promise.all(ready), timeout]).then(() => requestAnimationFrame(() => hero.classList.add('is-in')));
}

const hero = document.querySelector('[data-hero]');
playHero(hero);
// Coming back with the browser's back button restores the page as it was; replay the entrance
window.addEventListener('pageshow', event => event.persisted && playHero(hero));

ready.then(({ juices, settings, copy }) => {
	// The hero ships with the three launch bottles; rebuild it only if Hunter's menu differs
	const trio = document.querySelector('[data-hero-trio]');
	const shown = juices.slice(0, 3);
	const current = [...trio.querySelectorAll('.hero__bottle')].map(a => a.getAttribute('href')).join();
	const wanted = shown.map(j => `/juices/${j.slug}`).join();
	const changed = shown.some((j, i) => juiceStatus(j) !== 'available' || !trio.querySelectorAll('.hero__img')[i]?.src?.endsWith(j.image));
	if (shown.length && (current !== wanted || changed)) {
		trio.innerHTML = shown.map(heroBottle).join('');
		playHero(hero);
	}

	flavorCarousel(document.querySelector('[data-flavors]'), juices);
	const ways = document.querySelector('[data-ways]');
	ways.innerHTML = waysToOrder(settings, copy);
	ways.insertAdjacentHTML('afterend', shippingNote(settings, copy));

	// Hunter's own photo in the story block once he's uploaded one, otherwise a bottle on the river
	const media = document.querySelector('[data-story-media]');
	const portrait = t('home.story.photo') || settings.aboutPhoto || '/assets/img/hunter-portrait.webp';
	if (portrait) {
		media.classList.add('story__media--photo');
		media.innerHTML = `<img src="${e(portrait)}" alt="Hunter, the founder of SiponPressed" class="story__photo" loading="lazy" decoding="async">`;
	} else {
		const photographed = juices.filter(j => j.image);
		const story = media.querySelector('[data-story-bottle]');
		if (photographed[0] && !story.src.endsWith(photographed[0].image)) story.src = photographed[0].image;
	}

	const fan = juices.filter(j => j.image).slice(0, 3);
	// Wholesale band: the bottles rise up out of the bottom edge with their splashes bursting behind.
	// Splashes sit on their own layer (each beside an invisible copy of its bottle for sizing) so no
	// splash ever paints over a neighbouring bottle.
	const ctaBottle = (j, i, splash) => {
		const splashImg = splash && j.splash && j.splash !== 'none' ? `<img src="/assets/img/splash/${j.splash}.webp" alt="" class="cta-band__splash" loading="lazy" decoding="async">` : '';
		return `<span class="cta-band__bottle" style="--i: ${i}; --r: ${(i - (fan.length - 1) / 2) * 7}deg">${splashImg}<img src="${j.image}" alt="" class="cta-band__img${splash ? ' is-ghost' : ''}" loading="lazy" decoding="async"></span>`;
	};
	const ctaBottles = document.querySelector('[data-cta-bottles]');
	ctaBottles.innerHTML = `
		<div class="cta-band__layer">${fan.map((j, i) => ctaBottle(j, i, true)).join('')}</div>
		<div class="cta-band__layer">${fan.map((j, i) => ctaBottle(j, i, false)).join('')}</div>`;
	// Play the rise only once the bottles themselves are on screen and their photos are ready,
	// so it never starts half-loaded or out of view
	const band = ctaBottles.closest('.cta-band');
	const rise = () => {
		const ready = [...ctaBottles.querySelectorAll('img')].map(img => img.decode().catch(() => {}));
		Promise.race([Promise.all(ready), new Promise(r => setTimeout(r, 1200))]).then(() => requestAnimationFrame(() => band.classList.add('is-up')));
	};
	if (!('IntersectionObserver' in window)) rise();
	else {
		const watch = new IntersectionObserver(
			entries => {
				if (!entries.some(entry => entry.isIntersecting)) return;
				watch.disconnect();
				rise();
			},
			{ threshold: 0.35 }
		);
		watch.observe(ctaBottles);
	}
});
