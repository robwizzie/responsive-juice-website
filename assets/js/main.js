import Header from '/assets/js/components/header.js';

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
TweenMax.from('.home__title', 1, { delay: 0.2, opacity: 0, y: 20, ease: Expo.easeInOut });
TweenMax.from('.home__description', 1, { delay: 0.3, opacity: 0, y: 20, ease: Expo.easeInOut });
TweenMax.from('.home__button:not(.add-to-cart)', 1, { delay: 0.4, opacity: 0, y: 20, ease: Expo.easeInOut });
TweenMax.from('.home__liquid', 1, { delay: 0.7, opacity: 0, y: 200, ease: Expo.easeInOut });
TweenMax.from('.home__juice-animate', 1, { delay: 1.2, opacity: 0, y: -800, ease: Expo.easeInOut });
TweenMax.from('.home__apple1', 1, { delay: 1.5, opacity: 0, y: -800, ease: Expo.easeInOut });
TweenMax.from('.home__apple2', 1, { delay: 1.6, opacity: 0, y: -800, ease: Expo.easeInOut });
TweenMax.from('.home__leaf:nth-child(1)', 2, { delay: 1.3, opacity: 0, y: -800, ease: Expo.easeInOut });
TweenMax.from('.home__leaf:nth-child(2)', 2, { delay: 1.4, opacity: 0, y: -800, ease: Expo.easeInOut });
TweenMax.from('.home__leaf:nth-child(3)', 2, { delay: 1.5, opacity: 0, y: -800, ease: Expo.easeInOut });
TweenMax.from('.home__leaf:nth-child(4)', 2, { delay: 1.6, opacity: 0, y: -800, ease: Expo.easeInOut });
TweenMax.from('.home__leaf:nth-child(5)', 2, { delay: 1.7, opacity: 0, y: -800, ease: Expo.easeInOut });
TweenMax.from('.home__leaf:nth-child(6)', 2, { delay: 1.8, opacity: 0, y: -800, ease: Expo.easeInOut });

