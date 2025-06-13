/*=============== SHOW MENU ===============*/
const navMenu = document.getElementById('nav-menu'),
	navToggle = document.getElementById('nav-toggle'),
	navClose = document.getElementById('nav-close');

/*===== MENU SHOW =====*/
/* Validate if constant exists */
if (navToggle) {
	navToggle.addEventListener('click', () => {
		navMenu.classList.add('show-menu');
	});
}

/*===== MENU HIDDEN =====*/
/* Validate if constant exists */
if (navClose) {
	navClose.addEventListener('click', () => {
		navMenu.classList.remove('show-menu');
	});
}

/*=============== REMOVE MENU MOBILE ===============*/
const navLink = document.querySelectorAll('.nav__link');

function linkAction() {
	const navMenu = document.getElementById('nav-menu');
	// When we click on each nav__link, we remove the show-menu class
	navMenu.classList.remove('show-menu');
}
navLink.forEach(n => n.addEventListener('click', linkAction));

document.addEventListener('DOMContentLoaded', function () {
	console.log('Juice.js loaded');

	// Get the juice slug from the URL path
	const slug = window.location.pathname.split('/').pop();
	console.log('Current slug:', slug);

	if (typeof juices === 'undefined' || !juices) {
		console.error('Juices array is not defined. Ensure juices-database.js is loaded.');
		return;
	}
	console.log('Available juices:', juices);

	const juice = juices.find(j => j.slug === slug);
	console.log('Found juice:', juice);

	if (!juice) {
		window.location.href = '/';
		console.warn('Juice not found for slug:', slug);
		return;
	}

	// Populate main product details
	const juicePage = document.getElementById('juicePage');
	juicePage.innerHTML = `
        <div class="product__info">
            <h1 class="home__title" style="max-width: 550px;">
                ${juice.name} <span style="color: ${juice.color};">Details</span>
            </h1>
            <div class="ingredients-list">
            <h3 style="color:${juice.color}; margin-bottom: 1rem; font-size: 2.5rem;">Ingredients:</h3>
                <ul style="font-family: var(--second-font);">
                    ${juice.ingredients
						.map(
							ingredient => `
                        <li>
                            <img src="/assets/img/ingredients/${ingredient.toLowerCase().replace(/ /g, '-')}.svg" 
                                alt="${ingredient}" 
                                style="width: 50px; height: 50px; vertical-align: middle;" loading="lazy" decoding="async">
                            ${ingredient}
                        </li>
                    `
						)
						.join('')}
                </ul>
            </div>
            <p class="product__price">$${juice.price.toFixed(2)}</p>
            <button class="home__button add-to-cart" data-id="${juice.id}"  style="transform: translate(0px, 0px); opacity: 1; background-color: ${juice.color}">
                <span style="margin-right: 5px; font-size: 1rem;">Add to Cart</span> <svg viewBox="0 0 24 24" width="24" height="24" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
            </button>
        </div>

        <div class="home__images">
            <img src="/assets/img/splash/${juice.slug}-splash.svg" alt="Liquid image" class="home__liquid">
            <div class="home__juice-animate" style="z-index: 3; position: relative;">
                <img src="${juice.imageUrl}" alt="${juice.name}" class="home__juice" loading="lazy" decoding="async">
            </div>
            ${juice.ingredients
				.slice(0, 2)
				.map(
					(ingredient, index) => `
                <img src="/assets/img/ingredients/${ingredient.toLowerCase().replace(/ /g, '-')}.svg" 
                    alt="${ingredient}" 
                    class="home__apple${index + 1}" style="z-index: 0;" loading="lazy" decoding="async">
            `
				)
				.join('')}
            <div>
                <img src="/assets/img/leaf.png" alt="Leaf image" class="home__leaf">
                <img src="/assets/img/leaf.png" alt="Leaf image" class="home__leaf">
                <img src="/assets/img/leaf.png" alt="Leaf image" class="home__leaf">
                <img src="/assets/img/leaf.png" alt="Leaf image" class="home__leaf">
            </div>
        </div>
    `;

	// Populate nutrition section
	const nutritionSection = document.querySelector('.nutrition-content');
	nutritionSection.innerHTML = `
            <div class="magnifier-container">
                <img src="/assets/img/nutrition-facts/${juice.slug}-facts.png" 
                    alt="${juice.name} Nutrition Facts" 
                    class="nutrition-image"
                    loading="lazy">
                <div class="magnifier"></div>
            </div>
    `;

	// Add animation for the nutrition image
	TweenMax.from('.nutrition-image', 1, {
		delay: 1.8,
		opacity: 0,
		y: 20,
		ease: Expo.easeInOut
	});

	// Magnifier functionality for desktop only
	if (window.innerWidth > 768) {
		const magnifier = document.querySelector('.magnifier');
		const image = document.querySelector('.nutrition-image');
		const magnifierContainer = document.querySelector('.magnifier-container');

		// Wait for image to load to get correct dimensions
		image.onload = function () {
			const imageWidth = image.offsetWidth;
			const imageHeight = image.offsetHeight;
			const zoom = 2; // Zoom level

			// Set the background size based on actual image dimensions
			magnifier.style.backgroundSize = `${imageWidth * zoom}px ${imageHeight * zoom}px`;

			magnifierContainer.addEventListener('mousemove', function (e) {
				const rect = this.getBoundingClientRect();
				const x = e.clientX - rect.left;
				const y = e.clientY - rect.top;

				// Keep magnifier inside the image boundaries
				const magnifierRadius = 60; // Half of magnifier size
				const boundedX = Math.min(Math.max(magnifierRadius, x), rect.width - magnifierRadius);
				const boundedY = Math.min(Math.max(magnifierRadius, y), rect.height - magnifierRadius);

				// Position the magnifier
				magnifier.style.left = `${boundedX}px`;
				magnifier.style.top = `${boundedY}px`;

				// Calculate background position for the zoomed image
				const bgX = (x / rect.width) * 100;
				const bgY = (y / rect.height) * 100;

				magnifier.style.backgroundImage = `url('/assets/img/nutrition-facts/${juice.slug}-facts.png')`;
				magnifier.style.backgroundPosition = `${bgX}% ${bgY}%`;
			});

			magnifierContainer.addEventListener('mouseenter', function () {
				magnifier.style.opacity = '1';
			});

			magnifierContainer.addEventListener('mouseleave', function () {
				magnifier.style.opacity = '0';
			});
		};
	}

	// Initialize carousel with filtered juices
	initializeCarousel(slug);

	// Initialize GSAP animations
	TweenMax.from('.ingredients-list', 1, { delay: 0.3, opacity: 0, y: 20, ease: Expo.easeInOut });
	TweenMax.from('.product__price', 1, { delay: 0.4, opacity: 0, y: 20, ease: Expo.easeInOut });
	TweenMax.from('.home__button', 1, { delay: 0.5, opacity: 0, y: 20, ease: Expo.easeInOut });
	TweenMax.from('.home__liquid', 1, { delay: 0.7, opacity: 0, y: 200, ease: Expo.easeInOut });
	TweenMax.from('.home__juice-animate', 1, { delay: 1.2, opacity: 0, y: -800, ease: Expo.easeInOut });
	TweenMax.from('.home__apple1', 1, { delay: 1.5, opacity: 0, y: -800, ease: Expo.easeInOut });
	TweenMax.from('.home__apple2', 1, { delay: 1.6, opacity: 0, y: -800, ease: Expo.easeInOut });
});

