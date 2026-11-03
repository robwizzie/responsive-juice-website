/**
 * Photo cropper: shows the photo in a box shaped like the spot it's going into. Drag to move it,
 * pinch or use the slider (or scroll wheel) to zoom, then save just the framed part as a WebP.
 *
 *   const result = await cropPhoto(file, { aspect: 4 / 5, maxSide: 1400 });
 *   // { blob, preview } for the cropped photo, 'whole' to use it uncropped, or null if canceled
 */
import { icon } from '../lib/icons.js';
import { photoBlob } from './image.js';

const MAX_ZOOM = 4;

function loadImage(source) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.decoding = 'async';
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('That file could not be opened as an image.'));
		img.src = typeof source === 'string' ? source : URL.createObjectURL(source);
	});
}

/** The part of the photo inside the frame, in the photo's own pixels. Pure, so it can be tested. */
export function cropRect({ width, height }, frame, { zoom, x, y }) {
	const scale = Math.max(frame.width / width, frame.height / height) * zoom;
	return { sx: -x / scale, sy: -y / scale, sw: frame.width / scale, sh: frame.height / scale };
}

/** Keeps the photo covering the whole frame (no empty edges) after a move or zoom. */
export function clampView({ width, height }, frame, view) {
	const scale = Math.max(frame.width / width, frame.height / height) * view.zoom;
	const minX = frame.width - width * scale;
	const minY = frame.height - height * scale;
	return { zoom: view.zoom, x: Math.min(0, Math.max(minX, view.x)), y: Math.min(0, Math.max(minY, view.y)) };
}

