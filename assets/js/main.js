import Header from '/assets/js/components/header.js';

/*=============== PAGE LOADER ===============*/
// Pages inject the loader inline before first paint; this is a fallback for any that don't.
document.documentElement.classList.add('page-loading');

let loader = document.getElementById('page-loader');
if (!loader) {
	loader = document.createElement('div');
	loader.id = 'page-loader';
	loader.innerHTML = '<div class="spinner"></div>';
	document.body.prepend(loader);
}

// Reveal on full load, but never keep visitors staring at a spinner for long on slow connections
const LOADER_MAX_MS = 2500;
let loaderHidden = false;

function hideLoader() {
	if (loaderHidden) return;
	loaderHidden = true;
	document.documentElement.classList.remove('page-loading');
	loader.classList.add('hidden');
	setTimeout(() => loader.remove(), 600);
	window.dispatchEvent(new Event('page:ready'));
}

if (document.readyState === 'complete') hideLoader();
else {
	window.addEventListener('load', hideLoader);
	setTimeout(hideLoader, LOADER_MAX_MS);
}

/*=============== HEADER ===============*/
document.body.insertAdjacentHTML('afterbegin', Header.render());
Header.init();
