import Header from '/assets/js/components/header.js';
import CarouselManager from '/assets/js/components/carousel-manager.js';

async function initializePage() {
	// Render header
	const headerContainer = document.createElement('div');
	headerContainer.innerHTML = await Header.render();
	document.body.prepend(headerContainer);

	// Initialize header functionality
	Header.init();

	// Initialize cart after header is rendered
	if (typeof window.cart === 'undefined') {
		window.cart = new Cart();
	}
}

document.addEventListener('DOMContentLoaded', initializePage);

/*=============== GSAP ANIMATION ===============*/
function initializeGSAPAnimations() {
	// Only run on homepage
	if (window.location.pathname !== '/' && !window.location.pathname.includes('index')) {
		return;
	}

	gsap.from('.home__title', { duration: 1, delay: 0.2, opacity: 0, y: 20, ease: 'expo.inOut' });
	gsap.from('.home__description', { duration: 1, delay: 0.3, opacity: 0, y: 20, ease: 'expo.inOut' });
	gsap.from('.home__button:not(.add-to-cart)', { duration: 1, delay: 0.4, opacity: 0, y: 20, ease: 'expo.inOut' });
	gsap.from('.home__liquid', { duration: 1, delay: 0.7, opacity: 0, y: 200, ease: 'expo.inOut' });
	gsap.from('.home__juice-animate', { duration: 1, delay: 1.2, opacity: 0, y: -800, ease: 'expo.inOut' });
	gsap.from('.home__apple1', { duration: 1, delay: 1.5, opacity: 0, y: -800, ease: 'expo.inOut' });
	gsap.from('.home__apple2', { duration: 1, delay: 1.6, opacity: 0, y: -800, ease: 'expo.inOut' });
	gsap.from('.home__leaf:nth-child(1)', { duration: 2, delay: 1.3, opacity: 0, y: -800, ease: 'expo.inOut' });
	gsap.from('.home__leaf:nth-child(2)', { duration: 2, delay: 1.4, opacity: 0, y: -800, ease: 'expo.inOut' });
	gsap.from('.home__leaf:nth-child(3)', { duration: 2, delay: 1.5, opacity: 0, y: -800, ease: 'expo.inOut' });
	gsap.from('.home__leaf:nth-child(4)', { duration: 2, delay: 1.6, opacity: 0, y: -800, ease: 'expo.inOut' });
	gsap.from('.home__leaf:nth-child(5)', { duration: 2, delay: 1.7, opacity: 0, y: -800, ease: 'expo.inOut' });
	gsap.from('.home__leaf:nth-child(6)', { duration: 2, delay: 1.8, opacity: 0, y: -800, ease: 'expo.inOut' });
}

// Wait for GSAP to be available
function waitForGSAP() {
	if (typeof gsap !== 'undefined') {
		initializeGSAPAnimations();
	} else {
		setTimeout(waitForGSAP, 50);
	}
}

// Start waiting for GSAP
waitForGSAP();

document.addEventListener('DOMContentLoaded', function () {
	// Only run main carousel on home page, not on juice detail pages
	if (window.location.pathname.includes('/juices/')) return;

	// Check if carousel elements exist
	const track = document.querySelector('.carousel-track');
	if (!track) return;

	// Initialize main homepage carousel with CarouselManager
	window.mainCarousel = new CarouselManager({
		trackSelector: '.carousel-track',
		carouselSelector: '.carousel',
		prevButtonSelector: '.carousel-button.prev',
		nextButtonSelector: '.carousel-button.next',
		juices: typeof juices !== 'undefined' ? juices : [],
		isHomePage: true,
		dynamicWordSelector: '#dynamic-juice-word'
	});
});

// Add to main.js
document.addEventListener('DOMContentLoaded', () => {
	// Main.js initialization complete
});

// Add page-loading class immediately
if (!document.documentElement.classList.contains('page-loading')) {
	document.documentElement.classList.add('page-loading');
}

// Create and append loader overlay if it doesn't exist
let loader = document.getElementById('page-loader');
if (!loader) {
	loader = document.createElement('div');
	loader.id = 'page-loader';
	loader.innerHTML = '<div class="spinner"></div>';
	document.body.prepend(loader);
}

window.addEventListener('load', () => {
	// Remove loading class and hide loader
	document.documentElement.classList.remove('page-loading');
	loader.classList.add('hidden');
	setTimeout(() => loader.remove(), 600); // clean up after fade-out

	// No caching - always fetch fresh content
});

// Enable navigation for <button href="..."> elements (used on the hero section buttons).
document.addEventListener('click', event => {
	// Look for the closest button that has an href attribute and the "home__button" class.
	const btn = event.target.closest('button.home__button[href]');
	if (!btn) return;

	// Skip if this button is meant for cart operations or checkout.
	if (btn.classList.contains('add-to-cart') || btn.id === 'checkoutButton' || btn.classList.contains('checkout-button')) {
		return;
	}

	const url = btn.getAttribute('href');
	if (url && !url.startsWith('#')) {
		event.preventDefault();
		window.location.assign(url);
	}
});
