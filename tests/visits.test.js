import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deviceOf, isBot, makeEvent, publicSummary, sourceOf, summarize } from '../netlify/functions/lib/visits.js';
import { conversion, funnel, ranked, visitSeries, visitTotals } from '../assets/js/admin/visits-data.js';
import { period } from '../assets/js/admin/stats-data.js';

const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148';
const ctx = (ip, extra = {}) => ({ ip, userAgent: iphone, geo: { city: 'Philadelphia', subdivision: { code: 'PA' } }, ownHost: 'siponpressed.com', now: Date.parse('2026-11-03T18:00:00Z'), ...extra });

test('where a visit came from, in plain words', () => {
	assert.equal(sourceOf('https://l.instagram.com/', '', 'siponpressed.com'), 'Instagram');
	assert.equal(sourceOf('https://www.google.com/', '', 'siponpressed.com'), 'Google');
	assert.equal(sourceOf('', '', 'siponpressed.com'), 'Direct');
	assert.equal(sourceOf('https://siponpressed.com/juices', '', 'siponpressed.com'), 'Direct');
	assert.equal(sourceOf('https://phillymag.com/x', '', 'siponpressed.com'), 'phillymag.com');
	assert.equal(sourceOf('', 'IG', 'siponpressed.com'), 'IG');
	assert.equal(sourceOf('https://www.google.com/', 'instagram', 'siponpressed.com'), 'Instagram');
	assert.equal(deviceOf(iphone), 'phone');
	assert.equal(deviceOf('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), 'tablet');
	assert.equal(deviceOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)'), 'computer');
	assert.ok(isBot('Googlebot/2.1') && isBot('') && !isBot(iphone));
});

test('hits are cleaned: no admin pages, no bots, nothing odd in the path', () => {
	assert.equal(makeEvent({ p: '/admin' }, ctx('1.1.1.1')), null);
	assert.equal(makeEvent({ p: 'javascript:alert(1)' }, ctx('1.1.1.1')), null);
	assert.equal(makeEvent({ p: '/' }, ctx('1.1.1.1', { userAgent: 'Googlebot' })), null);
	const event = makeEvent({ p: '/juices/simply-red/?x=1', r: 'https://l.instagram.com/' }, ctx('1.1.1.1'));
	assert.equal(event.p, '/juices/simply-red');
	assert.equal(event.day, '2026-11-03');
	assert.equal(event.c, 'Philadelphia, PA');
	assert.equal(event.v.length, 16);
	// Same person, same day: same visitor id. Next day: a new one (they can't be followed)
	assert.equal(makeEvent({ p: '/' }, ctx('1.1.1.1')).v, event.v);
	assert.notEqual(makeEvent({ p: '/' }, ctx('1.1.1.1', { now: Date.parse('2026-11-04T18:00:00Z') })).v, event.v);
});

test('a day adds up: visitors once, their first source, the shopping steps', () => {
	const a = ctx('1.1.1.1');
	const b = ctx('2.2.2.2', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)', now: a.now + 60000 });
	const events = [
		makeEvent({ p: '/', r: 'https://l.instagram.com/' }, a),
		makeEvent({ p: '/juices/simply-red', r: 'https://siponpressed.com/' }, { ...a, now: a.now + 1000 }),
		makeEvent({ e: 'cart', p: '/juices/simply-red', j: 'simply-red' }, { ...a, now: a.now + 2000 }),
		makeEvent({ e: 'checkout', p: '/order' }, { ...a, now: a.now + 3000 }),
		makeEvent({ p: '/about', r: 'https://www.google.com/' }, b)
	];
	const day = publicSummary(summarize('2026-11-03', events));
	assert.equal(day.visitors, 2);
	assert.equal(day.views, 3);
	assert.deepEqual(day.sources, { Instagram: 1, Google: 1 });
	assert.deepEqual(day.devices, { phone: 1, computer: 1 });
	assert.deepEqual(day.juices, { 'simply-red': 1 });
	assert.deepEqual(day.cartJuices, { 'simply-red': 1 });
	assert.equal(day.cartVisitors, 1);
	assert.equal(day.checkoutVisitors, 1);
	assert.equal(day.juiceBrowsers, 1);
	assert.equal(day.hours.reduce((x, y) => x + y, 0), 2);
	// Late hits merge into a saved day without counting anyone twice
	const merged = publicSummary(summarize('2026-11-03', [makeEvent({ p: '/juices' }, { ...a, now: a.now + 9000 })], summarize('2026-11-03', events)));
	assert.equal(merged.visitors, 2);
	assert.equal(merged.views, 4);
});

test('periods add up their days, and the funnel narrows from visitors to paid', () => {
	const days = [
		{ day: '2026-10-30', visitors: 10, views: 30, sources: { Instagram: 6, Direct: 4 }, pages: {}, juices: {}, juiceVisitors: {}, cartJuices: {}, devices: { phone: 8, computer: 2 }, places: {}, hours: Array(24).fill(0), cartVisitors: 3, checkoutVisitors: 2, juiceBrowsers: 7 },
		{ day: '2026-11-02', visitors: 5, views: 10, sources: { Instagram: 1, Google: 4 }, pages: {}, juices: {}, juiceVisitors: {}, cartJuices: {}, devices: { phone: 5 }, places: {}, hours: Array(24).fill(0), cartVisitors: 1, checkoutVisitors: 1, juiceBrowsers: 2 }
	];
	const nov = visitTotals(days, period('month', '2026-11-03'));
	assert.equal(nov.visitors, 5);
	const all = visitTotals(days, { from: '2026-10-01', to: '2026-11-04' });
	assert.equal(all.visitors, 15);
	assert.equal(all.pagesPerVisit, 40 / 15);
	assert.deepEqual(ranked(all.sources).map(r => [r.key, r.n]), [['Instagram', 7], ['Direct', 4], ['Google', 4]]);
	const steps = funnel(all, 2);
	assert.deepEqual(steps.map(s => s.n), [15, 9, 4, 3, 2]);
	assert.equal(conversion(2, 15), 13.3);
	assert.equal(conversion(1, 0), null);
	// The month under way charts the last 30 days; a finished month just its own days
	assert.equal(visitSeries(days, period('month', '2026-11-03'), '2026-11-03').bars.length, 30);
	assert.equal(visitSeries(days, period('month', '2026-11-03', -1), '2026-11-03').bars.length, 31);
	const year = visitSeries(days, period('year', '2026-11-03'), '2026-11-03');
	assert.equal(year.by, 'month');
	assert.equal(year.bars.length, 11);
	assert.equal(year.bars.find(b => b.key === '2026-10').visitors, 10);
});
