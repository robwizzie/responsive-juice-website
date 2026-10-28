/**
 * Email via SMTP (nodemailer). For a Yahoo inbox use EMAIL_HOST=smtp.mail.yahoo.com,
 * EMAIL_PORT=465, EMAIL_USER=siponpressed@yahoo.com and a Yahoo "app password" as EMAIL_PASS.
 */
import nodemailer from 'nodemailer';
import { escapeHtml as e } from './http.js';
import { formatDate, formatMoney } from '../../../assets/js/shared/order-rules.js';

export const mailConfigured = () => Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);

let transporter;
function getTransporter() {
	const port = Number(process.env.EMAIL_PORT) || 465;
	transporter ??= nodemailer.createTransport({
		host: process.env.EMAIL_HOST,
		port,
		secure: port === 465,
		auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
	});
	return transporter;
}

export const ownerEmail = settings => process.env.CONTACT_EMAIL || settings.contactEmail;

export async function sendMail({ to, subject, html, replyTo }) {
	if (!mailConfigured()) {
		console.warn(`Email not configured; skipped "${subject}" to ${to}`);
		return false;
	}
	await getTransporter().sendMail({ from: `"SiponPressed" <${process.env.EMAIL_USER}>`, to, subject, html, replyTo });
	return true;
}

/* ---------- Templates ---------- */

const INK = '#111312';
const LIME = '#b6d43a';

function layout(siteUrl, body) {
	return `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:Helvetica,Arial,sans-serif;color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:${INK};padding:24px;text-align:center"><img src="${siteUrl}/assets/img/brand/logo-email.png" width="240" alt="SiponPressed" style="display:inline-block;width:240px;max-width:100%"></td></tr>
<tr><td style="padding:28px 28px 8px">${body}</td></tr>
<tr><td style="padding:20px 28px 28px;color:#6b6f6a;font-size:12px;line-height:1.6;border-top:1px solid #eeeae2">SiponPressed &middot; Cold-pressed juice made by Hunter in Philadelphia<br><a href="${siteUrl}" style="color:#6b6f6a">siponpressed.com</a> &middot; <a href="https://instagram.com/siponpressed" style="color:#6b6f6a">@siponpressed</a></td></tr>
</table></td></tr></table></body></html>`;
}

