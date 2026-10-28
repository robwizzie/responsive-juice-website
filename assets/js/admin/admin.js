/**
 * Hunter's admin: edit the menu, see orders, and change pickup/delivery settings.
 * Talks to netlify/functions/admin.js. Everything is saved to Netlify Blobs.
 */
import { icon } from '../lib/icons.js';
import { escapeHtml as e } from '../lib/catalog.js';
import { juiceCard, money } from '../lib/components.js';
import { SPLASH_STYLES, slugify } from '../shared/catalog.js';
import { formatDate, formatMoney, todayISO, weekdayName } from '../shared/order-rules.js';
import { prepareBottle } from './image.js';

const app = document.getElementById('admin');
const state = { juices: [], settings: null, status: {}, orders: null, tab: 'menu' };

/*=============== API ===============*/
class AuthError extends Error {}

async function api(path, { method = 'GET', json, blob } = {}) {
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

async function guarded(task) {
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
function toast(message, isError = false) {
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
				<p class="wordmark login__mark">SiponPressed</p>
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
	{ id: 'orders', label: 'Orders', icon: 'bag' },
	{ id: 'settings', label: 'Ordering & settings', icon: 'calendar' }
];

function renderShell() {
	app.innerHTML = `
		<header class="admin-bar">
			<div class="admin-bar__inner">
				<a href="/" class="wordmark">SiponPressed</a>
				<span class="admin-bar__badge">Admin</span>
				<nav class="admin-tabs" aria-label="Admin sections">
					${TABS.map(t => `<a href="#${t.id}" class="admin-tab" data-tab="${t.id}">${icon(t.icon)}<span>${t.label}</span></a>`).join('')}
				</nav>
				<div class="admin-bar__actions">
					<a href="/" class="btn btn--outline-light btn--sm" target="_blank" rel="noopener">${icon('eye')} View site</a>
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
	if (!state.status.stripe) missing.push('Stripe is not connected, so customers can\'t pay yet (add <code>STRIPE_SECRET_KEY</code>).');
	if (!state.status.webhook) missing.push('Order confirmations need <code>STRIPE_WEBHOOK_SECRET</code>.');
	if (!state.status.email) missing.push('Emails are off until the <code>EMAIL_*</code> settings are added.');
	document.querySelector('[data-status]').innerHTML = missing.length
		? `<div class="admin-status__inner">${icon('info')}<div>${missing.map(m => `<p>${m}</p>`).join('')}<p class="muted">See the README for setup steps.</p></div></div>`
		: '';
}

function showTab() {
	state.tab = TABS.some(t => `#${t.id}` === location.hash) ? location.hash.slice(1) : 'menu';
	document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.toggle('is-active', tab.dataset.tab === state.tab));
	({ menu: renderMenu, orders: renderOrders, settings: renderSettings })[state.tab]();
}

/*=============== MENU ===============*/
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
				<p class="muted">The order here is the order on the site. Changes go live as soon as you save.</p>
			</div>
			<button type="button" class="btn btn--lime" data-new>${icon('plus')} Add a juice</button>
		</div>
		<ul class="menu-list">
			${state.juices
				.map(
					(j, i) => `
				<li class="menu-row${j.active ? '' : ' is-hidden'}" style="--c: ${j.color}">
					<img src="${j.imageSmall || j.image}" alt="" class="menu-row__img">
					<div class="menu-row__info">
						<p class="menu-row__name">${e(j.name)}</p>
						<p class="menu-row__meta">${money(j.price)} &middot; ${j.nutrition.calories} cal &middot; ${j.ingredients.map(e).join(', ')}</p>
						<div class="menu-row__pills">
							<span class="pill ${j.active ? 'pill--ok' : ''}">${j.active ? 'On the site' : 'Hidden'}</span>
							<span class="pill ${j.inStock ? 'pill--ok' : 'pill--warn'}">${j.inStock ? 'In stock' : 'Sold out'}</span>
						</div>
					</div>
					<div class="menu-row__actions">
						<button type="button" class="btn btn--ghost btn--sm" data-stock="${i}">${j.inStock ? 'Mark sold out' : 'Back in stock'}</button>
						<button type="button" class="icon-btn" data-move="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${icon('arrowUp')}</button>
						<button type="button" class="icon-btn" data-move="${i}" data-dir="1" ${i === state.juices.length - 1 ? 'disabled' : ''} aria-label="Move down">${icon('arrowDown')}</button>
						<button type="button" class="btn btn--ink btn--sm" data-edit="${i}">${icon('edit')} Edit</button>
					</div>
				</li>`
				)
				.join('')}
		</ul>
		${state.juices.length === 0 ? '<p class="empty">No juices yet. Add your first one.</p>' : ''}`;

	main.querySelector('[data-new]').addEventListener('click', () => openEditor(null));
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
	main.querySelectorAll('[data-stock]').forEach(btn =>
		btn.addEventListener('click', () => {
			const i = Number(btn.dataset.stock);
			const list = state.juices.map((j, k) => (k === i ? { ...j, inStock: !j.inStock } : j));
			saveJuices(list, list[i].inStock ? `${list[i].name} is back in stock` : `${list[i].name} marked sold out`);
		})
	);
}

const BLANK = {
	name: '',
	slug: '',
	tagline: '',
	description: '',
	ingredients: [],
	price: 7.5,
	color: '#b6d43a',
	splash: 'lime',
	image: '',
	imageSmall: '',
	emailImage: '',
	sizeOz: 16,
	nutrition: { calories: 0, totalFat: 0, totalFatDv: 0, sodium: 0, sodiumDv: 0, carbs: 0, carbsDv: 0, sugars: 0, protein: 0 },
	vitamins: [],
	active: true,
	inStock: true
};

const numberField = (name, label, value, suffix = '', step = '1') => `
	<div class="field field--num">
		<label for="f-${name}">${label}</label>
		<div class="input-suffix"><input id="f-${name}" name="${name}" type="number" min="0" step="${step}" value="${value}">${suffix ? `<span>${suffix}</span>` : ''}</div>
	</div>`;

function vitaminRow(v = { name: '', dv: '' }) {
	return `<div class="vit-row"><input name="vitName" placeholder="Vitamin C" value="${e(v.name)}" aria-label="Vitamin or mineral"><div class="input-suffix"><input name="vitDv" type="number" min="0" value="${v.dv}" aria-label="Percent daily value"><span>%</span></div><button type="button" class="icon-btn" data-remove-vit aria-label="Remove">${icon('close')}</button></div>`;
}

function openEditor(index) {
	const original = index === null ? null : state.juices[index];
	const juice = structuredClone(original || BLANK);
	const n = juice.nutrition;

	document.body.insertAdjacentHTML(
		'beforeend',
		`<dialog class="editor" id="editor">
			<form method="dialog" class="editor__form" id="editor-form" novalidate>
				<header class="editor__head">
					<h2 class="editor__title">${original ? `Edit ${e(original.name)}` : 'New juice'}</h2>
					<button type="button" class="icon-btn" data-close aria-label="Close">${icon('close')}</button>
				</header>

				<div class="editor__body">
					<div class="editor__fields">
						<section class="editor__section">
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

						<section class="editor__section">
							<h3>Basics</h3>
							<div class="field-row">
								<div class="field"><label for="f-name">Name</label><input id="f-name" name="name" value="${e(juice.name)}" required placeholder="Simply Purple"></div>
								<div class="field"><label for="f-price">Price</label><div class="input-prefix"><span>$</span><input id="f-price" name="price" type="number" min="0.5" step="0.25" value="${juice.price}"></div></div>
							</div>
							<div class="field"><label for="f-tagline">Tagline <span class="optional">short, shows under the name</span></label><input id="f-tagline" name="tagline" maxlength="80" value="${e(juice.tagline)}"></div>
							<div class="field"><label for="f-description">Description</label><textarea id="f-description" name="description" rows="3" maxlength="600">${e(juice.description)}</textarea></div>
							<div class="field"><label for="f-ingredients">Ingredients <span class="optional">separate with commas</span></label><input id="f-ingredients" name="ingredients" value="${e(juice.ingredients.join(', '))}" placeholder="Strawberries, Apples, Lemon"></div>
							<div class="field-row">
								<div class="field"><label for="f-color">Color</label><div class="color-input"><input id="f-color" name="color" type="color" value="${juice.color}"><span data-color-value>${juice.color}</span></div></div>
								<div class="field"><label for="f-splash">Splash behind bottle</label>
									<select id="f-splash" name="splash">${['none', ...SPLASH_STYLES].map(s => `<option value="${s}" ${juice.splash === s ? 'selected' : ''}>${s === 'none' ? 'None' : s[0].toUpperCase() + s.slice(1)}</option>`).join('')}</select>
								</div>
							</div>
							<div class="toggles">
								<label class="toggle"><input type="checkbox" name="active" ${juice.active ? 'checked' : ''}><span></span> Show on the site</label>
								<label class="toggle"><input type="checkbox" name="inStock" ${juice.inStock ? 'checked' : ''}><span></span> In stock</label>
							</div>
						</section>

						<section class="editor__section">
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

						<section class="editor__section">
							<h3>Link</h3>
							<div class="field"><label for="f-slug">Page address</label><div class="input-prefix"><span>/juices/</span><input id="f-slug" name="slug" value="${e(juice.slug)}" placeholder="made from the name"></div></div>
						</section>
					</div>

					<aside class="editor__preview">
						<p class="field-label">Preview</p>
						<div data-preview></div>
					</aside>
				</div>

				<footer class="editor__foot">
					${original ? `<button type="button" class="btn btn--danger btn--sm" data-delete>${icon('trash')} Delete</button>` : '<span></span>'}
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
	let uploading = false;
	let slugTouched = Boolean(original);

	const close = () => {
		dialog.close();
		dialog.remove();
	};

	function read() {
		const f = form.elements;
		const num = name => Number(f[name].value) || 0;
		const names = [...form.querySelectorAll('[name="vitName"]')].map(i => i.value.trim());
		const dvs = [...form.querySelectorAll('[name="vitDv"]')].map(i => Number(i.value) || 0);
		return {
			...juice,
			name: f.name.value.trim(),
			slug: slugify(f.slug.value || f.name.value),
			tagline: f.tagline.value.trim(),
			description: f.description.value.trim(),
			ingredients: f.ingredients.value.split(',').map(s => s.trim()).filter(Boolean),
			price: Number(f.price.value) || 0,
			color: f.color.value,
			splash: f.splash.value,
			active: f.active.checked,
			inStock: f.inStock.checked,
			sizeOz: num('sizeOz') || 16,
			nutrition: Object.fromEntries(Object.keys(BLANK.nutrition).map(key => [key, num(key)])),
			vitamins: names.map((name, i) => ({ name, dv: dvs[i] })).filter(v => v.name)
		};
	}

	function preview() {
		const current = read();
		form.querySelector('[data-color-value]').textContent = current.color;
		form.querySelector('[data-preview]').innerHTML = current.image
			? juiceCard({ ...current, name: current.name || 'Juice name', image: current.image, imageSmall: current.imageSmall || current.image })
			: `<div class="preview-empty">Upload a bottle photo to see the preview.</div>`;
		form.querySelectorAll('[data-preview] [data-reveal]').forEach(el => el.classList.add('is-revealed'));
	}

	form.addEventListener('input', event => {
		if (event.target.name === 'slug') slugTouched = true;
		if (event.target.name === 'name' && !slugTouched) form.elements.slug.value = slugify(event.target.value);
		preview();
	});
	form.addEventListener('change', preview);
	form.addEventListener('click', event => {
		if (event.target.closest('[data-close]')) close();
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
		if (!next.image) return toast('Upload a bottle photo first.', true);
		const list = original ? state.juices.map((j, i) => (i === index ? next : j)) : [...state.juices, next];
		const button = form.querySelector('[data-save]');
		button.disabled = true;
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

	preview();
	dialog.showModal();
}

/*=============== ORDERS ===============*/
async function renderOrders() {
	const main = document.getElementById('admin-main');
	main.innerHTML = `<div class="admin-head"><div><h1 class="admin-title">Orders</h1><p class="muted">Paid orders, grouped by pickup or delivery day.</p></div><button type="button" class="btn btn--ghost" data-refresh>Refresh</button></div><div data-orders><p class="muted">Loading&hellip;</p></div>`;
	main.querySelector('[data-refresh]').addEventListener('click', () => {
		state.orders = null;
		renderOrders();
	});

	if (!state.orders) {
		const data = await guarded(() => api('orders'));
		if (!data) return;
		state.orders = data.orders;
	}
	if (state.tab !== 'orders') return;

	const today = todayISO();
	const byDate = new Map();
	state.orders.forEach(order => byDate.set(order.date, [...(byDate.get(order.date) || []), order]));
	const dates = [...byDate.keys()].sort();
	const upcoming = dates.filter(d => d >= today);
	const past = dates.filter(d => d < today).reverse();

	const dayBlock = date => {
		const orders = byDate.get(date);
		const prep = new Map();
		orders.forEach(o => o.lines.forEach(l => prep.set(l.name, (prep.get(l.name) || 0) + l.qty)));
		const total = orders.reduce((sum, o) => sum + o.total, 0);
		return `
			<section class="order-day">
				<header class="order-day__head">
					<h2>${formatDate(date)}</h2>
					<p>${orders.length} order${orders.length === 1 ? '' : 's'} &middot; ${formatMoney(total)}</p>
				</header>
				<div class="prep">${[...prep].map(([name, qty]) => `<span class="prep__item"><strong>${qty}</strong> ${e(name)}</span>`).join('')}</div>
				<div class="order-cards">
					${orders
						.map(
							o => `
						<article class="order-card">
							<div class="order-card__top">
								<span class="pill ${o.type === 'delivery' ? 'pill--dark' : 'pill--ok'}">${o.type === 'delivery' ? 'Delivery' : 'Pickup'}</span>
								<strong>${formatMoney(o.total)}</strong>
							</div>
							<h3>${e(o.customer.name)}</h3>
							<p class="order-card__contact"><a href="tel:${e(o.customer.phone)}">${e(o.customer.phone)}</a> &middot; <a href="mailto:${e(o.customer.email)}">${e(o.customer.email)}</a></p>
							${o.address ? `<p class="order-card__address">${icon('pin')} ${e([o.address.line1, o.address.line2, `${o.address.city}, NJ ${o.address.zip}`].filter(Boolean).join(', '))}${o.zoneCheck?.status === 'in' ? ` <span class="muted">(${o.zoneCheck.miles} mi)</span>` : ' <span class="pill pill--warn">check distance</span>'}</p>` : ''}
							<ul class="order-card__items">${o.lines.map(l => `<li>${l.qty} &times; ${e(l.name)}</li>`).join('')}</ul>
							${o.notes ? `<p class="order-card__notes">&ldquo;${e(o.notes)}&rdquo;</p>` : ''}
						</article>`
						)
						.join('')}
				</div>
			</section>`;
	};

	main.querySelector('[data-orders]').innerHTML = `
		${upcoming.length ? upcoming.map(dayBlock).join('') : '<p class="empty">No upcoming orders yet. New paid orders show up here and in your inbox.</p>'}
		${past.length ? `<details class="past"><summary>Past orders (${past.reduce((n, d) => n + byDate.get(d).length, 0)})</summary>${past.map(dayBlock).join('')}</details>` : ''}`;
}

/*=============== SETTINGS ===============*/
function renderSettings() {
	const s = state.settings;
	const days = [1, 2, 3, 4, 5, 6, 0];
	const main = document.getElementById('admin-main');
	main.innerHTML = `
		<div class="admin-head"><div><h1 class="admin-title">Ordering &amp; settings</h1><p class="muted">How customers can get their juice.</p></div></div>
		<form class="settings" id="settings-form" novalidate>
			<section class="card settings__card">
				<h2>Online ordering</h2>
				<label class="toggle toggle--lg"><input type="checkbox" name="orderingEnabled" ${s.orderingEnabled ? 'checked' : ''}><span></span> Accept online orders</label>
				<div class="field"><label for="s-announcement">Banner message <span class="optional">shows at the top of every page, leave empty for none</span></label><input id="s-announcement" name="announcement" maxlength="160" value="${e(s.announcement)}" placeholder="New flavor drops Monday!"></div>
			</section>

			<section class="card settings__card">
				<h2>Pickup</h2>
				<label class="toggle"><input type="checkbox" name="pickupEnabled" ${s.pickup.enabled ? 'checked' : ''}><span></span> Offer pickup</label>
				<div class="field"><label for="s-area">Pickup area <span class="optional">shown on the site</span></label><input id="s-area" name="pickupArea" value="${e(s.pickup.area)}"></div>
				<div class="field"><label for="s-details">Pickup instructions <span class="optional">only sent in the confirmation email</span></label><textarea id="s-details" name="pickupDetails" rows="2">${e(s.pickup.details)}</textarea></div>
				<p class="field-label">Pickup days</p>
				<div class="day-picks">${days.map(d => `<label class="day-pick"><input type="checkbox" name="pickupDays" value="${d}" ${s.pickup.days.includes(d) ? 'checked' : ''}><span>${weekdayName(d).slice(0, 3)}</span></label>`).join('')}</div>
				<div class="num-grid">${numberField('pickupLeadDays', 'Days of notice needed', s.pickup.leadDays, 'days')}</div>
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
					${numberField('cutoffDays', 'Order cutoff', s.delivery.cutoffDays, 'days before')}
				</div>
				<p class="hint">Radius is measured from ${s.delivery.zones.map(z => e(z.label)).join(' and ')}. Set "Free delivery over" to 0 to always charge the fee.</p>
			</section>

			<section class="card settings__card">
				<h2>Contact</h2>
				<div class="field-row">
					<div class="field"><label for="s-email">Email shown on the site</label><input id="s-email" name="contactEmail" type="email" value="${e(s.contactEmail)}"></div>
					<div class="field"><label for="s-ig">Instagram</label><div class="input-prefix"><span>@</span><input id="s-ig" name="instagram" value="${e(s.instagram)}"></div></div>
				</div>
			</section>

			<div class="settings__save"><button type="submit" class="btn btn--ink btn--lg">Save settings</button></div>
		</form>`;

	document.getElementById('settings-form').addEventListener('submit', async event => {
		event.preventDefault();
		const f = event.target.elements;
		const num = name => Number(f[name].value);
		const next = {
			...s,
			orderingEnabled: f.orderingEnabled.checked,
			announcement: f.announcement.value,
			contactEmail: f.contactEmail.value,
			instagram: f.instagram.value,
			pickup: {
				...s.pickup,
				enabled: f.pickupEnabled.checked,
				area: f.pickupArea.value,
				details: f.pickupDetails.value,
				days: [...event.target.querySelectorAll('[name="pickupDays"]:checked')].map(i => Number(i.value)),
				leadDays: num('pickupLeadDays')
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
		toast('Settings saved');
		renderSettings();
	});
}

/*=============== BOOT ===============*/
async function boot() {
	const session = await api('session');
	if (!session.signedIn) return renderLogin('', session.configured);
	const data = await guarded(() => api('data'));
	if (!data) return;
	Object.assign(state, { juices: data.juices, settings: data.settings, status: data.status, orders: null });
	renderShell();
	showTab();
}

window.addEventListener('hashchange', () => state.settings && document.getElementById('admin-main') && showTab());
boot().catch(err => {
	app.innerHTML = `<p class="admin-loading">Couldn't load the admin: ${e(err.message)}</p>`;
});
