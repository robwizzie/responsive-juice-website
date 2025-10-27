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
				const orderTypeIcon = isDelivery ? '🚚' : '📍';

				const customerEmailHtml = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                    <!-- Header with gradient -->
                    <div style="background: linear-gradient(135deg, #ff9700, #ff7700); padding: 40px 20px; text-align: center; border-radius: 0;">
                        <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 32px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">✓ Order Confirmed!</h1>
                        <p style="color: #ffffff; font-size: 18px; margin: 0; opacity: 0.95;">Thank you for your order with Pressed By J & H</p>
                    </div>

                    <!-- Main content -->
                    <div style="padding: 30px 20px;">
                    
                    <!-- Order Details Card -->
                    <div style="background: #ffffff; padding: 25px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e8e8e8;">
                        <h2 style="color: #ff9700; margin: 0 0 20px 0; font-size: 24px; border-bottom: 2px solid #ff9700; padding-bottom: 10px;">${orderTypeIcon} ${orderTypeText} Details</h2>

                        <div style="margin-bottom: 20px;">
                            <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong style="color: #555;">Customer:</strong> ${customerName}</p>
                            <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong style="color: #555;">Phone:</strong> ${customerPhone}</p>
                            <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong style="color: #555;">${orderTypeText} Date:</strong> ${formattedPickupDate}</p>
                        </div>

                        ${
							isDelivery
								? `
                        <!-- Delivery Address Card -->
                        <div style="margin: 20px 0 0 0; padding: 20px; background: linear-gradient(135deg, #f0fdf4, #dcfce7); border-radius: 10px; border-left: 4px solid #22c55e;">
                            <h3 style="color: #15803d; margin: 0 0 15px 0; font-size: 18px; display: flex; align-items: center;">
                                <span style="font-size: 24px; margin-right: 8px;">🚚</span>
                                Delivery Address
                            </h3>
                            <div style="background: white; padding: 15px; border-radius: 8px; margin-top: 10px;">
                                <p style="margin: 8px 0; color: #333; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #555; display: inline-block; width: 100px;">📍 Address:</strong>
                                    <span style="color: #111;">${deliveryAddress}</span>
                                </p>
                                <p style="margin: 8px 0; color: #333; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #555; display: inline-block; width: 100px;">🏙️ City:</strong>
                                    <span style="color: #111;">${deliveryCity}</span>
                                </p>
                                <p style="margin: 8px 0; color: #333; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #555; display: inline-block; width: 100px;">📮 ZIP Code:</strong>
                                    <span style="color: #111;">${deliveryZip}</span>
                                </p>
                                <p style="margin: 8px 0; color: #333; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #555; display: inline-block; width: 100px;">💰 Delivery Fee:</strong>
                                    <span style="color: #22c55e; font-weight: bold;">$${deliveryFee}</span>
                                </p>
                            </div>
                        </div>
                        `
								: `
                        <!-- Pickup Location Card -->
                        <div style="margin: 20px 0 0 0; padding: 20px; background: linear-gradient(135deg, #fff7ed, #ffedd5); border-radius: 10px; border-left: 4px solid #ff9700;">
                            <h3 style="color: #c2410c; margin: 0 0 15px 0; font-size: 18px; display: flex; align-items: center;">
                                <span style="font-size: 24px; margin-right: 8px;">📍</span>
                                ${locationName} Location
                            </h3>
                            <div style="background: white; padding: 15px; border-radius: 8px; margin-top: 10px;">
                                <p style="margin: 8px 0; color: #333; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #555; display: inline-block; min-width: 90px;">📍 Address:</strong>
                                    <span style="color: #111;">${locationAddress}</span>
                                </p>
                                <p style="margin: 8px 0; color: #333; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #555; display: inline-block; min-width: 90px;">📞 Phone:</strong>
                                    <a href="tel:${locationPhone}" style="color: #ff9700; text-decoration: none; font-weight: 500;">${locationPhone}</a>
                                </p>
                                <p style="margin: 8px 0; color: #333; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #555; display: inline-block; min-width: 90px;">🏢 Details:</strong>
                                    <span style="color: #111;">${locationDescription}</span>
                                </p>
                                <p style="margin: 8px 0; color: #333; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #555; display: inline-block; min-width: 90px;">🕒 Hours:</strong>
                                    <span style="color: #111;">${todaysHours}</span>
                                </p>
                            </div>
                        </div>
                        `
						}
                    </div>

                    <!-- Important Notice -->
                    <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); padding: 18px 20px; border-radius: 10px; border-left: 4px solid #ff9700; margin-bottom: 20px;">
                        <p style="margin: 0; color: #92400e; font-size: 15px; line-height: 1.6;">
                            <strong style="font-size: 16px;">📞 We'll call you</strong><br>
                            <span style="font-size: 14px;">to confirm the exact ${isDelivery ? 'delivery' : 'pickup'} time before your scheduled date.</span>
                        </p>
                    </div>

                    <!-- Additional Notice -->
                    <div style="background: linear-gradient(135deg, #fff3e0, #ffe0b2); padding: 15px 18px; border-radius: 8px; border-left: 4px solid #f57c00; margin-bottom: 20px;">
                        <p style="margin: 0; color: #e65100; font-size: 14px; line-height: 1.5;">
                            <strong>📋 Important:</strong> ${isDelivery ? 'Please ensure someone is available at the delivery address on the scheduled date.' : 'Please bring this confirmation email when picking up your order.'}
                        </p>
                    </div>

                    <!-- Order Summary -->
                    <div style="background: #ffffff; padding: 25px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e8e8e8;">
                        <h3 style="color: #333; margin: 0 0 20px 0; font-size: 20px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">💰 Order Summary</h3>
                        <div style="padding: 15px 0; border-bottom: 2px dashed #e0e0e0; margin-bottom: 15px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <span style="color: #666; font-size: 15px;">Subtotal:</span>
                                <span style="color: #333; font-size: 15px; font-weight: 500;">$${subtotal}</span>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0;">
                            <span style="color: #333; font-weight: bold; font-size: 20px;">Total Paid:</span>
                            <span style="color: #ff9700; font-weight: bold; font-size: 24px;">$${total}</span>
                        </div>
                    </div>

                    <!-- Questions Section -->
                    <div style="background: linear-gradient(135deg, #f8f9fa, #e9ecef); padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
                        <p style="color: #495057; margin: 0 0 8px 0; font-size: 16px; font-weight: 500;">❓ Questions about your order?</p>
                        <p style="color: #6c757d; margin: 0; font-size: 14px;">Reply to this email or contact us directly</p>
                    </div>

                    </div>

                    <!-- Footer -->
                    <div style="background: linear-gradient(135deg, #ff9700, #ff7700); padding: 25px 20px; text-align: center;">
                        <p style="color: #ffffff; font-size: 16px; margin: 0; font-weight: 500; opacity: 0.95;">🍊 Pressed By J & H</p>
                        <p style="color: #ffffff; font-size: 13px; margin: 5px 0 0 0; opacity: 0.85;">Fresh Juice, Fresh Life</p>
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
                    <!-- Header with gradient -->
                    <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 35px 20px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 28px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">🔔 New ${orderTypeText} Order!</h1>
                        <p style="color: #ffffff; font-size: 16px; margin: 0; opacity: 0.95;">Order Received - Action Required</p>
                    </div>

                    <!-- Main content -->
                    <div style="padding: 30px 20px;">

                    <!-- Customer Details Card -->
                    <div style="background: #ffffff; padding: 25px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e8e8e8;">
                        <h2 style="color: #dc2626; margin: 0 0 20px 0; font-size: 22px; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">👤 Customer Details</h2>
                        <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong style="color: #555;">Name:</strong> ${customerName}</p>
                        <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong style="color: #555;">Email:</strong> <a href="mailto:${customerEmail}" style="color: #dc2626; text-decoration: none;">${customerEmail}</a></p>
                        <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong style="color: #555;">Phone:</strong> <a href="tel:${customerPhone}" style="color: #dc2626; text-decoration: none; font-weight: 500;">${customerPhone}</a></p>
                    </div>

                    <!-- Order Information Card -->
                    <div style="background: #ffffff; padding: 25px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e8e8e8;">
                        <h2 style="color: #ff9700; margin: 0 0 20px 0; font-size: 22px; border-bottom: 2px solid #ff9700; padding-bottom: 10px;">${orderTypeIcon} ${orderTypeText} Information</h2>
                        <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong style="color: #555;">Date:</strong> ${formattedPickupDate}</p>
                        <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong style="color: #555;">Order Type:</strong> <span style="background: ${isDelivery ? '#dcfce7' : '#fed7aa'}; color: ${isDelivery ? '#15803d' : '#c2410c'}; padding: 4px 12px; border-radius: 12px; font-weight: 500;">${orderTypeText}</span></p>

                        ${
							isDelivery
								? `
                        <!-- Delivery Details -->
                        <div style="margin: 20px 0 0 0; padding: 20px; background: linear-gradient(135deg, #f0fdf4, #dcfce7); border-radius: 10px; border-left: 4px solid #22c55e;">
                            <h3 style="color: #15803d; margin: 0 0 15px 0; font-size: 18px;">🚚 Delivery Address</h3>
                            <div style="background: white; padding: 15px; border-radius: 8px;">
                                <p style="margin: 8px 0; color: #333; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #555; display: inline-block; width: 110px;">📍 Address:</strong>
                                    <span style="color: #111; font-weight: 500;">${deliveryAddress}</span>
                                </p>
                                <p style="margin: 8px 0; color: #333; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #555; display: inline-block; width: 110px;">🏙️ City:</strong>
                                    <span style="color: #111;">${deliveryCity}</span>
                                </p>
                                <p style="margin: 8px 0; color: #333; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #555; display: inline-block; width: 110px;">📮 ZIP Code:</strong>
                                    <span style="color: #111;">${deliveryZip}</span>
                                </p>
                                <p style="margin: 8px 0; color: #333; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #555; display: inline-block; width: 110px;">💰 Delivery Fee:</strong>
                                    <span style="color: #22c55e; font-weight: bold;">$${deliveryFee}</span>
                                </p>
                            </div>
                        </div>

                        <!-- Fulfilling Location -->
                        <div style="margin: 15px 0 0 0; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 3px solid #6c757d;">
                            <h4 style="color: #495057; margin: 0 0 10px 0; font-size: 16px;">🏪 Fulfilling Location</h4>
                            <p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>Location:</strong> ${locationName}</p>
                            <p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>Details:</strong> ${locationDescription}</p>
                            <p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>Address:</strong> ${locationAddress}</p>
                            <p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>Phone:</strong> ${locationPhone}</p>
                        </div>
                        `
								: `
                        <!-- Pickup Location -->
                        <div style="margin: 20px 0 0 0; padding: 20px; background: linear-gradient(135deg, #fff7ed, #ffedd5); border-radius: 10px; border-left: 4px solid #ff9700;">
                            <h3 style="color: #c2410c; margin: 0 0 15px 0; font-size: 18px;">📍 Pickup Location</h3>
                            <div style="background: white; padding: 15px; border-radius: 8px;">
                                <p style="margin: 8px 0; color: #333; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #555; display: inline-block; min-width: 90px;">Location:</strong>
                                    <span style="color: #111; font-weight: 500;">${locationName}</span>
                                </p>
                                <p style="margin: 8px 0; color: #333; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #555; display: inline-block; min-width: 90px;">Details:</strong>
                                    <span style="color: #111;">${locationDescription}</span>
                                </p>
                                <p style="margin: 8px 0; color: #333; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #555; display: inline-block; min-width: 90px;">Address:</strong>
                                    <span style="color: #111;">${locationAddress}</span>
                                </p>
                                <p style="margin: 8px 0; color: #333; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #555; display: inline-block; min-width: 90px;">Phone:</strong>
                                    <span style="color: #111;">${locationPhone}</span>
                                </p>
                                <p style="margin: 8px 0; color: #333; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #555; display: inline-block; min-width: 90px;">Hours:</strong>
                                    <span style="color: #111;">${todaysHours}</span>
                                </p>
                            </div>
                        </div>
                        `
						}
                    </div>

                    <!-- Order Details Card -->
                    <div style="background: #ffffff; padding: 25px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e8e8e8;">
                        <h2 style="color: #333; margin: 0 0 20px 0; font-size: 22px; border-bottom: 2px solid #e8e8e8; padding-bottom: 10px;">📦 Order Details</h2>
                        <p style="margin: 12px 0; color: #333; font-size: 16px;"><strong style="color: #555;">Order Total:</strong> <span style="color: #22c55e; font-weight: bold; font-size: 18px;">$${total}</span></p>
                        <p style="margin: 8px 0; color: #666; font-size: 13px;"><strong>Session ID:</strong> <code style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${session.id}</code></p>
                    </div>

                    <!-- Action Required Alert -->
                    <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); padding: 20px; border-radius: 10px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
                        <p style="margin: 0; color: #92400e; font-size: 15px; line-height: 1.6;">
                            <strong style="font-size: 17px;">⚠️ Action Required:</strong><br>
                            <span style="font-size: 14px; margin-top: 8px; display: inline-block;">${isDelivery ? 'Contact the customer to confirm delivery time and prepare for delivery.' : 'Reply to the customer with the exact pickup time confirmation.'}</span>
                        </p>
                    </div>

                    </div>

                    <!-- Footer -->
                    <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 20px; text-align: center;">
                        <p style="color: #ffffff; font-size: 14px; margin: 0; opacity: 0.9;">🍊 Pressed By J & H - Order Management System</p>
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