document.addEventListener('DOMContentLoaded', function () {
	const track = document.querySelector('.carousel-track');
	if (!track) return;

	// Only run main carousel on home page, not on juice detail pages
	if (window.location.pathname.includes('/juices/')) return;

	const carouselElement = document.querySelector('.carousel');
	const prevButton = document.querySelector('.carousel-button.prev');
	const nextButton = document.querySelector('.carousel-button.next');

	// Create left panel
	const leftPanel = document.createElement('div');
	leftPanel.className = 'carousel-left-panel';
	carouselElement.prepend(leftPanel);

	// Carousel state
	let currentIndex = 0;
	let isTransitioning = false;
	let activeJuice = null;
	let sortedJuices = [];
	let touchStartX = 0;
	let touchStartY = 0;
	let isDragging = false;
	let dragOffset = 0;
	let baseTransformX = 0;

	// Get number of visible items based on screen size
	function getVisibleItems() {
		const width = window.innerWidth;
		if (width <= 767) return 3;
		if (width >= 1800) return 5;
		if (width >= 1024) return 2;
		if (width >= 768) return 2;
		return 1;
	}

	// Initialize sorted juices
	function initializeSortedJuices() {
		sortedJuices = [...juices].sort((a, b) => {
			if (a.inStock && !b.inStock) return -1;
			if (!a.inStock && b.inStock) return 1;
			return 0;
		});
	}

	// Get juice by logical index (handles wrapping)
	function getJuiceByIndex(index) {
		const normalizedIndex = ((index % sortedJuices.length) + sortedJuices.length) % sortedJuices.length;
		return sortedJuices[normalizedIndex];
	}

	// Create initial carousel items
	function createCarouselItems() {
		track.innerHTML = '';
		const visibleItems = getVisibleItems();
		const totalItems = Math.max(visibleItems + 4, 7);

		// Create items centered around current index
		for (let i = 0; i < totalItems; i++) {
			const logicalIndex = currentIndex - Math.floor(totalItems / 2) + i;
			const juice = getJuiceByIndex(logicalIndex);
			const outOfStockClass = juice.inStock ? '' : ' out-of-stock';

			const item = document.createElement('div');
			item.className = `carousel-item${outOfStockClass}`;
			item.dataset.logicalIndex = logicalIndex;
			item.innerHTML = `
				<a href="/juices/${juice.slug}" class="carousel-item-link" tabindex="-1">
					<img src="${juice.imageUrl}" alt="${juice.name}" class="juice-bottle" loading="lazy" decoding="async">
				</a>
			`;
			track.appendChild(item);
		}
	}

	// Update existing items without recreating DOM - smooth transitions
	function updateCarouselContent() {
		const items = document.querySelectorAll('.carousel-item');
		const visibleItems = getVisibleItems();
		const totalItems = Math.max(visibleItems + 4, 7);

		// Update each existing item
		items.forEach((item, i) => {
			const logicalIndex = currentIndex - Math.floor(totalItems / 2) + i;
			const juice = getJuiceByIndex(logicalIndex);

			// Update data attribute
			item.dataset.logicalIndex = logicalIndex;

			// Update out of stock class
			item.classList.toggle('out-of-stock', !juice.inStock);

			// Update content only if needed to avoid unnecessary reflows
			const link = item.querySelector('.carousel-item-link');
			const img = item.querySelector('.juice-bottle');

			if (link.href !== window.location.origin + `/juices/${juice.slug}`) {
				link.href = `/juices/${juice.slug}`;
				img.src = juice.imageUrl;
				img.alt = juice.name;
			}
		});
	}

	// Render left panel content
	function renderLeftPanel(juice) {
		const addToCartButton = juice.inStock ? `<button class="home__button left-btn add-to-cart left-add-cart" data-id="${juice.id}" style="background-color:#fff;color:${juice.color};">Add to Cart</button>` : `<button class="home__button left-btn add-to-cart left-add-cart" data-id="${juice.id}" style="background-color:#ccc;color:#666;" disabled>Out of Stock</button>`;

		leftPanel.innerHTML = `
			<h3 class="slide-title" style="font-family: var(--second-font); color:#fff; margin-bottom:1.5rem;">${juice.name}</h3>
			<div class="ingredients-preview">
				${juice.ingredients
					.map(
						ing =>
							`<span class="ingredient-tag" style="background:rgba(255,255,255,0.3);color:#fff;">
						<img src="/assets/img/ingredients/${ing.toLowerCase().replace(/ /g, '-')}.svg" alt="${ing}" class="ingredient-icon"> 
						<span class="ingredient-name">${ing}</span>
					</span>`
					)
					.join('')}
			</div>
			<div class="button-row">
				<a href="/juices/${juice.slug}" class="home__button left-btn" style="background-color:#fff;color:${juice.color};">View Product</a>
				${addToCartButton}
			</div>
		`;
		leftPanel.style.backgroundColor = juice.color;

		if (window.innerWidth <= 767) {
			carouselElement.style.backgroundColor = juice.color;
		} else {
			carouselElement.style.backgroundColor = '';
		}

		// Update "Find Your Juice" title color
		const juiceWord = document.getElementById('dynamic-juice-word');
		if (juiceWord) {
			juiceWord.style.color = juice.color;
		}

		// Bind add-to-cart button (only if in stock)
		const btn = leftPanel.querySelector('.left-add-cart');
		if (btn && juice.inStock) {
			btn.addEventListener('click', e => {
				e.preventDefault();
				window.cart.addItem(juice.id);
			});
		}
	}

	// Update carousel position and styling
	function updateCarousel(instant = false, includeDragOffset = false) {
		const items = document.querySelectorAll('.carousel-item');
		if (items.length === 0) return;

		const itemWidth = items[0].offsetWidth + parseInt(window.getComputedStyle(track).gap || '0');
		const visibleItems = getVisibleItems();
		const centerIndex = Math.floor(items.length / 2);

		// Calculate base offset to center the middle item
		if (visibleItems === 3) {
			baseTransformX = -(centerIndex - 1) * itemWidth;
		} else if (visibleItems === 1) {
			const carouselWidth = carouselElement.offsetWidth;
			const extraSpace = (carouselWidth - itemWidth) / 2;
			baseTransformX = -centerIndex * itemWidth + extraSpace;
		} else {
			baseTransformX = -centerIndex * itemWidth;
		}

		// Include drag offset if dragging
		const finalOffset = baseTransformX + (includeDragOffset ? dragOffset : 0);

		// Apply transform
		if (instant) {
			track.style.transition = 'none';
			track.style.transform = `translateX(${finalOffset}px)`;
			track.offsetHeight; // Force reflow
			track.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
		} else {
			track.style.transition = isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
			track.style.transform = `translateX(${finalOffset}px)`;
		}

		// Update item classes only if not actively dragging
		if (!isDragging || !includeDragOffset) {
			items.forEach((item, index) => {
				item.classList.remove('active', 'prev', 'next', 'next2');

				if (index === centerIndex) {
					item.classList.add('active');
					const logicalIndex = parseInt(item.dataset.logicalIndex);
					activeJuice = getJuiceByIndex(logicalIndex);
				} else if (index === centerIndex - 1) {
					item.classList.add('prev');
				} else if (index === centerIndex + 1) {
					item.classList.add('next');
				} else if (index === centerIndex + 2) {
					item.classList.add('next2');
				}
			});

			if (activeJuice) {
				renderLeftPanel(activeJuice);
			}
		}
	}

	// Navigate to next item
	function nextSlide() {
		if (isTransitioning) return;
		isTransitioning = true;
		currentIndex++;
		updateCarouselContent(); // Update content without DOM recreation
		updateCarousel();
		setTimeout(() => {
			isTransitioning = false;
		}, 400);
	}

	// Navigate to previous item
	function prevSlide() {
		if (isTransitioning) return;
		isTransitioning = true;
		currentIndex--;
		updateCarouselContent(); // Update content without DOM recreation
		updateCarousel();
		setTimeout(() => {
			isTransitioning = false;
		}, 400);
	}

	// Navigate to specific item
	function goToSlide(targetLogicalIndex) {
		if (isTransitioning) return;
		isTransitioning = true;
		currentIndex = targetLogicalIndex;
		updateCarouselContent(); // Update content without DOM recreation
		updateCarousel();
		setTimeout(() => {
			isTransitioning = false;
		}, 400);
	}

	// Handle item clicks
	function handleItemClick(e) {
		const clickedItem = e.target.closest('.carousel-item');
		if (!clickedItem) return;

		// If clicking inactive item, navigate to it instead of following link
		if (!clickedItem.classList.contains('active')) {
			e.preventDefault();
			const logicalIndex = parseInt(clickedItem.dataset.logicalIndex);
			goToSlide(logicalIndex);
		}
	}

	// Enhanced touch event handlers for mobile dragging/swiping
	function handleTouchStart(e) {
		if (isTransitioning) return;

		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
		isDragging = false;
		dragOffset = 0;

		// Stop any ongoing transitions
		track.style.transition = 'none';
	}

	function handleTouchMove(e) {
		if (!touchStartX || isTransitioning) return;

		const touchCurrentX = e.touches[0].clientX;
		const touchCurrentY = e.touches[0].clientY;
		const diffX = touchStartX - touchCurrentX;
		const diffY = touchStartY - touchCurrentY;

		// Start dragging if horizontal movement is dominant
		if (!isDragging && Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 5) {
			isDragging = true;
			e.preventDefault(); // Prevent scrolling
		}

		// Update drag offset and apply real-time visual feedback
		if (isDragging) {
			e.preventDefault();
			dragOffset = -diffX; // Negative because we want drag to follow finger
			updateCarousel(false, true); // Update with drag offset
		}
	}

	function handleTouchEnd(e) {
		if (!touchStartX) return;

		const touchEndX = e.changedTouches[0].clientX;
		const diffX = touchStartX - touchEndX;
		const threshold = 50;
		const velocity = Math.abs(diffX) / 100; // Simple velocity calculation

		// Reset drag state
		const wasDragging = isDragging;
		isDragging = false;
		dragOffset = 0;

		if (wasDragging) {
			// Determine if we should navigate based on drag distance or velocity
			if (Math.abs(diffX) > threshold || velocity > 0.5) {
				if (diffX > 0) {
					nextSlide(); // Swipe left - go to next
				} else {
					prevSlide(); // Swipe right - go to previous
				}
			} else {
				// Snap back to current position
				updateCarousel(false, false);
			}
		}

		touchStartX = 0;
		touchStartY = 0;
	}

	// Debounce function for resize
	function debounce(func, wait) {
		let timeout;
		return function executedFunction(...args) {
			const later = () => {
				clearTimeout(timeout);
				func(...args);
			};
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
		};
	}

	// Handle window resize
	const handleResize = debounce(() => {
		// Only recreate items if screen size category changes significantly
		const items = document.querySelectorAll('.carousel-item');
		if (items.length === 0) {
			createCarouselItems();
		} else {
			updateCarouselContent();
		}
		updateCarousel(true);
	}, 250);

	// Event listeners
	prevButton.addEventListener('click', prevSlide);
	nextButton.addEventListener('click', nextSlide);
	track.addEventListener('click', handleItemClick);
	track.addEventListener('touchstart', handleTouchStart, { passive: false });
	track.addEventListener('touchmove', handleTouchMove, { passive: false });
	track.addEventListener('touchend', handleTouchEnd, { passive: false });
	window.addEventListener('resize', handleResize);

	// Initialize carousel
	initializeSortedJuices();
	createCarouselItems();
	updateCarousel(true);
});

// Add to main.js
document.addEventListener('DOMContentLoaded', () => {
	console.log('Main.js - DOM Content Loaded');
	console.log('Cart available:', window.cart);
	console.log('Add to cart buttons:', document.querySelectorAll('.add-to-cart').length);
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