export async function cropPhoto(source, { aspect = 4 / 5, maxSide = 1600, title = 'Fit your photo', shape = 'Portrait' } = {}) {
	const img = await loadImage(source);
	const natural = { width: img.naturalWidth, height: img.naturalHeight };

	const dialog = document.createElement('dialog');
	dialog.className = 'cropper';
	dialog.setAttribute('aria-labelledby', 'cropper-title');
	dialog.innerHTML = `
		<div class="cropper__head">
			<h2 id="cropper-title" class="cropper__title">${title}</h2>
			<button type="button" class="icon-btn" data-crop-cancel aria-label="Cancel">${icon('close')}</button>
		</div>
		<p class="cropper__hint">Drag the photo to move it. Zoom in to fill the frame. Only what's inside the frame goes on the site.</p>
		<div class="cropper__stage" style="--a: ${aspect}; aspect-ratio: ${aspect}" data-crop-stage tabindex="0" aria-label="${shape} frame. Use the arrow keys to move the photo, plus and minus to zoom.">
			<img src="${img.src}" alt="" class="cropper__img" draggable="false">
			<span class="cropper__grid" aria-hidden="true"></span>
		</div>
		<label class="cropper__zoom">
			<span>${icon('minus')}</span>
			<input type="range" min="1" max="${MAX_ZOOM}" step="0.01" value="1" aria-label="Zoom" data-crop-zoom>
			<span>${icon('plus')}</span>
		</label>
		<div class="cropper__foot">
			<button type="button" class="btn btn--ghost btn--sm" data-crop-whole>Use the whole photo</button>
			<button type="button" class="btn btn--ink" data-crop-done>${icon('check')} Use this</button>
		</div>`;
	document.body.append(dialog);

	const stage = dialog.querySelector('[data-crop-stage]');
	const photo = dialog.querySelector('.cropper__img');
	const slider = dialog.querySelector('[data-crop-zoom]');
	let frame = { width: 1, height: 1 };
	let view = { zoom: 1, x: 0, y: 0 };

	const draw = () => {
		const scale = Math.max(frame.width / natural.width, frame.height / natural.height) * view.zoom;
		photo.style.width = `${natural.width * scale}px`;
		photo.style.height = `${natural.height * scale}px`;
		photo.style.transform = `translate(${view.x}px, ${view.y}px)`;
		slider.value = view.zoom;
	};

	// Zoom around a point in the frame (the middle, or under the fingers / pointer)
	const zoomTo = (zoom, cx = frame.width / 2, cy = frame.height / 2) => {
		zoom = Math.min(MAX_ZOOM, Math.max(1, zoom));
		const ratio = zoom / view.zoom;
		view = clampView(natural, frame, { zoom, x: cx - (cx - view.x) * ratio, y: cy - (cy - view.y) * ratio });
		draw();
	};

	const measure = () => {
		const box = stage.getBoundingClientRect();
		const before = frame;
		frame = { width: box.width, height: box.height };
		if (before.width > 1) {
			// Keep the same part framed when the box resizes (rotating a phone)
			const k = frame.width / before.width;
			view = clampView(natural, frame, { zoom: view.zoom, x: view.x * k, y: view.y * k });
		} else {
			// Start centered, a little above middle so faces in portraits land well
			const scale = Math.max(frame.width / natural.width, frame.height / natural.height);
			view = clampView(natural, frame, { zoom: 1, x: (frame.width - natural.width * scale) / 2, y: (frame.height - natural.height * scale) * 0.3 });
		}
		draw();
	};

	// Dragging and pinching
	const pointers = new Map();
	let last = null;
	const gesture = () => {
		const [a, b] = [...pointers.values()];
		const box = stage.getBoundingClientRect();
		if (!b) return { x: a.x - box.left, y: a.y - box.top, distance: 0 };
		return { x: (a.x + b.x) / 2 - box.left, y: (a.y + b.y) / 2 - box.top, distance: Math.hypot(a.x - b.x, a.y - b.y) };
	};
	stage.addEventListener('pointerdown', event => {
		stage.setPointerCapture(event.pointerId);
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		last = gesture();
		stage.classList.add('is-dragging');
	});
	stage.addEventListener('pointermove', event => {
		if (!pointers.has(event.pointerId)) return;
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		const now = gesture();
		if (last.distance && now.distance) zoomTo(view.zoom * (now.distance / last.distance), now.x, now.y);
		view = clampView(natural, frame, { zoom: view.zoom, x: view.x + now.x - last.x, y: view.y + now.y - last.y });
		draw();
		last = now;
	});
	const release = event => {
		pointers.delete(event.pointerId);
		last = pointers.size ? gesture() : null;
		if (!pointers.size) stage.classList.remove('is-dragging');
	};
	stage.addEventListener('pointerup', release);
	stage.addEventListener('pointercancel', release);
	stage.addEventListener(
		'wheel',
		event => {
			event.preventDefault();
			const box = stage.getBoundingClientRect();
			zoomTo(view.zoom * Math.exp(-event.deltaY * 0.002), event.clientX - box.left, event.clientY - box.top);
		},
		{ passive: false }
	);
	stage.addEventListener('keydown', event => {
		const step = event.shiftKey ? 40 : 10;
		const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
		if (moves[event.key]) {
			event.preventDefault();
			view = clampView(natural, frame, { zoom: view.zoom, x: view.x + moves[event.key][0], y: view.y + moves[event.key][1] });
			draw();
		} else if (event.key === '+' || event.key === '=') zoomTo(view.zoom * 1.1);
		else if (event.key === '-') zoomTo(view.zoom / 1.1);
	});
	slider.addEventListener('input', () => zoomTo(Number(slider.value)));

	const resize = new ResizeObserver(measure);

	const result = await new Promise(resolve => {
		dialog.addEventListener('cancel', event => {
			event.preventDefault();
			resolve(null);
		});
		dialog.querySelector('[data-crop-cancel]').addEventListener('click', () => resolve(null));
		dialog.querySelector('[data-crop-whole]').addEventListener('click', () => resolve('whole'));
		dialog.querySelector('[data-crop-done]').addEventListener('click', async () => {
			const { sx, sy, sw, sh } = cropRect(natural, frame, view);
			// Never larger than the photo itself, and no bigger than the site needs
			const scale = Math.min(1, maxSide / Math.max(sw, sh));
			const canvas = document.createElement('canvas');
			canvas.width = Math.round(sw * scale);
			canvas.height = Math.round(sh * scale);
			const ctx = canvas.getContext('2d');
			ctx.imageSmoothingQuality = 'high';
			ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
			const blob = await photoBlob(canvas);
			resolve(blob ? { blob, preview: URL.createObjectURL(blob) } : null);
		});
		dialog.showModal();
		resize.observe(stage);
		stage.focus();
	});

	resize.disconnect();
	dialog.close();
	dialog.remove();
	if (typeof source !== 'string') URL.revokeObjectURL(img.src);
	return result;
}
