import { ready, t } from '../site.js';

const form = document.getElementById('contact-form');
const status = form.querySelector('.form__status');
const button = form.querySelector('button[type="submit"]');

// /contact?topic=wholesale preselects the wholesale option
if (new URLSearchParams(location.search).get('topic') === 'wholesale') form.topic.value = 'Wholesale / cafe or studio';

ready.then(({ juices, settings }) => {
	// The header bottle rotates through the menu, and the card's accent follows each juice's color
	const lineup = juices.filter(j => j.image);
	const card = document.querySelector('.page-card');
	const stage = document.querySelector('.page-card__bottle');
	const bottle = stage?.querySelector('.page-card__img');
	const splash = stage?.querySelector('.page-card__splash');
	const show = juice => {
		bottle.src = juice.imageSmall || juice.image;
		const hasSplash = juice.splash && juice.splash !== 'none';
		if (hasSplash) splash.src = `/assets/img/splash/${juice.splash}-sm.webp`;
		// Hide it without dropping it from the layout, so a juice with no splash doesn't shrink the card
		splash.style.visibility = hasSplash ? '' : 'hidden';
		if (/^#[0-9a-f]{6}$/i.test(juice.color || '')) card.style.setProperty('--accent', juice.color);
	};
	if (bottle && lineup.length) {
		show(lineup[0]);
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (lineup.length > 1 && !still) {
			// Warm the cache so each swap is instant
			lineup.forEach(j => (new Image().src = j.imageSmall || j.image));
			let i = 0;
			setInterval(() => {
				if (document.hidden) return;
				i = (i + 1) % lineup.length;
				stage.classList.add('is-swapping');
				setTimeout(() => {
					show(lineup[i]);
					stage.classList.remove('is-swapping');
				}, 450);
			}, 3800);
		}
	}

	const link = document.querySelector('[data-contact-email]');
	link.href = `mailto:${settings.contactEmail}`;
	document.querySelector('[data-contact-email-text]').textContent = settings.contactEmail;
});

form.addEventListener('submit', async event => {
	event.preventDefault();
	if (!form.reportValidity()) return;

	button.disabled = true;
	status.className = 'form__status';
	status.textContent = 'Sending…';

	try {
		const res = await fetch('/api/contact', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(Object.fromEntries(new FormData(form)))
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data.error || 'Something went wrong.');
		form.reset();
		status.classList.add('is-success');
		status.textContent = t('contact.form.thanks');
	} catch (err) {
		status.classList.add('is-error');
		status.textContent = err.message;
	} finally {
		button.disabled = false;
	}
});
