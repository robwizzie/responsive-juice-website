        document.addEventListener('DOMContentLoaded', () => {
            const infoCards = document.querySelectorAll('.info-card');
            infoCards.forEach((card, index) => {
                TweenMax.from(card, 1, {
                    delay: .4 + (index * 0.1),
                    opacity: 0,
                    y: 20,
                    ease: Expo.easeInOut
                });
            });

            TweenMax.from('.contact-form', 1, {
                delay: .5,
                opacity: 0,
                y: 20,
                ease: Expo.easeInOut
            });

            const form = document.getElementById('contactForm');
            const submitButton = form.querySelector('.submit-button');
            const originalButtonText = submitButton.textContent;

            form.addEventListener('submit', async(e) => {
                e.preventDefault();

                // Update button to sending state
                submitButton.classList.add('sending');
                submitButton.textContent = 'Sending...';

                const formData = {
                    firstName: form.firstName.value,
                    lastName: form.lastName.value,
                    email: form.email.value,
                    message: form.message.value
                };

                try {
                    const response = await fetch('/send-email', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(formData)
                    });

                    if (response.ok) {
                        // Success state
                        submitButton.classList.remove('sending');
                        submitButton.classList.add('success');
                        submitButton.textContent = 'Message Sent! ✓';
                        form.reset();

                        // Optional: Reset button after 3 seconds
                        setTimeout(() => {
                            submitButton.classList.remove('success');
                            submitButton.textContent = originalButtonText;
                        }, 3000);
                    } else {
                        throw new Error('Failed to send message');
                    }
                } catch (error) {
                    console.error('Error:', error);
                    // Error state
                    submitButton.classList.remove('sending');
                    submitButton.textContent = 'Failed to Send - Try Again';

                    // Reset button after 2 seconds
                    setTimeout(() => {
                        submitButton.textContent = originalButtonText;
                    }, 2000);
                }
            });
        });