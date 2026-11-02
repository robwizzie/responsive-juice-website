import { SPLASH_STYLES } from '../../assets/js/shared/catalog.js';
import { recolorSplash } from './lib/splash.js';
import { requestOrigin } from './lib/http.js';

// A splash shape repainted in any color Hunter picks for a juice:
// /api/splash/<shape>/<hex>.webp, or <hex>-sm.webp for the small size.
// Each address always gives the same picture, so browsers and Netlify's CDN keep it for good.
export default async (req, context) => {
	const { shape, file } = context.params;
	const match = /^([0-9a-f]{6})(-sm)?\.webp$/.exec(file || '');
	if (!SPLASH_STYLES.includes(shape) || !match) return new Response('Not found', { status: 404 });

	const source = await fetch(new URL(`/assets/img/splash/${shape}${match[2] || ''}.webp`, requestOrigin(req)));
	if (!source.ok) return new Response('Splash unavailable', { status: 502 });

	const webp = await recolorSplash(Buffer.from(await source.arrayBuffer()), `#${match[1]}`);
	return new Response(webp, {
		headers: {
			'Content-Type': 'image/webp',
			'Cache-Control': 'public, max-age=31536000, immutable',
			'Netlify-CDN-Cache-Control': 'public, durable, max-age=31536000, immutable'
		}
	});
};

export const config = { path: '/api/splash/:shape/:file' };
