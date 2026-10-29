/**
 * Turns a delivery address into coordinates so we can check the delivery radius, which is
 * measured from the pickup spot. Uses the free US Census geocoder (no key needed).
 */
import { milesFromCenter, pickupAddress } from '../../../assets/js/shared/order-rules.js';

const TIMEOUT_MS = 6000;

async function fetchJSON(url) {
	const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
	if (!res.ok) throw new Error(`Geocoder responded ${res.status}`);
	return res.json();
}

async function census(address) {
	const url = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress');
	url.search = new URLSearchParams({ address, benchmark: 'Public_AR_Current', format: 'json' });
	const data = await fetchJSON(url);
	const match = data?.result?.addressMatches?.[0];
	return match ? { lat: match.coordinates.y, lng: match.coordinates.x, matched: match.matchedAddress } : null;
}

export const formatAddress = ({ line1, line2, city, state, zip }) => [line1, line2, city, `${state || 'PA'} ${zip || ''}`.trim()].filter(Boolean).join(', ');

/**
 * The delivery centre for a pickup spot. Reuses `current` when the pickup address hasn't changed;
 * otherwise looks the new one up. Returns { center } or { center: current, warning } if the lookup fails.
 */
export async function deliveryCenterFor(pickup, current) {
	const address = pickupAddress(pickup);
	if (current && current.address === address) return { center: current };
	let point = null;
	try {
		point = await census(address);
	} catch (err) {
		console.error('Geocoding the pickup address failed:', err.message);
	}
	if (!point) {
		return { center: current, warning: `We couldn't find "${address}" on the map, so the delivery radius is still measured from ${current?.address || 'the old pickup spot'}. Check the address and save again.` };
	}
	return { center: { address, lat: Math.round(point.lat * 1e6) / 1e6, lng: Math.round(point.lng * 1e6) / 1e6 } };
}

/**
 * Returns { status: 'in' | 'out' | 'unknown' | 'unverified', miles?, matched?, zone? }.
 * 'unknown' means the address couldn't be found; 'unverified' means the lookup service was down.
 */
export async function checkDeliveryAddress(address, settings) {
	const oneLine = formatAddress(address);
	let point = null;
	let serviceFailed = false;

	try {
		point = await census(oneLine);
	} catch (err) {
		console.error('Geocoding failed:', err.message);
		serviceFailed = true;
	}

	if (!point) return { status: serviceFailed ? 'unverified' : 'unknown' };

	const miles = milesFromCenter(point, settings);
	return {
		status: miles <= settings.delivery.radiusMiles ? 'in' : 'out',
		miles: Math.round(miles * 10) / 10,
		matched: point.matched,
		// What the distance is measured from, shown as "4.2 mi from the pickup spot"
		zone: 'the pickup spot'
	};
}
