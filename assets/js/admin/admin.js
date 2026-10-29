/**
 * Hunter's admin: edit the menu, see orders, and change pickup/delivery settings.
 * Talks to netlify/functions/admin.js. Everything is saved to Netlify Blobs.
 */
import { icon } from '../lib/icons.js';
import { wordmark } from '../lib/brand.js';
import { escapeHtml as e } from '../lib/catalog.js';
import { bottleImage, juiceCard, juiceLoader, money } from '../lib/components.js';
import { BACKDROPS, DEFAULT_BACKDROP, JUICE_STATUSES, SPLASH_STYLES, ingredientKey, ingredientPhoto, juiceStatus, priceJuice, slugify } from '../shared/catalog.js';
import { weekdayName } from '../shared/order-rules.js';
import { isOpen } from '../shared/order-status.js';
import { prepareBottle, preparePhoto } from './image.js';
import { leavePages, renderPages, pagesDirty } from './pages.js';
import { allIngredients, renderIngredients } from './ingredients.js';
import { mountPreview, previewMarkup } from './preview.js';
import { refreshOrders, renderOrders } from './orders.js';
import { refreshMessages, renderMessages } from './messages.js';

const app = document.getElementById('admin');
const state = { juices: [], settings: null, copy: {}, status: {}, orders: null, messages: null, tab: 'menu' };

/*=============== API ===============*/
class AuthError extends Error {}

export async function api(path, { method = 'GET', json, blob } = {}) {
	const headers = {};
	if (method !== 'GET') headers['X-Admin-Request'] = '1';
	if (json !== undefined) headers['Content-Type'] = 'application/json';
	if (blob) headers['Content-Type'] = blob.type;
	const res = await fetch(`/api/admin/${path}`, { method, headers, body: blob || (json !== undefined ? JSON.stringify(json) : undefined), credentials: 'same-origin' });
	const data = await res.json().catch(() => ({}));
	if (res.status === 401 && path !== 'login') throw new AuthError(data.error);
	if (!res.ok) throw new Error(data.error || 'Something went wrong.');
	return data;
}

export async function guarded(task) {
	try {
		return await task();
	} catch (err) {
		if (err instanceof AuthError) {
			renderLogin('Your session ended. Please sign in again.');
			return null;
		}
		toast(err.message, true);
		throw err;
	}
}

let toastTimer;
export function toast(message, isError = false) {
	const el = document.querySelector('.toast');
	el.innerHTML = `${icon(isError ? 'info' : 'check')} <span>${e(message)}</span>`;
	el.classList.toggle('toast--error', isError);
	el.hidden = false;
	requestAnimationFrame(() => el.classList.add('is-visible'));
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		el.classList.remove('is-visible');
		setTimeout(() => (el.hidden = true), 300);
	}, 3200);
}

/*=============== SIGN IN ===============*/
function renderLogin(message = '', configured = true) {
	app.innerHTML = `
		<div class="login">
			<form class="login__card card" id="login-form">
				<p class="wordmark login__mark" aria-label="SiponPressed">${wordmark()}</p>
				<h1 class="login__title">Admin</h1>
				${
					configured
						? `<div class="field">
						<label for="password">Password</label>
						<input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
					</div>
					<p class="form__status is-error" role="alert">${e(message)}</p>
					<button class="btn btn--ink btn--lg btn--block" type="submit">Sign in</button>`
						: `<p class="muted">The admin isn't switched on yet. Add an <code>ADMIN_PASSWORD</code> environment variable in Netlify, redeploy, and come back.</p>`
				}
				<a href="/" class="login__back">${icon('arrowLeft')} Back to the site</a>
			</form>
		</div>`;

	document.getElementById('login-form').addEventListener('submit', async event => {
		event.preventDefault();
		const button = event.target.querySelector('button');
		button.disabled = true;
		try {
			await api('login', { method: 'POST', json: { password: event.target.password.value } });
			await boot();
		} catch (err) {
			renderLogin(err.message);
		}
	});
}

/*=============== SHELL ===============*/
const TABS = [
	{ id: 'menu', label: 'Menu', icon: 'leaf' },
	{ id: 'ingredients', label: 'Ingredients', icon: 'orange' },
	{ id: 'pages', label: 'Pages', icon: 'edit' },
	{ id: 'orders', label: 'Orders', icon: 'bag' },
	{ id: 'messages', label: 'Messages', icon: 'mail' },
	{ id: 'settings', label: 'Settings', icon: 'gear' }
];

function renderShell() {
	app.innerHTML = `
		<header class="admin-bar">
			<div class="admin-bar__inner">
				<a href="/" class="wordmark" aria-label="SiponPressed home">${wordmark()}</a>
				<span class="admin-bar__badge">Admin</span>
				<nav class="admin-tabs" aria-label="Admin sections">
					${TABS.map(t => `<a href="#${t.id}" class="admin-tab" data-tab="${t.id}">${icon(t.icon)}<span>${t.label}</span><span class="tab-count" data-count="${t.id}" hidden></span></a>`).join('')}
				</nav>
				<div class="admin-bar__actions">
					<a href="/" class="btn btn--outline btn--sm" target="_blank" rel="noopener">${icon('eye')} View site</a>
					<button type="button" class="icon-btn" data-logout aria-label="Sign out" title="Sign out">${icon('logout')}</button>
				</div>
			</div>
		</header>
		<div class="admin-status" data-status></div>
		<main class="admin-main" id="admin-main"></main>`;

	app.querySelector('[data-logout]').addEventListener('click', async () => {
		await api('logout', { method: 'POST' }).catch(() => {});
		renderLogin();
	});
	renderStatus();
}

function renderStatus() {
	const missing = [];
	if (!state.status.stripe) missing.push(['Card payments are off, so customers can\'t check out yet.', 'STRIPE_SECRET_KEY']);
	if (!state.status.webhook) missing.push(['Paid orders won\'t show up in Orders yet.', 'STRIPE_WEBHOOK_SECRET']);
	if (!state.status.email) missing.push(['Order and contact emails are off.', 'EMAIL_HOST, EMAIL_USER, EMAIL_PASS']);
	// Hunter can tuck the notice away once he's read it; it comes back if the list changes
	const signature = missing.map(([, vars]) => vars).join('|');
	let hidden = false;
	try {
		hidden = localStorage.getItem('sp-admin-status') === signature;
	} catch {
		/* private mode */
	}
	const box = document.querySelector('[data-status]');
	box.onclick = event => {
		if (!event.target.closest('[data-status-hide]')) return;
		try {
			localStorage.setItem('sp-admin-status', signature);
		} catch {
			/* private mode */
		}
		box.innerHTML = '';
	};
	box.innerHTML = missing.length && !hidden
		? `<div class="admin-status__inner">${icon('info')}<div class="admin-status__text">
			<p><strong>A few things still need setting up</strong> (the site works, but these are switched off):</p>
			<ul>${missing.map(([text]) => `<li>${text}</li>`).join('')}</ul>
			<details class="admin-status__tech"><summary>Details for whoever set up the site</summary><p>Add these in Netlify → Site configuration → Environment variables, then redeploy: ${missing.map(([, vars]) => `<code>${vars}</code>`).join(', ')}. The README has the steps.</p></details>
		</div><button type="button" class="btn btn--ghost btn--sm admin-status__hide" data-status-hide>Got it</button></div>`
		: '';
}

function showTab() {
	const next = TABS.some(t => `#${t.id}` === location.hash) ? location.hash.slice(1) : 'menu';
	// Don't lose unsaved page text or settings by clicking another tab
	if (state.tab === 'pages' && next !== 'pages' && pagesDirty() && !confirm('You have unsaved page changes. Leave without saving?')) {
		history.replaceState(null, '', '#pages');
		return;
	}
	if (state.tab === 'settings' && next !== 'settings' && settingsDirty && !confirm('You have unsaved settings. Leave without saving?')) {
		history.replaceState(null, '', '#settings');
		return;
	}
	settingsDirty = false;
	if (state.tab === 'pages' && next !== 'pages') leavePages();
	state.tab = next;
	document.body.dataset.tab = next;
	document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.toggle('is-active', tab.dataset.tab === state.tab));
	({ menu: renderMenu, ingredients: () => renderIngredients(state), pages: () => renderPages(state), orders: () => renderOrders(state), messages: () => renderMessages(state), settings: renderSettings })[state.tab]();
}

