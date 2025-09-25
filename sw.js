// Service Worker for Pressed by J & H
// This service worker provides basic caching functionality

const CACHE_NAME = 'pressed-juice-v1';
const urlsToCache = ['/', '/assets/css/styles.css', '/assets/js/main.js', '/assets/js/cart.js', '/assets/js/juices-database.js', '/assets/js/locations-database.js', '/assets/js/components/header.js', '/assets/js/components/footer.js', '/assets/js/components/carousel-manager.js', '/assets/js/components/juice-carousel.js', '/assets/img/branding/logo.png', '/assets/img/favicon.png'];

// Install event - cache resources
self.addEventListener('install', event => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then(cache => {
				// Service Worker: Caching files
				return cache.addAll(urlsToCache);
			})
			.catch(error => {
				// Service Worker: Cache failed
			})
	);
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
	event.respondWith(
		caches
			.match(event.request)
			.then(response => {
				// Return cached version or fetch from network
				return response || fetch(event.request);
			})
			.catch(error => {
				// Service Worker: Fetch failed
				// Return a fallback page for navigation requests
				if (event.request.mode === 'navigate') {
					return caches.match('/');
				}
			})
	);
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
	event.waitUntil(
		caches.keys().then(cacheNames => {
			return Promise.all(
				cacheNames.map(cacheName => {
					if (cacheName !== CACHE_NAME) {
						// Service Worker: Deleting old cache
						return caches.delete(cacheName);
					}
				})
			);
		})
	);
});
