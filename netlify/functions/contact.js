import { randomUUID } from 'node:crypto';
import { getCounter, getSettings, saveMessage, setCounter } from './lib/store.js';
import { contactMessage, mailConfigured, ownerEmail, sendMail } from './lib/mail.js';
import { clientIp, error, json, publicSiteUrl, readJSON } from './lib/http.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOPICS = ['General question', 'Wholesale / cafe or studio', 'Event or catering', 'An order'];
const HOUR_MS = 3600000;
const MAX_PER_HOUR = 8;

// Every message is saved for Hunter's admin (Messages) and, when email is set up, sent to his inbox.
export default async (req, context) => {
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

	// Keep one sender from flooding the inbox
	const counterKey = `contact:${clientIp(req, context)}`;
	const counter = await getCounter(counterKey);
	const fresh = Date.now() - counter.since > HOUR_MS ? { count: 0, since: Date.now() } : counter;
	if (fresh.count >= MAX_PER_HOUR) return error('Thanks, we have your messages. Please try again a little later.', 429);
	await setCounter(counterKey, { ...fresh, count: fresh.count + 1 });

	const saved = { id: randomUUID(), createdAt: new Date().toISOString(), name, email, topic, message, read: false, archived: false };
	try {
		await saveMessage(saved);
	} catch (err) {
		console.error('Saving contact message failed:', err);
		if (!mailConfigured()) return error('Sorry, that did not send. Please email us directly.', 500);
	}

	if (!mailConfigured()) return json({ ok: true });
	try {
		const settings = await getSettings();
		await sendMail({
			to: ownerEmail(settings),
			replyTo: email,
			subject: `${topic}: message from ${name}`,
			html: contactMessage({ name, email, message, topic }, publicSiteUrl(req))
		});
	} catch (err) {
		// It's already in the admin, so the visitor doesn't need to try again
		console.error('Contact email failed:', err);
		await saveMessage({ ...saved, emailFailed: true }).catch(() => {});
	}
	return json({ ok: true });
};

export const config = { path: ['/api/contact', '/send-email'] };