/*=============== MENU ===============*/
/** Saves the shop's bottle price; every juice without its own price follows it. */
export async function saveBottlePrice(price) {
	const data = await guarded(() => api('settings', { method: 'PUT', json: { ...state.settings, bottlePrice: price } })).catch(() => null);
	if (!data) return false;
	state.settings = data.settings;
	state.juices = data.juices;
	toast(`Every bottle is now ${money(data.settings.bottlePrice)}`);
	return true;
}

/** Saves the shared ingredient photo library if it changed. Resolves false when saving failed. */
export async function saveIngredientPhotos(photos) {
	if (JSON.stringify(photos) === JSON.stringify(state.settings.ingredientPhotos || {})) return true;
	const data = await guarded(() => api('settings', { method: 'PUT', json: { ...state.settings, ingredientPhotos: photos } })).catch(() => null);
	if (!data) return false;
	state.settings = data.settings;
	state.juices = data.juices;
	return true;
}

async function saveJuices(juices, message) {
	const data = await guarded(() => api('juices', { method: 'PUT', json: juices }));
	if (!data) return false;
	state.juices = data.juices;
	toast(message);
	renderMenu();
	return true;
}

function renderMenu() {
	const main = document.getElementById('admin-main');
	main.innerHTML = `
		<div class="admin-head">
			<div>
				<h1 class="admin-title">Menu</h1>
				<p class="muted">Your juices, in the order they show on the site. Tap <strong>Edit</strong> to change a juice and see its page as you go.</p>
			</div>
			<div class="admin-head__actions">
				<form class="price-chip" data-price-form>
					<label for="bottle-price">Bottle price</label>
					<div class="input-prefix"><span>$</span><input id="bottle-price" name="price" type="number" min="0.5" step="0.25" value="${state.settings.bottlePrice}" inputmode="decimal"></div>
					<button type="submit" class="btn btn--ink btn--sm" hidden>Save</button>
				</form>
				<button type="button" class="btn btn--lime" data-new>${icon('plus')} Add a juice</button>
			</div>
		</div>
		<p class="hint price-note">Every juice uses this price unless you give it its own in the editor. It updates the cards, cart, checkout and share images.</p>
		<ul class="menu-list">
			${state.juices
				.map(
					(j, i) => `
				<li class="menu-row${j.active ? '' : ' is-hidden'}" style="--c: ${j.color}">
					<span class="menu-row__img">${bottleImage(j, { small: true })}</span>
					<div class="menu-row__info">
						<p class="menu-row__name">${e(j.name)}${j.active ? '' : ' <span class="pill">Hidden</span>'}</p>
						<p class="menu-row__meta">${[j.price ? `${money(j.price)}${j.customPrice ? ' <span class="pill">own price</span>' : ''}` : 'No price yet', j.nutrition.calories ? `${j.nutrition.calories} cal` : '', j.ingredients.map(e).join(', ')].filter(Boolean).join(' &middot; ')}</p>
						<div class="status-switch" role="group" aria-label="${e(j.name)} availability">
							${Object.entries(JUICE_STATUSES)
								.map(([value, label]) => `<button type="button" class="status-switch__btn status-switch__btn--${value}" data-status="${i}" data-value="${value}" aria-pressed="${juiceStatus(j) === value}" title="${STATUS_HINTS[value]}">${label}</button>`)
								.join('')}
						</div>
					</div>
					<div class="menu-row__actions">
						<button type="button" class="icon-btn" data-move="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up" title="Move up on the site">${icon('arrowUp')}</button>
						<button type="button" class="icon-btn" data-move="${i}" data-dir="1" ${i === state.juices.length - 1 ? 'disabled' : ''} aria-label="Move down" title="Move down on the site">${icon('arrowDown')}</button>
						<button type="button" class="btn btn--ink btn--sm" data-edit="${i}">${icon('edit')} Edit</button>
					</div>
				</li>`
				)
				.join('')}
		</ul>
		${state.juices.length === 0 ? '<p class="empty">No juices yet. Add your first one.</p>' : ''}`;

	main.querySelector('[data-new]').addEventListener('click', () => openEditor(null));
	const priceForm = main.querySelector('[data-price-form]');
	const priceSave = priceForm.querySelector('button');
	priceForm.price.addEventListener('input', () => (priceSave.hidden = Number(priceForm.price.value) === state.settings.bottlePrice));
	priceForm.addEventListener('submit', async event => {
		event.preventDefault();
		const price = Math.round(Number(priceForm.price.value) * 100) / 100;
		if (!(price >= 0.5)) return toast('The bottle price needs to be at least $0.50.', true);
		priceSave.disabled = true;
		if (await saveBottlePrice(price)) renderMenu();
		priceSave.disabled = false;
	});
	main.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openEditor(Number(btn.dataset.edit))));
	main.querySelectorAll('[data-move]').forEach(btn =>
		btn.addEventListener('click', () => {
			const from = Number(btn.dataset.move);
			const to = from + Number(btn.dataset.dir);
			const list = [...state.juices];
			[list[from], list[to]] = [list[to], list[from]];
			saveJuices(list, 'Order updated');
		})
	);
	main.querySelectorAll('[data-status]').forEach(btn =>
		btn.addEventListener('click', () => {
			const i = Number(btn.dataset.status);
			const status = btn.dataset.value;
			const juice = state.juices[i];
			if (juiceStatus(juice) === status) return;
			if (status !== 'coming-soon' && !juice.image) return toast(`Add a bottle photo to ${juice.name} before marking it ${JUICE_STATUSES[status].toLowerCase()}.`, true);
			if (status !== 'coming-soon' && juice.customPrice && !(juice.price >= 0.5)) return toast(`Give ${juice.name} a price first.`, true);
			const list = state.juices.map((j, k) => (k === i ? { ...j, status, statusNote: '' } : j));
			const messages = { available: `${juice.name} is available again`, 'sold-out': `${juice.name} marked sold out`, 'coming-soon': `${juice.name} marked coming soon` };
			saveJuices(list, messages[status]);
		})
	);
}

