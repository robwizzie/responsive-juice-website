/**
 * Admin sign-in. There's a single admin (Hunter) whose password lives in the
 * ADMIN_PASSWORD environment variable. Signing in sets a signed, HttpOnly session
 * cookie; changing the password (or ADMIN_SESSION_SECRET) signs every session out.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { clearCounter, getCounter, setCounter } from './store.js';

const COOKIE = 'sp_admin';
const SESSION_DAYS = 14;
const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export const adminConfigured = () => Boolean(process.env.ADMIN_PASSWORD);

const secret = () => process.env.ADMIN_SESSION_SECRET || createHash('sha256').update(`siponpressed:${process.env.ADMIN_PASSWORD}`).digest('hex');
const sign = value => createHmac('sha256', secret()).update(value).digest('base64url');

function safeEqual(a, b) {
	const left = createHash('sha256').update(String(a)).digest();
	const right = createHash('sha256').update(String(b)).digest();
	return timingSafeEqual(left, right);
}

function readCookie(req, name) {
	const header = req.headers.get('cookie') || '';
	const match = header.split(/;\s*/).find(part => part.startsWith(`${name}=`));
	return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function isSignedIn(req) {
	if (!adminConfigured()) return false;
	const token = readCookie(req, COOKIE);
	if (!token) return false;
	const [expires, signature] = token.split('.');
	return Boolean(signature) && safeEqual(signature, sign(expires)) && Number(expires) > Date.now();
}

function cookie(value, maxAge, req) {
	const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
	return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

/** Checks the password, with a lockout after repeated failures from one IP. Returns { ok, cookie?, error? }. */
export async function signIn(req, password, ip) {
	if (!adminConfigured()) return { ok: false, error: 'Admin is not set up yet. Add ADMIN_PASSWORD in Netlify.' };

	const key = `login/${ip}`;
	const attempts = await getCounter(key);
	const locked = attempts.count >= MAX_FAILURES && Date.now() - attempts.since < LOCKOUT_MS;
	if (locked) return { ok: false, error: 'Too many attempts. Try again in 15 minutes.' };

	if (!safeEqual(password || '', process.env.ADMIN_PASSWORD)) {
		const fresh = Date.now() - attempts.since > LOCKOUT_MS;
		await setCounter(key, { count: fresh ? 1 : attempts.count + 1, since: fresh ? Date.now() : attempts.since });
		await new Promise(resolve => setTimeout(resolve, 600));
		return { ok: false, error: 'That password is not right.' };
	}

	await clearCounter(key);
	const expires = String(Date.now() + SESSION_DAYS * 86400000);
	return { ok: true, cookie: cookie(`${expires}.${sign(expires)}`, SESSION_DAYS * 86400, req) };
}

export const signOutCookie = req => cookie('', 0, req);
