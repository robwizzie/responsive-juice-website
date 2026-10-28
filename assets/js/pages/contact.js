import { ready, t } from '../site.js';

const form = document.getElementById('contact-form');
const status = form.querySelector('.form__status');
const button = form.querySelector('button[type="submit"]');

// /contact?topic=wholesale preselects the wholesale option
if (new URLSearchParams(location.search).get('topic') === 'wholesale') form.topic.value = 'Wholesale / cafe or studio';

ready.then(({ juices, settings }) => {
	// The bottle in the header is the first juice on the menu
	const lead = juices.find(j => j.image);
	const bottle = document.querySelector('.page-card__img');
	if (lead && bottle && !bottle.src.endsWith(lead.imageSmall || lead.image)) {
		bottle.src = lead.imageSmall || lead.image;
		const splash = document.querySelector('.page-card__splash');
		if (lead.splash && lead.splash !== 'none') splash.src = `/assets/img/splash/${lead.splash}-sm.webp`;
		else splash.remove();
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