function itemsTable(order, siteUrl, images) {
	const rows = order.lines
		.map(
			line => `<tr>
<td width="44" style="padding:10px 0;border-bottom:1px solid #eeeae2">${images[line.slug] ? `<img src="${siteUrl}${images[line.slug]}" height="56" alt="" style="display:block;height:56px">` : ''}</td>
<td style="padding:10px 8px;border-bottom:1px solid #eeeae2;font-size:15px"><strong>${e(line.name)}</strong><br><span style="color:#6b6f6a;font-size:13px">${line.qty} &times; ${formatMoney(line.unit)}</span></td>
<td align="right" style="padding:10px 0;border-bottom:1px solid #eeeae2;font-size:15px">${formatMoney(line.amount)}</td></tr>`
		)
		.join('');
	const fee =
		order.type === 'delivery'
			? `<tr><td></td><td style="padding:8px;color:#6b6f6a">Delivery</td><td align="right" style="padding:8px 0;color:#6b6f6a">${order.deliveryFee ? formatMoney(order.deliveryFee) : 'Free'}</td></tr>`
			: '';
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">${rows}${fee}
<tr><td></td><td style="padding:10px 8px;font-weight:bold">Total</td><td align="right" style="padding:10px 0;font-weight:bold;font-size:17px">${formatMoney(order.total)}</td></tr></table>`;
}

const addressText = address => (address ? [address.line1, address.line2, `${address.city}, ${address.state} ${address.zip}`].filter(Boolean).map(e).join('<br>') : '');

function fulfilmentBlock(order, settings, forOwner) {
	const when = e(formatDate(order.date));
	if (order.type === 'delivery') {
		const zone = order.zoneCheck?.status === 'in' ? `${order.zoneCheck.miles} mi from ${e(order.zoneCheck.zone)}` : 'Distance not verified, double-check the address';
		return `<p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b6f6a">Monday delivery</p>
<p style="margin:0 0 12px;font-size:18px"><strong>${when}</strong></p>
<p style="margin:0;line-height:1.5">${addressText(order.address)}</p>${forOwner ? `<p style="margin:6px 0 0;font-size:13px;color:#6b6f6a">${zone}</p>` : ''}`;
	}
	return `<p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b6f6a">Pickup</p>
<p style="margin:0 0 12px;font-size:18px"><strong>${when}</strong></p>
<p style="margin:0;line-height:1.5">${e(settings.pickup.area)}${forOwner ? '' : `<br>${e(settings.pickup.details)}`}</p>`;
}

const box = inner => `<div style="background:#f7f5f0;border-radius:12px;padding:16px 18px;margin:16px 0">${inner}</div>`;

export function customerConfirmation(order, settings, siteUrl, images) {
	const first = e(order.customer.name.split(' ')[0]);
	return layout(
		siteUrl,
		`<h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:26px">Thanks, ${first}!</h1>
<p style="margin:0;line-height:1.6;color:#3d413c">Your order is in. Everything is pressed fresh for your ${order.type === 'delivery' ? 'delivery' : 'pickup'} day.</p>
${box(fulfilmentBlock(order, settings, false))}
${itemsTable(order, siteUrl, images)}
<p style="line-height:1.6;color:#3d413c">Keep your juice refrigerated and shake well before sipping. Questions? Just reply to this email.</p>
<p style="margin:16px 0 0;font-family:Georgia,serif;font-style:italic;font-size:18px">Embrace the sip.<br><span style="font-style:normal;font-size:14px;color:${INK}">&mdash; Hunter</span></p>`
	);
}

export function ownerNotification(order, settings, siteUrl, images) {
	const c = order.customer;
	return layout(
		siteUrl,
		`<p style="margin:0 0 4px;display:inline-block;background:${LIME};color:${INK};font-size:12px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;padding:4px 10px;border-radius:99px">New ${order.type} order</p>
<h1 style="margin:12px 0 4px;font-family:Georgia,serif;font-size:24px">${e(c.name)} &middot; ${order.lines.reduce((n, l) => n + l.qty, 0)} bottles</h1>
<p style="margin:0;line-height:1.6"><a href="mailto:${e(c.email)}" style="color:${INK}">${e(c.email)}</a> &middot; <a href="tel:${e(c.phone)}" style="color:${INK}">${e(c.phone)}</a></p>
${box(fulfilmentBlock(order, settings, true))}
${order.notes ? box(`<p style="margin:0 0 4px;font-size:13px;color:#6b6f6a">Customer note</p><p style="margin:0;white-space:pre-wrap">${e(order.notes)}</p>`) : ''}
${itemsTable(order, siteUrl, images)}
<p style="font-size:13px;color:#6b6f6a">Paid with Stripe. All orders are listed at <a href="${siteUrl}/admin#orders" style="color:${INK}">${siteUrl.replace(/^https?:\/\//, '')}/admin</a>.</p>`
	);
}

export function contactMessage({ name, email, message, topic }, siteUrl) {
	return layout(
		siteUrl,
		`<p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b6f6a">${e(topic || 'Website message')}</p>
<h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:22px">${e(name)}</h1>
<p style="margin:0 0 16px"><a href="mailto:${e(email)}" style="color:${INK}">${e(email)}</a></p>
${box(`<p style="margin:0;white-space:pre-wrap;line-height:1.6">${e(message)}</p>`)}
<p style="font-size:13px;color:#6b6f6a">Reply to this email to answer ${e(name.split(' ')[0])} directly.</p>`
	);
}
