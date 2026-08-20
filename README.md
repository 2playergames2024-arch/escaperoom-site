Escape Room Mystery Website

Production website and custom booking flow for Escape Room Mystery.

Locations:

King of Prussia, Pennsylvania

Cherry Hill, New Jersey

The site is built with Next.js App Router and deployed on Vercel.

Tech Stack

Next.js 16

React

TypeScript

Tailwind CSS

Vercel

Bookeo API

Authorize.Net Accept Hosted

Upstash Redis

Resend

Local Development

Install dependencies:

npm install

On Windows PowerShell, if the normal npm command is blocked by execution policy, use:

npm.cmd install

Run the development server:

npm.cmd run dev

Open:

http://localhost:3000

Production build:

npm.cmd run build

Environment Variables

The application requires the following environment variables in production.

Bookeo

BOOKEO_KOP_API_KEY
BOOKEO_CH_API_KEY
BOOKEO_SECRET_KEY

Authorize.Net

AUTHORIZE_LOGIN_ID
AUTHORIZE_TRANSACTION_KEY
AUTHORIZE_SIGNATURE_KEY
AUTHORIZE_ENVIRONMENT

AUTHORIZE_ENVIRONMENT must be production or sandbox.

For the live Escape Room Mystery hostname, AUTHORIZE_ENVIRONMENT must be production. Sandbox is reserved for local, preview, or staging deployments that do not use the live production hostname.

Site URL

SITE_URL

Production value:

https://escaperoommystery.com

SITE_URL must be a clean HTTPS origin in production. Do not include a path, query string, fragment, username, or password.

Do not use obsolete Vercel deployment URLs as the production SITE_URL.

Redis

UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN

The application uses Redis.fromEnv(), so these exact Upstash REST variable names are required.

Legacy names such as KV_REST_API_URL, KV_REST_API_TOKEN, or REDIS_URL do not replace the required Upstash REST variables.

Email

RESEND_API_KEY

Administrative Recovery

ADMIN_RECOVERY_SECRET

This protects the orphan-payment recovery administration endpoints.

Never commit actual environment-variable values or secrets to Git.

Project Structure

Important application areas:

app/
├── api/
│   ├── admin/
│   │   └── orphans/
│   ├── authorize/
│   ├── bookeo/
│   ├── booking-session/
│   └── contact/
├── book/
│   ├── details/
│   ├── payment/
│   └── confirm/
├── components/
├── data/
├── gift-vouchers/
├── lib/
└── locations/

Central Location and Room Configuration

Location and room business data is centralized in:

app/data/locations.ts

This includes location slugs, addresses, routes, Bookeo room product IDs, room pricing, player minimums, Saturday minimums, maximum players, tax rates, and the Bookeo participant category.

Do not duplicate Bookeo product IDs or booking rules elsewhere unless there is a specific technical reason.

Room Detail Content

Shared room-detail content is maintained in:

app/data/roomDetails.ts

Room pages use the shared room-detail component rather than maintaining duplicate full page implementations.

Booking Flow

The customer booking flow is:

Location booking page
        ↓
Bookeo availability
        ↓
Bookeo hold
        ↓
Booking session stored in Redis
        ↓
Customer details
        ↓
Payment review
        ↓
Authorize.Net Accept Hosted
        ↓
Independent payment verification
        ↓
Bookeo finalization
        ↓
Confirmation

The browser should not be trusted as the source of booking price, room, player count, or payment status.

Trusted booking information is stored server-side and carried through the flow using the booking session ID.

Bookeo Holds

Bookeo holds are created through:

app/api/bookeo/hold/route.ts

Important rules:

product IDs are validated against centralized room configuration

booking location is validated

player counts are validated server-side

Saturday minimum-player requirements are enforced server-side

Bookeo price information is treated as the trusted payment source

Bookeo credentials are sent in request headers

Availability

Availability is retrieved through:

app/api/bookeo/availability/route.ts

The endpoint validates location, room/product ID, calendar date, and past dates.

Only known rooms for the selected location may be queried.

Booking Sessions

Booking sessions are stored in Upstash Redis.

The browser proceeds through the booking flow using an opaque session ID rather than repeatedly sending trusted booking data.

Session IDs use the application's ERM-... UUID format.

Shared validation and booking-domain types are located in:

app/lib/booking.ts

Authorize.Net

Payment initialization is handled by:

app/api/authorize/hosted-payment/route.ts

Authorize.Net Accept Hosted is used rather than collecting card information directly on the website.

