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
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #ff9700; margin-bottom: 10px;">Order Confirmed!</h1>
                        <p style="color: #666; font-size: 18px;">Thank you for your order with Pressed By J & H</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                        <h2 style="color: #333; margin-top: 0;">${orderTypeIcon} ${orderTypeText} Details</h2>
                        <p><strong>Customer:</strong> ${customerName}</p>
                        <p><strong>Phone:</strong> ${customerPhone}</p>
                        <p><strong>${orderTypeText} Date:</strong> ${formattedPickupDate}</p>
                        
                        ${
							isDelivery
								? `
                        <div style="margin: 15px 0; padding: 15px; background: white; border-radius: 8px; border: 1px solid #e0e0e0;">
                            <h3 style="color: #28a745; margin-top: 0; margin-bottom: 10px;">🚚 Delivery Address</h3>
                            <p style="margin: 5px 0;"><strong>📍 Address:</strong> ${deliveryAddress}</p>
                            <p style="margin: 5px 0;"><strong>🏙️ City:</strong> ${deliveryCity}</p>
                            <p style="margin: 5px 0;"><strong>📮 ZIP Code:</strong> ${deliveryZip}</p>
                            <p style="margin: 5px 0;"><strong>💰 Delivery Fee:</strong> $${deliveryFee}</p>
                        </div>
                        `
								: `
                        <div style="margin: 15px 0; padding: 15px; background: white; border-radius: 8px; border: 1px solid #e0e0e0;">
                            <h3 style="color: #ff9700; margin-top: 0; margin-bottom: 10px;">${locationName} Location</h3>
                            <p style="margin: 5px 0;"><strong>📍 Address:</strong> ${locationAddress}</p>
                            <p style="margin: 5px 0;"><strong>📞 Phone:</strong> <a href="tel:${locationPhone}" style="color: #ff9700; text-decoration: none;">${locationPhone}</a></p>
                            <p style="margin: 5px 0;"><strong>🏢 Details:</strong> ${locationDescription}</p>
                            <p style="margin: 5px 0;"><strong>🕒 Today's Hours:</strong> ${todaysHours}</p>
                        </div>
                        `
						}
                        
                        <p style="margin-top: 15px;"><strong>📞 We'll call you</strong> to confirm the exact ${isDelivery ? 'delivery' : 'pickup'} time before your scheduled date.</p>
                    </div>
                    
                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ff9700; margin-bottom: 20px;">
                        <p style="margin: 0; color: #856d03;"><strong>Important:</strong> ${isDelivery ? 'Please ensure someone is available at the delivery address on the scheduled date.' : 'Please bring this confirmation email when picking up your order.'}</p>
                    </div>
                    
                    <div style="border: 1px solid #ddd; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                        <h3 style="color: #333; margin-top: 0;">Order Summary</h3>
                        <div style="border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px;">
                            <div style="display: flex; justify-content: space-between;">
                                <span>Subtotal:</span>
                                <span>$${subtotal}</span>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 18px;">
                            <span>Total Paid:</span>
                            <span style="color: #ff9700;">$${total}</span>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <p style="color: #666;">Questions about your order?</p>
                        <p style="color: #666;">Reply to this email or contact us directly</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                        <p style="color: #999; font-size: 12px;">Pressed By J & H - Fresh Juice, Fresh Life</p>
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
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #ff9700;">New ${orderTypeText} Order Received!</h2>
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 10px;">
                        <h3 style="color: #333; margin-top: 0;">Customer Details</h3>
                        <p><strong>Name:</strong> ${customerName}</p>
                        <p><strong>Email:</strong> ${customerEmail}</p>
                        <p><strong>Phone:</strong> ${customerPhone}</p>
                        
                        <h3 style="color: #333; margin-top: 20px;">${orderTypeText} Information</h3>
                        <p><strong>Date:</strong> ${formattedPickupDate}</p>
                        <p><strong>Order Type:</strong> ${orderTypeText}</p>
                        
                        ${
							isDelivery
								? `
                        <div style="margin: 15px 0; padding: 15px; background: white; border-radius: 8px; border: 1px solid #e0e0e0;">
                            <h4 style="color: #28a745; margin-top: 0; margin-bottom: 10px;">🚚 Delivery Address</h4>
                            <p style="margin: 5px 0;"><strong>Address:</strong> ${deliveryAddress}</p>
                            <p style="margin: 5px 0;"><strong>City:</strong> ${deliveryCity}</p>
                            <p style="margin: 5px 0;"><strong>ZIP Code:</strong> ${deliveryZip}</p>
                            <p style="margin: 5px 0;"><strong>Delivery Fee:</strong> $${deliveryFee}</p>
                        </div>
                        <p><strong>Location:</strong> ${locationName} - ${locationDescription}</p>
                        <p><strong>Location Address:</strong> ${locationAddress}</p>
                        <p><strong>Location Phone:</strong> ${locationPhone}</p>
                        `
								: `
                        <p><strong>Location:</strong> ${locationName} - ${locationDescription}</p>
                        <p><strong>Address:</strong> ${locationAddress}</p>
                        <p><strong>Location Phone:</strong> ${locationPhone}</p>
                        <p><strong>Today's Hours:</strong> ${todaysHours}</p>
                        `
						}
                        
                        <h3 style="color: #333; margin-top: 20px;">Order Details</h3>
                        <p><strong>Order Total:</strong> $${total}</p>
                        <p><strong>Session ID:</strong> ${session.id}</p>
                    </div>
                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ff9700; margin-top: 20px;">
                        <p style="margin: 0; color: #856d03;"><strong>Action Required:</strong> ${isDelivery ? 'Contact the customer to confirm delivery time and prepare for delivery.' : 'Reply to the customer with the exact pickup address and time confirmation.'}</p>
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
