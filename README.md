# SiponPressed

Website for SiponPressed, Hunter's cold-pressed juice company in Philadelphia. It's a static site plus a few Netlify Functions for the menu, ordering, payments (Stripe) and an admin page.

## What's where

| Path | What it is |
| --- | --- |
| `index.html`, `juices.html`, `juice.html`, `about.html`, `contact.html`, `order.html`, `success.html` | Public pages. `juice.html` renders every `/juices/:slug` page. |
| `admin.html` + `assets/js/admin/` | Hunter's admin at `/admin`: edit/add juices, see orders, change pickup and delivery settings. |
| `assets/js/shared/catalog.js` | The starting menu (Simply Orange, Green, Red) and default shop settings. |
| `assets/js/shared/order-rules.js` | Dates, minimums, delivery fee and pricing. Used by both the order page and the checkout function, so they always agree. |
| `netlify/functions/` | `catalog` (public menu), `checkout` (Stripe Checkout), `stripe-webhook` (saves paid orders, sends emails), `delivery-check`, `contact`, `admin`, `images`, `order-summary`. |

Menu edits, settings, uploaded photos and orders are stored in **Netlify Blobs**, which every Netlify site has built in. There is no database to set up. Until something is saved in the admin, the defaults in `catalog.js` are used.

## Ordering rules (defaults, all editable in /admin → Ordering & settings)

- **Pickup** in Philadelphia, Monday to Saturday, with 2 days notice. No minimum. The exact spot is sent in the confirmation email ("Pickup instructions").
- **Monday delivery** within 30 miles of Blackwood or Woodbury, NJ (the same area as before). 6 bottle minimum, $7 fee, free over $50, orders close at the end of Thursday.
- Prices are always recalculated on the server from the saved menu; the browser can't change them.
- Delivery addresses are checked with the free US Census geocoder. If it's down the order still goes through and the email flags the address for Hunter to check.

## Netlify setup

Add these under **Site configuration → Environment variables**, then redeploy:

| Variable | Needed for | Notes |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Admin sign in | Pick a long password and give it to Hunter. Changing it signs everyone out. |
| `STRIPE_SECRET_KEY` | Payments | Live secret key (`sk_live_...`) from Stripe → Developers → API keys. |
| `STRIPE_WEBHOOK_SECRET` | Order confirmations | See below. |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` | Order + contact emails | For Yahoo: `smtp.mail.yahoo.com`, `465`, `siponpressed@yahoo.com`, and a Yahoo **app password** (Account security → Generate app password), not the normal password. |
| `CONTACT_EMAIL` | Optional | Where order and contact emails go. Defaults to the email in admin settings (siponpressed@yahoo.com). |
| `STRIPE_SECRET_KEY_TEST` | Optional | Used instead of the live key when running locally. |
| `ADMIN_SESSION_SECRET` | Optional | Extra secret for signing admin sessions. |
| `GOOGLE_MAPS_API_KEY` | Optional | Backup geocoder for delivery addresses (needs the Geocoding API enabled). |

**Stripe webhook:** in Stripe → Developers → Webhooks, add an endpoint at `https://siponpressed.com/webhook/stripe` (the same address the old site used) listening for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.

The functions need Node 22, which `netlify.toml` sets.

## Running locally

```bash
npm install
echo "ADMIN_PASSWORD=pick-something" > .env   # plus any Stripe/email keys you want to test
npm run dev                                   # http://localhost:8888
npm test
```

`npm run dev` serves the site, applies `_redirects`, runs the functions and keeps Blobs data in `.netlify/dev-blobs`. `netlify dev` works too.

## Adding a juice

Sign in at `/admin` → **Menu** → **Add a juice**. Upload a bottle photo (a PNG with the background removed looks best; remove.bg works well), fill in the ingredients and nutrition, and save. The site, cart and checkout pick it up immediately. Use **Mark sold out** to pause a flavor without hiding it, or untick **Show on the site** to hide it.
