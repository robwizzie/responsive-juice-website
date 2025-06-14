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

	// Get number of visible items based on screen size
	function getVisibleItems() {
		const width = window.innerWidth;
		if (width <= 767) return 3;
		if (width >= 1800) return 5;
		if (width >= 1024) return 2;
		if (width >= 768) return 2;
		return 1;
	}

	// Create carousel items with enough clones to prevent empty slots
	function createCarouselItems() {
		track.innerHTML = '';

		const visibleItems = getVisibleItems();
		// Create enough clones to handle any click-to-jump scenario
		const clonesNeeded = Math.max(visibleItems * 2, juices.length);

		// Add clones of LAST items at the beginning
		for (let i = 0; i < clonesNeeded; i++) {
			const juiceIndex = (juices.length - clonesNeeded + i + juices.length) % juices.length;
			const juice = juices[juiceIndex];
			track.insertAdjacentHTML(
				'beforeend',
				`<div class="carousel-item clone-start" data-original-index="${juiceIndex}">
					<a href="/juices/${juice.slug}" class="carousel-item-link" tabindex="-1">
						<img src="${juice.imageUrl}" alt="${juice.name}" class="juice-bottle" loading="lazy" decoding="async">
					</a>
				</div>`
			);
		}

		// Add original items
		juices.forEach((juice, index) => {
			track.insertAdjacentHTML(
				'beforeend',
				`<div class="carousel-item original" data-original-index="${index}">
					<a href="/juices/${juice.slug}" class="carousel-item-link" tabindex="-1">
						<img src="${juice.imageUrl}" alt="${juice.name}" class="juice-bottle" loading="lazy" decoding="async">
					</a>
				</div>`
			);
		});

		// Add clones of FIRST items at the end
		for (let i = 0; i < clonesNeeded; i++) {
			const juiceIndex = i % juices.length;
			const juice = juices[juiceIndex];
			track.insertAdjacentHTML(
				'beforeend',
				`<div class="carousel-item clone-end" data-original-index="${juiceIndex}">
					<a href="/juices/${juice.slug}" class="carousel-item-link" tabindex="-1">
						<img src="${juice.imageUrl}" alt="${juice.name}" class="juice-bottle" loading="lazy" decoding="async">
					</a>
				</div>`
			);
		}

		// Set initial position to first original item
		currentIndex = clonesNeeded;
	}

	// Render left panel content
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

		// Update "Find Your Juice" title color
		const juiceWord = document.getElementById('dynamic-juice-word');
		if (juiceWord) {
			juiceWord.style.color = juice.color;
		}

		// Bind add-to-cart button
		const btn = leftPanel.querySelector('.left-add-cart');
		if (btn) {
			btn.addEventListener('click', e => {
				e.preventDefault();
				window.cart.addItem(juice.id);
			});
		}
	}

	// Update carousel position and styling
	function updateCarousel(skipTransition = false, skipActiveUpdate = false) {
		const items = document.querySelectorAll('.carousel-item');
		const itemWidth = items[0].offsetWidth + parseInt(window.getComputedStyle(track).gap || '0');
		const visibleItems = getVisibleItems();

		// Calculate offset
		let offset;
		if (visibleItems === 3) {
			// Center the middle item when 3 are visible
			offset = -(currentIndex - 1) * itemWidth;
		} else if (visibleItems === 1) {
			// Center single item
			const carouselWidth = carouselElement.offsetWidth;
			const extraSpace = (carouselWidth - itemWidth) / 2;
			offset = -currentIndex * itemWidth + extraSpace;
		} else {
			offset = -currentIndex * itemWidth;
		}

		// Apply transform
		if (skipTransition) {
			track.style.transition = 'none';
			track.style.transform = `translateX(${offset}px)`;
			// Force reflow then restore transition
			track.offsetHeight;
			track.style.transition = 'transform 0.5s ease-in-out';
		} else {
			track.style.transition = 'transform 0.5s ease-in-out';
			track.style.transform = `translateX(${offset}px)`;
		}

		// Only update active classes if not skipping (prevents clone flicker)
		if (!skipActiveUpdate) {
			const clonesNeeded = Math.max(visibleItems * 2, juices.length);
			const originalStart = clonesNeeded;
			const originalEnd = originalStart + juices.length - 1;

			// Don't update active classes if we're at a clone position
			const isClonePosition = currentIndex < originalStart || currentIndex > originalEnd;

			if (!isClonePosition) {
				// Update item classes and active juice only for originals
				items.forEach((item, index) => {
					item.classList.remove('active', 'prev', 'next', 'next2');

					if (index === currentIndex) {
						item.classList.add('active');
						const originalIndex = parseInt(item.dataset.originalIndex);
						activeJuice = juices[originalIndex];
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

	// Navigation functions - true infinite feel using clones
	function nextSlide() {
		if (isTransitioning) return;
		isTransitioning = true;
		currentIndex++;

		// Animate to the new position (might be a clone)
		updateCarousel();

		// After animation, check if we need to invisibly jump
		setTimeout(() => {
			const visibleItems = getVisibleItems();
			const clonesNeeded = Math.max(visibleItems * 2, juices.length);
			const originalStart = clonesNeeded;
			const originalEnd = originalStart + juices.length - 1;

			// If we animated to an end clone, jump to the corresponding original
			if (currentIndex > originalEnd) {
				const clonePosition = currentIndex - originalEnd - 1;
				currentIndex = originalStart + clonePosition;
				// Jump instantly without transition and update active classes
				track.style.transition = 'none';
				const items = document.querySelectorAll('.carousel-item');
				const itemWidth = items[0].offsetWidth + parseInt(window.getComputedStyle(track).gap || '0');
				const visibleItems = getVisibleItems();

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

				track.style.transform = `translateX(${offset}px)`;

				// Update active classes to match new position
				items.forEach((item, index) => {
					item.classList.remove('active', 'prev', 'next', 'next2');

					if (index === currentIndex) {
						item.classList.add('active');
						const originalIndex = parseInt(item.dataset.originalIndex);
						activeJuice = juices[originalIndex];
					} else if (index === currentIndex - 1) {
						item.classList.add('prev');
					} else if (index === currentIndex + 1) {
						item.classList.add('next');
					} else if (index === currentIndex + 2) {
						item.classList.add('next2');
					}
				});

				// Update left panel with same juice (invisible to user)
				if (activeJuice) {
					renderLeftPanel(activeJuice);
				}

				track.offsetHeight; // Force reflow
				track.style.transition = 'transform 0.5s ease-in-out';
			}

			isTransitioning = false;
		}, 500);
	}

	function prevSlide() {
		if (isTransitioning) return;
		isTransitioning = true;
		currentIndex--;

		// Animate to the new position (might be a clone)
		updateCarousel();

		// After animation, check if we need to invisibly jump
		setTimeout(() => {
			const visibleItems = getVisibleItems();
			const clonesNeeded = Math.max(visibleItems * 2, juices.length);
			const originalStart = clonesNeeded;
			const originalEnd = originalStart + juices.length - 1;

			// If we animated to a start clone, jump to the corresponding original
			if (currentIndex < originalStart) {
				const clonePosition = originalStart - currentIndex - 1;
				currentIndex = originalEnd - clonePosition;
				// Jump instantly without transition and update active classes
				track.style.transition = 'none';
				const items = document.querySelectorAll('.carousel-item');
				const itemWidth = items[0].offsetWidth + parseInt(window.getComputedStyle(track).gap || '0');
				const visibleItems = getVisibleItems();

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

				track.style.transform = `translateX(${offset}px)`;

				// Update active classes to match new position
				items.forEach((item, index) => {
					item.classList.remove('active', 'prev', 'next', 'next2');

					if (index === currentIndex) {
						item.classList.add('active');
						const originalIndex = parseInt(item.dataset.originalIndex);
						activeJuice = juices[originalIndex];
					} else if (index === currentIndex - 1) {
						item.classList.add('prev');
					} else if (index === currentIndex + 1) {
						item.classList.add('next');
					} else if (index === currentIndex + 2) {
						item.classList.add('next2');
					}
				});

				// Update left panel with same juice (invisible to user)
				if (activeJuice) {
					renderLeftPanel(activeJuice);
				}

				track.offsetHeight; // Force reflow
				track.style.transition = 'transform 0.5s ease-in-out';
			}

			isTransitioning = false;
		}, 500);
	}

	// Handle item clicks
	function handleItemClick(e) {
		const clickedItem = e.target.closest('.carousel-item');
		if (!clickedItem) return;

		// If clicking inactive item, navigate to it instead of following link
		if (!clickedItem.classList.contains('active')) {
			e.preventDefault();
			const items = Array.from(document.querySelectorAll('.carousel-item'));
			const clickedIndex = items.indexOf(clickedItem);
			const difference = clickedIndex - currentIndex;

			// Handle any distance, but prefer shortest path for efficiency
			if (difference !== 0) {
				if (Math.abs(difference) === 1) {
					// Adjacent item - single step
					difference > 0 ? nextSlide() : prevSlide();
				} else {
					// Multiple steps - animate to target
					moveToIndex(clickedIndex);
				}
			}
		}
	}

	// Move directly to a specific index
	function moveToIndex(targetIndex) {
		if (isTransitioning) return;
		isTransitioning = true;
		currentIndex = targetIndex;

		// Animate to the target position
		updateCarousel();

		// After animation, check if we need to invisibly jump (same logic as navigation)
		setTimeout(() => {
			const visibleItems = getVisibleItems();
			const clonesNeeded = Math.max(visibleItems * 2, juices.length);
			const originalStart = clonesNeeded;
			const originalEnd = originalStart + juices.length - 1;

			// If we moved to a clone, jump to the corresponding original
			if (currentIndex > originalEnd) {
				const clonePosition = currentIndex - originalEnd - 1;
				currentIndex = originalStart + clonePosition;
				// Jump instantly without transition and update active classes
				track.style.transition = 'none';
				const items = document.querySelectorAll('.carousel-item');
				const itemWidth = items[0].offsetWidth + parseInt(window.getComputedStyle(track).gap || '0');
				const visibleItems = getVisibleItems();

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

				track.style.transform = `translateX(${offset}px)`;

				// Update active classes to match new position
				items.forEach((item, index) => {
					item.classList.remove('active', 'prev', 'next', 'next2');

					if (index === currentIndex) {
						item.classList.add('active');
						const originalIndex = parseInt(item.dataset.originalIndex);
						activeJuice = juices[originalIndex];
					} else if (index === currentIndex - 1) {
						item.classList.add('prev');
					} else if (index === currentIndex + 1) {
						item.classList.add('next');
					} else if (index === currentIndex + 2) {
						item.classList.add('next2');
					}
				});

				// Update left panel with same juice
				if (activeJuice) {
					renderLeftPanel(activeJuice);
				}

				track.offsetHeight; // Force reflow
				track.style.transition = 'transform 0.5s ease-in-out';
			} else if (currentIndex < originalStart) {
				const clonePosition = originalStart - currentIndex - 1;
				currentIndex = originalEnd - clonePosition;
				// Jump instantly without transition and update active classes
				track.style.transition = 'none';
				const items = document.querySelectorAll('.carousel-item');
				const itemWidth = items[0].offsetWidth + parseInt(window.getComputedStyle(track).gap || '0');
				const visibleItems = getVisibleItems();

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

				track.style.transform = `translateX(${offset}px)`;

				// Update active classes to match new position
				items.forEach((item, index) => {
					item.classList.remove('active', 'prev', 'next', 'next2');

					if (index === currentIndex) {
						item.classList.add('active');
						const originalIndex = parseInt(item.dataset.originalIndex);
						activeJuice = juices[originalIndex];
					} else if (index === currentIndex - 1) {
						item.classList.add('prev');
					} else if (index === currentIndex + 1) {
						item.classList.add('next');
					} else if (index === currentIndex + 2) {
						item.classList.add('next2');
					}
				});

				// Update left panel with same juice
				if (activeJuice) {
					renderLeftPanel(activeJuice);
				}

				track.offsetHeight; // Force reflow
				track.style.transition = 'transform 0.5s ease-in-out';
			}

			isTransitioning = false;
		}, 500);
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
