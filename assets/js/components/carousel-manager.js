/**
 * Unified Carousel Manager
 * Handles both main homepage carousel and juice detail page carousel
 * Provides smooth infinite scrolling with consistent animations
 */

class CarouselManager {
	constructor(options) {
		// Required elements
		this.track = document.querySelector(options.trackSelector);
		this.carouselElement = document.querySelector(options.carouselSelector);
		this.prevButton = document.querySelector(options.prevButtonSelector);
		this.nextButton = document.querySelector(options.nextButtonSelector);

		// Configuration
		this.juices = options.juices || [];
		this.currentSlug = options.currentSlug || null;
		this.isHomePage = options.isHomePage || false;
		this.dynamicWordSelector = options.dynamicWordSelector || null;

		// State
		this.currentIndex = 0;
		this.isTransitioning = false;
		this.activeJuice = null;
		this.lastVisibleItems = this.getVisibleItems();

		// Create left panel
		this.leftPanel = this.createLeftPanel();

		// Create mobile button row
		this.mobileButtonRow = this.createMobileButtonRow();

		// Initialize
		this.init();
	}

	init() {
		if (!this.track || !this.carouselElement) return;

		// Filter and sort juices
		this.prepareJuices();

		// Create initial items
		this.createCarouselItems();

		// Set initial position and state
		this.updateCarousel(true);

		// Bind events
		this.bindEvents();
	}

	prepareJuices() {
		// Filter out current juice if on detail page
		let filteredJuices = this.currentSlug ? this.juices.filter(j => j.slug !== this.currentSlug) : [...this.juices];

		// Sort: in-stock items first
		this.sortedJuices = filteredJuices.sort((a, b) => {
			if (a.inStock && !b.inStock) return -1;
			if (!a.inStock && b.inStock) return 1;
			return 0;
		});
	}

	createLeftPanel() {
		const leftPanel = document.createElement('div');
		leftPanel.className = 'carousel-left-panel';
		this.carouselElement.prepend(leftPanel);
		return leftPanel;
	}

	createMobileButtonRow() {
		const mobileButtonRow = document.createElement('div');
		mobileButtonRow.className = 'carousel-mobile-buttons';
		this.carouselElement.appendChild(mobileButtonRow);
		return mobileButtonRow;
	}

	getVisibleItems() {
		const width = window.innerWidth;
		if (width <= 767) return 3;
		if (width >= 1800) return 5;
		if (width >= 1024) return 2;
		if (width >= 768) return 2;
		return 1;
	}

	createCarouselItems() {
		this.track.innerHTML = '';

		if (this.sortedJuices.length === 0) {
			this.track.innerHTML = '<div class="no-juices">No juices available</div>';
			return;
		}

		const visibleItems = this.getVisibleItems();
		const clonesNeeded = Math.max(visibleItems * 2, this.sortedJuices.length);

		// Create clones at start (last items)
		for (let i = 0; i < clonesNeeded; i++) {
			const juiceIndex = (this.sortedJuices.length - clonesNeeded + i + this.sortedJuices.length) % this.sortedJuices.length;
			this.createCarouselItem(this.sortedJuices[juiceIndex], juiceIndex, 'clone-start');
		}

		// Create original items
		this.sortedJuices.forEach((juice, index) => {
			this.createCarouselItem(juice, index, 'original');
		});

		// Create clones at end (first items)
		for (let i = 0; i < clonesNeeded; i++) {
			const juiceIndex = i % this.sortedJuices.length;
			this.createCarouselItem(this.sortedJuices[juiceIndex], juiceIndex, 'clone-end');
		}

		// Set initial position to first original item
		this.currentIndex = clonesNeeded;
	}

	createCarouselItem(juice, originalIndex, type) {
		const outOfStockClass = juice.inStock ? '' : ' out-of-stock';
		const itemHTML = `
			<div class="carousel-item ${type}${outOfStockClass}" data-original-index="${originalIndex}">
				<a href="/juices/${juice.slug}" class="carousel-item-link" tabindex="-1">
					<img src="${juice.imageUrl}" alt="${juice.name}" class="juice-bottle" loading="lazy" decoding="async">
				</a>
			</div>
		`;
		this.track.insertAdjacentHTML('beforeend', itemHTML);
	}

