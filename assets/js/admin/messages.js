/**
 * Admin → Messages: everything sent through the contact form. New ones count on the tab badge
 * until Hunter opens them; Archive tucks a message away once it's dealt with.
 */
import { icon } from '../lib/icons.js';
import { escapeHtml as e } from '../lib/catalog.js';
import { juiceLoader } from '../lib/components.js';
import { api, guarded, toast, updateCounts } from './admin.js';

let state = null;

const keyOf = m => `${m.createdAt}/${m.id}`;

function when(iso) {
	const minutes = Math.round((Date.now() - new Date(iso)) / 60000);
	if (minutes < 1) return 'Just now';
	if (minutes < 60) return `${minutes} min ago`;
	if (minutes < 60 * 24) return `${Math.round(minutes / 60)} hr ago`;
	return new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

function card(m) {
	const reply = `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(`Re: ${m.topic}`)}`;
	return `
		<article class="message${m.read ? '' : ' message--unread'}" data-message="${e(keyOf(m))}">
			<header class="message__head">
				<div>
					<p class="message__name">${m.read ? '' : '<span class="message__dot" aria-label="New"></span>'}${e(m.name)}</p>
					<p class="message__from">${e(m.email)}</p>
				</div>
				<div class="message__when">
					<span class="message__topic">${e(m.topic)}</span>
					<time datetime="${e(m.createdAt)}">${when(m.createdAt)}</time>
				</div>
			</header>
			<p class="message__body">${e(m.message)}</p>
			${m.emailFailed ? `<p class="hint hint--warn">${icon('info')} This one didn't reach your inbox, so reply from here.</p>` : ''}
			<div class="message__actions">
				<a class="btn btn--ink btn--sm" href="${reply}" data-reply>${icon('mail')} Reply</a>
				${m.archived ? '<button type="button" class="btn btn--outline btn--sm" data-archive="false">Move to inbox</button>' : '<button type="button" class="btn btn--outline btn--sm" data-archive="true">Archive</button>'}
				<button type="button" class="btn btn--ghost btn--sm" data-read="${!m.read}">${m.read ? 'Mark unread' : 'Mark read'}</button>
				${m.archived ? `<button type="button" class="icon-btn icon-btn--light" data-delete aria-label="Delete message" title="Delete">${icon('trash')}</button>` : ''}
			</div>
		</article>`;
}

function renderList() {
	const box = document.querySelector('[data-messages]');
	if (!box || !state.messages) return;
	const archived = state.messageFilter === 'archived';
	const shown = state.messages.filter(m => Boolean(m.archived) === archived);
	const inbox = state.messages.filter(m => !m.archived).length;
	box.innerHTML = `
		<div class="order-filters" role="tablist" aria-label="Show messages">
			<button type="button" role="tab" class="order-filter${archived ? '' : ' is-active'}" aria-selected="${!archived}" data-filter="inbox">Inbox<span>${inbox}</span></button>
			<button type="button" role="tab" class="order-filter${archived ? ' is-active' : ''}" aria-selected="${archived}" data-filter="archived">Archived<span>${state.messages.length - inbox}</span></button>
		</div>
		${shown.length ? `<div class="messages">${shown.map(card).join('')}</div>` : `<p class="empty">${archived ? 'Messages you archive land here.' : 'No messages. Anything sent from the Contact page shows up here and in your inbox.'}</p>`}`;
}

async function update(key, change) {
	const data = await guarded(() => api('messages', { method: 'PUT', json: { key, ...change } })).catch(() => null);
	if (!data) return;
	state.messages = state.messages.map(m => (keyOf(m) === key ? data.message : m));
	updateCounts();
	renderList();
}

export async function renderMessages(adminState) {
	state = adminState;
	state.messageFilter ||= 'inbox';
	const main = document.getElementById('admin-main');
	main.innerHTML = `
		<div class="admin-head"><div><h1 class="admin-title">Messages</h1><p class="muted">Notes people send from the Contact page. Tap <strong>Reply</strong> to answer by email.</p></div><button type="button" class="btn btn--ghost" data-refresh>Refresh</button></div>
		<div data-messages>${state.messages ? '' : `<div class="admin-loading admin-loading--inline">${juiceLoader('Getting your messages&hellip;')}</div>`}</div>`;
	main.querySelector('[data-refresh]').addEventListener('click', async event => {
		event.currentTarget.disabled = true;
		await updateCounts({ reload: true });
		event.currentTarget.disabled = false;
	});
	main.querySelector('[data-messages]').addEventListener('click', async event => {
		const filter = event.target.closest('[data-filter]');
		if (filter) {
			state.messageFilter = filter.dataset.filter;
			return renderList();
		}
		const box = event.target.closest('[data-message]');
		if (!box) return;
		const key = box.dataset.message;
		const message = state.messages.find(m => keyOf(m) === key);
		// Replying counts as reading it; the mail app opens from the link as usual
		if (event.target.closest('[data-reply]')) {
			if (!message.read) update(key, { read: true });
			return;
		}
		const read = event.target.closest('[data-read]');
		if (read) return update(key, { read: read.dataset.read === 'true' });
		const archive = event.target.closest('[data-archive]');
		if (archive) {
			await update(key, { archived: archive.dataset.archive === 'true', read: true });
			return toast(archive.dataset.archive === 'true' ? 'Archived' : 'Moved to inbox');
		}
		if (event.target.closest('[data-delete]')) {
			if (!confirm(`Delete ${message.name}'s message for good?`)) return;
			const ok = await guarded(() => api('messages', { method: 'DELETE', json: { key } })).catch(() => null);
			if (!ok) return;
			state.messages = state.messages.filter(m => keyOf(m) !== key);
			updateCounts();
			renderList();
			return toast('Message deleted');
		}
		// Tapping the message itself marks it read
		if (!message.read && !event.target.closest('button, a')) update(key, { read: true });
	});

	if (!state.messages) await updateCounts({ reload: true });
	else renderList();
}

export function refreshMessages(adminState) {
	state = adminState;
	renderList();
}