const STATUS_ICONS = { available: 'check', 'sold-out': 'prohibit', 'coming-soon': 'hourglass' };
const STATUS_HINTS = { available: 'People can order it', 'sold-out': 'Shown, but greyed out', 'coming-soon': 'A teaser. Photo and price optional' };

const BLANK = {
	name: '',
	slug: '',
	tagline: '',
	description: '',
	ingredients: [],
	ingredientImages: {},
	price: 0,
	customPrice: false,
	color: '#b6d43a',
	splash: 'lime',
	image: '',
	imageSmall: '',
	emailImage: '',
	sizeOz: 16,
	nutrition: { calories: 0, totalFat: 0, totalFatDv: 0, sodium: 0, sodiumDv: 0, carbs: 0, carbsDv: 0, sugars: 0, protein: 0 },
	vitamins: [],
	active: true,
	status: 'available',
	statusNote: '',
	backdrop: DEFAULT_BACKDROP
};

const numberField = (name, label, value, suffix = '', step = '1') => `
	<div class="field field--num">
		<label for="f-${name}">${label}</label>
		<div class="input-suffix"><input id="f-${name}" name="${name}" type="number" min="0" step="${step}" value="${value}">${suffix ? `<span>${suffix}</span>` : ''}</div>
	</div>`;

function vitaminRow(v = { name: '', dv: '' }) {
	return `<div class="vit-row"><input name="vitName" placeholder="Vitamin C" value="${e(v.name)}" aria-label="Vitamin or mineral"><div class="input-suffix"><input name="vitDv" type="number" min="0" value="${v.dv}" aria-label="Percent daily value"><span>%</span></div><button type="button" class="icon-btn" data-remove-vit aria-label="Remove">${icon('close')}</button></div>`;
}

const EDITOR_SECTIONS = [
	['photo', 'Photo'],
	['basics', 'Basics'],
	['ingredients', 'Ingredients'],
	['availability', 'Availability'],
	['background', 'Background'],
	['nutrition', 'Nutrition'],
	['link', 'Link']
];

/** One ingredient in the editor: its photo (the site's own, Hunter's upload, or an upload slot), name and controls. */
function ingredientRow(name, i, count, juice) {
	const custom = juice.ingredientImages?.[ingredientKey(name)];
	const src = ingredientPhoto(juice, name);
	return `
		<li class="ingr" data-ingr="${i}">
			<label class="ingr__photo${src ? '' : ' is-empty'}" title="${custom ? 'Replace photo' : src ? 'Use your own photo' : 'Add a photo'}">
				${src ? `<img src="${e(src)}" alt="">` : icon('camera')}
				<input type="file" accept="image/png,image/webp,image/jpeg" data-ingr-photo="${i}" hidden>
			</label>
			<input class="ingr__name" value="${e(name)}" data-ingr-name="${i}" aria-label="Ingredient ${i + 1}" maxlength="40">
			<div class="ingr__actions">
				${custom ? `<button type="button" class="icon-btn icon-btn--sm" data-ingr-reset="${i}" title="Go back to the original photo" aria-label="Go back to the original photo">${icon('swap')}</button>` : ''}
				<button type="button" class="icon-btn icon-btn--sm" data-ingr-move="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up" title="Move up on the site">${icon('arrowUp')}</button>
				<button type="button" class="icon-btn icon-btn--sm" data-ingr-move="${i}" data-dir="1" ${i === count - 1 ? 'disabled' : ''} aria-label="Move down" title="Move down on the site">${icon('arrowDown')}</button>
				<button type="button" class="icon-btn icon-btn--sm" data-ingr-remove="${i}" aria-label="Remove ${e(name)}">${icon('close')}</button>
			</div>
		</li>`;
}