// Carousel initialization function using the same logic as home page
function initializeCarousel(currentSlug) {
	const track = document.querySelector('#relatedJuices');
	if (!track) return;

	// Only run on juice detail pages
	if (!window.location.pathname.includes('/juices/')) return;

	const carouselElement = document.querySelector('#relatedCarousel');
	const prevButton = document.querySelector('.carousel-button.prev');
	const nextButton = document.querySelector('.carousel-button.next');

	// Create left panel for the related carousel
	const leftPanel = document.createElement('div');
	leftPanel.className = 'carousel-left-panel';
	carouselElement.prepend(leftPanel);

	// Filter out current juice
	const filteredJuices = juices.filter(j => j.slug !== currentSlug);

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
		const clonesNeeded = Math.max(visibleItems * 2, filteredJuices.length);

		// Add clones of LAST items at the beginning
		for (let i = 0; i < clonesNeeded; i++) {
			const juiceIndex = (filteredJuices.length - clonesNeeded + i + filteredJuices.length) % filteredJuices.length;
			const juice = filteredJuices[juiceIndex];
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
		filteredJuices.forEach((juice, index) => {
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
			const juiceIndex = i % filteredJuices.length;
			const juice = filteredJuices[juiceIndex];
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
			const clonesNeeded = Math.max(visibleItems * 2, filteredJuices.length);
			const originalStart = clonesNeeded;
			const originalEnd = originalStart + filteredJuices.length - 1;

			// Don't update active classes if we're at a clone position
			const isClonePosition = currentIndex < originalStart || currentIndex > originalEnd;

			if (!isClonePosition) {
				// Update item classes and active juice only for originals
				items.forEach((item, index) => {
					item.classList.remove('active', 'prev', 'next', 'next2');

					if (index === currentIndex) {
						item.classList.add('active');
						const originalIndex = parseInt(item.dataset.originalIndex);
						activeJuice = filteredJuices[originalIndex];
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
			const clonesNeeded = Math.max(visibleItems * 2, filteredJuices.length);
			const originalStart = clonesNeeded;
			const originalEnd = originalStart + filteredJuices.length - 1;

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
						activeJuice = filteredJuices[originalIndex];
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
			const clonesNeeded = Math.max(visibleItems * 2, filteredJuices.length);
			const originalStart = clonesNeeded;
			const originalEnd = originalStart + filteredJuices.length - 1;

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
						activeJuice = filteredJuices[originalIndex];
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
			const clonesNeeded = Math.max(visibleItems * 2, filteredJuices.length);
			const originalStart = clonesNeeded;
			const originalEnd = originalStart + filteredJuices.length - 1;

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
						activeJuice = filteredJuices[originalIndex];
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
						activeJuice = filteredJuices[originalIndex];
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
}
