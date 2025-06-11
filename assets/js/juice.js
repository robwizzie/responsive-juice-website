/*=============== SHOW MENU ===============*/
const navMenu = document.getElementById('nav-menu'),
    navToggle = document.getElementById('nav-toggle'),
    navClose = document.getElementById('nav-close')

/*===== MENU SHOW =====*/
/* Validate if constant exists */
if (navToggle) {
    navToggle.addEventListener('click', () => {
        navMenu.classList.add('show-menu')
    })
}

/*===== MENU HIDDEN =====*/
/* Validate if constant exists */
if (navClose) {
    navClose.addEventListener('click', () => {
        navMenu.classList.remove('show-menu')
    })
}

/*=============== REMOVE MENU MOBILE ===============*/
const navLink = document.querySelectorAll('.nav__link')

function linkAction() {
    const navMenu = document.getElementById('nav-menu')
        // When we click on each nav__link, we remove the show-menu class
    navMenu.classList.remove('show-menu')
}
navLink.forEach(n => n.addEventListener('click', linkAction))

document.addEventListener('DOMContentLoaded', function() {
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
                    ${juice.ingredients.map(ingredient => `
                        <li>
                            <img src="/assets/img/ingredients/${ingredient.toLowerCase().replace(/ /g, '-')}.svg" 
                                alt="${ingredient}" 
                                style="width: 50px; height: 50px; vertical-align: middle;">
                            ${ingredient}
                        </li>
                    `).join('')}
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
                <img src="${juice.imageUrl}" alt="${juice.name}" class="home__juice">
            </div>
            ${juice.ingredients.slice(0, 2).map((ingredient, index) => `
                <img src="/assets/img/ingredients/${ingredient.toLowerCase().replace(/ /g, '-')}.svg" 
                    alt="${ingredient}" 
                    class="home__apple${index + 1}" style="z-index: 0;">
            `).join('')}
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
        image.onload = function() {
            const imageWidth = image.offsetWidth;
            const imageHeight = image.offsetHeight;
            const zoom = 2; // Zoom level

            // Set the background size based on actual image dimensions
            magnifier.style.backgroundSize = `${imageWidth * zoom}px ${imageHeight * zoom}px`;

            magnifierContainer.addEventListener('mousemove', function(e) {
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

            magnifierContainer.addEventListener('mouseenter', function() {
                magnifier.style.opacity = '1';
            });

            magnifierContainer.addEventListener('mouseleave', function() {
                magnifier.style.opacity = '0';
            });
        };
    }

    // Initialize carousel with filtered juices
    initializeCarousel(slug);

    // Initialize GSAP animations
    TweenMax.from('.ingredients-list', 1, { delay: .3, opacity: 0, y: 20, ease: Expo.easeInOut });
    TweenMax.from('.product__price', 1, { delay: .4, opacity: 0, y: 20, ease: Expo.easeInOut });
    TweenMax.from('.home__button', 1, { delay: .5, opacity: 0, y: 20, ease: Expo.easeInOut });
    TweenMax.from('.home__liquid', 1, { delay: .7, opacity: 0, y: 200, ease: Expo.easeInOut });
    TweenMax.from('.home__juice-animate', 1, { delay: 1.2, opacity: 0, y: -800, ease: Expo.easeInOut });
    TweenMax.from('.home__apple1', 1, { delay: 1.5, opacity: 0, y: -800, ease: Expo.easeInOut });
    TweenMax.from('.home__apple2', 1, { delay: 1.6, opacity: 0, y: -800, ease: Expo.easeInOut });
});

// Carousel initialization function
function initializeCarousel(currentSlug) {
    const track = document.querySelector('.carousel-track');
    track.innerHTML = '';

    // State variables
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let startTransform = 0;
    let swipeThreshold = 50;
    let isTransitioning = false;

    // Filter out current juice and create extended array
    const filteredJuices = juices.filter(j => j.slug !== currentSlug);
    const extendedJuices = [
        ...filteredJuices, ...filteredJuices, ...filteredJuices, ...filteredJuices,
        ...filteredJuices,
        ...filteredJuices, ...filteredJuices, ...filteredJuices, ...filteredJuices
    ];

    // Create carousel HTML
    function createJuiceHTML(juice, index) {
        return `
            <div class="carousel-item" data-index="${index}">
                <a href="/juices/${juice.slug}" class="textImgContainer ${juice.slug}" 
                   style="background-color: ${juice.color}10">
                    <img src="${juice.imageUrl}" alt="${juice.name}" class="juice-bottle">
                    <h3 style="font-family: var(--second-font);">${juice.name}</h3>
                    <div class="ingredients-preview">
                            ${juice.ingredients.map(ingredient => `
                                <span class="ingredient-tag">
                                    <img src="/assets/img/ingredients/${ingredient.toLowerCase().replace(/ /g, '-')}.svg" 
                                        alt="${ingredient}" 
                                        class="ingredient-icon">
                                       <span class="ingredient-name">${ingredient}</span>
                                </span>
                            `).join('')}
                        </div>
                    <p class="juice-price">$${juice.price.toFixed(2)}</p>
                </a>
                <button class="add-to-cart" data-id="${juice.id}" style="background-color: ${juice.color}">
                    <span style="margin-right: 5px; font-size: 1rem;">Add to Cart</span> <svg viewBox="0 0 24 24" width="24" height="24" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            </div>
        `;
    }

    // Populate carousel
    extendedJuices.forEach((juice, index) => {
        track.insertAdjacentHTML('beforeend', createJuiceHTML(juice, index % filteredJuices.length));
    });

    // Initialize carousel elements
    const items = document.querySelectorAll('.carousel-item');
    const itemCount = filteredJuices.length;
    const totalSets = 9;
    const middleSetIndex = Math.floor(totalSets / 2) * itemCount;
    let currentIndex = middleSetIndex;

    const prevButton = document.querySelector('.carousel-button.prev');
    const nextButton = document.querySelector('.carousel-button.next');

    // Utility functions
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
                item.querySelector('.textImgContainer').style.backgroundColor = filteredJuices[juiceIndex].color;
                item.querySelector('a').style.pointerEvents = 'auto';
            } else {
                item.classList.remove('active');
                item.querySelector('.textImgContainer').style.backgroundColor = `${filteredJuices[juiceIndex].color}10`;
                item.querySelector('a').style.pointerEvents = 'none';
            }
        });

        // Reset position if needed
        if (!skipTransition) {
            const distanceFromMiddle = Math.abs(currentIndex - middleSetIndex);
            if (distanceFromMiddle >= itemCount * 2) {
                setTimeout(() => {
                    currentIndex = middleSetIndex + (currentIndex - middleSetIndex) % itemCount;
                    updateCarousel(true);
                }, 500);
            }
        }
    }

    // Navigation functions
    function nextSlide() {
        if (isTransitioning) return;
        isTransitioning = true;
        currentIndex++;
        updateCarousel();
        setTimeout(() => { isTransitioning = false; }, 500);
    }

    function prevSlide() {
        if (isTransitioning) return;
        isTransitioning = true;
        currentIndex--;
        updateCarousel();
        setTimeout(() => { isTransitioning = false; }, 500);
    }

    // Event handlers
    function handleDragStart(e) {
        if (isTransitioning) return;
        isDragging = true;
        startX = e.type === 'mousedown' ? e.pageX : e.touches[0].pageX;
        startTransform = getCurrentTransform();
        track.classList.add('dragging');
    }

    function handleDragMove(e) {
        if (!isDragging) return;
        e.preventDefault();

        currentX = e.type === 'mousemove' ? e.pageX : e.touches[0].pageX;
        const diff = currentX - startX;
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
        return matrix.m41;
    }

    // Event listeners
    prevButton.addEventListener('click', prevSlide);
    nextButton.addEventListener('click', nextSlide);
    
    function handleItemClick(e) {
        const clickedItem = e.target.closest('.carousel-item');
        if (!clickedItem) return;
    
        // Get the add to cart button
        const addToCartButton = e.target.closest('.add-to-cart');
        if (addToCartButton) {
            e.stopPropagation();
            return; // Let the add to cart handler deal with this
        }
    
        // Only handle navigation for inactive items
        if (!clickedItem.classList.contains('active')) {
            e.preventDefault(); // Prevent navigation for inactive items
            const clickedIndex = Array.from(items).indexOf(clickedItem);
            const difference = clickedIndex - currentIndex;
    
            if (difference !== 0) {
                if (Math.abs(difference) === 1) {
                    difference > 0 ? nextSlide() : prevSlide();
                } else {
                    const itemsBefore = clickedIndex;
                    const itemsAfter = items.length - clickedIndex;
                    const shortestPath = Math.abs(difference) <= Math.min(itemsBefore, itemsAfter) ?
                        difference :
                        difference > 0 ? -itemsAfter : itemsBefore;
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
        setTimeout(() => { isTransitioning = false; }, 500);
    }
    
    // Add this to your event listeners section in initializeCarousel()
    track.addEventListener('click', handleItemClick);
    track.addEventListener('touchstart', handleDragStart);
    track.addEventListener('touchmove', handleDragMove, { passive: false });
    track.addEventListener('touchend', handleDragEnd);
    
    track.addEventListener('mousedown', handleDragStart);
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    
    track.addEventListener('contextmenu', e => e.preventDefault());
    
    document.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            track.classList.remove('dragging');
            updateCarousel();
        }
    });

    // Initialize carousel
    updateCarousel(true);
    
    // Handle window resize
    window.addEventListener('resize', debounce(() => {
        updateCarousel(true);
    }, 250));
}

// Utility function
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}