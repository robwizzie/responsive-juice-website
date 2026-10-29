/**
 * A live preview of a real page of the site, inside the admin. The page loads in a frame
 * with ?admin-preview, borrows the admin's unsaved edits through window.sipPreview (see
 * lib/catalog.js), and every spot Hunter can edit (data-copy / data-edit) can be tapped.
 */
import { icon } from '../lib/icons.js';

export const DEVICES = { phone: 390, computer: 1280 };
const EDITABLE = '[data-copy], [data-edit]';
const hoverRules = spots => {
	const list = spots.split(',').map(sel => `.sip-tappable ${sel.trim()}`);
	return `
	${list.join(', ')} { cursor: pointer; outline: 2px dashed transparent; outline-offset: 3px; border-radius: 4px; transition: outline-color 0.15s, background-color 0.15s; }
	${list.map(sel => `${sel}:hover`).join(', ')} { outline-color: rgba(127, 168, 34, 0.9); background-color: rgba(198, 232, 92, 0.18); }`;
};

// Styles added to the previewed page: show what can be tapped, and skip the scroll-in animations
const FRAME_CSS = `
	html { scroll-behavior: auto !important; }
	[data-reveal] { opacity: 1 !important; transform: none !important; transition: none !important; }
	.sip-tappable .sip-selected, .sip-tappable .sip-selected:hover { outline: 3px solid #7fa822 !important; outline-offset: 3px; background-color: rgba(198, 232, 92, 0.22); }
`;

export const previewMarkup = (device = 'phone') => `
	<div class="preview" data-device="${device}">
		<div class="preview__bar">
			<div class="segmented segmented--sm preview__devices" role="radiogroup" aria-label="Preview size">
				<label><input type="radio" name="preview-device" value="phone" ${device === 'phone' ? 'checked' : ''}><span>${icon('phone')} Phone</span></label>
				<label><input type="radio" name="preview-device" value="computer" ${device === 'computer' ? 'checked' : ''}><span>${icon('monitor')} Computer</span></label>
			</div>
			<span class="preview__status" data-preview-status></span>
		</div>
		<div class="preview__viewport" data-preview-viewport>
			<div class="preview__loading" data-preview-loading>${icon('sparkle')} Loading the page…</div>
		</div>
	</div>`;

/**
 * Mounts a preview inside an element rendered from previewMarkup().
 * draft() returns { copy, settings, juice, replaces } for the page to show.
 * onSelect(key) runs when Hunter taps a page-text spot. To tap other things instead, pass
 * spots (a selector) and onTap(element). onReady() runs after every (re)load.
 */
