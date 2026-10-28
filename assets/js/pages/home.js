import { ready } from '../site.js';
import { juiceCard, waysToOrder } from '../lib/components.js';

ready.then(({ juices, settings }) => {
	document.querySelector('[data-menu]').innerHTML = juices.map((juice, i) => juiceCard(juice, { eager: i < 3 })).join('');
	document.querySelector('[data-flavor-count]').textContent = juices.length;
	document.querySelector('[data-ways]').innerHTML = waysToOrder(settings);

	// The hero ships with the original three bottles; swap in the live menu if Hunter changed it.
	const [left, center, right] = juices;
	if (right) {
		const slots = { left, center, right };
		Object.entries(slots).forEach(([position, juice]) => {
			const slot = document.querySelector(`.hero__bottle--${position}`);
			const img = slot.querySelector('img');
			if (!img.src.endsWith(juice.image)) img.src = juice.image;
			slot.style.setProperty('--c', juice.color);
		});
	}
});
