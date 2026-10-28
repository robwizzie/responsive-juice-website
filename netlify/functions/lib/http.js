export const json = (body, status = 200, headers = {}) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }
	});

export const error = (message, status = 400) => json({ error: message }, status);

export async function readJSON(req) {
	try {
		return await req.json();
	} catch {
		return null;
	}
}

export const escapeHtml = value =>
	String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

export const clientIp = (req, context) => context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';

// The origin the visitor is on (so deploy previews redirect back to themselves)
export const requestOrigin = req => new URL(req.url).origin;

// The public site address, for links in emails
export const publicSiteUrl = req => process.env.URL || requestOrigin(req);
