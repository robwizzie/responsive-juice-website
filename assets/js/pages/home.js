import { ready } from '../site.js';
import { flavorCarousel } from '../lib/carousel.js';
import { bottleImage, garnishFor, onColor, statusStamp, waysToOrder } from '../lib/components.js';
import { escapeHtml as e } from '../lib/catalog.js';
import { icon } from '../lib/icons.js';
import { juiceStatus } from '../shared/catalog.js';

/** One arch in the hero: the juice's color, its bottle standing in it, two ingredients floating by. */
function pillar(juice, i) {
	const [fruitA, fruitB] = garnishFor(juice);
	const fruit = (src, cls) => (src ? `<span class="hero__fruit ${cls}"><img src="${src}" alt="" decoding="async"></span>` : '');
	return `
		<a href="/juices/${juice.slug}" class="hero__pillar is-${juiceStatus(juice)}" style="--c: ${juice.color}; --on-c: ${onColor(juice.color)}; --i: ${i}">
			<span class="hero__arch"></span>
			${fruit(fruitA, 'hero__fruit--a')}
			${fruit(fruitB, 'hero__fruit--b')}
			<span class="hero__bottle">${bottleImage(juice, { eager: true })}</span>
			${statusStamp(juice, { className: 'hero__stamp' })}
			<span class="hero__name">${e(juice.name)}${icon('arrowRight')}</span>
		</a>`;
}

ready.then(({ juices, settings }) => {
	// The hero ships with the three launch bottles; rebuild it only if Hunter's menu differs
	const trio = document.querySelector('[data-hero-trio]');
	const shown = juices.slice(0, 3);
	const current = [...trio.querySelectorAll('.hero__pillar')].map(a => a.getAttribute('href')).join();
	const wanted = shown.map(j => `/juices/${j.slug}`).join();
	const changed = shown.some((j, i) => j.status !== 'available' || !trio.querySelectorAll('.hero__bottle img')[i]?.src.endsWith(j.image));
	if (shown.length && (current !== wanted || changed)) {
		trio.innerHTML = shown.map(pillar).join('');
		trio.dataset.count = shown.length;
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
