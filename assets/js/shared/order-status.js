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
	if (stage === 'done') return type === 'delivery' ? 'Delivered' : 'Picked up';
	return { new: 'New', making: 'Making', ready: 'Ready', canceled: 'Canceled' }[stage] || 'New';
}

/** The one button that moves an order along, or null once it's finished. */
export function nextStep(order) {
	const stage = orderStage(order);
	if (stage === 'new') return { stage: 'making', label: 'Start making' };
	if (stage === 'making') return { stage: 'ready', label: 'Mark ready' };
	if (stage === 'ready') return { stage: 'done', label: order.type === 'delivery' ? 'Mark delivered' : 'Mark picked up' };
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