The hosted-payment endpoint receives only the booking session ID from the browser and reloads trusted booking information server-side.

Payment verification is handled separately before Bookeo finalization.

Payment Finalization

After Authorize.Net payment is independently verified, the site finalizes the existing Bookeo hold.

Finalization is handled by:

app/api/bookeo/finalize/route.ts

The route includes verified-payment requirements, idempotency protection, Redis locking, external-request timeout handling, and duplicate-finalization protection.

A Bookeo timeout or network interruption after payment is not assumed to mean that Bookeo failed.

Because Bookeo may have received the request before the connection failed, uncertain finalization results enter the orphan-payment recovery system.

Orphan Payment Recovery

A customer may occasionally have a successfully captured Authorize.Net payment without a confirmed Bookeo booking.

These cases are stored as orphan payments in Redis.

Administrative endpoints:

GET /api/admin/orphans
POST /api/admin/orphans/reconcile
POST /api/admin/orphans/recover

These endpoints are protected by:

ADMIN_RECOVERY_SECRET

Reconciliation

Reconciliation checks Bookeo for evidence that the booking was already created.

It does not blindly create another booking.

Recovery

Recovery is allowed only after reconciliation has confirmed that no matching Bookeo booking exists.

This is intended to prevent duplicate bookings after uncertain network or timeout conditions.

Do not remove or bypass the reconciliation requirement.

Rate Limiting

Sensitive and externally connected API routes use Redis-based rate limiting.

Different endpoints intentionally use different limits depending on their purpose, including availability, holds, hosted payment, payment verification, finalization, booking sessions, and administrative recovery.

Do not globally replace these with a single shared number without reviewing endpoint behavior.

External Request Timeouts

Bookeo and Authorize.Net calls use request timeouts.

Timeout behavior is intentionally different depending on the operation.

In particular:

a failed availability request can normally be retried

a timeout during post-payment Bookeo finalization is an uncertain state and must not be blindly retried

Gift Vouchers

Gift voucher pages:

/gift-vouchers/details
/gift-vouchers/checkout

The two locations use separate Bookeo voucher widgets.

Static widget files:

public/bookeo-gift-kop.html
public/bookeo-gift-ch.html

These files intentionally contain the corresponding Bookeo voucher account IDs.

Do not consolidate both widgets into one account ID.

Contact Form

The contact form posts to:

/api/contact

Email delivery uses Resend.

SEO

Important SEO files:

app/layout.tsx
app/robots.ts
app/sitemap.ts

The site includes global metadata, canonical URLs, Open Graph metadata, Twitter metadata, location metadata, room metadata, LocalBusiness structured data, a sitemap, and robots rules.

Transactional booking pages are intentionally configured as noindex.

Do not add booking/payment URLs to the sitemap.

Security Headers

Security headers and Content Security Policy are configured in:

next.config.ts

The CSP intentionally permits the Authorize.Net hosted-payment endpoints for both production and sandbox environments.

Changes to the CSP should be tested against the payment flow before deployment.

Production Environment Validation

Production builds validate critical environment variables.

A deployment should fail rather than silently start with missing booking/payment infrastructure.

When adding a new required production service, update environment validation accordingly.

Legacy Architecture

The previous Sanity CMS architecture has been removed.

Do not reintroduce:

sanity.config.ts
sanity.cli.ts
sanity-studio/
app/lib/sanity.ts
app/rooms/

unless the architecture is intentionally being redesigned.

Important Development Rules

Before making booking-related changes:

Treat app/data/locations.ts as the primary location and room configuration.

Never trust booking prices supplied by the browser.

Never trust browser-supplied payment status.

Do not blindly retry an uncertain Bookeo finalization.

Preserve idempotency and Redis locking.

Preserve the orphan reconciliation/recovery process.

Keep Bookeo API credentials in headers.

Never expose secrets in client code.

Do not run destructive dependency upgrades immediately before launch without reviewing the changes.

Run a production build before deployment.

Pre-Deployment Check

At minimum, run:

npm.cmd run build

The production build should complete with successful compilation, TypeScript validation, page generation, and no build errors.

Before launch, also verify the complete booking flow for both locations, including a real payment test and Bookeo booking finalization.

Deployment

The application is deployed through Vercel.

Before deploying production changes:

verify required Vercel environment variables

confirm SITE_URL is the canonical production origin

confirm AUTHORIZE_ENVIRONMENT=production for the live hostname

confirm Bookeo credentials

confirm Redis credentials

run a clean production build

test the booking/payment flow after deployment