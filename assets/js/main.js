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

function hideLoader() {
	document.documentElement.classList.remove('page-loading');
	loader.classList.add('hidden');
	setTimeout(() => loader.remove(), 600);
	window.dispatchEvent(new Event('page:ready'));
}

if (document.readyState === 'complete') hideLoader();
else window.addEventListener('load', hideLoader);

/*=============== HEADER ===============*/
document.body.insertAdjacentHTML('afterbegin', Header.render());
Header.init();
