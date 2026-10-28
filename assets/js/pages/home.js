import { ready } from '../site.js';
import { flavorCarousel } from '../lib/carousel.js';
import { bottleImage, garnishFor, statusStamp, waysToOrder } from '../lib/components.js';
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

ready.then(({ juices, settings }) => {
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
	document.querySelector('[data-ways]').innerHTML = waysToOrder(settings);

	// Hunter's own photo in the story block once he's uploaded one, otherwise a bottle on the river
	const media = document.querySelector('[data-story-media]');
	if (settings.aboutPhoto) {
		media.classList.add('story__media--photo');
		media.innerHTML = `<img src="${e(settings.aboutPhoto)}" alt="Hunter, the founder of SiponPressed" class="story__photo" loading="lazy" decoding="async">`;
	} else {
		const photographed = juices.filter(j => j.image);
		const story = media.querySelector('[data-story-bottle]');
		if (photographed[0] && !story.src.endsWith(photographed[0].image)) story.src = photographed[0].image;
	}

	const fan = juices.filter(j => j.image).slice(0, 3);
	document.querySelector('[data-cta-bottles]').innerHTML = fan.map((j, i) => `<img src="${j.imageSmall || j.image}" alt="" loading="lazy" style="--i: ${i}">`).join('');
});
