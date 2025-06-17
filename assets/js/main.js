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

		// Safety: if we have no juices, show message and exit
		if (sortedJuices.length === 0) {
			track.innerHTML = '<div class="no-juices">No juices available</div>';
			return;
		}

		const visibleItems = getVisibleItems();
		// Create enough clones (ahead & behind) so any navigation distance is seamless
		const clonesNeeded = Math.max(visibleItems * 2, sortedJuices.length);

		// 1️⃣  Clones of LAST items at the beginning
		for (let i = 0; i < clonesNeeded; i++) {
			const juiceIndex = (sortedJuices.length - clonesNeeded + i + sortedJuices.length) % sortedJuices.length;
			const juice = sortedJuices[juiceIndex];
			if (!juice) continue;
			const outOfStockClass = juice.inStock ? '' : ' out-of-stock';
			track.insertAdjacentHTML(
				'beforeend',
				`<div class="carousel-item clone-start${outOfStockClass}" data-original-index="${juiceIndex}">
					<a href="/juices/${juice.slug}" class="carousel-item-link" tabindex="-1">
						<img src="${juice.imageUrl}" alt="${juice.name}" class="juice-bottle" loading="lazy" decoding="async">
					</a>
				</div>`
			);
		}

		// 2️⃣  Original items
		sortedJuices.forEach((juice, index) => {
			const outOfStockClass = juice.inStock ? '' : ' out-of-stock';
			track.insertAdjacentHTML(
				'beforeend',
				`<div class="carousel-item original${outOfStockClass}" data-original-index="${index}">
					<a href="/juices/${juice.slug}" class="carousel-item-link" tabindex="-1">
						<img src="${juice.imageUrl}" alt="${juice.name}" class="juice-bottle" loading="lazy" decoding="async">
					</a>
				</div>`
			);
		});

		// 3️⃣  Clones of FIRST items at the end
		for (let i = 0; i < clonesNeeded; i++) {
			const juiceIndex = i % sortedJuices.length;
			const juice = sortedJuices[juiceIndex];
			if (!juice) continue;
			const outOfStockClass = juice.inStock ? '' : ' out-of-stock';
			track.insertAdjacentHTML(
				'beforeend',
				`<div class="carousel-item clone-end${outOfStockClass}" data-original-index="${juiceIndex}">
					<a href="/juices/${juice.slug}" class="carousel-item-link" tabindex="-1">
						<img src="${juice.imageUrl}" alt="${juice.name}" class="juice-bottle" loading="lazy" decoding="async">
					</a>
				</div>`
			);
		}

		// Set initial index to first original item (right after beginning clones)
		currentIndex = clonesNeeded;
	}

	// Update existing items without recreating DOM - smooth transitions
	function updateCarousel(skipTransition = false, skipActiveUpdate = false) {
		const items = document.querySelectorAll('.carousel-item');
		if (items.length === 0) return;

		const itemWidth = items[0].offsetWidth + parseInt(window.getComputedStyle(track).gap || '0');
		const visibleItems = getVisibleItems();

		// Calculate offset so the currentIndex item is centred appropriately
		let offset;
		if (visibleItems === 3) {
			offset = -(currentIndex - 1) * itemWidth;
		} else if (visibleItems === 1) {
			const carouselWidth = carouselElement.offsetWidth;
			const extraSpace = (carouselWidth - itemWidth) / 2;
			offset = -currentIndex * itemWidth + extraSpace;
		} else {
			offset = -currentIndex * itemWidth;
		}

		if (skipTransition) {
			track.style.transition = 'none';
			track.style.transform = `translateX(${offset}px)`;
			// Force reflow then restore transition timing
			track.offsetHeight;
			track.style.transition = 'transform 0.5s ease-in-out';
		} else {
			track.style.transition = 'transform 0.5s ease-in-out';
			track.style.transform = `translateX(${offset}px)`;
		}

		// Update active / prev / next classes if required (not during clone jump)
		if (!skipActiveUpdate) {
			const clonesNeeded = Math.max(visibleItems * 2, sortedJuices.length);
			const originalStart = clonesNeeded;
			const originalEnd = originalStart + sortedJuices.length - 1;
			const isClonePosition = currentIndex < originalStart || currentIndex > originalEnd;
			if (!isClonePosition) {
				items.forEach((item, index) => {
					item.classList.remove('active', 'prev', 'next', 'next2');
					if (index === currentIndex) {
						item.classList.add('active');
						activeJuice = sortedJuices[parseInt(item.dataset.originalIndex)];
					} else if (index === currentIndex - 1) {
						item.classList.add('prev');
					} else if (index === currentIndex + 1) {
						item.classList.add('next');
					} else if (index === currentIndex + 2) {
						item.classList.add('next2');
					}
				});
				if (activeJuice) {
					renderLeftPanel(activeJuice);
				}
			}
		}
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

	// Navigate to next item
	function nextSlide() {
		if (isTransitioning) return;
		isTransitioning = true;
		currentIndex++;
		updateCarousel();
		setTimeout(() => {
			const visibleItems = getVisibleItems();
			const clonesNeeded = Math.max(visibleItems * 2, sortedJuices.length);
			const originalStart = clonesNeeded;
			const originalEnd = originalStart + sortedJuices.length - 1;
			if (currentIndex > originalEnd) {
				const clonePos = currentIndex - originalEnd - 1;
				currentIndex = originalStart + clonePos;
				updateCarousel(true);
			}
			isTransitioning = false;
		}, 500);
	}

	// Navigate to previous item
	function prevSlide() {
		if (isTransitioning) return;
		isTransitioning = true;
		currentIndex--;
		updateCarousel();
		setTimeout(() => {
			const visibleItems = getVisibleItems();
			const clonesNeeded = Math.max(visibleItems * 2, sortedJuices.length);
			const originalStart = clonesNeeded;
			const originalEnd = originalStart + sortedJuices.length - 1;
			if (currentIndex < originalStart) {
				const clonePos = originalStart - currentIndex - 1;
				currentIndex = originalEnd - clonePos;
				updateCarousel(true);
			}
			isTransitioning = false;
		}, 500);
	}

	// Click helper to jump multiple items smoothly
	function moveToIndex(targetIndex) {
		if (isTransitioning) return;
		isTransitioning = true;
		currentIndex = targetIndex;
		updateCarousel();
		setTimeout(() => {
			const visibleItems = getVisibleItems();
			const clonesNeeded = Math.max(visibleItems * 2, sortedJuices.length);
			const originalStart = clonesNeeded;
			const originalEnd = originalStart + sortedJuices.length - 1;
			if (currentIndex > originalEnd) {
				const clonePos = currentIndex - originalEnd - 1;
				currentIndex = originalStart + clonePos;
				updateCarousel(true);
			} else if (currentIndex < originalStart) {
				const clonePos = originalStart - currentIndex - 1;
				currentIndex = originalEnd - clonePos;
				updateCarousel(true);
			}
			isTransitioning = false;
		}, 500);
	}

	// Replace handleItemClick logic
	function handleItemClick(e) {
		const clickedItem = e.target.closest('.carousel-item');
		if (!clickedItem) return;

		if (!clickedItem.classList.contains('active')) {
			e.preventDefault();
			const items = Array.from(document.querySelectorAll('.carousel-item'));
			const clickedIndex = items.indexOf(clickedItem);
			const diff = clickedIndex - currentIndex;
			if (diff === 1) {
				nextSlide();
			} else if (diff === -1) {
				prevSlide();
			} else if (diff !== 0) {
				moveToIndex(clickedIndex);
			}
		}
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
		createCarouselItems();
		updateCarousel(true);
	}, 250);

	// Event listeners
	prevButton.addEventListener('click', prevSlide);
	nextButton.addEventListener('click', nextSlide);
	track.addEventListener('click', handleItemClick);
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
