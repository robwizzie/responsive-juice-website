/**
 * Admin → Pages: the words and photos on every page of the site, edited on a live preview of
 * the real page. Tapping a spot on the preview opens it in the side panel (a sheet on phones);
 * typing updates the preview right away. The fields come from shared/content.js; only what
 * Hunter changes is saved, and nothing goes live until Save & publish.
 */
import { icon } from '../lib/icons.js';
import { escapeHtml as e } from '../lib/catalog.js';
import { DEFAULT_COPY, PAGES, TOKENS, copyField, fillTokens } from '../shared/content.js';
import { api, guarded, toast } from './admin.js';
import { preparePhoto } from './image.js';
import { mountPreview, previewMarkup } from './preview.js';

// Hunter's portrait lives in the shop settings (the share card reads it there), but he finds
// it with the rest of the About page
const ABOUT_PHOTO = '@aboutPhoto';
const ABOUT_PHOTO_FIELD = { key: ABOUT_PHOTO, label: 'Photo of you', type: 'image', portrait: true, hint: 'Goes in the photo frame at the top of the About page and on the home page. A portrait (taller than wide) looks best.' };

let state = null;
let draft = {};
let pageId = 'home';
let query = '';
let uploads = 0;
let lastFocused = null;
let preview = null;
let selectedKey = null;
let pendingSelect = null;

// Text that can't simply be swapped in place on the preview, so the page reloads to show it
const RELOAD_KEYS = new Set(['juice.inside.title', 'juice.comingSoon']);
const narrow = () => matchMedia('(max-width: 1000px)').matches;

const savedValue = key => (key === ABOUT_PHOTO ? state.settings.aboutPhoto || '' : (state.copy[key] ?? DEFAULT_COPY[key] ?? ''));
const value = key => (key in draft ? draft[key] : savedValue(key));
const defaultOf = key => (key === ABOUT_PHOTO ? '' : (DEFAULT_COPY[key] ?? ''));
const changedKeys = () => Object.keys(draft).filter(key => draft[key] !== savedValue(key));
const editedOnSite = key => value(key) !== defaultOf(key);

export const pagesDirty = () => Boolean(state) && changedKeys().length > 0;

function sectionsOf(page) {
	if (page.id !== 'about') return page.sections;
	return page.sections.map((section, i) => (i === 0 ? { ...section, fields: [...section.fields, ABOUT_PHOTO_FIELD] } : section));
}

const fieldsOf = page => sectionsOf(page).flatMap(section => section.fields);

/*=============== FIELDS ===============*/
function textField(field) {
	const current = value(field.key);
	const id = `c-${field.key.replace(/\W/g, '-')}`;
	const tokens = /\{\w+\}/.test(current);
	const max = field.max || (field.long ? 800 : 160);
	const input = field.long
		? `<textarea id="${id}" data-key="${field.key}" rows="3" maxlength="${max}" placeholder="${e(field.default)}">${e(current)}</textarea>`
		: `<input id="${id}" data-key="${field.key}" maxlength="${max}" value="${e(current)}" placeholder="${e(field.default)}">`;
	return `
		<div class="cfield${editedOnSite(field.key) ? ' is-edited' : ''}${field.key in draft && draft[field.key] !== savedValue(field.key) ? ' is-dirty' : ''}${field.key === selectedKey ? ' is-selected' : ''}" data-field="${field.key}">
			<div class="cfield__top">
				<label for="${id}">${e(field.label)}</label>
				<span class="cfield__dot" title="Not saved yet"></span>
				<button type="button" class="cfield__reset" data-reset="${field.key}">${icon('swap')} Original</button>
			</div>
			${input}
			<p class="cfield__shows" ${tokens ? '' : 'hidden'}>Shows as: <span>${e(fillTokens(current, state.settings, { count: 4 }))}</span></p>
			${field.hint ? `<p class="hint">${e(field.hint)}</p>` : ''}
		</div>`;
}

