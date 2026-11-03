import { SITE_URL } from '../../assets/js/shared/seo.js';
import { getJuices } from './lib/store.js';

const PAGES = ['/', '/juices', '/order', '/about', '/contact'];

const xml = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const image = (src, title) => `\n    <image:image><image:loc>${xml(src.startsWith('http') ? src : SITE_URL + src)}</image:loc><image:title>${xml(title)}</image:title></image:image>`;

/**
 * Every public page plus one per juice on the live menu. Each juice page lists its bottle photo
 * and share image, and the menu pages list every bottle, so Google Images shows today's bottles.
 */
export function sitemapXml(juices) {
	const live = juices.filter(juice => juice.active !== false);
	const bottles = live.filter(juice => juice.image).map(juice => image(juice.image, `${juice.name} cold-pressed juice by SiponPressed`));
	const pages = [
		...PAGES.map(path => ({ path, images: path === '/' || path === '/juices' ? bottles : [] })),
		...live.map(juice => ({
			path: `/juices/${juice.slug}`,
			images: [juice.image && image(juice.image, `${juice.name} cold-pressed juice by SiponPressed`), image(`/og/juices/${juice.slug}.png`, `${juice.name} | SiponPressed`)].filter(Boolean)
		}))
	];
	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${pages.map(({ path, images }) => `  <url><loc>${SITE_URL}${path}</loc>${images.join('')}\n  </url>`).join('\n')}
</urlset>
`;
}

export default async () => {
	const body = sitemapXml(await getJuices());
	return new Response(body, {
		headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'Netlify-Cache-Tag': 'og' }
	});
};

export const config = { path: '/sitemap.xml' };
