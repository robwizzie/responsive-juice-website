import { DEFAULT_JUICES, DEFAULT_SETTINGS, prepareJuices } from '../shared/catalog.js';
import { DEFAULT_COPY } from '../shared/content.js';

let request;

/**
 * Inside the admin's live preview (a same-site frame opened with ?admin-preview), the admin
 * page lends its unsaved edits through window.parent.sipPreview, so the real page shows them.
 */
export const previewHost = (() => {
	try {
		return new URLSearchParams(location.search).has('admin-preview') && window.parent !== window ? window.parent.sipPreview || null : null;
	} catch {
		return null;
	}
})();

function withDraft(catalog) {
	if (!previewHost) return catalog;
	const draft = previewHost.draft() || {};
	const settings = { ...catalog.settings, ...(draft.settings || {}) };
	let juices = catalog.juices;
	if (draft.juice) {
		const at = juices.findIndex(juice => juice.slug === (draft.replaces || draft.juice.slug));
		juices = at >= 0 ? juices.map((juice, i) => (i === at ? draft.juice : juice)) : [draft.juice, ...juices];
	}
	return { ...catalog, juices, settings, copy: { ...catalog.copy, ...(draft.copy || {}) } };
}

/** The live menu and shop settings, loaded once per page. Falls back to the built-in menu if the API is unreachable. */
export function loadCatalog() {
	request ??= fetch('/api/catalog')
		.then(res => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
		.then(catalog => ({ ...catalog, copy: { ...DEFAULT_COPY, ...catalog.copy } }))
		.catch(() => ({ juices: prepareJuices(DEFAULT_JUICES.filter(juice => juice.active), DEFAULT_SETTINGS), settings: DEFAULT_SETTINGS, copy: DEFAULT_COPY, offline: true }))
		.then(withDraft);
	return request;
}

export const escapeHtml = value =>
	String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
