/**
 * Counts a visit for Admin → Stats → Website: the page, where the visitor came from, and the
 * shopping steps (added to cart, started checkout). No cookies, nothing stored in the browser;
 * see netlify/functions/lib/visits.js for what the server keeps.
 */
const skip =
	// The admin's live preview and pages shown inside the admin aren't real visits
	window.parent !== window || new URLSearchParams(location.search).has('admin-preview') || document.body.classList.contains('page-not-found') || navigator.webdriver;

export function track(event = 'view', extra = {}) {
	// A page that's about to send the visitor elsewhere (a juice that's gone) sets data-no-track
	if (skip || document.documentElement.hasAttribute('data-no-track')) return;
	const params = new URLSearchParams(location.search);
	const body = JSON.stringify({ e: event, p: location.pathname, r: document.referrer, u: params.get('utm_source') || '', ...extra });
	try {
		if (navigator.sendBeacon?.('/api/hit', new Blob([body], { type: 'application/json' }))) return;
	} catch {
		/* fall through */
	}
	fetch('/api/hit', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
}
