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
TweenMax.from('.home__button', 1, { delay: 0.4, opacity: 0, y: 20, ease: Expo.easeInOut });
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
	track.innerHTML = '';

	let startX = 0;
	let currentX = 0;
	let isDragging = false;
	let startTransform = 0;
	let swipeThreshold = 50;
	let isTransitioning = false;
	let activeJuice = null;

	// Create left panel
	const carouselElement = document.querySelector('.carousel');
	const leftPanel = document.createElement('div');
	leftPanel.className = 'carousel-left-panel';
	carouselElement.prepend(leftPanel);

	// Build extended array for seamless looping
	const extendedJuices = [...juices, ...juices, ...juices, ...juices, ...juices, ...juices, ...juices, ...juices, ...juices];

	function renderLeftPanel(juice) {
		leftPanel.innerHTML = `
			<h3 class="slide-title" style="font-family: var(--second-font); color:#fff; margin-bottom:1.5rem;">${juice.name}</h3>
			<div class="ingredients-preview">
				${juice.ingredients.map(ing => `<span class="ingredient-tag" style="background:rgba(255,255,255,0.3);color:#fff;"><img src="/assets/img/ingredients/${ing.toLowerCase().replace(/ /g, '-')}.svg" alt="${ing}" class="ingredient-icon"> <span class="ingredient-name">${ing}</span></span>`).join('')}
			</div>
			<div class="button-row">
				<a href="/juices/${juice.slug}" class="home__button left-btn" style="background-color:#fff;color:${juice.color};">View Product</a>
				<button class="home__button left-btn add-to-cart left-add-cart" data-id="${juice.id}" style="background-color:#fff;color:${juice.color};">Add to Cart</button>
			</div>
		`;
		leftPanel.style.backgroundColor = juice.color;

		if (window.innerWidth <= 767) {
			carouselElement.style.backgroundColor = juice.color;
		} else {
			carouselElement.style.backgroundColor = '';
		}

		// bind add-to-cart button
		const btn = leftPanel.querySelector('.left-add-cart');
		if (btn) {
			btn.addEventListener('click', e => {
				e.preventDefault();
				window.cart.addItem(juice.id);
			});
		}
	}

	// Clear track and recreate items with only bottle image
	track.innerHTML = '';
	extendedJuices.forEach((juice, index) => {
		track.insertAdjacentHTML(
			'beforeend',
			`<div class="carousel-item" data-index="${index % juices.length}">
				<a href="/juices/${juice.slug}" class="carousel-item-link" tabindex="-1">
					<img src="${juice.imageUrl}" alt="${juice.name}" class="juice-bottle" loading="lazy" decoding="async">
				</a>
			</div>`
		);
	});

	// Re-query items after rebuild
	const items = document.querySelectorAll('.carousel-item');
	const itemCount = juices.length;
	const totalSets = 9;
	const middleSetIndex = Math.floor(totalSets / 2) * itemCount;
	let currentIndex = middleSetIndex;

	function normalizeIndex(index) {
		// Ensure we're getting a number within our total items range
		const totalItems = items.length;
		let normalizedIndex = index;

		// If we go beyond the end, wrap to beginning
		if (normalizedIndex >= totalItems - Math.floor(itemCount / 2)) {
			normalizedIndex = middleSetIndex;
		}
		// If we go beyond the start, wrap to end
		else if (normalizedIndex < Math.floor(itemCount / 2)) {
			normalizedIndex = middleSetIndex;
		}

		return normalizedIndex;
	}

	const prevButton = document.querySelector('.carousel-button.prev');
	const nextButton = document.querySelector('.carousel-button.next');

	// Update swipe threshold based on screen size
	function updateSwipeThreshold() {
		const width = window.innerWidth;
		if (width >= 1024) {
			swipeThreshold = 50;
		} else if (width >= 768) {
			swipeThreshold = 40;
		} else {
			swipeThreshold = 30;
		}
	}

	function getVisibleItems() {
		const width = window.innerWidth;
		if (width <= 767) return 3;
		if (width >= 1800) return 5;
		if (width >= 1024) return 2;
		if (width >= 768) return 2;
		return 1;
	}

	function updateCarousel(skipTransition = false) {
		if (skipTransition) {
			track.style.transition = 'none';
		} else {
			track.style.transition = 'transform 0.5s ease-in-out';
		}

		const itemWidth = items[0].offsetWidth + parseInt(window.getComputedStyle(track).gap);
		const visibleItems = getVisibleItems();

		// Update the currentIndex to wrap around if needed
		if (currentIndex >= items.length) {
			currentIndex = (currentIndex % itemCount) + middleSetIndex;
			skipTransition = true;
		} else if (currentIndex < 0) {
			currentIndex = middleSetIndex + itemCount - 1;
			skipTransition = true;
		}

		let offset;
		if (visibleItems === 3) {
			// If three items visible, center the active one
			offset = -(currentIndex - 1) * itemWidth;
		} else if (visibleItems === 1) {
			// When only one item is visible, center it within the carousel
			const carouselWidth = carouselElement.offsetWidth;
			const extraSpace = (carouselWidth - itemWidth) / 2;
			offset = -currentIndex * itemWidth + extraSpace;
		} else {
			offset = -currentIndex * itemWidth;
		}

		if (skipTransition) {
			track.style.transition = 'none';
			requestAnimationFrame(() => {
				track.style.transform = `translateX(${offset}px)`;
				requestAnimationFrame(() => {
					track.style.transition = 'transform 0.5s ease-in-out';
				});
			});
		} else {
			track.style.transform = `translateX(${offset}px)`;
		}

		// Reset classes
		items.forEach(i => i.classList.remove('prev', 'next', 'next2'));
		const prevIdx = normalizeIndex(currentIndex - 1);
		const nextIdx = normalizeIndex(currentIndex + 1);
		const next2Idx = normalizeIndex(currentIndex + 2);

		items.forEach((item, index) => {
			const isActive = index === currentIndex;

			if (isActive) {
				item.classList.add('active');
				activeJuice = juices[parseInt(item.dataset.index)];
			} else {
				item.classList.remove('active');
			}

			if (index === prevIdx) item.classList.add('prev');
			if (index === nextIdx) item.classList.add('next');
			if (index === next2Idx) item.classList.add('next2');
		});

		if (activeJuice) renderLeftPanel(activeJuice);

		// Recenter index when far from middle to achieve infinite loop
		const distance = Math.abs(currentIndex - middleSetIndex);
		if (distance > itemCount * 2) {
			currentIndex = middleSetIndex + ((currentIndex - middleSetIndex) % itemCount);
			updateCarousel(true);
			return; // skip rest in this iteration
		}
	}

	// Debounce function for resize handler
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
		updateCarousel(true);
	}, 250);

	window.addEventListener('resize', handleResize);

	// Update touch/swipe threshold based on screen size
	function updateSwipeThreshold() {
		const width = window.innerWidth;
		if (width >= 1024) {
			swipeThreshold = 50;
		} else if (width >= 768) {
			swipeThreshold = 40;
		} else {
			swipeThreshold = 30;
		}
	}

	// Call once on init
	updateSwipeThreshold();
	window.addEventListener('resize', updateSwipeThreshold);

	// Adjust drag behavior for different screen sizes
	function handleDragMove(e) {
		if (!isDragging) return;
		e.preventDefault();

		currentX = e.type === 'mousemove' ? e.pageX : e.touches[0].pageX;
		const diff = currentX - startX;

		// Add resistance at screen edges
		const resistance = 0.5;
		const visibleItems = getVisibleItems();
		const maxDrag = items[0].offsetWidth * visibleItems * resistance;

		const constrainedDiff = Math.max(Math.min(diff, maxDrag), -maxDrag);

		track.style.transition = 'none';
		track.style.transform = `translateX(${startTransform + constrainedDiff}px)`;
	}

	function nextSlide() {
		if (isTransitioning) return;
		isTransitioning = true;
		currentIndex++;
		updateCarousel();
		setTimeout(() => {
			isTransitioning = false;
		}, 500);
	}

	function prevSlide() {
		if (isTransitioning) return;
		isTransitioning = true;
		currentIndex--;
		updateCarousel();
		setTimeout(() => {
			isTransitioning = false;
		}, 500);
	}

	// Event Listeners
	prevButton.addEventListener('click', prevSlide);
	nextButton.addEventListener('click', nextSlide);

	// Initial setup
	updateCarousel(true);

	// Handle window resize
	window.addEventListener('resize', () => {
		updateCarousel(true);
	});

	function handleItemClick(e) {
		const clickedItem = e.target.closest('.carousel-item');
		if (!clickedItem) return;

		// If clicking an inactive item, prevent navigation and rotate carousel
		if (!clickedItem.classList.contains('active')) {
			e.preventDefault();
			const clickedIndex = Array.from(items).indexOf(clickedItem);
			const difference = clickedIndex - currentIndex;

			if (difference !== 0) {
				if (Math.abs(difference) === 1) {
					difference > 0 ? nextSlide() : prevSlide();
				} else {
					const itemsBefore = clickedIndex;
					const itemsAfter = items.length - clickedIndex;
					const shortestPath = Math.abs(difference) <= Math.min(itemsBefore, itemsAfter) ? difference : difference > 0 ? -itemsAfter : itemsBefore;
					moveMultipleSlides(shortestPath);
				}
			}
		}
	}

	function moveMultipleSlides(slideCount) {
		if (isTransitioning) return;
		isTransitioning = true;
		currentIndex += slideCount;
		updateCarousel();
		setTimeout(() => {
			isTransitioning = false;
		}, 500);
	}

	function handleDragStart(e) {
		if (isTransitioning) return;
		isDragging = true;
		startX = e.type === 'mousedown' ? e.pageX : e.touches[0].pageX;
		startTransform = getCurrentTransform();

		// Add dragging class for visual feedback
		track.classList.add('dragging');
	}

	function handleDragEnd(e) {
		if (!isDragging) return;
		isDragging = false;
		track.classList.remove('dragging');

		const endX = e.type === 'mouseup' ? e.pageX : e.changedTouches[0].pageX;
		const diff = endX - startX;

		if (Math.abs(diff) >= swipeThreshold) {
			if (diff > 0) {
				prevSlide();
			} else {
				nextSlide();
			}
		} else {
			updateCarousel();
		}
	}

	function getCurrentTransform() {
		const style = window.getComputedStyle(track);
		const matrix = new WebKitCSSMatrix(style.transform);
		return matrix.m41; // Get the X transform value
	}

	// Click event listener for items
	track.addEventListener('click', handleItemClick);

	// Drag interactions disabled for stability

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