function imageField(field) {
	const current = value(field.key);
	return `
		<div class="cfield cfield--photo${current ? ' is-edited' : ''}${field.key in draft && draft[field.key] !== savedValue(field.key) ? ' is-dirty' : ''}${field.key === selectedKey ? ' is-selected' : ''}" data-field="${field.key}">
			<div class="cfield__top"><span class="cfield__label">${e(field.label)}</span><span class="cfield__dot" title="Not saved yet"></span></div>
			<div class="photo">
				<div class="photo__preview ${field.portrait ? 'photo__preview--portrait' : 'photo__preview--wide'}" data-photo-box="${field.key}">${current ? `<img src="${e(current)}" alt="">` : `<span class="photo__default">${icon('image')}<small>Original photo</small></span>`}</div>
				<div class="photo__copy">
					<div class="photo__btns">
						<label class="btn btn--ghost btn--sm photo__btn">${icon('upload')} ${current ? 'Replace' : 'Upload your own'}<input type="file" accept="image/png,image/webp,image/jpeg" data-photo-key="${field.key}" hidden></label>
						${current ? `<button type="button" class="btn btn--ghost btn--sm" data-reset="${field.key}">${icon('trash')} Use the original</button>` : ''}
					</div>
					${field.hint ? `<p class="hint">${e(field.hint)}</p>` : ''}
				</div>
			</div>
		</div>`;
}

const field = f => (f.type === 'image' ? imageField(f) : textField(f));

/*=============== LAYOUT ===============*/
function tokenBar() {
	return `
		<details class="tokens">
			<summary class="tokens__label">${icon('sparkle')} Fill-ins <span class="muted">words that update themselves, like {price}</span></summary>
			<div class="tokens__list">
			${Object.entries(TOKENS)
				.map(([name, token]) => `<button type="button" class="token" data-token="${name}" title="${e(token.label)}: insert into the box you're typing in"><code>{${name}}</code><span>${e(token.value(state.settings))}</span></button>`)
				.join('')}
			</div>
			<p class="hint">Click into any text box, then tap one of these. It fills in from your settings, so changing the price or delivery day updates the wording too.</p>
		</details>`;
}

const currentPage = () => PAGES.find(p => p.id === pageId) || PAGES[0];
const pageOf = key => PAGES.find(page => fieldsOf(page).some(f => f.key === key));
const previewPath = page => (page.id === 'juice' && state.juices[0] ? `/juices/${state.juices[0].slug}` : page.path);

function sectionsBody(groups) {
	return groups
		.map(
			({ title, hint, fields }) => `
		<section class="pages__section">
			<h3>${e(title)}</h3>
			${hint ? `<p class="hint hint--top">${e(hint)}</p>` : ''}
			<div class="pages__fields">${fields.map(field).join('')}</div>
		</section>`
		)
		.join('');
}

function panelBody() {
	if (query) {
		const q = query.toLowerCase();
		const groups = PAGES.map(page => ({
			title: page.label,
			fields: fieldsOf(page).filter(f => [f.label, f.default, value(f.key)].some(text => String(text || '').toLowerCase().includes(q)))
		})).filter(group => group.fields.length);
		return groups.length
			? sectionsBody(groups)
			: `<p class="empty">Nothing on the site says &ldquo;${e(query)}&rdquo;. Juice names, descriptions and ingredients are in Menu.</p>`;
	}
	const page = currentPage();
	return `${page.hint ? `<p class="pages__hint">${icon('info')} ${e(page.hint)}</p>` : ''}${sectionsBody(sectionsOf(page))}`;
}

const editedCount = page => fieldsOf(page).filter(f => editedOnSite(f.key)).length;

function renderNav() {
	return PAGES.map(page => {
		const edited = editedCount(page);
		return `<button type="button" class="pages__tab${page.id === pageId ? ' is-active' : ''}" data-page="${page.id}">${e(page.label)}${edited ? `<span class="pages__count" title="${edited} changed from the original">${edited}</span>` : ''}</button>`;
	}).join('');
}

