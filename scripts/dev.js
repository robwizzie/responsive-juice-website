/**
 * Local preview without the Netlify CLI: serves the static site, applies _redirects,
 * runs the functions in netlify/functions, and backs Netlify Blobs with a local folder.
 *
 *   npm run dev        → http://localhost:8888
 *
 * Reads secrets from a .env file if present (see README). `netlify dev` also works.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { Readable } from 'node:stream';
import { BlobsServer } from '@netlify/blobs/server';

const root = new URL('..', import.meta.url).pathname;
const PORT = Number(process.env.PORT) || 8888;

if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
process.env.CONTEXT ??= 'dev';

// Local stand-in for Netlify Blobs
const token = 'local-dev';
const blobs = new BlobsServer({ directory: join(root, '.netlify/dev-blobs'), port: 0, token });
const { port: blobsPort } = await blobs.start();
const edgeURL = `http://localhost:${blobsPort}`;
globalThis.netlifyBlobsContext = Buffer.from(JSON.stringify({ edgeURL, uncachedEdgeURL: edgeURL, token, siteID: 'local' })).toString('base64');

// Functions and their routes
const toPattern = path => new RegExp(`^${path.replace(/\*/g, '.*').replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`);
const routes = [];
for (const file of readdirSync(join(root, 'netlify/functions')).filter(f => f.endsWith('.js'))) {
	const mod = await import(join(root, 'netlify/functions', file));
	for (const path of [mod.config?.path].flat().filter(Boolean)) routes.push({ pattern: toPattern(path), handler: mod.default, file });
}

// _redirects (only what this site uses: exact paths, :params, splats, 200/301/302)
const redirects = readFileSync(join(root, '_redirects'), 'utf8')
	.split('\n')
	.map(line => line.trim())
	.filter(line => line && !line.startsWith('#'))
	.map(line => {
		const [from, to, status = '301'] = line.split(/\s+/);
		return { pattern: toPattern(from.replace(/\/\*$/, '/*')), to, status: parseInt(status, 10) };
	});

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function staticFile(pathname) {
	const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
	for (const candidate of [clean, `${clean}.html`, join(clean, 'index.html')]) {
		const file = join(root, candidate);
		if (file.startsWith(root) && existsSync(file) && statSync(file).isFile() && !candidate.includes('node_modules') && !candidate.startsWith('/.')) return file;
	}
	return null;
}

function sendFile(res, file, status = 200) {
	res.writeHead(status, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
	res.end(readFileSync(file));
}

async function runFunction(route, match, req, res, url) {
	const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Readable.toWeb(req);
	const request = new Request(url, { method: req.method, headers: req.headers, body, duplex: 'half' });
	const response = await route.handler(request, { params: match.groups || {}, ip: req.socket.remoteAddress });
	const headers = Object.fromEntries(response.headers);
	const cookies = response.headers.getSetCookie?.() || [];
	if (cookies.length) headers['set-cookie'] = cookies;
	res.writeHead(response.status, headers);
	res.end(Buffer.from(await response.arrayBuffer()));
}

createServer(async (req, res) => {
	const url = new URL(req.url, `http://${req.headers.host}`);
	try {
		for (const route of routes) {
			const match = url.pathname.match(route.pattern);
			if (match) return await runFunction(route, match, req, res, url);
		}

		const direct = staticFile(url.pathname);
		if (direct && url.pathname !== '/') return sendFile(res, direct);

		for (const rule of redirects) {
			const match = url.pathname.match(rule.pattern);
			if (!match) continue;
			let target = rule.to;
			for (const [key, value] of Object.entries(match.groups || {})) target = target.replace(`:${key}`, value);
			if (rule.status === 200) {
				const file = staticFile(target);
				if (file) return sendFile(res, file);
			} else {
				res.writeHead(rule.status, { Location: target });
				return res.end();
			}
		}

		if (direct) return sendFile(res, direct);
		return sendFile(res, join(root, '404.html'), 404);
	} catch (err) {
		console.error(err);
		res.writeHead(500, { 'Content-Type': 'text/plain' });
		res.end('Server error');
	}
}).listen(PORT, () => {
	console.log(`SiponPressed running at http://localhost:${PORT}`);
	console.log(`Functions: ${routes.map(r => r.file).filter((f, i, a) => a.indexOf(f) === i).join(', ')}`);
});
