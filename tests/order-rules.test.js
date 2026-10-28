import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_JUICES, DEFAULT_SETTINGS } from '../assets/js/shared/catalog.js';
import { availableDates, priceOrder, todayISO } from '../assets/js/shared/order-rules.js';

// Wednesday Oct 28 2026, noon in Philadelphia
const WED = new Date('2026-10-28T16:00:00Z');
// Friday Oct 30 2026, after the Thursday cutoff
const FRI = new Date('2026-10-30T16:00:00Z');

test('today is computed in Philadelphia time', () => {
	assert.equal(todayISO(new Date('2026-10-29T03:30:00Z')), '2026-10-28');
});

test('Monday delivery dates respect the Thursday cutoff', () => {
	assert.equal(availableDates(DEFAULT_SETTINGS, 'delivery', WED)[0], '2026-11-02');
	assert.equal(availableDates(DEFAULT_SETTINGS, 'delivery', FRI)[0], '2026-11-09');
});

test('pickup dates need two days notice and skip Sundays', () => {
	const dates = availableDates(DEFAULT_SETTINGS, 'pickup', WED);
	assert.equal(dates[0], '2026-10-30');
	assert.ok(!dates.includes('2026-11-01'));
});

test('delivery needs the minimum number of bottles', () => {
	const small = priceOrder({ items: [{ slug: 'simply-red', qty: 5 }], type: 'delivery' }, DEFAULT_JUICES, DEFAULT_SETTINGS, WED);
	assert.equal(small.ok, false);
	const enough = priceOrder({ items: [{ slug: 'simply-red', qty: 6 }], type: 'delivery', date: '2026-11-02' }, DEFAULT_JUICES, DEFAULT_SETTINGS, WED);
	assert.equal(enough.ok, true);
	assert.equal(enough.subtotal, 4500);
	assert.equal(enough.deliveryFee, 700);
	assert.equal(enough.total, 5200);
});

test('delivery is free over the threshold', () => {
	const big = priceOrder({ items: [{ slug: 'simply-green', qty: 7 }], type: 'delivery' }, DEFAULT_JUICES, DEFAULT_SETTINGS, WED);
	assert.equal(big.deliveryFee, 0);
});

test('prices come from the menu, not the request, and bad items are rejected', () => {
	const order = priceOrder({ items: [{ slug: 'simply-orange', qty: 2, price: 0.01 }], type: 'pickup' }, DEFAULT_JUICES, DEFAULT_SETTINGS, WED);
	assert.equal(order.total, 1500);
	const unknown = priceOrder({ items: [{ slug: 'nope', qty: 1 }], type: 'pickup' }, DEFAULT_JUICES, DEFAULT_SETTINGS, WED);
	assert.equal(unknown.ok, false);
	const soldOut = priceOrder({ items: [{ slug: 'simply-red', qty: 1 }], type: 'pickup' }, DEFAULT_JUICES.map(j => ({ ...j, status: 'sold-out' })), DEFAULT_SETTINGS, WED);
	assert.match(soldOut.errors[0], /sold out/);
	const teaser = priceOrder({ items: [{ slug: 'simply-red', qty: 1 }], type: 'pickup' }, DEFAULT_JUICES.map(j => ({ ...j, status: 'coming-soon' })), DEFAULT_SETTINGS, WED);
	assert.match(teaser.errors[0], /isn't available yet/);
	// Menus saved before statuses existed only have inStock
	const legacy = priceOrder({ items: [{ slug: 'simply-red', qty: 1 }], type: 'pickup' }, DEFAULT_JUICES.map(({ status, ...j }) => ({ ...j, inStock: false })), DEFAULT_SETTINGS, WED);
	assert.match(legacy.errors[0], /sold out/);
});

test('dates outside the allowed list are rejected', () => {
	const order = priceOrder({ items: [{ slug: 'simply-red', qty: 1 }], type: 'pickup', date: '2026-11-01' }, DEFAULT_JUICES, DEFAULT_SETTINGS, WED);
	assert.equal(order.ok, false);
});
