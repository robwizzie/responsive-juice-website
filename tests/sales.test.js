import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanSale, linesFromStripe, mergeStripeOrders, orderFromLinkSession, orderFromPaymentIntent, spreadTotal, stripeDay } from '../netlify/functions/lib/sales.js';
import { customerName, isOutsideSale, paymentLabel, sourceLabel, stageLabel } from '../assets/js/shared/order-status.js';
import { regulars, salesFrom, sourceSplit } from '../assets/js/admin/stats-data.js';

const juices = [
	{ slug: 'simply-orange', name: 'Simply Orange', price: 8, color: '#f90' },
	{ slug: 'simply-green', name: 'Simply Green', price: 8, color: '#0a0' }
];
const now = new Date('2026-11-04T20:00:00Z');

test('a handed-over cash sale is done right away, at menu price', () => {
	const { value } = cleanSale({ items: [{ slug: 'simply-orange', qty: 2 }, { slug: 'simply-green', qty: 1 }], date: '2026-11-04' }, juices, { now });
	assert.equal(value.type, 'handoff');
	assert.equal(value.stage, 'done');
	assert.equal(value.payment, 'cash');
	assert.equal(value.channel, 'in-person');
	assert.equal(value.total, 2400);
	assert.equal(value.paidAt, now.toISOString());
	assert.equal(stageLabel(value.stage, value.type), 'Handed over');
	assert.equal(customerName(value), 'Walk-up sale');
	assert.ok(isOutsideSale(value));
});

test('wholesale owed later, logged for a past day', () => {
	const { value } = cleanSale({ items: [{ slug: 'simply-green', qty: 12 }], total: 6000, payment: 'unpaid', channel: 'wholesale', type: 'delivery', date: '2026-11-02', address: 'Cafe on 9th', customer: { name: 'Cafe' } }, juices, { now });
	assert.equal(value.status, 'unpaid');
	assert.equal(value.paidAt, null);
	assert.equal(value.soldAt, '2026-11-02T17:00:00.000Z');
	assert.equal(value.stage, 'new');
	assert.deepEqual(value.address, { line1: 'Cafe on 9th' });
	assert.equal(paymentLabel(value), 'Not paid yet');
	assert.equal(sourceLabel(value), 'Wholesale');

	// Paid a few days later: it counts from when it was paid
	const later = new Date('2026-11-06T15:00:00Z');
	const { value: paid } = cleanSale({ items: [{ slug: 'simply-green', qty: 12 }], total: 6000, payment: 'zelle', channel: 'wholesale', type: 'delivery', date: '2026-11-02' }, juices, { existing: value, now: later });
	assert.equal(paid.status, 'paid');
	assert.equal(paid.paidAt, '2026-11-02T17:00:00.000Z', 'a past-dated sale counts on its day');
	assert.equal(paid.id, value.id);
	assert.equal(paid.stage, 'new', 'progress is kept');
});

test('bad sales are refused', () => {
	assert.ok(cleanSale({ items: [], date: '2026-11-04' }, juices, { now }).error);
	assert.ok(cleanSale({ items: [{ slug: 'nope', qty: 1 }], date: '2026-11-04' }, juices, { now }).error);
	assert.ok(cleanSale({ items: [{ slug: 'simply-orange', qty: 1 }], date: 'tomorrow' }, juices, { now }).error);
	assert.ok(cleanSale({ items: [{ slug: 'simply-orange', qty: 1 }], date: '2026-11-04', total: -5 }, juices, { now }).error);
	assert.ok(cleanSale({ items: [{ slug: 'simply-orange', qty: 501 }], date: '2026-11-04' }, juices, { now }).error);
});

test('a deal price adds up line by line', () => {
	const lines = spreadTotal([{ slug: 'a', qty: 2, unit: 800 }, { slug: 'b', qty: 1, unit: 800 }], 2000);
	assert.deepEqual(lines.map(l => l.amount), [1333, 667]);
});

test('Stripe: Tap to Pay, Payment Links, and the two events for one payment', () => {
	const created = Math.floor(Date.parse('2026-11-05T03:30:00Z') / 1000);
	assert.equal(stripeDay(created), '2026-11-04', 'Philadelphia day');

	const tap = orderFromPaymentIntent({ id: 'pi_1', amount: 1600, amount_received: 1600, payment_method_types: ['card_present'], receipt_email: 'a@b.co' }, { livemode: true, created });
	assert.equal(tap.type, 'handoff');
	assert.equal(tap.stage, 'done');
	assert.equal(sourceLabel(tap), 'Tap to Pay');
	assert.equal(customerName(tap), 'Stripe payment');

	const online = orderFromPaymentIntent({ id: 'pi_2', amount: 2400, payment_method_types: ['card'] }, { livemode: false, created });
	assert.equal(online.stage, 'new');
	assert.equal(online.test, true);

	const lines = linesFromStripe([{ description: 'Simply Orange', quantity: 2, amount_total: 1600 }, { description: 'Gift box', quantity: 1, amount_total: 500 }], juices);
	assert.equal(lines[0].slug, 'simply-orange');
	assert.equal(lines[1].name, 'Gift box');

	const session = { id: 'cs_live_1', payment_intent: 'pi_2', payment_link: 'plink_1', amount_total: 2100, customer_details: { name: 'Jo', email: 'jo@x.co' } };
	const link = orderFromLinkSession(session, [{ description: 'simply orange', quantity: 2, amount_total: 1600 }], juices, { livemode: true, created });
	assert.equal(link.id, 'pi_2', 'same id as the payment event');
	assert.equal(sourceLabel(link), 'Payment Link');

	// Payment event first, then the checkout fills in the juices and keeps Hunter's progress
	const merged = mergeStripeOrders({ ...online, stage: 'making' }, link);
	assert.equal(merged.stage, 'making');
	assert.equal(merged.lines.length, 1);
	assert.equal(merged.needsDetails, false);
	assert.equal(merged.customer.name, 'Jo');
	// Checkout first: the payment event changes nothing
	assert.equal(mergeStripeOrders(link, online), link);
});

test('stats count outside sales, and regulars without an email', () => {
	const sale = (id, customer, extra = {}) => ({ id, date: '2026-11-04', type: 'handoff', stage: 'done', status: 'paid', total: 800, lines: [{ slug: 'simply-orange', name: 'Simply Orange', qty: 1, amount: 800 }], customer, createdAt: '2026-11-04T15:00:00Z', ...extra });
	const orders = [
		sale('1', { name: 'Ana', phone: '(215) 555-0100' }, { source: 'manual' }),
		sale('2', { name: 'Ana P', phone: '215-555-0100' }, { source: 'manual', status: 'unpaid', soldAt: '2026-11-03T17:00:00Z' }),
		sale('3', { name: 'Web', email: 'web@x.co' }, { paidAt: '2026-11-04T15:00:00Z', test: false })
	];
	const sales = salesFrom(orders, juices);
	assert.equal(sales.length, 3);
	assert.equal(sales[0].day, '2026-11-03', 'unpaid sale counts from the day it was made');
	assert.deepEqual(sourceSplit(sales), { website: 1, outside: 2, websiteRevenue: 800, outsideRevenue: 1600 });
	assert.equal(regulars(sales).returning, 1, 'matched by phone number');
});
