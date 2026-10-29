import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from '../assets/js/shared/catalog.js';
import { milesFromCenter, pickupAddress } from '../assets/js/shared/order-rules.js';
import { checkDeliveryAddress, deliveryCenterFor, formatAddress } from '../netlify/functions/lib/geo.js';
import { cleanSettings } from '../netlify/functions/lib/validate.js';
import { upgradeSettings, mergeDeep } from '../netlify/functions/lib/store.js';
import { DEFAULT_COPY, copyText, fillTokens } from '../assets/js/shared/content.js';

// Real US Census geocoder results (looked up Oct 29 2026), so the distances match what the live site sees
const PLACES = {
	'1400 John F Kennedy Blvd, Philadelphia, PA 19107': { lat: 39.953309, lng: -75.16341 },
	'200 College Dr, Blackwood, NJ 08012': { lat: 39.784026, lng: -75.048524 },
	'1000 N King St, Wilmington, DE 19801': { lat: 39.745229, lng: -75.54685 },
	'125 W State St, Trenton, NJ 08608': { lat: 40.220782, lng: -74.769386 },
	'640 E Wood St, Vineland, NJ 08360': { lat: 39.48713, lng: -75.022385 },
	'1900 Market St, Philadelphia, PA 19103': { lat: 39.953, lng: -75.1725 }
};

const realFetch = globalThis.fetch;
const lookups = [];
function fakeCensus({ down = false } = {}) {
	globalThis.fetch = async url => {
		const address = new URL(url).searchParams.get('address');
		lookups.push(address);
		if (down) throw new Error('network down');
		const place = PLACES[address];
		const addressMatches = place ? [{ matchedAddress: address.toUpperCase(), coordinates: { x: place.lng, y: place.lat } }] : [];
		return new Response(JSON.stringify({ result: { addressMatches } }));
	};
}
afterEach(() => {
	globalThis.fetch = realFetch;
	lookups.length = 0;
});

const split = oneLine => {
	const [line1, city, stateZip] = oneLine.split(', ');
	const [state, zip] = stateZip.split(' ');
	return { line1, city, state, zip };
};

test('delivery is 25 miles from the pickup spot on Jackson Street', () => {
	assert.equal(DEFAULT_SETTINGS.delivery.radiusMiles, 25);
	assert.equal(DEFAULT_SETTINGS.delivery.center.address, pickupAddress(DEFAULT_SETTINGS.pickup));
	assert.equal(DEFAULT_SETTINGS.delivery.zones, undefined);
	assert.equal(DEFAULT_SETTINGS.delivery.areaLabel, 'Greater Philly');
	const miles = place => Math.round(milesFromCenter(PLACES[place], DEFAULT_SETTINGS));
	assert.equal(miles('1400 John F Kennedy Blvd, Philadelphia, PA 19107'), 2);
	assert.equal(miles('200 College Dr, Blackwood, NJ 08012'), 12);
	assert.equal(miles('1000 N King St, Wilmington, DE 19801'), 23);
	assert.equal(miles('125 W State St, Trenton, NJ 08608'), 30);
	assert.equal(miles('640 E Wood St, Vineland, NJ 08360'), 31);
});

test('real Philly, South Jersey and Delaware addresses land inside or outside the radius', async () => {
	fakeCensus();
	const check = async place => checkDeliveryAddress(split(place), DEFAULT_SETTINGS);
	assert.deepEqual(await check('1400 John F Kennedy Blvd, Philadelphia, PA 19107'), {
		status: 'in',
		miles: 2.2,
		matched: '1400 JOHN F KENNEDY BLVD, PHILADELPHIA, PA 19107',
		zone: 'the pickup spot'
	});
	assert.equal((await check('200 College Dr, Blackwood, NJ 08012')).status, 'in');
	assert.equal((await check('1000 N King St, Wilmington, DE 19801')).status, 'in');
	assert.equal((await check('125 W State St, Trenton, NJ 08608')).status, 'out');
	assert.equal((await check('640 E Wood St, Vineland, NJ 08360')).status, 'out');
	assert.equal((await check('1 Nowhere Ln, Philadelphia, PA 19145')).status, 'unknown');
	// The state the customer picked is what gets looked up (it used to always say NJ)
	assert.ok(lookups.includes('1400 John F Kennedy Blvd, Philadelphia, PA 19107'));
	assert.equal(formatAddress({ line1: '1 Main St', city: 'Philadelphia', zip: '19145' }), '1 Main St, Philadelphia, PA 19145');

	fakeCensus({ down: true });
	assert.deepEqual(await check('125 W State St, Trenton, NJ 08608'), { status: 'unverified' });
});

test('moving the pickup address in Settings moves the delivery radius with it', async () => {
	fakeCensus();
	const current = DEFAULT_SETTINGS.delivery.center;
	assert.deepEqual(await deliveryCenterFor(DEFAULT_SETTINGS.pickup, current), { center: current });
	assert.equal(lookups.length, 0, 'an unchanged address is not looked up again');

	const moved = await deliveryCenterFor({ address: '1900 Market St', area: 'Philadelphia, PA 19103' }, current);
	assert.deepEqual(moved, { center: { address: '1900 Market St, Philadelphia, PA 19103', lat: 39.953, lng: -75.1725 } });
	const settings = { ...DEFAULT_SETTINGS, delivery: { ...DEFAULT_SETTINGS.delivery, center: moved.center } };
	assert.equal(Math.round(milesFromCenter(PLACES['1400 John F Kennedy Blvd, Philadelphia, PA 19107'], settings) * 10) / 10, 0.5);

	const typo = await deliveryCenterFor({ address: '1 Nowhere Ln', area: 'Philadelphia, PA' }, current);
	assert.equal(typo.center, current, 'a bad address keeps the old centre');
	assert.match(typo.warning, /1903 Jackson Street/);
});

test('settings saved before the move drop the South Jersey towns and 30 mile radius', () => {
	const old = { delivery: { radiusMiles: 30, areaLabel: 'South Jersey', zones: [{ label: 'Blackwood, NJ', lat: 39.8, lng: -75.06 }], fee: 5 } };
	const settings = mergeDeep(DEFAULT_SETTINGS, upgradeSettings(old));
	assert.equal(settings.delivery.radiusMiles, 25);
	assert.equal(settings.delivery.areaLabel, 'Greater Philly');
	assert.equal(settings.delivery.zones, undefined);
	assert.equal(settings.delivery.fee, 5, 'other saved values are kept');
	// Once saved under the new version, Hunter's own radius sticks, even 30
	assert.equal(mergeDeep(DEFAULT_SETTINGS, upgradeSettings({ delivery: { radiusMiles: 30 } })).delivery.radiusMiles, 30);
	const saved = cleanSettings({ ...DEFAULT_SETTINGS, delivery: { ...DEFAULT_SETTINGS.delivery } }, { ...DEFAULT_SETTINGS, delivery: { ...DEFAULT_SETTINGS.delivery, zones: [] } });
	assert.equal('zones' in saved.value.delivery, false);
	assert.deepEqual(saved.value.delivery.center, DEFAULT_SETTINGS.delivery.center);
});

test('no page text mentions Blackwood, Woodbury or South Jersey', () => {
	const all = Object.keys(DEFAULT_COPY).map(key => copyText(DEFAULT_COPY, key, DEFAULT_SETTINGS)).join('\n');
	assert.doesNotMatch(all, /Blackwood|Woodbury|South Jersey/);
	assert.equal(fillTokens('within {deliveryRadius} of {deliveryTowns}', DEFAULT_SETTINGS), 'within 25 miles of our Philadelphia pickup spot', 'old saved text still reads right');
});
