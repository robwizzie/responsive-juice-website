import { ready } from '../site.js';
import { flavorCarousel } from '../lib/carousel.js';
import { juiceCard, waysToOrder } from '../lib/components.js';

ready.then(({ juices, settings }) => {
	flavorCarousel(document.querySelector('[data-flavors]'), juices);
	document.querySelector('[data-menu]').innerHTML = juices.map((juice, i) => juiceCard(juice, { eager: i < 3 })).join('');
	document.querySelector('[data-ways]').innerHTML = waysToOrder(settings);

	const photographed = juices.filter(j => j.image);
	const story = document.querySelector('[data-story-bottle]');
	if (photographed[0] && !story.src.endsWith(photographed[0].image)) story.src = photographed[0].image;
	document.querySelector('[data-cta-bottles]').innerHTML = photographed
		.slice(0, 3)
		.map((j, i) => `<img src="${j.imageSmall || j.image}" alt="" loading="lazy" style="--r: ${(i - 1) * 10}deg">`)
		.join('');
});
