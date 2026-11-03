import { imageStore } from './lib/store.js';
import { toWebp } from './lib/webp.js';

const FOREVER = { 'Cache-Control': 'public, max-age=31536000, immutable', 'Netlify-CDN-Cache-Control': 'public, durable, max-age=31536000, immutable' };

// Serves photos uploaded from the admin page. Keys are unique per upload, so cache forever.
// Older uploads saved as PNG/JPEG can also be asked for as <id>.webp: they're converted once and
// the CDN keeps the result (see webImage in shared/catalog.js, which points the site at those).
export default async (req, context) => {
	const key = context.params.key;
	const store = imageStore();
	const result = await store.getWithMetadata(key, { type: 'arrayBuffer' });
	if (result) return new Response(result.data, { headers: { 'Content-Type': result.metadata?.contentType || 'image/webp', ...FOREVER } });

	const id = /^([\w-]+)\.webp$/.exec(key || '')?.[1];
	if (id) {
		for (const extension of ['png', 'jpg']) {
			const original = await store.get(`${id}.${extension}`, { type: 'arrayBuffer' });
			if (original) return new Response(await toWebp(original), { headers: { 'Content-Type': 'image/webp', ...FOREVER } });
		}
	}
	return new Response('Not found', { status: 404 });
};

export const config = { path: '/api/images/:key' };
