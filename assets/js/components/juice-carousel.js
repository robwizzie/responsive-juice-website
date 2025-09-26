/**
 * Simple Infinite Carousel Manager
 * No clones, just smart position management for true infinite scrolling
 */

class SimpleCarousel {
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
		this.currentIndex = 0; // Logical index (0 to juices.length - 1)
		this.visualIndex = 0; // Visual position for transforms
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

		if (this.sortedJuices.length === 0) {
			this.track.innerHTML = '<div class="no-juices">No juices available</div>';
			return;
		}

		// Create items
		this.createCarouselItems();

		// Set initial state
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

		// Create only the actual items - no clones
		this.sortedJuices.forEach((juice, index) => {
			this.createCarouselItem(juice, index);
		});

		// Start at first item
		this.currentIndex = 0;
		this.visualIndex = 0;
	}

	createCarouselItem(juice, index) {
		const outOfStockClass = juice.inStock ? '' : ' out-of-stock';
		const itemHTML = `
			<div class="carousel-item${outOfStockClass}" data-index="${index}">
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
			// Center the middle item
			offset = -(this.visualIndex - 1) * itemWidth;
		} else if (visibleItems === 1) {
			// Center single item
			const carouselWidth = this.carouselElement.offsetWidth;
			const extraSpace = (carouselWidth - itemWidth) / 2;
			offset = -this.visualIndex * itemWidth + extraSpace;
		} else {
			offset = -this.visualIndex * itemWidth;
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
		// Clear all classes
		items.forEach(item => {
			item.classList.remove('active', 'prev', 'next', 'next2');
		});

		// Set classes based on current logical index
		items.forEach((item, index) => {
			const itemIndex = parseInt(item.dataset.index);

			if (itemIndex === this.currentIndex) {
				item.classList.add('active');
				this.activeJuice = this.sortedJuices[itemIndex];
			} else if (itemIndex === this.getPrevIndex()) {
				item.classList.add('prev');
			} else if (itemIndex === this.getNextIndex()) {
				item.classList.add('next');
			} else if (itemIndex === this.getNextIndex(2)) {
				item.classList.add('next2');
			}
		});

		if (this.activeJuice) {
			this.renderLeftPanel(this.activeJuice);
		}
	}

	// Helper functions for circular indexing
	getPrevIndex(steps = 1) {
		return (this.currentIndex - steps + this.sortedJuices.length) % this.sortedJuices.length;
	}

	getNextIndex(steps = 1) {
		return (this.currentIndex + steps) % this.sortedJuices.length;
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

		// Update logical position
		this.currentIndex = this.getNextIndex();

		// Update visual position
		this.visualIndex++;

		// Animate to new position
		this.updateCarousel();

		// Handle infinite wraparound
		setTimeout(() => {
			// If we've moved past the last item visually, reset to beginning
			if (this.visualIndex >= this.sortedJuices.length) {
				this.visualIndex = 0;
				this.updateCarousel(true); // Skip transition for invisible jump
			}
			this.isTransitioning = false;
		}, 500);
	}

	prevSlide() {
		if (this.isTransitioning) return;
		this.isTransitioning = true;

		// Update logical position
		this.currentIndex = this.getPrevIndex();

		// If going before the first item, jump to the end first
		if (this.visualIndex === 0) {
			this.visualIndex = this.sortedJuices.length;
			this.updateCarousel(true); // Skip transition for invisible jump

			// Small delay to ensure the jump completes
			setTimeout(() => {
				this.visualIndex--;
				this.updateCarousel();

				setTimeout(() => {
					this.isTransitioning = false;
				}, 500);
			}, 50);
		} else {
			// Normal previous movement
			this.visualIndex--;
			this.updateCarousel();

			setTimeout(() => {
				this.isTransitioning = false;
			}, 500);
		}
	}

	moveToIndex(targetIndex) {
		if (this.isTransitioning || targetIndex === this.currentIndex) return;
		this.isTransitioning = true;

		// Calculate shortest path (considering circular nature)
		const totalItems = this.sortedJuices.length;
		const forwardDistance = (targetIndex - this.currentIndex + totalItems) % totalItems;
		const backwardDistance = (this.currentIndex - targetIndex + totalItems) % totalItems;

		// Choose shortest path
		if (forwardDistance <= backwardDistance) {
			// Move forward
			for (let i = 0; i < forwardDistance; i++) {
				setTimeout(() => {
					if (i === forwardDistance - 1) {
						// Last step
						this.nextSlide();
					} else {
						// Intermediate steps - move without full animation
						this.currentIndex = this.getNextIndex();
						this.visualIndex++;
						if (this.visualIndex >= this.sortedJuices.length) {
							this.visualIndex = 0;
						}
						this.updateCarousel(true);
					}
				}, i * 100);
			}
		} else {
			// Move backward
			for (let i = 0; i < backwardDistance; i++) {
				setTimeout(() => {
					if (i === backwardDistance - 1) {
						// Last step
						this.prevSlide();
					} else {
						// Intermediate steps - move without full animation
						this.currentIndex = this.getPrevIndex();
						if (this.visualIndex === 0) {
							this.visualIndex = this.sortedJuices.length;
						}
						this.visualIndex--;
						this.updateCarousel(true);
					}
				}, i * 100);
			}
		}
	}

	handleItemClick(e) {
		const clickedItem = e.target.closest('.carousel-item');
		if (!clickedItem) return;

		const targetIndex = parseInt(clickedItem.dataset.index);

		if (targetIndex !== this.currentIndex) {
			e.preventDefault();
			this.moveToIndex(targetIndex);
		}
		// If it's the active item, let the link work normally
	}

	handleResize() {
		const newVisible = this.getVisibleItems();
		if (newVisible !== this.lastVisibleItems) {
			this.lastVisibleItems = newVisible;
			// Just update positioning, no need to recreate items
			this.updateCarousel(true);
		}
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

	// Public methods
	getActiveJuice() {
		return this.activeJuice;
	}

	refresh() {
		this.prepareJuices();
		this.createCarouselItems();
		this.updateCarousel(true);
	}
}

export default SimpleCarousel;
