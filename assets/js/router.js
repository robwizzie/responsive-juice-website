// Function to initialize the router
function initRouter() {
    const path = window.location.pathname;
    const pathSegments = path.split('/').filter(Boolean);

    if (pathSegments[0] === 'juices' && pathSegments[1]) {
        // Show juice page based on slug
        showJuicePage(pathSegments[1]);
    } else {
        // Show homepage
        showHomePage();
    }
}

function navigateTo(url) {
    window.history.pushState({}, '', url);
    initRouter();
}

// Function to show the juice page based on slug
function showJuicePage(slug) {
    const juice = juices.find(j => j.slug === slug);

    if (juice) {
        document.title = `${juice.name} - J & H Juices`;
        const juicePage = document.getElementById('juicePage');

        juicePage.innerHTML = `
          <div class="product__info">
              <h1 class="home__title" style="max-width: 550px;">
                  ${juice.name} <span style="color: ${juice.color};">Details</span>
              </h1>
        <img src="${juice.imageUrl}" alt="${juice.name}">
        <p>${juice.description}</p>
        <h3 style="font-size: 3rem;">Ingredients:</h3>
        <ul style="font-family: var(--second-font);">
          ${juice.ingredients.map(ingredient => `<li>${ingredient}</li>`).join('')}
        </ul>
        <a href="/">Go Back to Home</a>
      `;

      initializeCarousel(slug);
    } else {
      window.location.href = '/';
      console.warn('Juice not found:', slug);
    }
  }

// Event listener for anchor tags to override default behavior
function setupLinkListeners() {
  document.querySelectorAll('a').forEach(anchor => {
      anchor.addEventListener('click', function(event) {
          event.preventDefault(); // Prevent default behavior
          const url = this.getAttribute('href');
          if (url) {
              navigateTo(url); // Use custom navigateTo function
          }
      });
  });
}

// Initialize the router and set up link listeners
document.addEventListener('DOMContentLoaded', () => {
  initRouter();
  setupLinkListeners();
});

// Listen for browser's back and forward button actions
window.addEventListener('popstate', initRouter);