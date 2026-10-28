/**
 * Prepares a bottle photo in the browser before upload: trims empty transparent edges and
 * makes the three sizes the site uses (large + small WebP for the site, PNG for emails/Stripe).
 */

const SIZES = [
	{ key: 'image', height: 1200, type: 'image/webp', quality: 0.86 },
	{ key: 'imageSmall', height: 560, type: 'image/webp', quality: 0.86 },
	{ key: 'emailImage', height: 360, type: 'image/png' }
];

function loadImage(file) {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('That file could not be opened as an image.'));
		img.src = url;
	});
}

/** Bounding box of pixels that aren't (nearly) transparent, plus whether the image has transparency at all. */
function opaqueBounds(ctx, width, height) {
	const { data } = ctx.getImageData(0, 0, width, height);
	let top = height,
		left = width,
		right = -1,
		bottom = -1,
		transparent = 0;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const alpha = data[(y * width + x) * 4 + 3];
			if (alpha < 250) transparent++;
			if (alpha > 24) {
				if (x < left) left = x;
				if (x > right) right = x;
				if (y < top) top = y;
				if (y > bottom) bottom = y;
			}
		}
	}
	const hasTransparency = transparent > width * height * 0.05;
	return right < 0 ? { left: 0, top: 0, width, height, hasTransparency } : { left, top, width: right - left + 1, height: bottom - top + 1, hasTransparency };
}

const toBlob = (canvas, type, quality) => new Promise(resolve => canvas.toBlob(resolve, type, quality));

export async function prepareBottle(file) {
	const img = await loadImage(file);
	// Work on a capped copy so huge phone photos don't stall the tab
	const scale = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
	const work = document.createElement('canvas');
	work.width = Math.round(img.naturalWidth * scale);
	work.height = Math.round(img.naturalHeight * scale);
	const ctx = work.getContext('2d', { willReadFrequently: true });
	ctx.drawImage(img, 0, 0, work.width, work.height);
	URL.revokeObjectURL(img.src);

	const box = opaqueBounds(ctx, work.width, work.height);
	const outputs = {};
	for (const size of SIZES) {
		const height = Math.min(size.height, box.height);
		const width = Math.round((box.width / box.height) * height);
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const out = canvas.getContext('2d');
		out.imageSmoothingQuality = 'high';
		out.drawImage(work, box.left, box.top, box.width, box.height, 0, 0, width, height);
		outputs[size.key] = await toBlob(canvas, size.type, size.quality);
	}
	return { blobs: outputs, hasTransparency: box.hasTransparency, preview: URL.createObjectURL(outputs.imageSmall) };
}
