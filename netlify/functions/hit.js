import { isSignedIn } from './lib/auth.js';
import { clientIp, requestOrigin } from './lib/http.js';
import { makeEvent, saveEvent } from './lib/visits.js';

// A page view (or "added to cart" / "started checkout") from the public site, for Admin → Stats → Website.
// Always answers 204 so a failed count never bothers the visitor.
export default async (req, context) => {
	const done = new Response(null, { status: 204 });
	if (req.method !== 'POST') return done;
	try {
		const text = await req.text();
		if (text.length > 2000) return done;
		// Hunter browsing his own site doesn't count
		if (await isSignedIn(req)) return done;
		const event = makeEvent(JSON.parse(text), {
			ip: clientIp(req, context),
			userAgent: req.headers.get('user-agent') || '',
			geo: context.geo,
			ownHost: new URL(requestOrigin(req)).hostname.replace(/^www\./, '')
		});
		if (event) await saveEvent(event);
	} catch (err) {
		console.warn('Could not count a visit', err.message);
	}
	return done;
};

export const config = { path: '/api/hit' };
