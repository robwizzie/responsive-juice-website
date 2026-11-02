import { test } from 'node:test';
import assert from 'node:assert/strict';
import { booked, change, comparison, dailySeries, inRange, juiceRanking, localDay, monthlySeries, period, predictions, regulars, salesFrom, todayVsOthers, totals, weekdayPattern } from '../assets/js/admin/stats-data.js';

const juices = [
	{ slug: 'simply-orange', name: 'Simply Orange', active: true },
	{ slug: 'simply-green', name: 'Simply Green', active: true },
	{ slug: 'simply-red', name: 'Simply Blue', active: true },
	{ slug: 'simply-purple', name: 'Simply Purple', active: true }
];

let n = 0;
// An order paid at noon Philadelphia time (16:00 UTC in summer/fall) on `day`
const order = (day, lines, extra = {}) => ({
	id: `o${++n}`,
	date: day,
	status: 'paid',
	paidAt: `${day}T16:00:00Z`,
	customer: { name: 'Pat', email: 'pat@example.com' },
	type: 'pickup',
	lines: lines.map(([slug, qty, name]) => ({ slug, name: name || slug, qty, unit: 800, amount: qty * 800 })),
	total: lines.reduce((sum, [, qty]) => sum + qty * 800, 0),
	test: false,
	stage: 'done',
	...extra
});

test('sales are paid, not canceled, and real unless test orders are asked for', () => {
	const orders = [order('2026-10-01', [['simply-orange', 2]]), order('2026-10-02', [['simply-green', 1]], { stage: 'canceled' }), order('2026-10-03', [['simply-red', 3]], { test: true })];
	assert.equal(salesFrom(orders, juices).length, 1);
	assert.equal(salesFrom(orders, juices, { includeTest: true }).length, 2);
});

test('a sale counts on the Philadelphia day it was paid', () => {
	// 11:30pm in Philadelphia on Oct 31 is already Nov 1 in UTC
	assert.equal(localDay('2026-11-01T03:30:00Z'), '2026-10-31');
	assert.equal(localDay('2026-11-01T12:00:00Z'), '2026-11-01');
});

test('periods: weeks run Monday to Sunday, months and years step back cleanly', () => {
	// 2026-11-04 is a Wednesday
	assert.deepEqual(period('week', '2026-11-04'), { unit: 'week', offset: 0, from: '2026-11-02', to: '2026-11-09', previous: { from: '2026-10-26', to: '2026-11-02' } });
	assert.equal(period('week', '2026-11-08').from, '2026-11-02'); // Sunday belongs to the week before it
	const october = period('month', '2026-11-04', -1);
	assert.equal(october.from, '2026-10-01');
	assert.equal(october.to, '2026-11-01');
	assert.deepEqual(october.previous, { from: '2026-09-01', to: '2026-10-01' });
	assert.deepEqual(period('month', '2026-01-15', -1).from, '2025-12-01');
	assert.equal(period('day', '2026-11-04', -1).from, '2026-11-03');
	assert.equal(period('year', '2026-11-04').from, '2026-01-01');
	assert.equal(period('all', '2026-11-04', 0, '2026-06-01').from, '2026-06-01');
});

test('totals, ranking and the least popular juice', () => {
	const sales = salesFrom(
		[
			order('2026-10-01', [
				['simply-orange', 2],
				['simply-red', 1, 'Simply Red']
			]),
			order('2026-10-02', [['simply-orange', 1]]),
			order('2026-10-03', [['simply-green', 3]], { total: 3 * 800 + 700, type: 'delivery' })
		],
		juices
	);
	assert.deepEqual(totals(sales), { revenue: 2400 + 800 + 3100, bottles: 7, orders: 3, average: 2100 });
	const ranking = juiceRanking(sales, juices);
	assert.deepEqual(
		ranking.map(r => [r.name, r.bottles]),
		[
			['Simply Green', 3],
			['Simply Orange', 3],
			['Simply Blue', 1],
			['Simply Purple', 0]
		]
	);
	// Ties on bottles go to the one that made more (green's 3 came in one order at the same price, so revenue ties too: alphabetical)
	assert.equal(ranking[3].share, 0);
	assert.equal(Math.round(ranking[0].share * 7), 3);
	assert.equal(change(150, 100), 50);
	assert.equal(change(5, 0), null);
});

test('renamed juices keep their sales history under the new name', () => {
	const sales = salesFrom([order('2026-10-01', [['simply-red', 4, 'Simply Red']])], juices);
	assert.equal(sales[0].lines[0].name, 'Simply Blue');
	assert.equal(juiceRanking(sales, juices)[0].name, 'Simply Blue');
});