export function mountPreview(root, { path, draft, onSelect = () => {}, onReady = () => {}, spots: tapSpots = EDITABLE, onTap = null, tappable = true }) {
	const viewport = root.querySelector('[data-preview-viewport]');
	const loading = root.querySelector('[data-preview-loading]');
	let device = root.querySelector('.preview').dataset.device;
	let frame = null;
	let currentPath = path;
	let selected = null;
	let restoreY = 0;
	let reloadTimer;
	let generation = 0;

	window.sipPreview = { draft };

	const doc = () => {
		try {
			return frame?.contentDocument || null;
		} catch {
			return null;
		}
	};

	function fit() {
		if (!frame) return;
		const width = DEVICES[device];
		const box = viewport.clientWidth;
		const scale = Math.min(1, box / width);
		frame.style.width = `${width}px`;
		frame.style.height = `${viewport.clientHeight / scale}px`;
		frame.style.transform = `scale(${scale})`;
		frame.style.left = `${Math.max(0, (box - width * scale) / 2)}px`;
	}

	// The page adds .is-ready once its content has rendered from the live menu
	function whenReady(win, done) {
		const start = Date.now();
		const mine = generation;
		(function check() {
			if (generation !== mine) return;
			const ready = win.document?.documentElement?.classList.contains('is-ready');
			if (ready || Date.now() - start > 4000) done();
			else setTimeout(check, 60);
		})();
	}

	function load() {
		generation++;
		const next = document.createElement('iframe');
		next.className = 'preview__frame';
		next.title = 'Preview of the page';
		next.setAttribute('tabindex', '-1');
		next.src = `${currentPath}${currentPath.includes('?') ? '&' : '?'}admin-preview=1`;
		next.style.visibility = 'hidden';
		viewport.appendChild(next);
		const old = frame;
		frame = next;
		fit();
		loading.hidden = Boolean(old);
		next.addEventListener('load', () => {
			const win = next.contentWindow;
			const d = next.contentDocument;
			const style = d.createElement('style');
			style.textContent = FRAME_CSS + hoverRules(tapSpots);
			d.head.appendChild(style);
			if (tappable) d.documentElement.classList.add('sip-tappable');
			// Tapping in the preview selects; links, buttons and the cart do nothing here
			d.addEventListener(
				'click',
				event => {
					event.preventDefault();
					event.stopPropagation();
					if (!tappable) return;
					if (onTap) return onTap(event.target);
					const spot = event.target.closest(EDITABLE);
					if (spot) onSelect(spot.dataset.copy || spot.dataset.edit);
				},
				true
			);
			d.addEventListener('submit', event => event.preventDefault(), true);
			whenReady(win, () => {
				win.scrollTo(0, restoreY);
				next.style.visibility = '';
				old?.remove();
				loading.hidden = true;
				if (selected) mark(selected, false);
				onReady();
			});
		});
	}

	function spots(key) {
		const d = doc();
		return d ? [...d.querySelectorAll(`[data-copy="${CSS.escape(key)}"], [data-edit="${CSS.escape(key)}"]`)] : [];
	}

	function mark(key, scroll = true) {
		const d = doc();
		if (!d) return;
		d.querySelectorAll('.sip-selected').forEach(el => el.classList.remove('sip-selected'));
		selected = key;
		const found = key ? spots(key) : [];
		found.forEach(el => el.classList.add('sip-selected'));
		const first = found.find(el => el.getClientRects().length);
		if (scroll && first) {
			const win = frame.contentWindow;
			const rect = first.getBoundingClientRect();
			const visible = win.innerHeight * (root.closest('.is-sheet-open') ? 0.45 : 1);
			if (rect.top < 60 || rect.bottom > visible - 20) win.scrollTo({ top: win.scrollY + rect.top - Math.min(120, visible / 4), behavior: 'smooth' });
		}
		return found.length > 0;
	}

	new ResizeObserver(fit).observe(viewport);
	root.addEventListener('change', event => {
		if (event.target.name !== 'preview-device') return;
		device = event.target.value;
		root.querySelector('.preview').dataset.device = device;
		fit();
		if (selected) setTimeout(() => mark(selected), 50);
	});

	load();

	return {
		/** Shows new text in place; returns false when the spot isn't plain text on this page. */
		setText(key, text) {
			const found = spots(key);
			if (!found.length) return false;
			found.forEach(el => (el.textContent = text));
			return true;
		},
		/** Reloads the page with the latest draft, keeping the scroll position. */
		reload(delay = 350) {
			clearTimeout(reloadTimer);
			reloadTimer = setTimeout(() => {
				try {
					restoreY = frame?.contentWindow?.scrollY || 0;
				} catch {
					restoreY = 0;
				}
				load();
			}, delay);
		},
		navigate(nextPath) {
			if (nextPath === currentPath) return;
			currentPath = nextPath;
			restoreY = 0;
			selected = null;
			loading.hidden = false;
			load();
		},
		select: key => mark(key),
		has: key => spots(key).length > 0,
		/** Re-renders a juice page in place (no reload), for the juice editor. */
		render(juice) {
			try {
				const win = frame?.contentWindow;
				if (win?.sipRenderJuice) {
					win.sipRenderJuice(juice);
					return true;
				}
			} catch {
				/* fall back to a reload */
			}
			return false;
		},
		destroy() {
			clearTimeout(reloadTimer);
			generation++;
			if (window.sipPreview?.draft === draft) delete window.sipPreview;
		}
	};
}
