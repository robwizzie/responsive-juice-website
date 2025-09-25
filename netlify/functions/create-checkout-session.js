const stripeLib = require('stripe');
const { locations, getLocationBySlug } = require('../../assets/js/locations-database.js');

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
		const { items, pickupDate, pickupLocation, orderType, customerName, customerPhone, deliveryAddress, deliveryCity, deliveryZip, deliveryFee } = JSON.parse(event.body);

		// Determine base URL for absolute image links
		const protocol = event.headers['x-forwarded-proto'] || 'https';
		const host = event.headers['host'];
		const baseURL = `${protocol}://${host}`;

		// Calculate subtotal for tax calculation
		let subtotal = 0;
		const lineItems = items.map(item => {
			const rawImage = item.price_data.product_data.images[0] || '';
			const imageUrl = rawImage.startsWith('http') ? rawImage : `${baseURL}${rawImage}`;

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

		// Add delivery fee if applicable
		if (orderType === 'delivery' && deliveryFee && deliveryFee > 0) {
			lineItems.push({
				price_data: {
					currency: 'usd',
					product_data: {
						name: 'Delivery Fee',
						description: 'Delivery within 30 miles of Blackwood'
					},
					unit_amount: Math.round(deliveryFee * 100)
				},
				quantity: 1
			});
			subtotal += Math.round(deliveryFee * 100);
		}

		// Get location details from database
		const locationData = getLocationBySlug(pickupLocation);
		const locationName = locationData ? locationData.name : pickupLocation;
		const locationFullName = locationData ? `${locationData.name}, ${locationData.fullLocation}` : pickupLocation;

		const session = await stripe.checkout.sessions.create({
			payment_method_types: ['card'],
			line_items: lineItems,
			mode: 'payment',
			success_url: `${baseURL}/success?pickup_date=${encodeURIComponent(pickupDate || '')}&location=${encodeURIComponent(pickupLocation || '')}&order_type=${encodeURIComponent(orderType || 'pickup')}`,
			cancel_url: `${baseURL}/cancel`,
			metadata: {
				order_type: orderType || 'pickup',
				pickup_date: pickupDate || '',
				pickup_location: pickupLocation || '',
				pickup_location_name: locationName,
				pickup_location_full: locationFullName,
				customer_name: customerName || '',
				customer_phone: customerPhone || '',
				delivery_address: deliveryAddress || '',
				delivery_city: deliveryCity || '',
				delivery_zip: deliveryZip || '',
				delivery_fee: deliveryFee || 0,
				subtotal: (subtotal / 100).toFixed(2),
				location: 'New Jersey'
			},
			custom_text: {
				submit: {
					message: orderType === 'delivery' ? `Order will be delivered to your address on your selected date` : `Order will be ready for pickup in ${locationName} on your selected date`
				}
			}
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
