/**
 * Admin → Pages: the words and photos on every page of the site. The fields come from
 * shared/content.js; only what Hunter changes is saved, and the pages pick it up right away.
 */
import { icon } from '../lib/icons.js';
import { escapeHtml as e } from '../lib/catalog.js';
import { DEFAULT_COPY, PAGES, TOKENS, copyField, fillTokens } from '../shared/content.js';
import { api, guarded, toast } from './admin.js';
import { preparePhoto } from './image.js';

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
		<div class="cfield${editedOnSite(field.key) ? ' is-edited' : ''}${field.key in draft && draft[field.key] !== savedValue(field.key) ? ' is-dirty' : ''}" data-field="${field.key}">
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
		<div class="cfield cfield--photo${current ? ' is-edited' : ''}${field.key in draft && draft[field.key] !== savedValue(field.key) ? ' is-dirty' : ''}" data-field="${field.key}">
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

function pageBody(page) {
	return `
		<header class="pages__head">
			<div>
				<h2>${e(page.label)}</h2>
				${page.hint ? `<p class="muted">${e(page.hint)}</p>` : ''}
			</div>
			<a href="${page.id === 'juice' && state.juices[0] ? `/juices/${e(state.juices[0].slug)}` : page.path}" class="btn btn--ghost btn--sm" target="_blank" rel="noopener">${icon('external')} View page</a>
		</header>
		${tokenBar()}
		${sectionsOf(page)
			.map(
				section => `
			<section class="card pages__section">
				<h3>${e(section.title)}</h3>
				${section.hint ? `<p class="hint hint--top">${e(section.hint)}</p>` : ''}
				<div class="pages__fields">${section.fields.map(field).join('')}</div>
			</section>`
			)
			.join('')}`;
}

function searchBody() {
	const q = query.toLowerCase();
	const groups = PAGES.map(page => ({
		page,
		fields: fieldsOf(page).filter(f => [f.label, f.default, value(f.key)].some(text => String(text || '').toLowerCase().includes(q)))
	})).filter(group => group.fields.length);
	if (!groups.length) return `<p class="empty">Nothing on the site says &ldquo;${e(query)}&rdquo;. Juice names, descriptions and ingredients are in Menu.</p>`;
	return groups
		.map(
			({ page, fields }) => `
		<section class="card pages__section">
			<h3>${e(page.label)}</h3>
			<div class="pages__fields">${fields.map(field).join('')}</div>
		</section>`
		)
		.join('');
}

const editedCount = page => fieldsOf(page).filter(f => editedOnSite(f.key)).length;

function renderNav() {
	return PAGES.map(page => {
		const edited = editedCount(page);
		return `<button type="button" class="pages__tab${page.id === pageId && !query ? ' is-active' : ''}" data-page="${page.id}">${e(page.label)}${edited ? `<span class="pages__count" title="${edited} changed from the original">${edited}</span>` : ''}</button>`;
	}).join('');
}

function renderBody() {
	const main = document.getElementById('admin-main');
	const page = PAGES.find(p => p.id === pageId) || PAGES[0];
	main.querySelector('[data-pages-nav]').innerHTML = renderNav();
	const open = main.querySelector('details.tokens')?.open;
	main.querySelector('[data-pages-body]').innerHTML = query ? `${tokenBar()}${searchBody()}` : pageBody(page);
	if (open) main.querySelector('details.tokens').open = true;
	main.querySelectorAll('.cfield textarea').forEach(grow);
	renderSaveBar();
}

function renderSaveBar() {
	const bar = document.querySelector('[data-savebar]');
	if (!bar) return;
	const count = changedKeys().length;
	bar.hidden = count === 0;
	bar.querySelector('[data-savebar-count]').textContent = `${count} unsaved change${count === 1 ? '' : 's'}`;
	document.querySelectorAll('.pages__tab').forEach(tab => {
		const page = PAGES.find(p => p.id === tab.dataset.page);
		tab.classList.toggle('has-dirty', fieldsOf(page).some(f => changedKeys().includes(f.key)));
	});
}

function grow(textarea) {
	textarea.style.height = 'auto';
	textarea.style.height = `${textarea.scrollHeight + 2}px`;
}

function setDraft(key, next) {
	draft[key] = next;
	const box = document.querySelector(`[data-field="${CSS.escape(key)}"]`);
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
		renderBody();
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
	const main = document.getElementById('admin-main');
	main.innerHTML = `
		<div data-pages-root>
		<div class="admin-head">
			<div>
				<h1 class="admin-title">Pages</h1>
				<p class="muted">The words and photos on every page. Each juice's own details are in Menu.</p>
			</div>
			<label class="search">${icon('search')}<input type="search" placeholder="Find any text on the site" value="${e(query)}" data-search aria-label="Find text"></label>
		</div>
		<div class="pages">
			<nav class="pages__nav" data-pages-nav aria-label="Pages"></nav>
			<div class="pages__body" data-pages-body></div>
		</div>
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
	renderBody();

	const search = main.querySelector('[data-search]');
	search.addEventListener('input', () => {
		query = search.value.trim();
		renderBody();
	});

	root.addEventListener('click', event => {
		const tab = event.target.closest('[data-page]');
		if (tab) {
			pageId = tab.dataset.page;
			query = '';
			search.value = '';
			renderBody();
			main.querySelector('.pages__body').scrollIntoView({ block: 'start', behavior: 'smooth' });
			return;
		}
		const reset = event.target.closest('[data-reset]');
		if (reset) {
			const key = reset.dataset.reset;
			setDraft(key, defaultOf(key));
			const input = main.querySelector(`[data-key="${CSS.escape(key)}"]`);
			if (input) {
				input.value = defaultOf(key);
				if (input.tagName === 'TEXTAREA') grow(input);
			} else renderBody();
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
			renderBody();
			toast('Changes discarded');
			return;
		}
		const saveButton = event.target.closest('[data-save]');
		if (saveButton) save(saveButton);
	});

	root.addEventListener('focusin', event => {
		if (event.target.matches('[data-key]')) lastFocused = event.target;
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
			const { blob, preview } = await preparePhoto(file, field.portrait ? 1400 : 2000);
			box.innerHTML = `<img src="${preview}" alt="">`;
			const upload = await guarded(() => api('images', { method: 'POST', blob }));
			if (upload) {
				draft[key] = upload.url;
				toast('Photo ready. Save & publish to put it on the site.');
			}
		} catch (err) {
			toast(err.message, true);
		} finally {
			uploads--;
			renderBody();
		}
	});
}