function openEditor(index) {
	const original = index === null ? null : state.juices[index];
	const juice = structuredClone(original || BLANK);
	// Ingredient photos are one shared library (Admin → Ingredients); edits here save to it
	juice.ingredientImages = { ...(state.settings.ingredientPhotos || {}) };
	let customBackdrop = juice.backdrop && !BACKDROPS[juice.backdrop] ? juice.backdrop : '';
	const n = juice.nutrition;

	document.body.insertAdjacentHTML(
		'beforeend',
		`<dialog class="editor" id="editor">
			<form method="dialog" class="editor__form" id="editor-form" novalidate>
				<header class="editor__head">
					<div class="editor__head-main">
						<h2 class="editor__title">${original ? `Edit ${e(original.name)}` : 'New juice'}</h2>
						<nav class="editor__nav" aria-label="Jump to">${EDITOR_SECTIONS.map(([id, label]) => `<button type="button" data-jump="${id}">${label}</button>`).join('')}</nav>
					</div>
					<button type="button" class="btn btn--lime btn--sm editor__preview-btn" data-preview-open>${icon('eye')} Preview</button>
					${original ? `<a href="/juices/${e(original.slug)}" class="btn btn--ghost btn--sm editor__view" target="_blank" rel="noopener">${icon('external')} Live page</a>` : ''}
					<button type="button" class="icon-btn" data-close aria-label="Close">${icon('close')}</button>
				</header>

				<div class="editor__body">
					<div class="editor__fields">
						<section class="editor__section" data-section="photo">
							<h3>Bottle photo</h3>
							<div class="photo">
								<div class="photo__preview" data-photo-preview>${juice.image ? `<img src="${juice.imageSmall || juice.image}" alt="">` : `<span>${icon('upload')}</span>`}</div>
								<div class="photo__copy">
									<label class="btn btn--ghost btn--sm photo__btn">${icon('upload')} ${juice.image ? 'Replace photo' : 'Upload photo'}<input type="file" accept="image/png,image/webp,image/jpeg" data-photo hidden></label>
									<p class="hint">Best: a PNG of just the bottle with the background removed (try remove.bg). We trim the edges and size it for you.</p>
									<p class="hint hint--warn" data-photo-warn hidden></p>
								</div>
							</div>
						</section>

						<section class="editor__section" data-section="basics">
							<h3>Basics</h3>
							<div class="field"><label for="f-name">Name</label><input id="f-name" name="name" value="${e(juice.name)}" required placeholder="Simply Purple"></div>
							<div class="field">
								<p class="field-label">Price</p>
								<div class="price-pick">
									<div class="segmented" role="radiogroup" aria-label="Price">
										<label><input type="radio" name="priceMode" value="shop" ${juice.customPrice ? '' : 'checked'}><span>Shop price &middot; ${money(state.settings.bottlePrice)}</span></label>
										<label><input type="radio" name="priceMode" value="custom" ${juice.customPrice ? 'checked' : ''}><span>Its own price</span></label>
									</div>
									<div class="input-prefix price-pick__input" data-custom-price ${juice.customPrice ? '' : 'hidden'}><span>$</span><input id="f-price" name="price" type="number" min="0.5" step="0.25" value="${juice.customPrice ? juice.price : state.settings.bottlePrice}" aria-label="This juice's price"></div>
								</div>
								<p class="hint">The shop price is set at the top of the Menu page and changes every bottle at once.</p>
							</div>
							<div class="field"><label for="f-tagline">Tagline <span class="optional">short, shows under the name</span></label><input id="f-tagline" name="tagline" maxlength="80" value="${e(juice.tagline)}"></div>
							<div class="field"><label for="f-description">Description</label><textarea id="f-description" name="description" rows="3" maxlength="600">${e(juice.description)}</textarea></div>
							<div class="field-row">
								<div class="field"><label for="f-color">Color</label><div class="color-input"><input id="f-color" name="color" type="color" value="${juice.color}"><span data-color-value>${juice.color}</span></div></div>
								<div class="field"><label for="f-splash">Splash behind bottle</label>
									<select id="f-splash" name="splash">${['none', ...SPLASH_STYLES].map(s => `<option value="${s}" ${juice.splash === s ? 'selected' : ''}>${s === 'none' ? 'None' : s[0].toUpperCase() + s.slice(1)}</option>`).join('')}</select>
								</div>
							</div>
							<div class="toggles">
								<label class="toggle"><input type="checkbox" name="active" ${juice.active ? 'checked' : ''}><span></span> Show on the site</label>
							</div>
						</section>

						<section class="editor__section" data-section="ingredients">
							<h3>Ingredients</h3>
							<p class="hint hint--top">In label order. Tap a photo to upload your own; it's used for that ingredient on every juice. The first two with photos float around the bottle.</p>
							<ul class="ingr-list" data-ingredients></ul>
							<p class="field-label ingr-pick__label">Add ingredients <span class="optional">tap one from your list, or type a new one</span></p>
							<div class="ingr-add">
								<input data-ingr-new placeholder="Search, or add a new one" maxlength="40" aria-label="Find or add an ingredient" autocomplete="off">
								<button type="button" class="btn btn--ghost btn--sm" data-ingr-add>${icon('plus')} Add</button>
							</div>
							<div class="ingr-pick" data-ingr-options></div>
						</section>

						<section class="editor__section" data-section="availability">
							<h3>Availability</h3>
							<div class="status-picks">
								${Object.entries(JUICE_STATUSES)
									.map(
										([value, label]) => `
									<label class="status-pick status-pick--${value}"><input type="radio" name="status" value="${value}" ${juiceStatus(juice) === value ? 'checked' : ''}><span>${icon(STATUS_ICONS[value])}<strong>${label}</strong><small>${STATUS_HINTS[value]}</small></span></label>`
									)
									.join('')}
							</div>
							<div class="field"><label for="f-note">Badge text <span class="optional">optional, like "Back Monday" or "Drops in March"</span></label><input id="f-note" name="statusNote" maxlength="40" value="${e(juice.statusNote || '')}"></div>
						</section>

						<section class="editor__section" data-section="background">
							<h3>Page background</h3>
							<p class="hint">What sits behind the bottle at the top of this juice's page.</p>
							<div class="backdrop-picks" style="--c: ${juice.color}">
								${Object.entries(BACKDROPS)
									.map(
										([value, b]) => `
									<label class="backdrop-pick"><input type="radio" name="backdrop" value="${value}" ${(juice.backdrop || DEFAULT_BACKDROP) === value ? 'checked' : ''}><span class="backdrop-pick__thumb backdrop-pick__thumb--${value}"${b.imageSmall ? ` style="background-image: url('${b.imageSmall}')"` : ''}></span><span class="backdrop-pick__label">${b.label}</span></label>`
									)
									.join('')}
								<label class="backdrop-pick"><input type="radio" name="backdrop" value="photo" ${customBackdrop ? 'checked' : 'disabled'} data-backdrop-photo><span class="backdrop-pick__thumb backdrop-pick__thumb--photo" data-backdrop-thumb${customBackdrop ? ` style="background-image: url('${e(customBackdrop)}')"` : ''}>${icon('image')}</span><span class="backdrop-pick__label">Your photo</span></label>
							</div>
							<label class="btn btn--ghost btn--sm backdrop-upload">${icon('upload')} Upload a background<input type="file" accept="image/png,image/webp,image/jpeg" data-backdrop-file hidden></label>
						</section>

						<section class="editor__section" data-section="nutrition">
							<h3>Nutrition <span class="optional">per bottle</span></h3>
							<div class="num-grid">
								${numberField('sizeOz', 'Bottle size', juice.sizeOz, 'fl oz')}
								${numberField('calories', 'Calories', n.calories)}
								${numberField('sugars', 'Natural sugars', n.sugars, 'g')}
								${numberField('protein', 'Protein', n.protein, 'g')}
								${numberField('carbs', 'Carbs', n.carbs, 'g')}
								${numberField('carbsDv', 'Carbs DV', n.carbsDv, '%')}
								${numberField('sodium', 'Sodium', n.sodium, 'mg')}
								${numberField('sodiumDv', 'Sodium DV', n.sodiumDv, '%')}
								${numberField('totalFat', 'Total fat', n.totalFat, 'g', '0.5')}
								${numberField('totalFatDv', 'Fat DV', n.totalFatDv, '%')}
							</div>
							<p class="field-label">Vitamins &amp; minerals <span class="optional">% daily value</span></p>
							<div class="vits" data-vits>${juice.vitamins.map(vitaminRow).join('')}</div>
							<button type="button" class="btn btn--ghost btn--sm" data-add-vit>${icon('plus')} Add a vitamin</button>
						</section>

						<section class="editor__section" data-section="link">
							<h3>Link</h3>
							<div class="field"><label for="f-slug">Page address</label><div class="input-prefix"><span>/juices/</span><input id="f-slug" name="slug" value="${e(juice.slug)}" placeholder="made from the name"></div></div>
						</section>
					</div>

					<aside class="editor__preview">
						<div class="editor__preview-head">
							<div class="segmented segmented--sm" role="radiogroup" aria-label="Preview">
								<label><input type="radio" name="previewView" value="page" checked><span>Juice page</span></label>
								<label><input type="radio" name="previewView" value="card"><span>Menu card</span></label>
							</div>
							<button type="button" class="btn btn--ink btn--sm editor__back" data-preview-close>${icon('arrowLeft')} Back</button>
						</div>
						<div class="editor__page" data-preview-page>${previewMarkup('phone')}</div>
						<div class="editor__card" data-preview hidden></div>
						<p class="hint editor__preview-hint">This is how it will look, before you save. Tap the name, photo, description or ingredients to jump to them.</p>
					</aside>
				</div>

				<footer class="editor__foot">
					${original ? `<button type="button" class="btn btn--danger btn--sm" data-delete aria-label="Delete this juice">${icon('trash')} <span class="editor__delete-label">Delete</span></button>` : '<span></span>'}
					<div class="editor__foot-actions">
						<button type="button" class="btn btn--ghost" data-close>Cancel</button>
						<button type="submit" class="btn btn--ink" data-save>${original ? 'Save changes' : 'Add to menu'}</button>
					</div>
				</footer>
			</form>
		</dialog>`
	);

	const dialog = document.getElementById('editor');
	const form = document.getElementById('editor-form');
	const ingredients = [...juice.ingredients];
	let uploading = false;

	function renderIngredients() {
		const list = form.querySelector('[data-ingredients]');
		list.innerHTML = ingredients.length ? ingredients.map((name, i) => ingredientRow(name, i, ingredients.length, juice)).join('') : '<li class="ingr-empty">No ingredients yet. Pick some below.</li>';
		renderPicker();
	}

	// The shared ingredient list (every juice's ingredients, the site's photos and Hunter's own),
	// so he picks instead of retyping. Anything new he adds here joins the list once the juice is saved.
	const library = allIngredients(state);
	const libraryName = name => library.find(item => item.key === ingredientKey(name))?.name || name;

	function renderPicker() {
		const input = form.querySelector('[data-ingr-new]');
		const q = input.value.trim().toLowerCase();
		const taken = new Set(ingredients.map(ingredientKey));
		const matches = library.filter(item => !taken.has(item.key) && (!q || item.name.toLowerCase().includes(q)));
		const exact = q && (taken.has(ingredientKey(q)) || library.some(item => item.key === ingredientKey(q)));
		const chip = item => {
			const src = ingredientPhoto(juice, item.name);
			return `<button type="button" class="ingr-chip" data-ingr-pick="${e(item.name)}">${src ? `<img src="${e(src)}" alt="" loading="lazy">` : `<span class="ingr-chip__dot">${icon('plus')}</span>`}<span>${e(item.name)}</span></button>`;
		};
		const fresh = q && !exact ? `<button type="button" class="ingr-chip ingr-chip--new" data-ingr-pick="${e(input.value.trim())}">${icon('plus')}<span>Add &ldquo;${e(input.value.trim())}&rdquo; as a new ingredient</span></button>` : '';
		form.querySelector('[data-ingr-options]').innerHTML =
			fresh + matches.map(chip).join('') || `<p class="hint">${q ? 'Already on this juice.' : 'Every ingredient in your list is on this juice.'}</p>`;
	}

	function addNames(names) {
		const fresh = names.map(libraryName).filter((name, i, all) => !ingredients.some(item => ingredientKey(item) === ingredientKey(name)) && all.findIndex(other => ingredientKey(other) === ingredientKey(name)) === i);
		if (!fresh.length) return;
		if (ingredients.length + fresh.length > 12) return toast('Twelve ingredients is the most a juice can list.', true);
		ingredients.push(...fresh);
		renderIngredients();
		preview();
	}

	function addIngredient() {
		const input = form.querySelector('[data-ingr-new]');
		const names = input.value.split(',').map(s => s.trim()).filter(Boolean);
		if (!names.length) return;
		addNames(names);
		input.value = '';
		renderPicker();
		input.focus();
	}

	form.querySelector('[data-ingr-new]').addEventListener('keydown', event => {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		addIngredient();
	});
	form.querySelector('[data-ingr-new]').addEventListener('input', renderPicker);
	form.querySelector('[data-ingr-options]').addEventListener('click', event => {
		const pick = event.target.closest('[data-ingr-pick]');
		if (!pick) return;
		addNames([pick.dataset.ingrPick]);
		form.querySelector('[data-ingr-new]').value = '';
		renderPicker();
	});

	form.querySelector('[data-ingredients]').addEventListener('change', async event => {
		const nameInput = event.target.closest('[data-ingr-name]');
		if (nameInput) {
			const i = Number(nameInput.dataset.ingrName);
			const name = nameInput.value.trim();
			if (!name) return renderIngredients();
			ingredients[i] = name;
			renderIngredients();
			return preview();
		}
		const fileInput = event.target.closest('[data-ingr-photo]');
		const file = fileInput?.files[0];
		if (!file) return;
		const name = ingredients[Number(fileInput.dataset.ingrPhoto)];
		const slot = fileInput.closest('.ingr__photo');
		uploading = true;
		slot.classList.add('is-busy');
		try {
			const { blob, preview: localUrl } = await preparePhoto(file, 480);
			slot.innerHTML = `<img src="${localUrl}" alt="">`;
			const upload = await guarded(() => api('images', { method: 'POST', blob }));
			if (upload) juice.ingredientImages[ingredientKey(name)] = upload.url;
		} catch (err) {
			toast(err.message, true);
		} finally {
			uploading = false;
			renderIngredients();
			preview();
		}
	});

	let slugTouched = Boolean(original);

	const close = () => {
		pagePreview.destroy();
		dialog.close();
		dialog.remove();
	};

	// Scroll just the editor's body; scrollIntoView would also shift the dialog itself
	function scrollEditorTo(el) {
		const body = form.querySelector('.editor__body');
		body.scrollTo({ top: el.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 16, behavior: 'smooth' });
	}

	const showPreview = on => form.classList.toggle('is-previewing', on);

	// Tapping something on the juice page preview jumps to where it's edited
	const PAGE_SPOTS = [
		['.pdp-panel__name', 'name'],
		['.pdp-panel__tagline', 'tagline'],
		['.pdp-panel__desc', 'description'],
		['.pdp-panel__buy .price', 'price'],
		['.pdp-panel__soon, .pdp-panel__buy .stamp', '@availability'],
		['.chips, .ingredients, [data-edit="juice.inside.title"]', '@ingredients'],
		['.bottle-art', '@photo'],
		['.label, .vitamins__list', '@nutrition'],
		['.pdp-hero', '@background']
	];
	function jumpFromPreview(target) {
		const spot = PAGE_SPOTS.find(([selector]) => target.closest(selector));
		if (!spot) {
			if (target.closest('[data-copy], [data-edit]')) toast('That line is the same on every juice page. Change it in Pages → Each juice page.');
			return;
		}
		showPreview(false);
		const [, to] = spot;
		if (to.startsWith('@')) return scrollEditorTo(form.querySelector(`[data-section="${to.slice(1)}"]`));
		if (to === 'price' && form.querySelector('[name="priceMode"]:checked').value === 'shop') return scrollEditorTo(form.querySelector('.price-pick'));
		const input = form.elements[to];
		scrollEditorTo(input.closest('.field') || input);
		input.focus({ preventScroll: true });
	}

	const previewJuice = () => {
		const current = priceJuice(read(), state.settings);
		return { ...current, name: current.name || 'Juice name', imageSmall: current.imageSmall || current.image };
	};
	let pageReady = false;
	let pageTimer;
	const pagePreview = mountPreview(form.querySelector('[data-preview-page]'), {
		path: `/juices/${original?.slug || state.juices.find(j => j.active)?.slug || state.juices[0]?.slug || 'simply-orange'}`,
		draft: () => ({ juice: previewJuice(), replaces: original?.slug }),
		spots: `${PAGE_SPOTS.slice(0, -1).map(([selector]) => selector).join(', ')}, [data-copy], [data-edit]`,
		onTap: jumpFromPreview,
		onReady: () => {
			pageReady = true;
			pagePreview.render(previewJuice());
		}
	});

	function read() {
		const f = form.elements;
		const backdrop = form.querySelector('[name="backdrop"]:checked')?.value || DEFAULT_BACKDROP;
		const num = name => Number(f[name].value) || 0;
		const names = [...form.querySelectorAll('[name="vitName"]')].map(i => i.value.trim());
		const dvs = [...form.querySelectorAll('[name="vitDv"]')].map(i => Number(i.value) || 0);
		return {
			...juice,
			name: f.name.value.trim(),
			slug: slugify(f.slug.value || f.name.value),
			tagline: f.tagline.value.trim(),
			description: f.description.value.trim(),
			ingredients: [...ingredients],
			ingredientImages: { ...juice.ingredientImages },
			customPrice: form.querySelector('[name="priceMode"]:checked')?.value === 'custom',
			price: Number(f.price.value) || 0,
			color: f.color.value,
			splash: f.splash.value,
			active: f.active.checked,
			status: form.querySelector('[name="status"]:checked')?.value || 'available',
			statusNote: f.statusNote.value.trim(),
			backdrop: backdrop === 'photo' ? customBackdrop || DEFAULT_BACKDROP : backdrop,
			sizeOz: num('sizeOz') || 16,
			nutrition: Object.fromEntries(Object.keys(BLANK.nutrition).map(key => [key, num(key)])),
			vitamins: names.map((name, i) => ({ name, dv: dvs[i] })).filter(v => v.name)
		};
	}

	function preview() {
		const current = priceJuice(read(), state.settings);
		clearTimeout(pageTimer);
		if (pageReady) pageTimer = setTimeout(() => pagePreview.render(previewJuice()) || pagePreview.reload(0), 120);
		form.querySelector('[data-color-value]').textContent = current.color;
		form.querySelector('[data-preview]').innerHTML =
			current.image || current.status === 'coming-soon'
				? juiceCard({ ...current, name: current.name || 'Juice name', imageSmall: current.imageSmall || current.image })
				: `<div class="preview-empty">Upload a bottle photo to see the preview.</div>`;
		form.querySelectorAll('[data-preview] [data-reveal]').forEach(el => el.classList.add('is-revealed'));
	}

	form.addEventListener('input', event => {
		if (event.target.closest('[data-ingr-name], [data-ingr-new]')) return;
		if (event.target.name === 'slug') slugTouched = true;
		if (event.target.name === 'name' && !slugTouched) form.elements.slug.value = slugify(event.target.value);
		preview();
	});
	form.addEventListener('change', event => {
		if (event.target.name === 'previewView') {
			const card = event.target.value === 'card';
			form.querySelector('[data-preview]').hidden = !card;
			form.querySelector('[data-preview-page]').hidden = card;
			return;
		}
		if (event.target.name === 'preview-device') return;
		if (event.target.name === 'priceMode') {
			const custom = event.target.value === 'custom';
			form.querySelector('[data-custom-price]').hidden = !custom;
			if (custom) form.elements.price.select();
		}
		preview();
	});
	form.addEventListener('click', event => {
		if (event.target.closest('[data-close]')) close();
		if (event.target.closest('[data-preview-open]')) showPreview(true);
		if (event.target.closest('[data-preview-close]')) showPreview(false);
		const jump = event.target.closest('[data-jump]');
		if (jump) {
			showPreview(false);
			scrollEditorTo(form.querySelector(`[data-section="${jump.dataset.jump}"]`));
		}
		if (event.target.closest('[data-ingr-add]')) addIngredient();
		const move = event.target.closest('[data-ingr-move]');
		if (move) {
			const from = Number(move.dataset.ingrMove);
			const to = from + Number(move.dataset.dir);
			[ingredients[from], ingredients[to]] = [ingredients[to], ingredients[from]];
			renderIngredients();
			preview();
		}
		const remove = event.target.closest('[data-ingr-remove]');
		if (remove) {
			ingredients.splice(Number(remove.dataset.ingrRemove), 1);
			renderIngredients();
			preview();
		}
		const reset = event.target.closest('[data-ingr-reset]');
		if (reset) {
			delete juice.ingredientImages[ingredientKey(ingredients[Number(reset.dataset.ingrReset)])];
			renderIngredients();
			preview();
		}
		if (event.target.closest('[data-add-vit]')) {
			form.querySelector('[data-vits]').insertAdjacentHTML('beforeend', vitaminRow());
			form.querySelector('[data-vits] .vit-row:last-child input').focus();
		}
		if (event.target.closest('[data-remove-vit]')) {
			event.target.closest('.vit-row').remove();
			preview();
		}
		// Links inside the preview card shouldn't navigate away
		if (event.target.closest('[data-preview] a, [data-preview] button')) event.preventDefault();
	});
	dialog.addEventListener('cancel', event => {
		event.preventDefault();
		close();
	});

	form.querySelector('[data-backdrop-file]').addEventListener('change', async event => {
		const file = event.target.files[0];
		if (!file) return;
		const thumb = form.querySelector('[data-backdrop-thumb]');
		uploading = true;
		thumb.classList.add('is-busy');
		try {
			const { blob, preview: localUrl } = await preparePhoto(file);
			thumb.style.backgroundImage = `url('${localUrl}')`;
			const upload = await guarded(() => api('images', { method: 'POST', blob }));
			if (!upload) return;
			customBackdrop = upload.url;
			const radio = form.querySelector('[data-backdrop-photo]');
			radio.disabled = false;
			radio.checked = true;
		} catch (err) {
			toast(err.message, true);
		} finally {
			uploading = false;
			thumb.classList.remove('is-busy');
			event.target.value = '';
		}
	});

	form.querySelector('[data-photo]').addEventListener('change', async event => {
		const file = event.target.files[0];
		if (!file) return;
		const warn = form.querySelector('[data-photo-warn]');
		const box = form.querySelector('[data-photo-preview]');
		uploading = true;
		box.classList.add('is-busy');
		try {
			const { blobs, hasTransparency, preview: localUrl } = await prepareBottle(file);
			box.innerHTML = `<img src="${localUrl}" alt="">`;
			form.querySelector('.photo__btn').firstChild.nextSibling.textContent = ' Replace photo';
			const uploads = await guarded(() => Promise.all(Object.entries(blobs).map(([key, blob]) => api('images', { method: 'POST', blob }).then(r => [key, r.url]))));
			if (!uploads) return;
			Object.assign(juice, Object.fromEntries(uploads));
			warn.hidden = hasTransparency;
			warn.textContent = hasTransparency ? '' : "This photo has a background. It'll work, but the floating-bottle look needs a cut-out PNG.";
			preview();
		} catch (err) {
			toast(err.message, true);
		} finally {
			uploading = false;
			box.classList.remove('is-busy');
			event.target.value = '';
		}
	});

	form.addEventListener('submit', async event => {
		event.preventDefault();
		if (uploading) return toast('Hang on, the photo is still uploading.', true);
		const next = read();
		if (!next.name) return toast('Give the juice a name.', true);
		const teaser = next.status === 'coming-soon';
		if (!next.image && !teaser) return toast('Upload a bottle photo first, or mark it "Coming soon".', true);
		if (next.customPrice && !(next.price >= 0.5) && !teaser) return toast('Give it a price of at least $0.50, or use the shop price.', true);
		if (form.querySelector('[data-ingr-new]').value.trim()) addIngredient();
		next.ingredients = [...ingredients];
		const list = original ? state.juices.map((j, i) => (i === index ? next : j)) : [...state.juices, next];
		const button = form.querySelector('[data-save]');
		button.disabled = true;
		if (!(await saveIngredientPhotos(juice.ingredientImages))) return (button.disabled = false);
		const ok = await saveJuices(list, original ? `${next.name} saved` : `${next.name} added to the menu`).catch(() => false);
		button.disabled = false;
		if (ok) close();
	});

	form.querySelector('[data-delete]')?.addEventListener('click', async () => {
		if (!confirm(`Delete ${original.name} from the menu? You can hide it instead by unticking "Show on the site".`)) return;
		const ok = await saveJuices(
			state.juices.filter((_, i) => i !== index),
			`${original.name} deleted`
		).catch(() => false);
		if (ok) close();
	});

	renderIngredients();
	preview();
	dialog.showModal();
}

