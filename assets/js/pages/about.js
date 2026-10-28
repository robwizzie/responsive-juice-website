import { ready } from '../site.js';
import { escapeHtml as e } from '../lib/catalog.js';

ready.then(({ juices, settings }) => {
	const photographed = juices.filter(j => j.image);
	const photo = document.querySelector('[data-portrait-photo]');
	if (settings.aboutPhoto) {
		photo.innerHTML = `<img src="${e(settings.aboutPhoto)}" alt="Hunter, founder of SiponPressed" decoding="async">`;
	} else {
		// No photo of Hunter yet: show his bottles on the river until he uploads one in /admin
		document.querySelector('[data-portrait]').classList.add('portrait--empty');
		photo.innerHTML = `
			<img src="/assets/img/backdrops/riverfront-sm.webp" alt="" decoding="async">
			${photographed[0] ? `<img src="${photographed[0].imageSmall || photographed[0].image}" alt="" class="portrait__bottle" decoding="async">` : ''}`;
		photo.insertAdjacentHTML('afterend', '<span class="stamp stamp--coming-soon portrait__soon">Photo of Hunter soon</span>');
	}

	document.querySelector('[data-about-bottles]').innerHTML = photographed
		.slice(0, 3)
		.map((juice, i) => `<a href="/juices/${juice.slug}" class="about-bottles__item" style="--i: ${i}"><img src="${juice.image}" alt="${e(juice.name)}" loading="lazy" decoding="async"></a>`)
		.join('');
});