function renderPanel() {
	const main = document.getElementById('admin-main');
	main.querySelector('[data-pages-nav]').innerHTML = renderNav();
	const open = main.querySelector('details.tokens')?.open;
	main.querySelector('[data-pages-list]').innerHTML = `${panelBody()}${tokenBar()}`;
	if (open) main.querySelector('details.tokens').open = true;
	main.querySelector('[data-panel-title]').textContent = query ? `Results for “${query}”` : currentPage().label;
	main.querySelectorAll('.cfield textarea').forEach(grow);
	renderSaveBar();
}

function renderSaveBar() {
	const bar = document.querySelector('[data-savebar]');
	if (!bar) return;
	const count = changedKeys().length;
	bar.hidden = count === 0;
	bar.querySelector('[data-savebar-count]').textContent = matchMedia('(max-width: 480px)').matches ? `${count} not saved` : `${count} unsaved change${count === 1 ? '' : 's'}`;
	document.querySelectorAll('.pages__tab').forEach(tab => {
		const page = PAGES.find(p => p.id === tab.dataset.page);
		tab.classList.toggle('has-dirty', fieldsOf(page).some(f => changedKeys().includes(f.key)));
	});
}

function grow(textarea) {
	textarea.style.height = 'auto';
	textarea.style.height = `${textarea.scrollHeight + 2}px`;
}

/*=============== PREVIEW ===============*/
// What the previewed page shows: the saved text with Hunter's unsaved edits on top
function previewDraft() {
	const copy = {};
	for (const key of Object.keys(draft)) if (key !== ABOUT_PHOTO) copy[key] = draft[key];
	return { copy, settings: ABOUT_PHOTO in draft ? { aboutPhoto: draft[ABOUT_PHOTO] } : {} };
}

function showOnPreview(key) {
	const isPhoto = key === ABOUT_PHOTO || copyField(key)?.type === 'image';
	const text = fillTokens(value(key) || defaultOf(key), state.settings);
	if (isPhoto || RELOAD_KEYS.has(key) || !preview.setText(key, text)) preview.reload();
}

function setStatus(message) {
	const status = document.querySelector('[data-preview-status]');
	if (status) status.textContent = message;
}

/** Selects a field: highlights it on the preview and opens it in the panel. */
function select(key, { fromPreview = false, focus = fromPreview } = {}) {
	const owner = pageOf(key);
	if (owner && owner.id !== pageId && !query) {
		pageId = owner.id;
		pendingSelect = key;
		preview.navigate(previewPath(owner));
	}
	selectedKey = key;
	const root = document.querySelector('[data-pages-root]');
	root.querySelectorAll('.cfield.is-selected').forEach(el => el.classList.remove('is-selected'));
	if (fromPreview && query) {
		query = '';
		root.querySelector('[data-search]').value = '';
	}
	if (fromPreview || !root.querySelector(`[data-field="${CSS.escape(key)}"]`)) renderPanel();
	const box = root.querySelector(`[data-field="${CSS.escape(key)}"]`);
	box?.classList.add('is-selected');
	if (fromPreview) root.classList.add('is-sheet-open', 'is-single');
	const shown = owner?.id === pageId ? preview.select(key) : false;
	setStatus(shown || pendingSelect ? '' : "This one isn't showing on the page right now.");
	if (box && fromPreview) {
		const list = root.querySelector('[data-pages-list]');
		if (!narrow()) list.scrollTo({ top: box.offsetTop - list.offsetTop - 16, behavior: 'smooth' });
		if (focus) {
			const input = box.querySelector('[data-key]');
			// On phones, focusing would pop the keyboard over the sheet before Hunter sees it
			if (input && !narrow()) input.focus({ preventScroll: true });
		}
	}
}

function closeSheet() {
	const root = document.querySelector('[data-pages-root]');
	root.classList.remove('is-sheet-open', 'is-single');
}

