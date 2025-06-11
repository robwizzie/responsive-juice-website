// Router class to handle client-side routing
class Router {
	constructor() {
		this.routes = {
			'/': 'index.html',
			'/about': 'about.html',
			'/juices': 'all-juices.html',
			'/contact': 'contact.html',
			'/athletes': 'athletes.html'
		};

		// Handle individual juice pages dynamically
		this.handleJuicePage = path => {
			const slug = path.split('/').pop();
			if (!window.juices) {
				console.error('Juices database not loaded');
				return false;
			}
			const juice = window.juices.find(j => j.slug === slug);
			if (juice) {
				return 'juice.html';
			}
			return false;
		};

		this.init();
	}

	init() {
		// Handle initial page load
		this.handleRoute(window.location.pathname);

		// Handle browser back/forward buttons
		window.addEventListener('popstate', e => {
			this.handleRoute(window.location.pathname, false);
		});

		// Handle link clicks
		document.addEventListener('click', e => {
			const link = e.target.closest('a');
			if (link && link.href.startsWith(window.location.origin)) {
				e.preventDefault();
				const path = link.pathname;
				this.navigate(path);
			}
		});
	}

	async handleRoute(path, addToHistory = true) {
		let page = this.routes[path];

		// Check for juice page if route not found
		if (!page && path.startsWith('/juices/')) {
			page = this.handleJuicePage(path);
		}

		if (!page) {
			console.error('Page not found:', path);
			this.navigate('/');
			return;
		}

		try {
			const response = await fetch(page);
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			const html = await response.text();

			// Update the page content
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, 'text/html');

			// Preserve the header and cart
			const currentHeader = document.querySelector('header');
			const currentCart = document.getElementById('cartOverlay');

			// Update the main content
			const newMain = doc.querySelector('main');
			const currentMain = document.querySelector('main');
			if (currentMain && newMain) {
				currentMain.replaceWith(newMain);
			} else if (newMain) {
				document.body.appendChild(newMain);
			}

			// Update title
			document.title = doc.title;

			// Add to browser history
			if (addToHistory) {
				window.history.pushState({}, '', path);
			}

			// Initialize any page-specific JavaScript
			this.initializePageScripts(path);
		} catch (error) {
			console.error('Error loading page:', error);
			this.navigate('/');
		}
	}

	navigate(path) {
		this.handleRoute(path);
	}

	initializePageScripts(path) {
		// Remove any existing page-specific scripts
		const oldScripts = document.querySelectorAll('script[data-page-script]');
		oldScripts.forEach(script => script.remove());

		// Add new page-specific scripts
		if (path.startsWith('/juices/')) {
			// Individual juice page
			const script = document.createElement('script');
			script.src = '/assets/js/juice.js';
			script.setAttribute('data-page-script', 'true');
			document.body.appendChild(script);
		} else if (path === '/juices') {
			// All juices page
			const script = document.createElement('script');
			script.src = '/assets/js/all-juices.js';
			script.setAttribute('data-page-script', 'true');
			document.body.appendChild(script);
		}
		// Add other page-specific script initializations as needed
	}
}

// Initialize router
document.addEventListener('DOMContentLoaded', () => {
	window.router = new Router();
});
