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

	function createJuiceHTML(juice, index) {
		return `
            <div class="carousel-item" data-index="${index}">
                <a href="/juices/${juice.slug}" class="textImgContainer ${juice.slug}" 
                   style="background-color: ${juice.color}10">
                    <img src="${juice.imageUrl}" alt="${juice.name}" class="juice-bottle" loading="lazy" decoding="async">
                    <h3 style="font-family: var(--second-font);">${juice.name}</h3>
                    <div class="ingredients-preview">
                            ${juice.ingredients
								.map(
									ingredient => `
                                <span class="ingredient-tag">
                                    <img src="/assets/img/ingredients/${ingredient.toLowerCase().replace(/ /g, '-')}.svg" 
                                        alt="${ingredient}" 
                                        class="ingredient-icon" loading="lazy" decoding="async">
                                    <span class="ingredient-name">${ingredient}</span>
                                </span>
                            `
								)
								.join('')}
                        </div>
                    <p class="juice-price">$${juice.price.toFixed(2)}</p>
                </a>
                <button class="add-to-cart" data-id="${juice.id}" style="background-color: ${juice.color}">
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            </div>
        `;
	}

	// Create 9 sets for extra smoothness
	const extendedJuices = [
		...juices,
		...juices,
		...juices,
		...juices, // 4 sets before
		...juices, // main set
		...juices,
		...juices,
		...juices,
		...juices // 4 sets after
	];

	extendedJuices.forEach((juice, index) => {
		track.insertAdjacentHTML('beforeend', createJuiceHTML(juice, index % juices.length));
	});

	// Create elements
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
		if (width >= 1024) return 3;
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

		// Calculate offset
		let offset;
		if (visibleItems === 3) {
			offset = -(currentIndex - 1) * itemWidth;
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

		// Update active states
		items.forEach((item, index) => {
			const juiceIndex = parseInt(item.dataset.index);
			const isActive = index === currentIndex;

			if (isActive) {
				item.classList.add('active');
				item.querySelector('.textImgContainer').style.backgroundColor = juices[juiceIndex].color;
				item.querySelector('a').style.pointerEvents = 'auto';
			} else {
				item.classList.remove('active');
				item.querySelector('.textImgContainer').style.backgroundColor = `${juices[juiceIndex].color}65`;
				item.querySelector('a').style.pointerEvents = 'none';
			}
		});
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

	function handleDragMove(e) {
		if (!isDragging) return;
		e.preventDefault();

		currentX = e.type === 'mousemove' ? e.pageX : e.touches[0].pageX;
		const diff = currentX - startX;

		// Apply drag movement
		track.style.transition = 'none';
		track.style.transform = `translateX(${startTransform + diff}px)`;
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

	// Touch event listeners
	track.addEventListener('touchstart', handleDragStart);
	track.addEventListener('touchmove', handleDragMove, { passive: false });
	track.addEventListener('touchend', handleDragEnd);

	// Mouse event listeners for drag
	track.addEventListener('mousedown', handleDragStart);
	document.addEventListener('mousemove', handleDragMove);
	document.addEventListener('mouseup', handleDragEnd);

	// Prevent context menu on long press
	track.addEventListener('contextmenu', e => e.preventDefault());

	// Clean up function for mouse events when track is not being interacted with
	document.addEventListener('mouseleave', () => {
		if (isDragging) {
			isDragging = false;
			track.classList.remove('dragging');
			updateCarousel();
		}
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
});

// Add to main.js
document.addEventListener('DOMContentLoaded', () => {
	console.log('Main.js - DOM Content Loaded');
	console.log('Cart available:', window.cart);
	console.log('Add to cart buttons:', document.querySelectorAll('.add-to-cart').length);
});