test('retired juices show only when they sold', () => {
	const withRetired = [...juices, { slug: 'old-one', name: 'Old One', active: false }];
	assert.equal(
		juiceRanking([], withRetired).some(r => r.slug === 'old-one'),
		false
	);
	const sales = salesFrom([order('2026-10-01', [['old-one', 1]])], withRetired);
	assert.equal(juiceRanking(sales, withRetired)[0].name, 'Old One');
});

test('monthly bars add up to what was paid, delivery fees included', () => {
	const sales = salesFrom([order('2026-10-05', [['simply-orange', 2]]), order('2026-11-02', [['simply-green', 3]], { total: 3 * 800 + 700 })], juices);
	const months = monthlySeries(sales, '2026-11-04', 3);
	assert.deepEqual(
		months.map(m => [m.month, m.revenue]),
		[
			['2026-09', 0],
			['2026-10', 1600],
			['2026-11', 3100]
		]
	);
	const nov = months[2];
	assert.equal([...nov.byJuice.values()].reduce((a, b) => a + b, 0) + nov.other, nov.revenue);
	assert.equal(nov.other, 700);
});

test('today against the average day and the best day', () => {
	const sales = salesFrom([order('2026-10-20', [['simply-orange', 10]]), order('2026-11-04', [['simply-orange', 1]])], juices);
	const t = todayVsOthers(sales, '2026-11-04');
	assert.equal(t.today.revenue, 800);
	// One $80 day in the last 30 (not counting today) averages to $2.67 a day
	assert.equal(t.average, Math.round(8000 / 30));
	assert.deepEqual(t.best, { day: '2026-10-20', revenue: 8000 });
	assert.equal(dailySeries(sales, '2026-11-04', 3).length, 3);
});

test('forecasts follow the recent pace', () => {
	// Four full weeks before Mon 2026-11-02, each with 4 orange and 2 green
	const orders = [];
	for (const day of ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'])
		orders.push(
			order(day, [
				['simply-orange', 4],
				['simply-green', 2]
			])
		);
	const sales = salesFrom(orders, juices);
	const p = predictions(sales, juices, '2026-11-04');
	assert.equal(p.nextWeek.find(r => r.slug === 'simply-orange').expected, 4);
	assert.equal(p.nextWeek.find(r => r.slug === 'simply-green').expected, 2);
	assert.equal(p.nextWeekBottles, 6);
	assert.equal(p.confident, true);
	// Nothing sold yet in November: the forecast is the recent daily pace times the days left
	const last28 = inRange(sales, { from: '2026-10-07', to: '2026-11-04' });
	const pace = totals(last28).revenue / 28;
	assert.equal(p.monthForecast, Math.round(pace * 26));
});

test('booked bottles, regulars and busiest days', () => {
	const sales = salesFrom(
		[
			order('2026-11-06', [['simply-orange', 2]], { stage: 'new', paidAt: '2026-11-03T16:00:00Z' }),
			order('2026-11-06', [['simply-orange', 1]], { stage: 'ready', paidAt: '2026-11-03T17:00:00Z', customer: { name: 'Sam', email: 'SAM@example.com' } }),
			order('2026-10-01', [['simply-green', 1]], { customer: { name: 'Sam', email: 'sam@example.com' } })
		],
		juices
	);
	const b = booked(sales, '2026-11-04');
	assert.equal(b.bottles, 2); // the ready one is already made
	const r = regulars(sales);
	assert.equal(r.customers, 2);
	assert.equal(r.top[0].name, 'Sam');
	assert.equal(r.top[0].orders, 2);
	const days = weekdayPattern(sales);
	assert.equal(days[2].orders, 2); // both Nov 3 orders were on a Tuesday
});

test('a period under way is compared with the same days of the one before', () => {
	// Nov 2: November so far (2 days) vs Oct 1–2, not all of October
	assert.deepEqual(comparison(period('month', '2026-11-02'), '2026-11-02'), { from: '2026-10-01', to: '2026-10-03', sameDays: true });
	// A finished month is compared with the whole month before
	assert.deepEqual(comparison(period('month', '2026-11-02', -1), '2026-11-02'), { from: '2026-09-01', to: '2026-10-01', sameDays: false });
	// March 31 against February: February runs out first, so the whole of it
	assert.deepEqual(comparison(period('month', '2026-03-31'), '2026-03-31'), { from: '2026-02-01', to: '2026-03-01', sameDays: false });
	// Wednesday: this week's Mon–Wed vs last week's Mon–Wed
	assert.deepEqual(comparison(period('week', '2026-11-04'), '2026-11-04'), { from: '2026-10-26', to: '2026-10-29', sameDays: true });
	assert.equal(comparison(period('all', '2026-11-04'), '2026-11-04'), null);
});