	calculateOffset() {
		const items = document.querySelectorAll('.carousel-item');
		if (items.length === 0) return 0;

		const itemWidth = items[0].offsetWidth + parseInt(window.getComputedStyle(this.track).gap || '0');
		const visibleItems = this.getVisibleItems();

		let offset;
		if (visibleItems === 3) {
			offset = -(this.currentIndex - 1) * itemWidth;
		} else if (visibleItems === 1) {
			const carouselWidth = this.carouselElement.offsetWidth;
			const extraSpace = (carouselWidth - itemWidth) / 2;
			offset = -this.currentIndex * itemWidth + extraSpace;
		} else {
			offset = -this.currentIndex * itemWidth;
		}

		return offset;
	}

	updateCarousel(skipTransition = false, skipActiveUpdate = false) {
		const items = document.querySelectorAll('.carousel-item');
		if (items.length === 0) return;

		const offset = this.calculateOffset();

		// Apply transform with consistent timing
		if (skipTransition) {
			this.track.style.transition = 'none';
			this.track.style.transform = `translateX(${offset}px)`;
			// Force reflow
			this.track.offsetHeight;
			this.track.style.transition = 'transform 0.5s ease-in-out';
		} else {
			this.track.style.transition = 'transform 0.5s ease-in-out';
			this.track.style.transform = `translateX(${offset}px)`;
		}

		// Update active classes and left panel
		if (!skipActiveUpdate) {
			this.updateActiveClasses(items);
		}
	}

	updateActiveClasses(items) {
		const visibleItems = this.getVisibleItems();
		const clonesNeeded = Math.max(visibleItems * 2, this.sortedJuices.length);
		const originalStart = clonesNeeded;
		const originalEnd = originalStart + this.sortedJuices.length - 1;

		// Only update if we're not at a clone position
		if (this.currentIndex >= originalStart && this.currentIndex <= originalEnd) {
			items.forEach((item, index) => {
				item.classList.remove('active', 'prev', 'next', 'next2');

				if (index === this.currentIndex) {
					item.classList.add('active');
					const originalIndex = parseInt(item.dataset.originalIndex);
					this.activeJuice = this.sortedJuices[originalIndex];
				} else if (index === this.currentIndex - 1) {
					item.classList.add('prev');
				} else if (index === this.currentIndex + 1) {
					item.classList.add('next');
				} else if (index === this.currentIndex + 2) {
					item.classList.add('next2');
				}
			});

			if (this.activeJuice) {
				this.renderLeftPanel(this.activeJuice);
			}
		}
	}

	renderLeftPanel(juice) {
		const addToCartButton = juice.inStock ? `<button class="home__button left-btn add-to-cart left-add-cart" data-id="${juice.id}" style="background-color:#fff;color:${juice.color};">Add to Cart</button>` : `<button class="home__button left-btn add-to-cart left-add-cart" data-id="${juice.id}" style="background-color:#ccc;color:#666;" disabled>Out of Stock</button>`;

		this.leftPanel.innerHTML = `
			<h3 class="slide-title" style="font-family: var(--second-font); color:#fff; margin-bottom:1.5rem;">${juice.name}</h3>
			<div class="ingredients-preview">
				${juice.ingredients
					.map(
						ing => `
					<span class="ingredient-tag" style="background:rgba(255,255,255,0.3);color:#fff;">
						<img src="/assets/img/ingredients/${ing.toLowerCase().replace(/ /g, '-')}.svg" alt="${ing}" class="ingredient-icon"> 
						<span class="ingredient-name">${ing}</span>
					</span>
				`
					)
					.join('')}
			</div>
			<div class="button-row">
				<a href="/juices/${juice.slug}" class="home__button left-btn" style="background-color:#fff;color:${juice.color};">View Product</a>
				${addToCartButton}
			</div>
		`;

		this.leftPanel.style.backgroundColor = juice.color;

		// Mobile background color
		if (window.innerWidth <= 767) {
			this.carouselElement.style.backgroundColor = juice.color;
		} else {
			this.carouselElement.style.backgroundColor = '';
		}

		// Update dynamic word color
		if (this.dynamicWordSelector) {
			const dynamicWord = document.querySelector(this.dynamicWordSelector);
			if (dynamicWord) {
				dynamicWord.style.color = juice.color;
			}
		}

		// Bind add-to-cart button
		const btn = this.leftPanel.querySelector('.left-add-cart');
		if (btn && juice.inStock && window.cart) {
			btn.addEventListener('click', e => {
				e.preventDefault();
				window.cart.addItem(juice.id);
			});
		}

		// Render mobile buttons
		this.renderMobileButtons(juice);
	}

