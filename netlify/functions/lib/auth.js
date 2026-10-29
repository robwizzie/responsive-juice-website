/**
 * Admin sign-in. There's a single admin (Hunter). The ADMIN_PASSWORD environment
 * variable is the first password and always keeps working as a backup; Hunter can
 * set his own from Settings, which is stored only as a salted scrypt hash. Signing in
 * sets a signed, HttpOnly session cookie; changing either password (or
 * ADMIN_SESSION_SECRET) signs every session out.
 */
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { clearCounter, getCounter, getSavedPassword, savePassword, setCounter } from './store.js';

const COOKIE = 'sp_admin';
const SESSION_DAYS = 14;
const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
export const MIN_PASSWORD = 8;
const scryptAsync = promisify(scrypt);

export const adminConfigured = () => Boolean(process.env.ADMIN_PASSWORD);

// The saved hash is part of the signing key, so a new password ends every old session
const secret = saved => (process.env.ADMIN_SESSION_SECRET || createHash('sha256').update(`siponpressed:${process.env.ADMIN_PASSWORD}`).digest('hex')) + (saved?.hash || '');
const sign = (value, saved) => createHmac('sha256', secret(saved)).update(value).digest('base64url');

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

export async function isSignedIn(req) {
	if (!adminConfigured()) return false;
	const token = readCookie(req, COOKIE);
	if (!token) return false;
	const [expires, signature] = token.split('.');
	if (!signature || Number(expires) <= Date.now()) return false;
	return safeEqual(signature, sign(expires, await getSavedPassword()));
}

const hashPassword = async (password, salt) => (await scryptAsync(String(password), salt, 64)).toString('hex');

// The Netlify password always works, so Rob can get back in if Hunter forgets his
async function passwordMatches(password, saved) {
	if (safeEqual(password || '', process.env.ADMIN_PASSWORD)) return true;
	if (!saved?.hash || !password) return false;
	return safeEqual(await hashPassword(password, saved.salt), saved.hash);
}

function cookie(value, maxAge, req) {
	const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
	return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function sessionCookie(req, saved) {
	const expires = String(Date.now() + SESSION_DAYS * 86400000);
	return cookie(`${expires}.${sign(expires, saved)}`, SESSION_DAYS * 86400, req);
}

// Checks a password, with a lockout after repeated failures from one IP
async function checkPassword(password, ip, saved) {
	const key = `login/${ip}`;
	const attempts = await getCounter(key);
	const locked = attempts.count >= MAX_FAILURES && Date.now() - attempts.since < LOCKOUT_MS;
	if (locked) return 'Too many attempts. Try again in 15 minutes.';

	if (!(await passwordMatches(password, saved))) {
		const fresh = Date.now() - attempts.since > LOCKOUT_MS;
		await setCounter(key, { count: fresh ? 1 : attempts.count + 1, since: fresh ? Date.now() : attempts.since });
		await new Promise(resolve => setTimeout(resolve, 600));
		return 'That password is not right.';
	}

	await clearCounter(key);
	return null;
}

/** Signs in with either password. Returns { ok, cookie?, error? }. */
export async function signIn(req, password, ip) {
	if (!adminConfigured()) return { ok: false, error: 'Admin is not set up yet. Add ADMIN_PASSWORD in Netlify.' };
	const saved = await getSavedPassword();
	const problem = await checkPassword(password, ip, saved);
	return problem ? { ok: false, error: problem } : { ok: true, cookie: sessionCookie(req, saved) };
}

/** Saves a new password after checking the current one. Other devices are signed out; this one gets a fresh cookie. */
export async function changePassword(req, current, next, ip) {
	if (typeof next !== 'string' || next.length < MIN_PASSWORD) return { ok: false, error: `Use at least ${MIN_PASSWORD} characters.` };
	if (next.length > 200) return { ok: false, error: 'That password is too long.' };
	const problem = await checkPassword(current, ip, await getSavedPassword());
	if (problem) return { ok: false, error: problem === 'That password is not right.' ? 'Your current password is not right.' : problem };

	const salt = randomBytes(16).toString('hex');
	const saved = { salt, hash: await hashPassword(next, salt), changedAt: new Date().toISOString() };
	await savePassword(saved);
	return { ok: true, cookie: sessionCookie(req, saved) };
}

export const signOutCookie = req => cookie('', 0, req);
