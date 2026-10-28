import { SITE_URL } from '../../assets/js/shared/seo.js';
import { getJuices } from './lib/store.js';

const PAGES = ['/', '/juices', '/order', '/about', '/contact'];

// Every public page plus one per juice on the live menu
export default async () => {
	const juices = (await getJuices()).filter(juice => juice.active);
	const urls = [...PAGES, ...juices.map(juice => `/juices/${juice.slug}`)];
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(path => `  <url><loc>${SITE_URL}${path}</loc></url>`).join('\n')}
</urlset>
`;
	return new Response(body, {
		headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'Netlify-Cache-Tag': 'og' }
	});
};

export const config = { path: '/sitemap.xml' };