/*=============== BADGES ===============*/
// Orders still to do and unread messages show as a count on their tab (and in the browser tab title)
let lastSeenOrders = null;
export async function updateCounts({ reload = false } = {}) {
	if (reload) {
		const [orders, messages] = await Promise.all([guarded(() => api('orders')).catch(() => null), guarded(() => api('messages')).catch(() => null)]);
		if (orders) state.orders = orders.orders;
		if (messages) state.messages = messages.messages;
		if (state.tab === 'orders') refreshOrders(state);
		if (state.tab === 'messages') refreshMessages(state);
	}
	const counts = { orders: state.orders?.filter(isOpen).length || 0, messages: state.messages?.filter(m => !m.read && !m.archived).length || 0 };
	Object.entries(counts).forEach(([tab, n]) => {
		const badge = document.querySelector(`[data-count="${tab}"]`);
		if (!badge) return;
		badge.hidden = !n;
		badge.textContent = n > 99 ? '99+' : n;
		badge.closest('.admin-tab').setAttribute('aria-label', `${TABS.find(t => t.id === tab).label}${n ? `, ${n} ${tab === 'orders' ? 'to do' : 'new'}` : ''}`);
	});
	const total = counts.orders + counts.messages;
	document.title = `${total ? `(${total}) ` : ''}Admin | SiponPressed`;
	// A new order while the admin is open gets a heads-up
	const ids = new Set((state.orders || []).map(o => o.id));
	if (lastSeenOrders && [...ids].some(id => !lastSeenOrders.has(id))) toast('A new order just came in');
	if (state.orders) lastSeenOrders = ids;
}