	renderMobileButtons(juice) {
		const addToCartButton = juice.inStock ? `<button class="home__button left-btn add-to-cart mobile-add-cart" data-id="${juice.id}" style="background-color:#fff;color:${juice.color};">Add to Cart</button>` : `<button class="home__button left-btn add-to-cart mobile-add-cart" data-id="${juice.id}" style="background-color:#ccc;color:#666;" disabled>Out of Stock</button>`;

		this.mobileButtonRow.innerHTML = `
			<a href="/juices/${juice.slug}" class="home__button left-btn" style="background-color:#fff;color:${juice.color};">View Product</a>
			${addToCartButton}
		`;

		// Bind mobile add-to-cart button
		const mobileBtn = this.mobileButtonRow.querySelector('.mobile-add-cart');
		if (mobileBtn && juice.inStock && window.cart) {
			mobileBtn.addEventListener('click', e => {
				e.preventDefault();
				window.cart.addItem(juice.id);
			});
		}
	}

	nextSlide() {
		if (this.isTransitioning) return;
		this.isTransitioning = true;
		this.currentIndex++;
		this.updateCarousel();

		// Handle infinite scroll wraparound
		setTimeout(() => {
			this.handleInfiniteScroll();
			this.isTransitioning = false;
		}, 500); // Match CSS transition duration
	}

	prevSlide() {
		if (this.isTransitioning) return;
		this.isTransitioning = true;
		this.currentIndex--;
		this.updateCarousel();

		// Handle infinite scroll wraparound
		setTimeout(() => {
			this.handleInfiniteScroll();
			this.isTransitioning = false;
		}, 500); // Match CSS transition duration
	}

	handleInfiniteScroll() {
		const visibleItems = this.getVisibleItems();
		const clonesNeeded = Math.max(visibleItems * 2, this.sortedJuices.length);
		const originalStart = clonesNeeded;
		const originalEnd = originalStart + this.sortedJuices.length - 1;

		if (this.currentIndex > originalEnd) {
			// Moved past end, jump to beginning
			const clonePosition = this.currentIndex - originalEnd - 1;
			this.currentIndex = originalStart + clonePosition;
			this.updateCarousel(true);
		} else if (this.currentIndex < originalStart) {
			// Moved before start, jump to end
			const clonePosition = originalStart - this.currentIndex - 1;
			this.currentIndex = originalEnd - clonePosition;
			this.updateCarousel(true);
		}
	}

	moveToIndex(targetIndex) {
		if (this.isTransitioning) return;
		this.isTransitioning = true;
		this.currentIndex = targetIndex;
		this.updateCarousel();

		setTimeout(() => {
			this.handleInfiniteScroll();
			this.isTransitioning = false;
		}, 500);
	}

	handleItemClick(e) {
		const clickedItem = e.target.closest('.carousel-item');
		if (!clickedItem) return;

		if (!clickedItem.classList.contains('active')) {
			e.preventDefault();
			const items = Array.from(document.querySelectorAll('.carousel-item'));
			const clickedIndex = items.indexOf(clickedItem);
			const diff = clickedIndex - this.currentIndex;

			if (diff === 1) {
				this.nextSlide();
			} else if (diff === -1) {
				this.prevSlide();
			} else if (diff !== 0) {
				this.moveToIndex(clickedIndex);
			}
		}
	}

	handleResize() {
		const newVisible = this.getVisibleItems();
		if (newVisible !== this.lastVisibleItems) {
			// Preserve currently active juice
			const originalIndex = this.currentIndex % this.sortedJuices.length;
			this.lastVisibleItems = newVisible;
			this.createCarouselItems();

			// Adjust position to maintain same active juice
			const clonesNeeded = Math.max(newVisible * 2, this.sortedJuices.length);
			this.currentIndex = clonesNeeded + originalIndex;
		}
		this.updateCarousel(true);
	}

	bindEvents() {
		// Navigation buttons
		this.prevButton?.addEventListener('click', () => this.prevSlide());
		this.nextButton?.addEventListener('click', () => this.nextSlide());

		// Item clicks
		this.track.addEventListener('click', e => this.handleItemClick(e));

		// Resize handling with debounce
		let resizeTimeout;
		window.addEventListener('resize', () => {
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(() => this.handleResize(), 250);
		});
	}

	// Public method to get current active juice
	getActiveJuice() {
		return this.activeJuice;
	}

	// Public method to refresh carousel (useful after data changes)
	refresh() {
		this.prepareJuices();
		this.createCarouselItems();
		this.updateCarousel(true);
	}
}

export default CarouselManager;
