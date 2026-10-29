/**
 * Admin → Ingredients: one photo per ingredient, shared by every juice. Hunter can replace the
 * photos that ship with the site or add one for a new ingredient. Each change saves right away.
 */
import { icon } from '../lib/icons.js';
import { escapeHtml as e } from '../lib/catalog.js';
import { INGREDIENT_ICONS, ingredientIcon, ingredientKey } from '../shared/catalog.js';
import { api, guarded, saveIngredientPhotos, toast } from './admin.js';
import { preparePhoto } from './image.js';

let state = null;
let query = '';

const pretty = file => file.replace(/-/g, ' ').replace(/^./, ch => ch.toUpperCase());

/** Every ingredient the site knows: on a juice, bundled with the site, or uploaded by Hunter. */
export function allIngredients(adminState = state) {
	const state = adminState;
	const byKey = new Map();
	const add = (key, name) => byKey.get(key) || byKey.set(key, { key, name, juices: [] }).get(key);
	state.juices.forEach(juice => juice.ingredients.forEach(name => add(ingredientKey(name), name).juices.push(juice.name)));
	INGREDIENT_ICONS.forEach(file => add(file, pretty(file)));
	Object.keys(state.settings.ingredientPhotos || {}).forEach(key => add(key, pretty(key)));
	return [...byKey.values()].sort((a, b) => Boolean(b.juices.length) - Boolean(a.juices.length) || a.name.localeCompare(b.name));
}

function card(item) {
	const custom = state.settings.ingredientPhotos?.[item.key];
	const bundled = ingredientIcon(item.key);
	const src = custom || bundled;
	return `
		<article class="ingr-card${custom ? ' is-custom' : ''}">
			<label class="ingr-card__photo${src ? '' : ' is-empty'}" data-ingr-box="${e(item.key)}" title="${src ? 'Replace photo' : 'Add a photo'}">
				${src ? `<img src="${e(src)}" alt="" loading="lazy">` : `${icon('camera')}<small>Add photo</small>`}
				<input type="file" accept="image/png,image/webp,image/jpeg" data-ingr-upload="${e(item.key)}" data-name="${e(item.name)}" hidden>
			</label>
			<div class="ingr-card__body">
				<h3>${e(item.name)}</h3>
				<p class="ingr-card__used">${item.juices.length ? `In ${item.juices.map(e).join(', ')}` : 'Not in a juice yet'}</p>
				<p class="ingr-card__source">${custom ? '<span class="pill pill--ok">Your photo</span>' : bundled ? '<span class="pill">Original photo</span>' : '<span class="pill pill--warn">No photo</span>'}</p>
			</div>
			<div class="ingr-card__actions">
				<label class="btn btn--ghost btn--sm">${icon('upload')} ${src ? 'Replace' : 'Upload'}<input type="file" accept="image/png,image/webp,image/jpeg" data-ingr-upload="${e(item.key)}" data-name="${e(item.name)}" hidden></label>
				${custom ? `<button type="button" class="btn btn--ghost btn--sm" data-ingr-original="${e(item.key)}" data-name="${e(item.name)}">${icon(bundled ? 'swap' : 'trash')} ${bundled ? 'Original' : 'Remove'}</button>` : ''}
			</div>
		</article>`;
}

function renderList() {
	const q = query.toLowerCase();
	const items = allIngredients().filter(item => !q || item.name.toLowerCase().includes(q) || item.juices.some(name => name.toLowerCase().includes(q)));
	const used = items.filter(item => item.juices.length);
	const rest = items.filter(item => !item.juices.length);
	document.querySelector('[data-ingr-list]').innerHTML = items.length
		? `${used.length ? `<h2 class="ingr-group">On your juices</h2><div class="ingr-grid">${used.map(card).join('')}</div>` : ''}
			${rest.length ? `<h2 class="ingr-group">Other ingredients</h2><div class="ingr-grid">${rest.map(card).join('')}</div>` : ''}`
		: `<p class="empty">No ingredient called &ldquo;${e(query)}&rdquo; yet. Add it below with a photo, then put it on a juice in Menu.</p>`;
}

async function setPhoto(key, url, message) {
	const photos = { ...(state.settings.ingredientPhotos || {}) };
	if (url) photos[key] = url;
	else delete photos[key];
	if (await saveIngredientPhotos(photos)) toast(message);
	renderList();
}

async function upload(file, key, name, box) {
	box?.classList.add('is-busy');
	try {
		const { blob } = await preparePhoto(file, 480);
		const result = await guarded(() => api('images', { method: 'POST', blob }));
		if (result) await setPhoto(key, result.url, `${name} photo saved. It's live on every juice with ${name}.`);
	} catch (err) {
		toast(err.message, true);
	} finally {
		box?.classList.remove('is-busy');
	}
}

export function renderIngredients(adminState) {
	state = adminState;
	const main = document.getElementById('admin-main');
	main.innerHTML = `
		<div data-ingr-root>
			<div class="admin-head">
				<div>
					<h1 class="admin-title">Ingredients</h1>
					<p class="muted">One photo per ingredient, used on every juice that has it. Changes go live as soon as you upload.</p>
				</div>
				<label class="search">${icon('search')}<input type="search" placeholder="Find an ingredient" value="${e(query)}" data-ingr-search aria-label="Find an ingredient"></label>
			</div>
			<form class="card ingr-new" data-ingr-new-form>
				<div class="ingr-new__copy">
					<h2>Add a new ingredient</h2>
					<p class="hint">Give it a name and a photo (a PNG with the background removed looks best). Then add it to a juice in Menu.</p>
				</div>
				<input name="name" placeholder="Dragon fruit" maxlength="40" aria-label="Ingredient name" required>
				<label class="btn btn--ink">${icon('upload')} Choose photo<input type="file" name="photo" accept="image/png,image/webp,image/jpeg" hidden></label>
			</form>
			<div data-ingr-list></div>
		</div>`;
	renderList();
	const root = main.querySelector('[data-ingr-root]');

	root.querySelector('[data-ingr-search]').addEventListener('input', event => {
		query = event.target.value.trim();
		renderList();
	});

	root.addEventListener('change', event => {
		const input = event.target.closest('[data-ingr-upload]');
		if (input?.files[0]) return upload(input.files[0], input.dataset.ingrUpload, input.dataset.name, root.querySelector(`[data-ingr-box="${CSS.escape(input.dataset.ingrUpload)}"]`));
		if (event.target.name === 'photo' && event.target.files[0]) {
			const form = event.target.form;
			const name = form.name.value.trim();
			if (!name) {
				event.target.value = '';
				form.name.focus();
				return toast('Type the ingredient name first.', true);
			}
			upload(event.target.files[0], ingredientKey(name), name).then(() => form.reset());
		}
	});

	root.addEventListener('submit', event => event.preventDefault());

	root.addEventListener('click', event => {
		const original = event.target.closest('[data-ingr-original]');
		if (!original) return;
		const { ingrOriginal: key, name } = original.dataset;
		setPhoto(key, '', ingredientIcon(key) ? `${name} is back to the original photo.` : `${name} photo removed.`);
	});
}
