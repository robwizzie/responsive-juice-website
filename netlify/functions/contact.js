import { getSettings } from './lib/store.js';
import { contactMessage, mailConfigured, ownerEmail, sendMail } from './lib/mail.js';
import { error, json, publicSiteUrl, readJSON } from './lib/http.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOPICS = ['General question', 'Wholesale / cafe or studio', 'Event or catering', 'An order'];

export default async req => {
	if (req.method !== 'POST') return error('Method not allowed', 405);
	const body = await readJSON(req);
	const name = String(body?.name || [body?.firstName, body?.lastName].filter(Boolean).join(' ')).trim().slice(0, 100);
	const email = String(body?.email || '').trim().slice(0, 120);
	const message = String(body?.message || '').trim().slice(0, 4000);
	const topic = TOPICS.includes(body?.topic) ? body.topic : TOPICS[0];

	// Bots fill in the hidden "website" field; pretend it worked.
	if (body?.website) return json({ ok: true });
	if (!name || !email || !message) return error('Please fill in your name, email and message.');
	if (!emailPattern.test(email)) return error('That email address does not look right.');
	if (!mailConfigured()) return error('The contact form is not connected yet. Please email us directly.', 503);

	try {
		const settings = await getSettings();
		await sendMail({
			to: ownerEmail(settings),
			replyTo: email,
			subject: `${topic}: message from ${name}`,
			html: contactMessage({ name, email, message, topic }, publicSiteUrl(req))
		});
		return json({ ok: true });
	} catch (err) {
		console.error('Contact email failed:', err);
		return error('Sorry, that did not send. Please email us directly.', 500);
	}
};

export const config = { path: ['/api/contact', '/send-email'] };
