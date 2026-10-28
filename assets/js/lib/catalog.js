import { DEFAULT_JUICES, DEFAULT_SETTINGS } from '../shared/catalog.js';

let request;

/** The live menu and shop settings, loaded once per page. Falls back to the built-in menu if the API is unreachable. */
export function loadCatalog() {
	request ??= fetch('/api/catalog')
		.then(res => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
		.catch(() => ({ juices: DEFAULT_JUICES.filter(juice => juice.active), settings: DEFAULT_SETTINGS, offline: true }));
	return request;
}

export const escapeHtml = value =>
	String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
