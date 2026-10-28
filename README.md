# SiponPressed

Website for SiponPressed, Hunter's cold-pressed juice company in Philadelphia. It's a static site plus a few Netlify Functions for the menu, ordering, payments (Stripe) and an admin page.

## What's where

| Path | What it is |
| --- | --- |
| `index.html`, `juices.html`, `juice.html`, `about.html`, `contact.html`, `order.html`, `success.html` | Public pages. `juice.html` renders every `/juices/:slug` page (served by the `juice-page` function so each juice has its own share tags). |
| `admin.html` + `assets/js/admin/` | Hunter's admin at `/admin`: edit/add juices, edit the words and photos on every page, see orders, change the price and pickup/delivery settings. |
| `assets/js/shared/content.js` | Every piece of page text (and the few photos) Hunter can change in **Admin → Pages**, with its default. The HTML marks each spot with `data-copy="<key>"`. |
| `assets/js/shared/catalog.js` | The starting menu (Simply Orange, Green, Red) and default shop settings. |
| `assets/js/shared/order-rules.js` | Dates, minimums, delivery fee and pricing. Used by both the order page and the checkout function, so they always agree. |
| `netlify/functions/` | `catalog` (public menu, settings and Hunter's page text, which `site.js` fills into each page), `checkout` (Stripe Checkout), `stripe-webhook` (saves paid orders, sends emails), `delivery-check`, `contact`, `admin`, `images`, `order-summary`, `og` (share images), `juice-page`, `sitemap`. |
| `assets/js/shared/seo.js` | Page titles, descriptions, share tags and structured data. Baked into each page's `<head>` by `node scripts/bake-header.mjs`. |

Menu edits, settings, uploaded photos and orders are stored in **Netlify Blobs**, which every Netlify site has built in. There is no database to set up. Until something is saved in the admin, the defaults in `catalog.js` are used.

## Ordering rules (defaults, all editable in /admin → Settings)

- **$8 a bottle.** One shop-wide price (Menu page, or Settings → Price) that every juice uses, unless a juice is given its own price in its editor. Changing it reprices the cards, cart, checkout, emails and share images at once.
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

## Ingredient photos

**Admin → Ingredients** lists every ingredient (the ones on juices first) with its photo. Upload to replace a photo the site ships with, or to add one for a new ingredient; **Original** puts the site's photo back. There's one photo per ingredient (stored in settings as `ingredientPhotos`, keyed so "Oranges" and "orange" match) and it's used on every juice, card and page that shows that ingredient. Uploading a photo from an ingredient row in the juice editor saves to the same place.

## Editing page text

Sign in at `/admin` → **Pages**. Every heading, paragraph, button label and badge on the site is listed by page (or search for the words you see). Edited fields turn green and have an **Original** button to undo. Nothing changes on the site until **Save & publish**. Text can include fill-ins like `{price}` or `{deliveryDay}` that update themselves from the settings.

To make a new spot editable: add a field to `assets/js/shared/content.js`, then either put `data-copy="<key>"` on an element that holds only text in the HTML (its text must match the default; `npm test` checks) or read it with `t('<key>')` in the page's script.

## Adding a juice

Sign in at `/admin` → **Menu** → **Add a juice**. Upload a bottle photo (a PNG with the background removed looks best; remove.bg works well), add the ingredients one by one (tap an ingredient's photo to upload your own), fill in the nutrition, and save. The site, cart and checkout pick it up immediately. Use **Mark sold out** to pause a flavor without hiding it, or untick **Show on the site** to hide it.

## Link previews

The image a link shows when shared (iMessage, Instagram DMs, X, Slack…) is drawn on the fly from the live menu by the `og` function: `/og/home.png`, `/og/juices.png`, `/og/order.png`, `/og/about.png`, `/og/contact.png` and `/og/juices/<slug>.png`. Saving in the admin refreshes them. Apps cache previews on their side for a while; Facebook's [Sharing Debugger](https://developers.facebook.com/tools/debug/) and LinkedIn's [Post Inspector](https://www.linkedin.com/post-inspector/) can force a refresh.

Previews that play video use the short clips in `assets/videos/og/`. After changing the lineup, run `node scripts/make-og-videos.mjs` (needs ffmpeg) and commit the new clips. A juice without a clip just shows its image.
