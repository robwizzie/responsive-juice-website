/**
 * Where an order is in Hunter's day: new → making → ready → done (picked up or delivered).
 * Shared by the admin and the admin function so both agree on the steps and their names.
 */
export const ORDER_STAGES = ['new', 'making', 'ready', 'done', 'canceled'];

// Orders saved before stages existed have none, so they start as new
export const orderStage = order => (ORDER_STAGES.includes(order?.stage) ? order.stage : 'new');

export const isOpen = order => !['done', 'canceled'].includes(orderStage(order));

// Stripe test-mode orders. Older orders didn't record it, but their session id says so.
export const isTestOrder = order => (typeof order?.test === 'boolean' ? order.test : /^cs_test_/.test(order?.stripeSessionId || ''));

export function stageLabel(stage, type) {
	if (stage === 'done') return type === 'delivery' ? 'Delivered' : type === 'handoff' ? 'Handed over' : 'Picked up';
	return { new: 'New', making: 'Making', ready: 'Ready', canceled: 'Canceled' }[stage] || 'New';
}

/** The one button that moves an order along, or null once it's finished. */
export function nextStep(order) {
	const stage = orderStage(order);
	if (stage === 'new') return { stage: 'making', label: 'Start making' };
	if (stage === 'making') return { stage: 'ready', label: 'Mark ready' };
	if (stage === 'ready') return { stage: 'done', label: order.type === 'delivery' ? 'Mark delivered' : order.type === 'handoff' ? 'Mark handed over' : 'Mark picked up' };
	return null;
}

/** The juice an order line was for, even if Hunter has since renamed it or changed its page address. */
export const juiceForLine = (line, juices = []) => juices.find(j => j.slug === line.slug) || juices.find(j => j.formerSlugs?.includes(line.slug)) || null;

/**
 * An order's lines named the way the menu names them today, so renaming a juice (Simply Red to
 * Simply Blue) updates past orders too. `orderedAs` keeps the name at checkout when it differs.
 * Lines for juices that no longer exist keep their saved name.
 */
export function currentLines(order, juices) {
	return order.lines.map(line => {
		const juice = juiceForLine(line, juices);
		if (!juice) return line;
		return { ...line, slug: juice.slug, name: juice.name, ...(juice.name !== line.name ? { orderedAs: line.name } : {}) };
	});
}

/*
 * Where an order came from. Website orders carry no `source`. Sales Hunter types in himself
 * (cash, Venmo, Instagram DMs, cafes) are `manual`, and Stripe payments that didn't go through the
 * site's checkout (a Payment Link, Tap to Pay) are `stripe`.
 */
export const orderSource = order => (order?.source === 'manual' || order?.source === 'stripe' ? order.source : 'website');
export const isOutsideSale = order => orderSource(order) !== 'website';

// Where Hunter made the sale (manual sales only)
export const SALE_CHANNELS = [
	{ id: 'in-person', label: 'In person' },
	{ id: 'instagram', label: 'Instagram' },
	{ id: 'text', label: 'Text or call' },
	{ id: 'wholesale', label: 'Wholesale' },
	{ id: 'event', label: 'Pop-up or event' },
	{ id: 'other', label: 'Other' }
];

// How it was paid. `unpaid` is for a sale that's still owed, like a cafe paying later.
export const PAYMENT_METHODS = [
	{ id: 'cash', label: 'Cash' },
	{ id: 'venmo', label: 'Venmo' },
	{ id: 'zelle', label: 'Zelle' },
	{ id: 'cashapp', label: 'Cash App' },
	{ id: 'card', label: 'Card' },
	{ id: 'other', label: 'Other' },
	{ id: 'unpaid', label: 'Not paid yet' }
];

// How the bottles reach the customer. `handoff` means he already handed them over.
export const HANDOFF_TYPES = ['pickup', 'delivery', 'handoff'];

/** The short tag on an order card: Website, Instagram, Cash, Stripe link, Tap to Pay… */
export function sourceLabel(order) {
	const source = orderSource(order);
	if (source === 'website') return 'Website';
	if (source === 'stripe') return { link: 'Payment Link', tap: 'Tap to Pay', qr: 'QR checkout' }[order.stripe?.kind] || 'Stripe';
	return SALE_CHANNELS.find(c => c.id === order.channel)?.label || 'Outside sale';
}

/** How it was paid, in words. */
export function paymentLabel(order) {
	const source = orderSource(order);
	if (source === 'website') return isTestOrder(order) ? 'Stripe test mode' : 'Paid with Stripe';
	if (source === 'stripe') return isTestOrder(order) ? 'Stripe test mode' : `Card through Stripe (${sourceLabel(order)})`;
	if (order.status === 'unpaid') return 'Not paid yet';
	return PAYMENT_METHODS.find(p => p.id === order.payment)?.label || 'Paid';
}

/** A real Stripe payment (like Tap to Pay) still waiting for Hunter to say which juices it was. */
export const needsJuices = order => Boolean(order?.needsDetails) && !isTestOrder(order) && orderStage(order) !== 'canceled';

/** The name to show for an order; outside sales can leave it blank. */
export const customerName = order => order?.customer?.name || (orderSource(order) === 'stripe' ? 'Stripe payment' : 'Walk-up sale');
