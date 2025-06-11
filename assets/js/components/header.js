class Header {
    static async render() {
        const headerHTML = `
            <header class="header" id="header">
                <nav class="nav container">
                    <a href="/" class="nav__logo">
                        <img src="/assets/img/branding/logo.png" alt="J & H Logo">
                    </a>

                    <div class="nav__menu" id="nav-menu">
                        <ul class="nav__list">
                            <li class="nav__item">
                                <a href="/" class="nav__link" data-page="home">Home</a>
                            </li>
                            <li class="nav__item">
                                <a href="/about" class="nav__link" data-page="about">About</a>
                            </li>
                            <li class="nav__item">
                                <a href="/juices" class="nav__link" data-page="juices">Juices</a>
                            </li>
                            <li class="nav__item">
                                <a href="/athletes" class="nav__link" data-page="athletes">Athletes</a>
                            </li>
                            <li class="nav__item">
                                <a href="/contact" class="nav__link" data-page="contact">Contact</a>
                            </li>
                            <li class="nav__item cart-item">
                                <button class="cart-button">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" class="bi bi-cart-fill" viewBox="0 0 16 16">
                                        <path d="M0 1.5A.5.5 0 0 1 .5 1H2a.5.5 0 0 1 .485.379L2.89 3H14.5a.5.5 0 0 1 .491.592l-1.5 8A.5.5 0 0 1 13 12H4a.5.5 0 0 1-.491-.408L2.01 3.607 1.61 2H.5a.5.5 0 0 1-.5-.5M5 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4m7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4m-7 1a1 1 0 1 1 0 2 1 1 0 0 1 0-2m7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2"></path>
                                    </svg>
                                </button>
                            </li>
                        </ul>

                        <div class="nav__close" id="nav-close">
                            <i class="ri-close-line"></i>
                        </div>

                        <img src="/assets/img/nav-img.png" alt="Nav image" class="nav__img">
                    </div>

                    <div class="nav__toggle" id="nav-toggle">
                        <i class="ri-menu-line"></i>
                    </div>
                </nav>
            </header>
        `;

        return headerHTML;
    }

    static init() {
        const currentPage = window.location.pathname.split('/')[1] || 'home';
        document.querySelectorAll('.nav__link').forEach(link => {
            // Check if the current page matches the link's data-page attribute
            if (link.dataset.page === currentPage || (currentPage === '' && link.dataset.page === 'home')) {
                link.classList.add('active-link');
            } else {
                link.classList.remove('active-link');
            }
        });

        // Mobile menu functionality
        const navMenu = document.getElementById('nav-menu');
        const navToggle = document.getElementById('nav-toggle');
        const navClose = document.getElementById('nav-close');
        const navLinks = document.querySelectorAll('.nav__link');

        if (navToggle) {
            navToggle.addEventListener('click', () => {
                navMenu.classList.add('show-menu');
            });
        }

        if (navClose) {
            navClose.addEventListener('click', () => {
                navMenu.classList.remove('show-menu');
            });
        }

        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('show-menu');
            });
        });
    }
}

export default Header;