/**
 * Makes the short looping clips that link previews play (iMessage, Discord, Facebook, LinkedIn):
 *   assets/videos/og/lineup.mp4          home, menu and order pages
 *   assets/videos/og/<juice slug>.mp4    each juice's page
 *
 * Re-run when the lineup changes, then commit the new files:
 *   node scripts/make-og-videos.mjs [--site https://siponpressed.com]
 *
 * It reads the live menu from --site (falling back to the defaults in shared/catalog.js), draws
 * each frame in a headless browser and encodes with ffmpeg. Needs Playwright and ffmpeg.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';
import { DEFAULT_JUICES, juiceStatus, onColor } from '../assets/js/shared/catalog.js';
import { OG_VIDEO_SIZE } from '../assets/js/shared/seo.js';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = new URL('../', import.meta.url).pathname;
const site = process.argv.includes('--site') ? process.argv[process.argv.indexOf('--site') + 1] : 'https://siponpressed.com';
const FPS = 30;
const SECONDS = 5;
const { width: W, height: H } = OG_VIDEO_SIZE;
const TYPES = { '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.jpg': 'image/jpeg' };

async function menu() {
	try {
		const res = await fetch(`${site}/api/catalog`, { signal: AbortSignal.timeout(8000) });
		const { juices } = await res.json();
		if (Array.isArray(juices) && juices.length) return juices;
	} catch {}
	console.log(`Couldn't read ${site}/api/catalog, using the default menu`);
	return DEFAULT_JUICES.filter(juice => juice.active);
}

const esc = value => String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

// Shared look: Archivo, the wordmark, and keyframes that start and end empty so the clip loops
const base = `
@font-face { font-family: Archivo; src: url(/assets/fonts/og/archivo-500.ttf); font-weight: 500; }
@font-face { font-family: Archivo; src: url(/assets/fonts/og/archivo-700.ttf); font-weight: 700; }
@font-face { font-family: Display; src: url(/assets/fonts/og/archivo-expanded-900.ttf); font-weight: 900; }
* { margin: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
body { position: relative; font-family: Archivo; background: var(--bg); color: var(--fg); }
.copy { position: absolute; left: 64px; top: 56px; bottom: 56px; width: 600px; display: flex; flex-direction: column; justify-content: space-between; z-index: 3; }
.mark { width: 290px; height: 46px; background: var(--fg); -webkit-mask: url(/assets/img/brand/wordmark.svg) left / contain no-repeat; }
.title { font: 900 var(--size, 112px)/.92 Display; letter-spacing: -1px; text-transform: uppercase; }
.line { display: block; overflow: hidden; padding: 0 .08em .1em 0; margin-bottom: -.1em; }
.line span { display: block; animation: line ${SECONDS}s cubic-bezier(.2,.8,.2,1) infinite both; }
.line:nth-child(2) span { animation-delay: .12s; }
.note { margin-top: 20px; font-size: 30px; font-weight: 500; max-width: 520px; line-height: 1.25; animation: fade ${SECONDS}s ease infinite both; animation-delay: .3s; }
.pill { align-self: flex-start; padding: 14px 28px; border-radius: 99px; background: var(--fg); color: var(--bg); font-size: 26px; font-weight: 700; animation: fade ${SECONDS}s ease infinite both; animation-delay: .45s; }
.kicker { font-size: 24px; font-weight: 700; letter-spacing: 3px; opacity: .75; margin-bottom: 18px; }
.stage { position: absolute; right: 30px; bottom: 0; width: 540px; height: 600px; }
.bottle, .splash { position: absolute; bottom: 0; left: 50%; }
.bottle { animation: rise ${SECONDS}s cubic-bezier(.22,1.2,.36,1) infinite both; z-index: 2; }
.bottle img { display: block; height: 100%; animation: bob 2.5s ease-in-out infinite alternate; }
.splash { animation: burst ${SECONDS}s cubic-bezier(.2,.9,.2,1) infinite both; z-index: 1; opacity: .9; }
.splash img { display: block; width: 100%; animation: spin ${SECONDS}s linear infinite; }
.word { position: absolute; left: 0; bottom: -50px; white-space: nowrap; font: 900 300px/1 Display; opacity: .13; letter-spacing: -4px; animation: drift ${SECONDS}s ease-in-out infinite; }
@keyframes rise { 0% { transform: translate(-50%, 110%) rotate(var(--r)); } 22%, 80% { transform: translate(-50%, 0) rotate(var(--r)); } 100% { transform: translate(-50%, 115%) rotate(var(--r)); } }
@keyframes burst { 0%, 8% { transform: translateX(-50%) scale(0); opacity: 0; } 30%, 80% { transform: translateX(-50%) scale(1); opacity: .9; } 100% { transform: translateX(-50%) scale(.2); opacity: 0; } }
.glow { position: absolute; left: 50%; border-radius: 50%; background: radial-gradient(closest-side, var(--c), transparent); filter: blur(30px); animation: burst ${SECONDS}s cubic-bezier(.2,.9,.2,1) infinite both; z-index: 0; }
@keyframes spin { to { transform: rotate(40deg); } }
@keyframes bob { to { transform: translateY(-12px); } }
@keyframes line { 0%, 4% { transform: translateY(110%); } 22%, 80% { transform: translateY(0); } 94%, 100% { transform: translateY(-110%); } }
@keyframes fade { 0%, 6% { opacity: 0; transform: translateY(16px); } 24%, 76% { opacity: 1; transform: none; } 88%, 100% { opacity: 0; } }
@keyframes drift { 50% { transform: translateX(-120px); } }
`;

function bottles(juices, height, glow = false) {
	const shown = juices.filter(juice => juice.image).slice(0, 3);
	const mid = (shown.length - 1) / 2;
	const step = shown.length > 1 ? 170 : 0;
	return shown
		.map((juice, i) => {
			const x = 270 + (i - mid) * step;
			const lift = shown.length > 1 && i === Math.round(mid) ? 26 : 0;
			const delay = `${i * 0.1}s`;
			const splash = `/assets/img/splash/${juice.splash || 'orange'}.webp`;
			const halo = glow && /^#[0-9a-f]{6}$/i.test(juice.color || '') ? `<div class="glow" style="--c:${juice.color}66; left:${x}px; width:${height * 0.75}px; height:${height * 0.75}px; bottom:${height * 0.2}px; animation-delay:${delay}"></div>` : '';
			return `${halo}
<div class="splash" style="left:${x}px; width:${height * 0.9}px; bottom:${height * 0.05}px; animation-delay:${delay}"><img src="${splash}"></div>
<div class="bottle" style="left:${x}px; height:${height}px; bottom:${lift}px; --r:${(i - mid) * 6}deg; animation-delay:${delay}"><img src="${esc(juice.image)}" style="animation-delay:-${i * 0.8}s"></div>`;
		})
		.join('');
}

const lines = (words, size) => `<h1 class="title" style="--size:${size}px">${words.map(word => `<span class="line"><span>${esc(word)}</span></span>`).join('')}</h1>`;
const fit = (words, maxWidth, max) => Math.round(Math.min(max, maxWidth / (Math.max(...words.map(w => w.length)) * 0.95)));

// Night card: the juices glow on black, and a lime band along the bottom keeps the
// link bar iMessage tints from the image's bottom edge in the brand green
function lineupPage(juices) {
	// No prices in the clips: they're baked files, and Hunter can change prices any time in admin
	const words = ['Embrace', 'the sip'];
	return `<style>${base}
body { --bg: #0b0b0a; --fg: #fdf6ea; --lime: #c4dd3b; }
.copy { bottom: 136px; top: 52px; }
.title .line:nth-child(2) { color: var(--lime); }
.note { color: rgba(253, 246, 234, .72); font-size: 28px; }
.stage { bottom: 92px; height: 538px; }
.band { position: absolute; left: 0; right: 0; bottom: 0; height: 92px; background: var(--lime); color: #161513; display: flex; align-items: center; justify-content: space-between; padding: 0 64px; font-size: 28px; font-weight: 700; z-index: 4; }
.band b { font-family: Display; font-weight: 900; font-size: 26px; letter-spacing: 1px; text-transform: uppercase; }
</style>
<div class="copy">
	<div class="mark"></div>
	<div>${lines(words, fit(words, 530, 124))}<p class="note">Small-batch cold-pressed juice, made by Hunter in Philly</p></div>
</div>
<div class="stage">${bottles(juices, 405, true)}</div>
<div class="band"><b>Cold-pressed in Philly</b><span>siponpressed.com</span></div>`;
}

function juicePage(juice) {
	const color = /^#[0-9a-f]{6}$/i.test(juice.color || '') ? juice.color : '#c4dd3b';
	const words = juice.name.split(/\s+/);
	const status = juiceStatus(juice);
	const badge = { 'sold-out': 'Sold out', 'coming-soon': 'Coming soon' }[status] || 'siponpressed.com';
	const word = words[words.length - 1].toUpperCase();
	return `<style>${base} body { --bg: ${color}; --fg: ${onColor(color)}; }</style>
<div class="word">${esc(`${word} ${word} ${word}`)}</div>
<div class="copy">
	<div class="mark"></div>
	<div><p class="kicker">COLD-PRESSED${juice.sizeOz ? ` · ${juice.sizeOz} OZ` : ''}</p>${lines(words, fit(words, 530, 118))}${juice.tagline ? `<p class="note">${esc(juice.tagline)}</p>` : ''}</div>
	<div class="pill">${esc(badge)}</div>
</div>
<div class="stage">${bottles([juice], 560)}</div>`;
}

async function record(browser, html, out) {
	const page = await browser.newPage({ viewport: { width: W, height: H } });
	// Site files come from this checkout; uploaded photos come from the live site
	await page.route('**/*', async route => {
		const url = new URL(route.request().url());
		if (url.pathname.startsWith('/assets/')) {
			try {
				return route.fulfill({ body: await readFile(join(root, url.pathname)), contentType: TYPES[extname(url.pathname)] || 'application/octet-stream' });
			} catch {
				return route.fulfill({ status: 404 });
			}
		}
		if (url.pathname.startsWith('/api/images/')) return route.continue({ url: `${site}${url.pathname}` });
		if (url.pathname === '/') return route.fulfill({ body: `<!doctype html><meta charset="utf-8">${html}`, contentType: 'text/html' });
		return route.fulfill({ status: 404 });
	});
	await page.goto('http://og.local/');
	await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map(image => image.decode().catch(() => {}))]));
	const frames = await mkdtemp(join(tmpdir(), 'og-frames-'));
	for (let i = 0; i < FPS * SECONDS; i++) {
		await page.evaluate(ms => document.getAnimations().forEach(animation => (animation.pause(), (animation.currentTime = ms))), (i * 1000) / FPS);
		await page.screenshot({ path: join(frames, `${String(i).padStart(4, '0')}.png`) });
	}
	await page.close();
	execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, '%04d.png'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out]);
	await rm(frames, { recursive: true });
	console.log(`made ${out.replace(root, '')}`);
}

const juices = await menu();
const outDir = join(root, 'assets/videos/og');
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
await record(browser, lineupPage(juices), join(outDir, 'lineup.mp4'));
for (const juice of juices.filter(juice => juice.image)) await record(browser, juicePage(juice), join(outDir, `${juice.slug}.mp4`));
await browser.close();