// Check for new orders and messages every minute while the admin is on screen
let pollTimer;
function startPolling() {
	clearInterval(pollTimer);
	pollTimer = setInterval(() => document.visibilityState === 'visible' && updateCounts({ reload: true }), 60000);
}
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && state.settings && document.getElementById('admin-main') && updateCounts({ reload: true }));

/*=============== SETTINGS ===============*/
let settingsDirty = false;

function renderSettings() {
	const s = state.settings;
	const days = [1, 2, 3, 4, 5, 6, 0];
	const main = document.getElementById('admin-main');
	main.innerHTML = `
		<div class="admin-head"><div><h1 class="admin-title">Settings</h1><p class="muted">Price, ordering, pickup and delivery. Change anything, then press <strong>Save settings</strong> at the bottom of the screen.</p></div></div>
		<form class="settings" id="settings-form" novalidate>
			<section class="card settings__card">
				<h2>Price</h2>
				<div class="num-grid">${numberField('bottlePrice', 'Price per bottle ($)', s.bottlePrice, '', '0.25')}</div>
				<p class="hint">Every juice uses this unless you give it its own price in the Menu editor.</p>
			</section>

			<section class="card settings__card">
				<h2>Online ordering</h2>
				<label class="toggle toggle--lg"><input type="checkbox" name="orderingEnabled" ${s.orderingEnabled ? 'checked' : ''}><span></span> Accept online orders</label>
				<div class="field"><label for="s-announcement">Banner message <span class="optional">shows at the top of every page, leave empty for none</span></label><input id="s-announcement" name="announcement" maxlength="160" value="${e(s.announcement)}" placeholder="New flavor drops Monday!"></div>
			</section>

			<section class="card settings__card">
				<h2>Pickup</h2>
				<label class="toggle"><input type="checkbox" name="pickupEnabled" ${s.pickup.enabled ? 'checked' : ''}><span></span> Offer pickup</label>
				<div class="field-row">
					<div class="field"><label for="s-address">Pickup address <span class="optional">shown on every page</span></label><input id="s-address" name="pickupAddress" maxlength="120" value="${e(s.pickup.address || '')}" placeholder="1903 Jackson Street" autocomplete="off"></div>
					<div class="field"><label for="s-area">Town and state</label><input id="s-area" name="pickupArea" value="${e(s.pickup.area)}"></div>
				</div>
				<div class="field"><label for="s-hours">Pickup times <span class="optional">optional, leave empty and you text each customer a time</span></label><input id="s-hours" name="pickupHours" maxlength="80" value="${e(s.pickup.hours || '')}" placeholder="4pm to 7pm"></div>
				<div class="field"><label for="s-details">Pickup instructions <span class="optional">only sent in the confirmation email</span></label><textarea id="s-details" name="pickupDetails" rows="2">${e(s.pickup.details)}</textarea></div>
				<p class="field-label">Pickup days</p>
				<div class="day-picks">${days.map(d => `<label class="day-pick"><input type="checkbox" name="pickupDays" value="${d}" ${s.pickup.days.includes(d) ? 'checked' : ''}><span>${weekdayName(d).slice(0, 3)}</span></label>`).join('')}</div>
				<div class="num-grid">
					${numberField('pickupMinBottles', 'Minimum bottles', s.pickup.minBottles ?? 0)}
					${numberField('pickupLeadDays', 'Days of notice needed', s.pickup.leadDays, 'days')}
				</div>
				<p class="hint">2 days of notice means an order placed Wednesday can be picked up Friday or later (48 hours). Set the minimum to 0 for no minimum.</p>
			</section>

			<section class="card settings__card">
				<h2>Delivery</h2>
				<label class="toggle"><input type="checkbox" name="deliveryEnabled" ${s.delivery.enabled ? 'checked' : ''}><span></span> Offer delivery</label>
				<div class="field-row">
					<div class="field"><label for="s-dday">Delivery day</label><select id="s-dday" name="deliveryDay">${days.map(d => `<option value="${d}" ${s.delivery.day === d ? 'selected' : ''}>${weekdayName(d)}</option>`).join('')}</select></div>
					<div class="field"><label for="s-darea">Area name</label><input id="s-darea" name="deliveryArea" value="${e(s.delivery.areaLabel)}"></div>
				</div>
				<div class="num-grid">
					${numberField('minBottles', 'Minimum bottles', s.delivery.minBottles)}
					${numberField('fee', 'Delivery fee ($)', s.delivery.fee, '', '0.5')}
					${numberField('freeOver', 'Free delivery over ($)', s.delivery.freeOver, '', '1')}
					${numberField('radiusMiles', 'Delivery radius', s.delivery.radiusMiles, 'miles')}
				</div>
				<div class="field"><label for="s-cutoff">Orders close <span class="optional">end of this day, for that week's delivery</span></label><select id="s-cutoff" name="cutoffDays">${[1, 2, 3, 4, 5, 6]
					.map(n => `<option value="${n}" ${s.delivery.cutoffDays === n ? 'selected' : ''}>${weekdayName((s.delivery.day - n + 7) % 7)} (${n} day${n === 1 ? '' : 's'} before)</option>`)
					.join('')}</select></div>
				<p class="hint">Radius is measured from your pickup spot${s.delivery.center?.address ? `, ${e(s.delivery.center.address)}` : ''}. Change the pickup address above and the radius moves with it. Set "Free delivery over" to 0 to always charge the fee.</p>
			</section>

			<section class="card settings__card">
				<h2>Emails</h2>
				${
					state.status.email
						? `<p>New orders and Contact page messages are emailed to <strong>${e(state.status.emailTo || s.contactEmail)}</strong>. Every customer also gets a confirmation email when they pay.</p>
					<div><button type="button" class="btn btn--outline btn--sm" data-test-email>${icon('mail')} Send me a test email</button></div>`
						: `<p class="hint hint--warn">${icon('info')} Emails are switched off until the email login is added in Netlify. Orders and messages still show up here in the admin.</p>`
				}
			</section>

			<section class="card settings__card">
				<h2>Contact</h2>
				<div class="field-row">
					<div class="field"><label for="s-email">Email shown on the site</label><input id="s-email" name="contactEmail" type="email" value="${e(s.contactEmail)}"></div>
					<div class="field"><label for="s-ig">Instagram</label><div class="input-prefix"><span>@</span><input id="s-ig" name="instagram" value="${e(s.instagram)}"></div></div>
				</div>
			</section>

			<div class="savebar" data-settings-bar hidden>
				<div class="savebar__inner">
					<span class="savebar__count"><span class="cfield__dot"></span>Unsaved changes</span>
					<div class="savebar__actions">
						<button type="button" class="btn btn--ghost btn--sm" data-settings-discard>Discard</button>
						<button type="submit" class="btn btn--lime">Save settings</button>
					</div>
				</div>
			</div>
		</form>

		<form class="settings settings--password" id="password-form">
			<section class="card settings__card">
				<h2>Admin password</h2>
				<input type="text" name="username" value="admin" autocomplete="username" hidden>
				<div class="field"><label for="p-current">Current password</label><input id="p-current" name="current" type="password" autocomplete="current-password" required></div>
				<div class="field-row">
					<div class="field"><label for="p-next">New password <span class="optional">at least 8 characters</span></label><input id="p-next" name="next" type="password" autocomplete="new-password" minlength="8" required></div>
					<div class="field"><label for="p-confirm">Type it again</label><input id="p-confirm" name="confirm" type="password" autocomplete="new-password" minlength="8" required></div>
				</div>
				<p class="hint">Changing it signs out the admin on every other phone and computer. The original password set up in Netlify keeps working too, as a backup if this one is ever forgotten.</p>
				<div><button type="submit" class="btn btn--ink">Change password</button></div>
			</section>
		</form>`;

	main.querySelector('[data-test-email]')?.addEventListener('click', async event => {
		const button = event.currentTarget;
		button.disabled = true;
		const data = await guarded(() => api('test-email', { method: 'POST' })).catch(() => null);
		button.disabled = false;
		if (data) toast(`Sent to ${data.to}. Check that inbox (and spam).`);
	});

	const settingsForm = document.getElementById('settings-form');
	const settingsBar = settingsForm.querySelector('[data-settings-bar]');
	const markDirty = () => {
		settingsBar.hidden = false;
		settingsDirty = true;
	};
	settingsForm.addEventListener('input', markDirty);
	settingsForm.addEventListener('change', markDirty);
	// The cutoff options name a weekday, so they follow the delivery day
	settingsForm.deliveryDay.addEventListener('change', () => {
		const day = Number(settingsForm.deliveryDay.value);
		[...settingsForm.cutoffDays.options].forEach(option => (option.textContent = option.textContent.replace(/^\w+/, weekdayName((day - Number(option.value) + 7) % 7))));
	});
	settingsForm.querySelector('[data-settings-discard]').addEventListener('click', () => {
		settingsDirty = false;
		renderSettings();
		toast('Changes discarded');
	});

	settingsForm.addEventListener('submit', async event => {
		event.preventDefault();
		const f = event.target.elements;
		const num = name => Number(f[name].value);
		if (!(num('bottlePrice') >= 0.5)) return toast('The bottle price needs to be at least $0.50.', true);
		const next = {
			...s,
			bottlePrice: num('bottlePrice'),
			orderingEnabled: f.orderingEnabled.checked,
			announcement: f.announcement.value,
			contactEmail: f.contactEmail.value,
			instagram: f.instagram.value,
			pickup: {
				...s.pickup,
				enabled: f.pickupEnabled.checked,
				address: f.pickupAddress.value,
				area: f.pickupArea.value,
				hours: f.pickupHours.value,
				details: f.pickupDetails.value,
				days: [...event.target.querySelectorAll('[name="pickupDays"]:checked')].map(i => Number(i.value)),
				leadDays: num('pickupLeadDays'),
				minBottles: num('pickupMinBottles')
			},
			delivery: {
				...s.delivery,
				enabled: f.deliveryEnabled.checked,
				day: Number(f.deliveryDay.value),
				areaLabel: f.deliveryArea.value,
				minBottles: num('minBottles'),
				fee: num('fee'),
				freeOver: num('freeOver'),
				radiusMiles: num('radiusMiles'),
				cutoffDays: num('cutoffDays')
			}
		};
		const button = event.target.querySelector('[type="submit"]');
		button.disabled = true;
		const data = await guarded(() => api('settings', { method: 'PUT', json: next })).catch(() => null);
		button.disabled = false;
		if (!data) return;
		state.settings = data.settings;
		state.juices = data.juices;
		settingsDirty = false;
		toast(data.warning || "Settings saved. They're live on the site.", Boolean(data.warning));
		renderSettings();
	});

	document.getElementById('password-form').addEventListener('submit', async event => {
		event.preventDefault();
		const f = event.target.elements;
		if (f.next.value.length < 8) return toast('Use at least 8 characters for the new password.', true);
		if (f.next.value !== f.confirm.value) return toast("The two new passwords don't match.", true);
		const button = event.target.querySelector('[type="submit"]');
		button.disabled = true;
		const data = await guarded(() => api('password', { method: 'PUT', json: { current: f.current.value, next: f.next.value } })).catch(() => null);
		button.disabled = false;
		if (!data) return;
		event.target.reset();
		toast('Password changed');
	});
}

/*=============== BOOT ===============*/
async function boot() {
	const session = await api('session');
	if (!session.signedIn) return renderLogin('', session.configured);
	// Right after signing in the form is still up, so swap it for the loader while the shop loads
	if (!app.querySelector('.juice-loader')) app.innerHTML = `<div class="admin-loading">${juiceLoader('Opening your shop&hellip;')}</div>`;
	const data = await guarded(() => api('data'));
	if (!data) return;
	Object.assign(state, { juices: data.juices, settings: data.settings, copy: data.copy || {}, status: data.status, orders: null, messages: null });
	renderShell();
	showTab();
	if (!['orders', 'messages'].includes(state.tab)) updateCounts({ reload: true });
	startPolling();
}

window.addEventListener('beforeunload', event => {
	if (pagesDirty() || settingsDirty) event.preventDefault();
});
window.addEventListener('hashchange', () => state.settings && document.getElementById('admin-main') && showTab());
boot().catch(err => {
	app.innerHTML = `<p class="admin-loading">Couldn't load the admin: ${e(err.message)}</p>`;
});
