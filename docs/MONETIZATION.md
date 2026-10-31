# Monetization

TaskFlow stays local-first: there is no account backend, and the app never sees
your users' tasks. Paid access is delivered with **cryptographically signed
license keys** that the app verifies offline. You (the seller) hold the private
key; the app ships only the public key, so nobody can mint working keys from the
bundle.

## Pricing

| Plan | Price | Term | Notes |
|---|---|---|---|
| Monthly | $10 | 32 days | Default plan |
| Annual | $72 | 366 days | "Save 40% vs monthly" |
| Lifetime | $149 | never expires | De-emphasized in the UI |

Free is capped at **40 active tasks** and **3 projects**. Pro unlocks Goals,
Routines, weekly review, weekly-pulse analytics, and Plan my day. A one-time
**7-day trial** is offered at onboarding and in the paywall.

## How fulfillment works (no server)

```
buyer clicks Subscribe ─▶ opens your payment link (Stripe / Razorpay)
        │
        ▼
you receive the payment notification / receipt
        │
        ▼
you run:  node scripts/issue-license.mjs --plan monthly --email buyer@example.com
        │
        ▼
you email the printed key (TF1.…)
        │
        ▼
buyer pastes it into TaskFlow ─▶ app verifies the signature offline ─▶ Pro unlocks
```

This is honest: the key is minted by you after a real payment, and the app can
prove the key came from you.

## One-time setup

### 1. Generate your signing keypair

```bash
node scripts/generate-keys.mjs
```

- `scripts/keys/private.jwk.json` — **secret**. Git-ignored. Never commit, never
  ship, back it up somewhere safe.
- `src/lib/licensePublicKey.ts` — public. Committed and bundled in the app.

Re-running with `--force` rotates the key and invalidates every key you have
already sold, so only do it deliberately.

> This workspace already contains a generated keypair. `scripts/keys/private.jwk.json`
> matches the public key currently bundled in the app, but it is **git-ignored** and
> is **not** included in the Vercel zip. Back it up somewhere safe before you deploy,
> or run `generate-keys.mjs --force` once and redeploy so you own a fresh pair.

### 2. Point checkout at your payment link

Create three fixed-amount payment links (one per plan) and give them to the app,
either in **Settings → Advanced · checkout links**, or via build-time env vars
(see `.env.example`):

```
VITE_CHECKOUT_MONTHLY_URL=https://buy.stripe.com/...
VITE_CHECKOUT_ANNUAL_URL=https://buy.stripe.com/...
VITE_CHECKOUT_LIFETIME_URL=https://buy.stripe.com/...
```

Use a provider that fixes the amount on the link (Stripe Payment Links, Razorpay
Payment Pages, Lemon Squeezy, Gumroad, Paddle) so the customer cannot choose what
to pay. The old self-typed-amount flow has been removed on purpose.

### 3. Issue a key per sale

```bash
node scripts/issue-license.mjs --plan monthly  --email buyer@example.com
node scripts/issue-license.mjs --plan annual   --email buyer@example.com --days 366
node scripts/issue-license.mjs --plan lifetime --email buyer@example.com
```

The script self-verifies each key before printing it. Email the key to the buyer.

## Security model

What this protects against:

- **Forgery.** Keys are ECDSA P-256 signatures over the plan/expiry claims.
  Without `private.jwk.json`, a key cannot be created or edited.
- **Sharing a made-up key.** A random or hand-edited `TF1.…` string fails
  signature verification.

What a local-first app cannot prevent:

- A determined user editing their own `localStorage`. Any purely client-side
  entitlement is tamperable by the person who owns the device. The app mitigates
  this by re-verifying the key signature on every load and clearing keys that
  don't verify, but it is not a substitute for a server if you need
  tamper-proof enforcement.

If you later want automatic, server-verified fulfillment (webhook issues the key
instantly), add a small serverless function that holds the private key and exposes
a signed-key endpoint. Nothing in the current design blocks that.

## Entitlement rules

- `isPro(settings)` is authoritative: a valid signed license **or** an active trial.
- A license is valid while `exp` is in the future (lifetime keys have `exp: null`).
- Expiry is read from the signed payload, not from editable settings fields.
- Lapsed licenses drop to Free automatically; goals and over-cap tasks are kept,
  not deleted.
- Monthly keys default to a 32-day term so a slightly late renewal doesn't lapse.

## Conversion analytics

TaskFlow logs a small, **local-only** funnel (nothing is uploaded): paywall views,
checkout opens, trial starts, and license activations/failures. See it in
**Settings → Conversion** and use it to tune pricing and copy. Reset clears it.

## Files

- `src/lib/license.ts` — token format, decode, async signature verify
- `src/lib/licensePublicKey.ts` — embedded public key (generated)
- `src/lib/pro.ts` — pricing, entitlements, checkout URL resolution
- `src/store/useStore.ts` — `startTrial`, `redeemLicense`, `openCheckout`
- `src/lib/funnel.ts` — local funnel tracking
- `scripts/generate-keys.mjs`, `scripts/issue-license.mjs`, `scripts/license-core.mjs`
