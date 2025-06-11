const stripeLib = require('stripe');

require('dotenv').config();

// Select the correct Stripe key:
// • In local Netlify dev (CONTEXT === 'dev') use STRIPE_SECRET_KEY_TEST if provided.
// • In production use STRIPE_SECRET_KEY.
const stripeSecretKey = process.env.CONTEXT === 'dev' && process.env.STRIPE_SECRET_KEY_TEST ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY;

const stripe = stripeLib(stripeSecretKey);

exports.handler = async event => {
	if (event.httpMethod !== 'POST') {
		return {
			statusCode: 405,
			body: 'Method Not Allowed'
		};
	}

	try {
		const { items } = JSON.parse(event.body);

		// Determine base URL for absolute image links
		const protocol = event.headers['x-forwarded-proto'] || 'https';
		const host = event.headers['host'];
		const baseURL = `${protocol}://${host}`;

		const lineItems = items.map(item => {
			const rawImage = item.price_data.product_data.images[0] || '';
			const imageUrl = rawImage.startsWith('http') ? rawImage : `${baseURL}${rawImage}`;

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

		const session = await stripe.checkout.sessions.create({
			payment_method_types: ['card'],
			line_items: lineItems,
			mode: 'payment',
			success_url: `${baseURL}/success`,
			cancel_url: `${baseURL}/cancel`
		});

		return {
			statusCode: 200,
			body: JSON.stringify({ url: session.url })
		};
	} catch (error) {
		console.error('Stripe checkout error:', error);
		return {
			statusCode: 500,
			body: 'Error creating checkout session'
		};
	}
};
