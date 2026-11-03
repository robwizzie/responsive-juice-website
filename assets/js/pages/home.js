import { ready, t } from '../site.js';
import { flavorCarousel } from '../lib/carousel.js';
import { heroBottle, shippingNote, waysToOrder } from '../lib/components.js';
import { escapeHtml as e } from '../lib/catalog.js';
import { featuredJuices, juiceStatus, splashUrl, webImage } from '../shared/catalog.js';

/** Plays the hero entrance (the words straight away; the bottles once they're live, see showBottles). */
function playHero(hero) {
	hero.classList.remove('is-in');
	requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('is-in')));
}

/**
 * The page ships with the launch bottles baked in so the layout is ready, but they stay hidden
 * until Hunter's live menu has arrived and its photos are decoded. That way a renamed or
 * replaced juice never flashes up first and then swaps.
 */
function showBottles(trio) {
	const imgs = [...trio.querySelectorAll('.hero__img')].filter(img => img.tagName === 'IMG');
	const decoded = Promise.all(imgs.map(img => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())));
	const timeout = new Promise(resolve => setTimeout(resolve, 1500));
	Promise.race([decoded, timeout]).then(() => requestAnimationFrame(() => trio.classList.add('is-live')));
}

// The page ships with the hero's entrance already playing (is-in in the HTML), so the headline
// shows without waiting for this script; only a return visit from the back button replays it
const hero = document.querySelector('[data-hero]');
// Coming back with the browser's back button restores the page as it was; replay the entrance
window.addEventListener('pageshow', event => event.persisted && playHero(hero));

ready.then(({ juices, settings, copy }) => {
	// The hero ships with the three launch bottles; rebuild it only if Hunter's menu differs
	const trio = document.querySelector('[data-hero-trio]');
	const shown = featuredJuices(juices, settings);
	const current = [...trio.querySelectorAll('.hero__bottle')].map(a => a.getAttribute('href')).join();
	const wanted = shown.map(j => `/juices/${j.slug}`).join();
	const changed = shown.some((j, i) => juiceStatus(j) !== 'available' || !trio.querySelectorAll('.hero__img')[i]?.src?.endsWith(j.image));
	if (shown.length && (current !== wanted || changed)) trio.innerHTML = shown.map(heroBottle).join('');
	showBottles(trio);

	flavorCarousel(document.querySelector('[data-flavors]'), juices);
	const ways = document.querySelector('[data-ways]');
	ways.innerHTML = waysToOrder(settings, copy);
	ways.insertAdjacentHTML('afterend', shippingNote(settings, copy));

	// Hunter's own photo in the story block once he's uploaded one, otherwise a bottle on the river
	const media = document.querySelector('[data-story-media]');
	const portrait = webImage(t('home.story.photo') || settings.aboutPhoto) || '/assets/img/hunter-portrait.webp';
	if (portrait) {
		media.classList.add('story__media--photo');
		media.innerHTML = `<img src="${e(portrait)}" alt="Hunter, the founder of SiponPressed" class="story__photo" loading="lazy" decoding="async">`;
	} else {
		const photographed = juices.filter(j => j.image);
		const story = media.querySelector('[data-story-bottle]');
		if (photographed[0] && !story.src.endsWith(photographed[0].image)) story.src = photographed[0].image;
	}

	const fan = featuredJuices(juices, settings, { needsPhoto: true });
	// Wholesale band: the bottles rise up out of the bottom edge with their splashes bursting behind.
	// Splashes sit on their own layer (each beside an invisible copy of its bottle for sizing) so no
	// splash ever paints over a neighbouring bottle.
	const ctaBottle = (j, i, splash) => {
		const splashImg = splash && splashUrl(j) ? `<img src="${splashUrl(j)}" alt="" class="cta-band__splash" loading="lazy" decoding="async">` : '';
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