function setDraft(key, next) {
	draft[key] = next;
	const box = document.querySelector(`[data-field="${CSS.escape(key)}"]`);
	showOnPreview(key);
	if (!box) return renderSaveBar();
	box.classList.toggle('is-dirty', next !== savedValue(key));
	box.classList.toggle('is-edited', next !== defaultOf(key));
	const shows = box.querySelector('.cfield__shows');
	if (shows) {
		shows.hidden = !/\{\w+\}/.test(next);
		shows.querySelector('span').textContent = fillTokens(next || defaultOf(key), state.settings, { count: 4 });
	}
	renderSaveBar();
}

/*=============== SAVE ===============*/
async function save(button) {
	if (uploads) return toast('Hang on, a photo is still uploading.', true);
	const keys = changedKeys();
	if (!keys.length) return;
	button.disabled = true;
	try {
		const copyKeys = keys.filter(key => key !== ABOUT_PHOTO);
		if (copyKeys.length) {
			// Send every value that differs from the original; the server drops the rest
			const next = { ...state.copy };
			copyKeys.forEach(key => (draft[key].trim() ? (next[key] = draft[key]) : delete next[key]));
			const data = await guarded(() => api('copy', { method: 'PUT', json: next }));
			if (!data) return;
			state.copy = data.copy;
		}
		if (keys.includes(ABOUT_PHOTO)) {
			const data = await guarded(() => api('settings', { method: 'PUT', json: { ...state.settings, aboutPhoto: draft[ABOUT_PHOTO] } }));
			if (!data) return;
			state.settings = data.settings;
			state.juices = data.juices;
		}
		draft = {};
		renderPanel();
		closeSheet();
		toast("Saved. It's live on the site.");
	} catch {
		/* guarded() already showed the error */
	} finally {
		button.disabled = false;
	}
}

