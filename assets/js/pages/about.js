import { ready } from '../site.js';

ready.then(({ juices }) => {
	document.querySelector('[data-about-bottles]').innerHTML = juices
		.slice(0, 3)
		.map((juice, i) => `<a href="/juices/${juice.slug}" class="about-bottles__item" style="--c: ${juice.color}; --i: ${i}"><img src="${juice.image}" alt="${juice.name}" loading="lazy" decoding="async"></a>`)
		.join('');
});
