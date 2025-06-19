// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { locations, getLocationBySlug } = require('./assets/js/locations-database.js');
// Choose Stripe key based on environment
const stripeSecretKey = process.env.NODE_ENV !== 'production' && process.env.STRIPE_SECRET_KEY_TEST ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY;
const stripe = require('stripe')(stripeSecretKey);
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files with correct MIME types
app.use(
	'/assets',
	express.static(path.join(__dirname, 'assets'), {
		maxAge: '1d', // cache static assets for 24 hours
		setHeaders: (res, filePath) => {
			if (filePath.endsWith('.js')) {
				res.setHeader('Content-Type', 'application/javascript');
			} else if (filePath.endsWith('.css')) {
				res.setHeader('Content-Type', 'text/css');
			}
		}
	})
);

// Serve JS files from /js directory
app.use(
	'/js',
	express.static(path.join(__dirname, 'js'), {
		maxAge: '1d',
		setHeaders: (res, filePath) => {
			if (filePath.endsWith('.js')) {
				res.setHeader('Content-Type', 'application/javascript');
			}
		}
	})
);

// Routes
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/about', (req, res) => {
	res.sendFile(path.join(__dirname, 'about.html'));
});

app.get('/juices', (req, res) => {
	res.sendFile(path.join(__dirname, 'juices.html'));
});

app.get('/juices/:slug', (req, res) => {
	res.sendFile(path.join(__dirname, 'juice-details.html'));
});

app.get('/athletes', (req, res) => {
	res.sendFile(path.join(__dirname, 'athletes.html'));
});

app.get('/success', (req, res) => {
	res.sendFile(path.join(__dirname, 'success.html'));
});

app.get('/cancel', (req, res) => {
	res.sendFile(path.join(__dirname, 'cancel.html'));
});

app.get('/contact', (req, res) => {
	res.sendFile(path.join(__dirname, 'contact.html'));
});

// Email configuration
const transporter = nodemailer.createTransport({
	host: process.env.EMAIL_HOST,
	port: process.env.EMAIL_PORT,
	secure: false, // true for 465, false for other ports
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASS
	}
});

// Verify transporter configuration
transporter.verify(function (error, success) {
	if (error) {
		console.log('Error verifying email configuration:', error);
	} else {
		console.log('Email server is ready to send messages');
	}
});

function validateEmail(req, res, next) {
	const { email } = req.body;
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	if (!emailRegex.test(email)) {
		return res.status(400).json({ error: 'Invalid email address' });
	}
	next();
}

const emailLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 5 // limit each IP to 5 requests per windowMs
});

// Email endpoint
app.post('/send-email', emailLimiter, validateEmail, async (req, res) => {
	const { firstName, lastName, email, message } = req.body;

	try {
		// Send email
		const info = await transporter.sendMail({
			from: `"${firstName} ${lastName}" <${process.env.EMAIL_USER}>`,
			to: process.env.CONTACT_EMAIL,
			replyTo: email,
			subject: 'New Contact Form Submission - Pressed by J & H',
			html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #ff9700;">New Message from Website Contact Form</h2>
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 10px;">
                        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Message:</strong></p>
                        <p style="white-space: pre-wrap;">${message}</p>
                    </div>
                    <p style="color: #666; font-size: 12px; margin-top: 20px;">
                        This message was sent from the Pressed by J & H website contact form.
                    </p>
                </div>
            `
		});

		console.log('Email sent successfully:', info);
		res.status(200).json({ message: 'Email sent successfully' });
	} catch (error) {
		console.error('Error sending email:', error);
		res.status(500).json({ error: 'Failed to send email' });
	}
});

app.post('/create-checkout-session', async (req, res) => {
	try {
		// Get the base URL
		const baseURL = `${req.protocol}://${req.get('host')}`;
		const { items, pickupDate, pickupLocation, customerName, customerPhone } = req.body;

		// NJ Sales Tax Rate (6.625%)
		const NJ_SALES_TAX_RATE = 0.06625;

		// Calculate subtotal for tax calculation
		let subtotal = 0;
		const lineItems = items.map(item => {
			const imageUrl = `${baseURL}${item.price_data.product_data.images[0]}`;
			const itemTotal = item.price_data.unit_amount * item.quantity;
			subtotal += itemTotal;

			return {
				price_data: {
					currency: 'usd',
					product_data: {
						name: item.price_data.product_data.name,
						description: item.price_data.product_data.description,
						images: [imageUrl]
					},
					unit_amount: item.price_data.unit_amount
				},
				quantity: item.quantity
			};
		});

		// Add NJ Sales Tax as a separate line item
		const taxAmount = Math.round(subtotal * NJ_SALES_TAX_RATE);
		if (taxAmount > 0) {
			lineItems.push({
				price_data: {
					currency: 'usd',
					product_data: {
						name: 'NJ Sales Tax (6.625%)',
						description: 'New Jersey State Sales Tax'
					},
					unit_amount: taxAmount
				},
				quantity: 1
			});
		}

		// Get location details from database
		const locationData = getLocationBySlug(pickupLocation);
		const locationName = locationData ? locationData.name : pickupLocation;
		const locationFullName = locationData ? `${locationData.name}, ${locationData.fullLocation}` : pickupLocation;

		const session = await stripe.checkout.sessions.create({
			payment_method_types: ['card'],
			line_items: lineItems,
			mode: 'payment',
			success_url: `${baseURL}/success?pickup_date=${encodeURIComponent(pickupDate || '')}&location=${encodeURIComponent(pickupLocation || '')}`,
			cancel_url: `${baseURL}/cancel`,
			metadata: {
				order_type: 'pickup',
				pickup_date: pickupDate || '',
				pickup_location: pickupLocation || '',
				pickup_location_name: locationName,
				pickup_location_full: locationFullName,
				customer_name: customerName || '',
				customer_phone: customerPhone || '',
				subtotal: (subtotal / 100).toFixed(2),
				tax_amount: (taxAmount / 100).toFixed(2),
				location: 'New Jersey'
			},
			custom_text: {
				submit: {
					message: `Order will be ready for pickup in ${locationName} on your selected date`
				}
			}
		});

		res.json({ url: session.url });
	} catch (error) {
		console.error('Error creating checkout session:', error);
		console.error('Error details:', error.raw);
		res.status(500).json({ error: 'Error creating checkout session' });
	}
});