/*=============== TAB ===============*/
export function renderPages(adminState) {
	state = adminState;
	preview?.destroy();
	selectedKey = null;
	const main = document.getElementById('admin-main');
	main.innerHTML = `
		<div class="pages-root" data-pages-root>
		<div class="admin-head">
			<div>
				<h1 class="admin-title">Pages</h1>
				<p class="muted">${narrow() ? 'Tap' : 'Click'} any words or photo on the page to change them. Nothing goes live until you press <strong>Save &amp; publish</strong>.</p>
			</div>
			<label class="search">${icon('search')}<input type="search" placeholder="Find any text on the site" value="${e(query)}" data-search aria-label="Find text"></label>
		</div>
		<nav class="pages__nav" data-pages-nav aria-label="Pages"></nav>
		<div class="pages">
			<div class="pages__preview">${previewMarkup(narrow() ? 'phone' : 'computer')}</div>
			<aside class="pages__panel" aria-label="Text on this page">
				<div class="pages__panel-head">
					<div>
						<p class="pages__panel-kicker">Editing</p>
						<h2 data-panel-title></h2>
					</div>
					<button type="button" class="btn btn--ghost btn--sm pages__all" data-show-all>${icon('edit')} Show all</button>
					<button type="button" class="icon-btn pages__close" data-close-sheet aria-label="Close">${icon('close')}</button>
				</div>
				<div class="pages__list" data-pages-list></div>
			</aside>
		</div>
		<button type="button" class="btn btn--ink pages__open" data-open-list>${icon('edit')} All text on this page</button>
		<div class="savebar" data-savebar hidden>
			<div class="savebar__inner">
				<span class="savebar__count"><span class="cfield__dot"></span><span data-savebar-count></span></span>
				<div class="savebar__actions">
					<button type="button" class="btn btn--ghost btn--sm" data-discard>Discard</button>
					<button type="button" class="btn btn--lime" data-save>Save &amp; publish</button>
				</div>
			</div>
		</div>
		</div>`;
	const root = main.querySelector('[data-pages-root]');
	renderPanel();

	preview = mountPreview(root.querySelector('.pages__preview'), {
		path: previewPath(currentPage()),
		draft: previewDraft,
		onSelect: key => select(key, { fromPreview: true }),
		onReady: () => {
			const key = pendingSelect || selectedKey;
			pendingSelect = null;
			if (key) {
				const shown = preview.select(key);
				setStatus(shown ? '' : "This one isn't showing on the page right now.");
			}
		}
	});

	const search = main.querySelector('[data-search]');
	search.addEventListener('input', () => {
		query = search.value.trim();
		renderPanel();
		if (query && narrow()) root.classList.add('is-sheet-open');
	});

	root.addEventListener('click', event => {
		const tab = event.target.closest('[data-page]');
		if (tab) {
			pageId = tab.dataset.page;
			query = '';
			search.value = '';
			selectedKey = null;
			setStatus('');
			renderPanel();
			preview.navigate(previewPath(currentPage()));
			return;
		}
		if (event.target.closest('[data-open-list]')) {
			root.classList.add('is-sheet-open');
			root.classList.remove('is-single');
			return;
		}
		if (event.target.closest('[data-show-all]')) {
			root.classList.remove('is-single');
			return;
		}
		if (event.target.closest('[data-close-sheet]')) return closeSheet();
		const reset = event.target.closest('[data-reset]');
		if (reset) {
			const key = reset.dataset.reset;
			setDraft(key, defaultOf(key));
			const input = main.querySelector(`[data-key="${CSS.escape(key)}"]`);
			if (input) {
				input.value = defaultOf(key);
				if (input.tagName === 'TEXTAREA') grow(input);
			} else renderPanel();
			return;
		}
		const token = event.target.closest('[data-token]');
		if (token) {
			const target = lastFocused && document.body.contains(lastFocused) ? lastFocused : null;
			if (!target) return toast('Click into a text box first, then pick a fill-in.', true);
			const text = `{${token.dataset.token}}`;
			const { selectionStart: start = target.value.length, selectionEnd: end = target.value.length } = target;
			target.setRangeText(text, start, end, 'end');
			target.focus();
			target.dispatchEvent(new Event('input', { bubbles: true }));
			return;
		}
		if (event.target.closest('[data-discard]')) {
			draft = {};
			renderPanel();
			preview.reload(0);
			toast('Changes discarded');
			return;
		}
		const saveButton = event.target.closest('[data-save]');
		if (saveButton) return save(saveButton);
		// Clicking a field's box in the list shows where it is on the page
		const box = event.target.closest('[data-field]');
		if (box && box.dataset.field !== selectedKey) select(box.dataset.field);
	});

	root.addEventListener('focusin', event => {
		if (!event.target.matches('[data-key]')) return;
		lastFocused = event.target;
		if (event.target.dataset.key !== selectedKey) select(event.target.dataset.key);
	});

	root.addEventListener('input', event => {
		const input = event.target.closest('[data-key]');
		if (!input) return;
		if (input.tagName === 'TEXTAREA') grow(input);
		setDraft(input.dataset.key, input.value);
	});

	root.addEventListener('change', async event => {
		const fileInput = event.target.closest('[data-photo-key]');
		const file = fileInput?.files[0];
		if (!file) return;
		const key = fileInput.dataset.photoKey;
		const box = main.querySelector(`[data-photo-box="${CSS.escape(key)}"]`);
		uploads++;
		box.classList.add('is-busy');
		try {
			const field = key === ABOUT_PHOTO ? ABOUT_PHOTO_FIELD : copyField(key);
			const { blob, preview: local } = await preparePhoto(file, field.portrait ? 1400 : 2000);
			box.innerHTML = `<img src="${local}" alt="">`;
			const upload = await guarded(() => api('images', { method: 'POST', blob }));
			if (upload) {
				setDraft(key, upload.url);
				toast('Photo ready. Save & publish to put it on the site.');
			}
		} catch (err) {
			toast(err.message, true);
		} finally {
			uploads--;
			renderPanel();
		}
	});
}

/** Called when leaving the tab, so the preview stops borrowing this tab's edits. */
export function leavePages() {
	preview?.destroy();
	preview = null;
}
