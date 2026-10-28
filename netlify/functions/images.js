import { imageStore } from './lib/store.js';

// Serves bottle photos uploaded from the admin page. Keys are unique per upload, so cache forever.
export default async (req, context) => {
	const key = context.params.key;
	const result = await imageStore().getWithMetadata(key, { type: 'arrayBuffer' });
	if (!result) return new Response('Not found', { status: 404 });
	return new Response(result.data, {
		headers: {
			'Content-Type': result.metadata?.contentType || 'image/webp',
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};

export const config = { path: '/api/images/:key' };
