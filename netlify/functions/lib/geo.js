/**
 * Turns a delivery address into coordinates so we can check the delivery radius.
 * Uses the free US Census geocoder (no key needed). If GOOGLE_MAPS_API_KEY is set it is
 * used as a fallback for addresses the Census data doesn't know.
 */
import { nearestZone } from '../../../assets/js/shared/order-rules.js';

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

async function google(address) {
	const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
	url.search = new URLSearchParams({ address, key: process.env.GOOGLE_MAPS_API_KEY, components: 'country:US' });
	const data = await fetchJSON(url);
	const match = data?.results?.[0];
	return match ? { ...match.geometry.location, matched: match.formatted_address } : null;
}

export const formatAddress = ({ line1, line2, city, state, zip }) => [line1, line2, city, `${state || 'NJ'} ${zip || ''}`.trim()].filter(Boolean).join(', ');

/**
 * Returns { status: 'in' | 'out' | 'unknown' | 'unverified', miles?, matched?, zone? }.
 * 'unknown' means the address couldn't be found; 'unverified' means the lookup service was down.
 */
export async function checkDeliveryAddress(address, settings) {
	const oneLine = formatAddress(address);
	let point = null;
	let serviceFailed = false;

	for (const lookup of [census, process.env.GOOGLE_MAPS_API_KEY ? google : null].filter(Boolean)) {
		try {
			point = await lookup(oneLine);
			if (point) break;
		} catch (err) {
			console.error('Geocoding failed:', err.message);
			serviceFailed = true;
		}
	}

	if (!point) return { status: serviceFailed ? 'unverified' : 'unknown' };

	const { zone, miles } = nearestZone(point, settings);
	return {
		status: miles <= settings.delivery.radiusMiles ? 'in' : 'out',
		miles: Math.round(miles * 10) / 10,
		matched: point.matched,
		zone: zone.label
	};
}
