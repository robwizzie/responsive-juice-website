/**
 * The cart lives in localStorage as { slug: quantity } and announces changes with a
 * `cart:change` event on window, so the header badge, drawer and order page stay in sync.
 */
const KEY = 'siponpressed-cart';

function read() {
	try {
		const value = JSON.parse(localStorage.getItem(KEY) || '{}');
		return value && typeof value === 'object' ? value : {};
	} catch {
		return {};
	}
}

function write(cart) {
	try {
		localStorage.setItem(KEY, JSON.stringify(cart));
	} catch {
		/* private mode: cart just won't persist */
	}
	window.dispatchEvent(new CustomEvent('cart:change', { detail: cart }));
}

export const getCart = read;

export function setQty(slug, qty) {
	const cart = read();
	const next = Math.max(0, Math.min(99, Math.floor(qty) || 0));
	if (next === 0) delete cart[slug];
	else cart[slug] = next;
	write(cart);
}

export const addToCart = (slug, qty = 1) => setQty(slug, (read()[slug] || 0) + qty);

export const clearCart = () => write({});

export const cartCount = (cart = read()) => Object.values(cart).reduce((sum, qty) => sum + qty, 0);

/** Cart entries joined with juice details, dropping anything no longer on the menu. */
export function cartLines(juices, cart = read()) {
	return Object.entries(cart)
		.map(([slug, qty]) => ({ juice: juices.find(juice => juice.slug === slug), qty }))
		.filter(line => line.juice);
}

window.addEventListener('storage', event => {
	if (event.key === KEY) window.dispatchEvent(new CustomEvent('cart:change', { detail: read() }));
});
