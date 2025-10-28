const nodemailer = require('nodemailer');
const stripeLib = require('stripe');
const { locations, getLocationBySlug, getTodaysHours, getFormattedHours } = require('../../assets/js/locations-database.js');
require('dotenv').config();

// Initialize Stripe
const stripeSecretKey = process.env.CONTEXT === 'dev' && process.env.STRIPE_SECRET_KEY_TEST ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY;
const stripe = stripeLib(stripeSecretKey);

// Email configuration
const transporter = nodemailer.createTransporter({
	host: process.env.EMAIL_HOST,
	port: process.env.EMAIL_PORT || 465,
	secure: process.env.EMAIL_PORT === '465',
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASS
	}
});

exports.handler = async event => {
	if (event.httpMethod !== 'POST') {
		return {
			statusCode: 405,
			body: 'Method Not Allowed'
		};
	}

	try {
		const sig = event.headers['stripe-signature'];
		const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

		let stripeEvent;
		try {
			stripeEvent = stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
		} catch (err) {
			// console.log(`Webhook signature verification failed.`, err.message);
			return {
				statusCode: 400,
				body: `Webhook Error: ${err.message}`
			};
		}

		// Handle the checkout.session.completed event
		if (stripeEvent.type === 'checkout.session.completed') {
			const session = stripeEvent.data.object;

			// Get customer email from session
			const customerEmail = session.customer_details && session.customer_details.email;
			const pickupDate = session.metadata && session.metadata.pickup_date;
			const pickupLocation = session.metadata && session.metadata.pickup_location;
			const customerName = session.metadata && session.metadata.customer_name;
			const customerPhone = session.metadata && session.metadata.customer_phone;
			const subtotal = session.metadata && session.metadata.subtotal;
			const total = ((session.amount_total || 0) / 100).toFixed(2);
			const orderType = session.metadata && session.metadata.order_type;
			const deliveryAddress = session.metadata && session.metadata.delivery_address;
			const deliveryCity = session.metadata && session.metadata.delivery_city;
			const deliveryZip = session.metadata && session.metadata.delivery_zip;
			const deliveryFee = session.metadata && session.metadata.delivery_fee;

			// Fetch line items from the session
			let lineItems = [];
			try {
				const lineItemsResponse = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
				lineItems = lineItemsResponse.data;
			} catch (error) {
				console.error('Error fetching line items:', error);
			}

			// Get base URL for images
			const baseURL = process.env.URL || 'https://pressedbyjandh.com';

			if (customerEmail && pickupDate && pickupLocation) {
				// Format the pickup date
				const formattedPickupDate = new Date(pickupDate).toLocaleDateString('en-US', {
					weekday: 'long',
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				});

				// Get location details from database
				const locationData = getLocationBySlug(pickupLocation);
				const locationName = locationData ? locationData.name : pickupLocation.charAt(0).toUpperCase() + pickupLocation.slice(1);
				const locationDetails = locationData ? locationData.fullLocation : 'New Jersey';
				const locationAddress = locationData ? locationData.address : '[ADDRESS TO BE PROVIDED]';
				const locationPhone = locationData ? locationData.contactPhone : '';
				const locationDescription = locationData ? locationData.description : '';
				const todaysHours = locationData ? getTodaysHours(pickupLocation) : 'Hours not available';

				// Send confirmation email to customer
				const isDelivery = orderType === 'delivery';
				const orderTypeText = isDelivery ? 'Delivery' : 'Pickup';

				// Helper function to get juice image URL from product name
				const getJuiceImageUrl = productName => {
					const juiceImageMap = {
						'Sweet Green': `${baseURL}/assets/img/juices/sweet-green.png`,
						'Midnight Rush': `${baseURL}/assets/img/juices/midnight-rush.png`,
						'Tropical Storm': `${baseURL}/assets/img/juices/tropical-storm.png`,
						'Electric Berry Lemonade': `${baseURL}/assets/img/juices/electric-berry-lemonade.png`,
						'Strawberry Lemonade': `${baseURL}/assets/img/juices/strawberry-lemonade.png`,
						'Cinnamon Green Apple': `${baseURL}/assets/img/juices/cinnamon-green-apple.png`,
						'Sour Punch': `${baseURL}/assets/img/juices/sour-punch.png`,
						'Strawberry Banana': `${baseURL}/assets/img/juices/strawberry-banana.png`
					};
					return juiceImageMap[productName] || `${baseURL}/assets/img/juices/sweet-green.png`;
				};

				// Build order items HTML
				let orderItemsHtml = '';
				lineItems.forEach(item => {
					// Skip delivery fee items
					if (item.description && item.description.name !== 'Delivery Fee') {
						const itemPrice = ((item.amount_total || 0) / 100).toFixed(2);
						const juiceImage = getJuiceImageUrl(item.description.name);
						orderItemsHtml += `
						<tr>
							<td style="padding: 15px; border-bottom: 1px solid #eeeeee;">
								<table style="width: 100%; border-collapse: collapse;">
									<tr>
										<td style="width: 70px; vertical-align: middle;">
											<img src="${juiceImage}" alt="${item.description.name}" style="width: 60px; height: 60px; object-fit: contain; border-radius: 8px; display: block;">
										</td>
										<td style="vertical-align: middle; padding-left: 15px;">
											<p style="margin: 0; color: #222; font-size: 15px; font-weight: 500;">${item.description.name}</p>
											<p style="margin: 5px 0 0 0; color: #666; font-size: 13px;">Quantity: ${item.quantity}</p>
										</td>
										<td style="vertical-align: middle; text-align: right; width: 80px;">
											<p style="margin: 0; color: #222; font-size: 15px; font-weight: 500;">$${itemPrice}</p>
										</td>
									</tr>
								</table>
							</td>
						</tr>`;
					}
				});

				const customerEmailHtml = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">

                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #ff9700, #ff7700); padding: 30px 30px 40px 30px; text-align: center;">
                        <img src="${baseURL}/assets/img/branding/logo.png" alt="Pressed By J & H" style="height: 50px; margin-bottom: 20px;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 300; letter-spacing: 1px;">ORDER CONFIRMED</h1>
                        <p style="color: #ffffff; font-size: 15px; margin: 12px 0 0 0; opacity: 0.9; font-weight: 300;">Thank you for choosing Pressed By J & H</p>
                    </div>

                    <!-- Main Content -->
                    <div style="padding: 40px 30px; background: #fafafa;">

                        <!-- Order Items -->
                        <div style="background: #ffffff; padding: 30px; margin-bottom: 20px;">
                            <h2 style="color: #222; margin: 0 0 20px 0; font-size: 18px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Your Order</h2>
                            <table style="width: 100%; border-collapse: collapse;">
                                ${orderItemsHtml}
                            </table>
                        </div>

                        <!-- Order Information -->
                        <div style="background: #ffffff; padding: 30px; margin-bottom: 20px;">
                            <h2 style="color: #222; margin: 0 0 25px 0; font-size: 18px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">${orderTypeText} Information</h2>

                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #eeeeee; color: #666; font-size: 14px;">Name</td>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #eeeeee; color: #222; font-size: 14px; text-align: right;">${customerName}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #eeeeee; color: #666; font-size: 14px;">Phone</td>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #eeeeee; color: #222; font-size: 14px; text-align: right;">${customerPhone}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #eeeeee; color: #666; font-size: 14px;">Date</td>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #eeeeee; color: #222; font-size: 14px; text-align: right;">${formattedPickupDate}</td>
                                </tr>
                            </table>
                        </div>

                        ${
							isDelivery
								? `
                        <!-- Delivery Address -->
                        <div style="background: #ffffff; padding: 30px; margin-bottom: 20px;">
                            <h3 style="color: #222; margin: 0 0 20px 0; font-size: 16px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Delivery Address</h3>
                            <p style="color: #222; font-size: 15px; line-height: 1.7; margin: 0;">
                                ${deliveryAddress}<br>
                                ${deliveryCity}, NJ ${deliveryZip}
                            </p>
                            <p style="color: #666; font-size: 13px; margin: 15px 0 0 0; padding-top: 15px; border-top: 1px solid #eeeeee;">
                                Delivery Fee: <span style="color: #ff9700; font-weight: 500;">$${deliveryFee}</span>
                            </p>
                        </div>
                        `
								: `
                        <!-- Pickup Location -->
                        <div style="background: #ffffff; padding: 30px; margin-bottom: 20px;">
                            <h3 style="color: #222; margin: 0 0 20px 0; font-size: 16px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Pickup Location</h3>
                            <p style="color: #222; font-size: 15px; font-weight: 500; margin: 0 0 8px 0;">${locationName}</p>
                            <p style="color: #666; font-size: 14px; line-height: 1.7; margin: 0;">
                                ${locationAddress}<br>
                                ${locationPhone}<br>
                                Hours: ${todaysHours}
                            </p>
                        </div>
                        `
						}

                        <!-- Order Total -->
                        <div style="background: #ffffff; padding: 30px; margin-bottom: 20px;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 12px 0; color: #666; font-size: 15px;">Subtotal</td>
                                    <td style="padding: 12px 0; color: #222; font-size: 15px; text-align: right;">$${subtotal}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 15px 0 0 0; color: #222; font-size: 17px; font-weight: 500; border-top: 2px solid #eeeeee;">Total</td>
                                    <td style="padding: 15px 0 0 0; color: #ff9700; font-size: 17px; font-weight: 600; text-align: right; border-top: 2px solid #eeeeee;">$${total}</td>
                                </tr>
                            </table>
                        </div>

                        <!-- Note -->
                        <div style="background: #fff8f0; padding: 20px 25px; border-left: 3px solid #ff9700;">
                            <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 0;">
                                We'll contact you to confirm your ${isDelivery ? 'delivery' : 'pickup'} time before your scheduled date.
                            </p>
                        </div>

                    </div>

                    <!-- Footer -->
                    <div style="background: #222; padding: 30px; text-align: center;">
                        <p style="color: #ffffff; font-size: 16px; margin: 0 0 5px 0; font-weight: 400; letter-spacing: 1px;">PRESSED BY J & H</p>
                        <p style="color: #999; font-size: 13px; margin: 0;">Fresh Juice, Fresh Life</p>
                    </div>

                </div>
                `;

				// Send email to customer
				await transporter.sendMail({
					from: `"Pressed By J & H" <${process.env.EMAIL_USER}>`,
					to: customerEmail,
					subject: `Order Confirmation - ${orderTypeText} Details Inside`,
					html: customerEmailHtml
				});

				// Send notification to business owner
				const businessNotificationHtml = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">

                    <!-- Header -->
                    <div style="background: #222; padding: 30px 30px 40px 30px; text-align: center; border-bottom: 4px solid #ff9700;">
                        <img src="${baseURL}/assets/img/branding/logo.png" alt="Pressed By J & H" style="height: 45px; margin-bottom: 20px;">
                        <h1 style="color: #ff9700; margin: 0; font-size: 24px; font-weight: 500; letter-spacing: 1px;">NEW ORDER RECEIVED</h1>
                        <p style="color: #999; font-size: 14px; margin: 10px 0 0 0;">${orderTypeText} • ${formattedPickupDate}</p>
                    </div>

                    <!-- Main Content -->
                    <div style="padding: 40px 30px; background: #fafafa;">

                        <!-- Order Items -->
                        <div style="background: #fff; padding: 30px; margin-bottom: 20px;">
                            <h2 style="color: #222; margin: 0 0 20px 0; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Order Items</h2>
                            <table style="width: 100%; border-collapse: collapse;">
                                ${orderItemsHtml}
                            </table>
                        </div>

                        <!-- Order Summary -->
                        <div style="background: #fff; padding: 25px; margin-bottom: 20px; border-left: 4px solid #ff9700;">
                            <div style="margin-bottom: 20px;">
                                <p style="color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 5px 0;">Order Total</p>
                                <p style="color: #222; font-size: 32px; font-weight: 600; margin: 0;">$${total}</p>
                            </div>
                            <div style="padding-top: 15px; border-top: 1px solid #eee;">
                                <p style="color: #666; font-size: 12px; margin: 0;">Session: ${session.id}</p>
                            </div>
                        </div>

                        <!-- Customer Contact -->
                        <div style="background: #fff; padding: 30px; margin-bottom: 20px;">
                            <h2 style="color: #222; margin: 0 0 20px 0; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Customer Contact</h2>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 10px 0; border-bottom: 1px solid #eeeeee; color: #666; font-size: 14px;">Name</td>
                                    <td style="padding: 10px 0; border-bottom: 1px solid #eeeeee; color: #222; font-size: 14px; text-align: right; font-weight: 500;">${customerName}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; border-bottom: 1px solid #eeeeee; color: #666; font-size: 14px;">Phone</td>
                                    <td style="padding: 10px 0; border-bottom: 1px solid #eeeeee; text-align: right;">
                                        <a href="tel:${customerPhone}" style="color: #ff9700; text-decoration: none; font-size: 14px; font-weight: 500;">${customerPhone}</a>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; border-bottom: 1px solid #eeeeee; color: #666; font-size: 14px;">Email</td>
                                    <td style="padding: 10px 0; border-bottom: 1px solid #eeeeee; text-align: right;">
                                        <a href="mailto:${customerEmail}" style="color: #ff9700; text-decoration: none; font-size: 14px;">${customerEmail}</a>
                                    </td>
                                </tr>
                            </table>
                        </div>

                        ${
							isDelivery
								? `
                        <!-- Delivery Information -->
                        <div style="background: #fff; padding: 30px; margin-bottom: 20px;">
                            <h3 style="color: #222; margin: 0 0 20px 0; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Delivery Address</h3>
                            <p style="color: #222; font-size: 16px; line-height: 1.6; margin: 0 0 12px 0; font-weight: 500;">
                                ${deliveryAddress}<br>
                                ${deliveryCity}, NJ ${deliveryZip}
                            </p>
                            <p style="color: #666; font-size: 13px; margin: 15px 0 0 0; padding-top: 15px; border-top: 1px solid #eee;">
                                Delivery Fee: $${deliveryFee}
                            </p>
                        </div>

                        <!-- Fulfilling Location -->
                        <div style="background: #f8f8f8; padding: 20px; margin-bottom: 20px;">
                            <p style="color: #999; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px 0;">Fulfilling From</p>
                            <p style="color: #222; font-size: 14px; margin: 0; font-weight: 500;">${locationName}</p>
                            <p style="color: #666; font-size: 13px; margin: 5px 0 0 0;">${locationAddress}</p>
                        </div>
                        `
								: `
                        <!-- Pickup Location -->
                        <div style="background: #fff; padding: 30px; margin-bottom: 20px;">
                            <h3 style="color: #222; margin: 0 0 20px 0; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Pickup Location</h3>
                            <p style="color: #222; font-size: 16px; margin: 0 0 8px 0; font-weight: 500;">${locationName}</p>
                            <p style="color: #666; font-size: 14px; line-height: 1.7; margin: 0;">
                                ${locationAddress}<br>
                                ${locationPhone}<br>
                                Hours: ${todaysHours}
                            </p>
                        </div>
                        `
						}

                        <!-- Action Note -->
                        <div style="background: #fffbf0; padding: 20px; border-left: 3px solid #ff9700;">
                            <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0;">
                                <strong style="color: #222;">Next Step:</strong> Contact the customer to confirm the ${isDelivery ? 'delivery' : 'pickup'} time.
                            </p>
                        </div>

                    </div>

                    <!-- Footer -->
                    <div style="background: #222; padding: 25px; text-align: center;">
                        <p style="color: #999; font-size: 12px; margin: 0;">Pressed By J & H Order System</p>
                    </div>

                </div>
                `;

				await transporter.sendMail({
					from: `"Order System" <${process.env.EMAIL_USER}>`,
					to: process.env.CONTACT_EMAIL,
					subject: `New ${orderTypeText} Order - ${locationName} - ${formattedPickupDate}`,
					html: businessNotificationHtml
				});

				// console.log(`Confirmation emails sent for order ${session.id}`);
			}
		}

		return {
			statusCode: 200,
			body: JSON.stringify({ received: true })
		};
	} catch (error) {
		console.error('Webhook error:', error);
		return {
			statusCode: 500,
			body: 'Webhook handler failed'
		};
	}
};
