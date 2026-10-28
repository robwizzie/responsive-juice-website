import { DEFAULT_JUICES, DEFAULT_SETTINGS, prepareJuices } from '../shared/catalog.js';
import { DEFAULT_COPY } from '../shared/content.js';

let request;

/** The live menu and shop settings, loaded once per page. Falls back to the built-in menu if the API is unreachable. */
export function loadCatalog() {
	request ??= fetch('/api/catalog')
		.then(res => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
		.then(catalog => ({ ...catalog, copy: { ...DEFAULT_COPY, ...catalog.copy } }))
		.catch(() => ({ juices: prepareJuices(DEFAULT_JUICES.filter(juice => juice.active), DEFAULT_SETTINGS), settings: DEFAULT_SETTINGS, copy: DEFAULT_COPY, offline: true }));
	return request;
}

export const escapeHtml = value =>
	String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
