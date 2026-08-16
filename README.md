# NoHunger

Surplus food gets thrown away while people nearby go hungry. A donor posts extra
food with one photo, how many it feeds and when it expires. It appears on a live
map. A receiver claims a portion, the donor accepts, the two are matched, they
track and call each other until the handoff, then the listing cleans itself up.

Next.js App Router + TypeScript + Supabase + Leaflet/OpenStreetMap. Free tier
end to end, no service that asks for a card.

---

## The frontend is frozen

`design/NoHunger-Organic.html` is the source of truth for the landing page. The
port changed **no rendered pixel**.

Run the check yourself:

```bash
python3 tools/verify-design-port.py
```

It resolves every token back to its literal value and diffs all 530 declarations
in the original against the port. Current result: **0 declarations absent**, and
2 extras, both explained below.

What was and was not touched:

| | |
|---|---|
| Markup structure, section order, copy | unchanged |
| Class names (`.serif`, `.blob`, `.btn`, `.btn-primary`, `.btn-outline`, `.btn-honey`) | unchanged |
| Colours, fonts, spacing, radii, shadows, decorative SVGs | unchanged |
| `<style>` block | copied verbatim into `src/styles/globals.css`, with literals swapped for tokens of identical value |
| Inline `style=""` attributes | transcribed declaration for declaration into `src/components/landing/Landing.module.css` |
| Font loading | still the same two `<link>` tags, same families, same axes. Not `next/font`, which renames families and would break `.serif` |
| Viewport meta | still `width=device-width, initial-scale=1`. No `viewport-fit=cover`, so the landing page cannot shift under a notch |

Three edits, all in the allowed set:

1. **Buttons wired to routes.** `Donate Food →` goes to `/donate`, `Find Food Near
   You` and the hero card's `Get` go to `/map`. The header `Get started` still
   scrolls to `#cta` exactly as designed, and that form now carries the address
   into `/signup` instead of only calling `preventDefault()`.
2. **Feature-card hover.** The source used inline `onmouseover`/`onmouseout`
   handlers setting `this.style.transform` and `this.style.boxShadow`. `this.style`
   has no JSX equivalent, so those two values moved to a `:hover` rule verbatim.
   These are the 2 "extra" declarations the checker reports.
3. **Accessibility attributes** that do not paint: `aria-hidden` on decorative
   SVGs and the `◐` marks, `aria-label` on the nav, a visually-hidden `<label>`
   for the CTA email input, and a `prefers-reduced-motion` block.

Two things worth flagging rather than silently fixing, because both would have
changed the design:

- **The landing page has no mobile breakpoints.** The original sets fixed
  `grid-template-columns: 1.05fr .95fr`, `repeat(3,1fr)` and `repeat(2,1fr)` with
  no media queries, so it renders exactly as designed at every width, including
  narrow ones. Adding responsive rules is a layout reflow, which Rule 1 forbids.
  Say the word and it is a ten-minute change.
- **Footer links still point at `#`,** as in the source. They are marked
  `// PHASE 5`.

Every screen the design did not cover (map, donate, orders, history, profile)
is built from `src/styles/tokens.css` and the same type scale, so it reads as the
same site by the same designer.

---

## Proof, not claims

Three things were verified before this ZIP was built, and you can re-run all of
them:

```bash
python3 tools/verify-design-port.py                    # 0 declarations lost
npx tsc --noEmit && npm run build                      # clean
psql -v ON_ERROR_STOP=1 -d <scratch> -f supabase/tests/qa.sql   # 34/34 pass
```

The SQL in `/supabase` was executed end to end against a real PostgreSQL 16
instance, in order, with Supabase stand-ins for `auth` and `storage`. It runs
clean. The two-session race on the last serving was run for real: the second
accept blocked on the row lock, then failed with `NOT_ENOUGH_SERVINGS` and rolled
back whole, leaving `servings_remaining = 1` with one accepted and one pending
request. See `supabase/tests/README.md` to reproduce it.

---

## Getting it running

```bash
cp .env.example .env.local     # fill in the Supabase values
npm install
npm run dev
```

`.env.local` needs a Supabase project first. **Step A of the delivery plan walks
that through milestone by milestone** — say go and you get it one milestone at a
time rather than a wall of SQL. The short version:

1. Create a free Supabase project.
2. Run `supabase/schema.sql`, then `policies.sql`, `functions.sql`, `storage.sql`,
   `cron.sql`, in that order, in the SQL editor.
3. Copy the project URL, anon key and service-role key into `.env.local`.

Until then `npm run dev` starts clean and the landing page renders; anything that
talks to the database will say so rather than crash.

---

## Phase checklist

### Phase 1 — in this ZIP

- [x] Scaffold: Next 15 App Router, TypeScript strict, `middleware.ts`, security headers
- [x] Design tokens, global stylesheet, landing page, pixel-identical
- [x] Auth: email + password, magic link, signup, onboarding, `/auth/callback`, sign out
- [x] Route protection in middleware **and** re-checked server-side in every page and action
- [x] Live map: geolocation, realtime listings, distance, expiry countdowns, bottom-sheet list
- [x] Filters: radius, diet, cooked/packaged, minimum servings, fulfilment mode
- [x] Manual location search via Nominatim when geolocation is denied
- [x] Donate form: one photo, canvas re-encode to ~50 KB WebP with EXIF and GPS stripped
- [x] Request flow: servings picker, pickup/delivery choice, dropoff detail
- [x] Donor inbox: accept and reject, wired to the atomic database function
- [x] Cancel, from either side, restoring servings
- [x] Typed Supabase clients (browser / server / service role), generated-shape DB types, hooks, server actions
- [x] Complete SQL in `/supabase`, including cancel, restore, timeout and auto-reject
- [x] Image GC queue plus the endpoint that drains it
- [x] Food-safety notice at donation and at claim time
- [x] Bottom nav, skeletons, empty states, focus rings, semantic markup

### Step B — active order
Live two-way tracking, shortest route via OpenRouteService with OSRM fallback,
temporary contact reveal, delivery-address reveal. `get_order_details()` and
`live_locations` already exist and are already state-gated; this is UI plus a
routing endpoint. Markers: `// PHASE 2` in `OrdersClient.tsx`.

### Step C — completion
Confirm handover, delete the photo, ratings, history. `complete_request()` is
already written and idempotent, `nh_guard_rating()` already blocks self-rating
and rating before completion. Markers: `// PHASE 3`.

### Step D — notifications
In-app realtime plus Web Push over VAPID. `notifications` and
`push_subscriptions` tables and the `nh_notify()` calls are already in place, so
this is a service worker, a subscribe flow and a send endpoint. Markers:
`// PHASE 4`.

### Step E — reports, blocks, filters, PWA
`reports` and `blocks` tables exist and blocking is already enforced server-side
in `get_available_donations()` and `create_request()`; what is missing is the UI
and the PNG icons. Markers: `// PHASE 5`.

### Step F — tests and QA script
**Partly delivered already.** `supabase/tests/qa.sql` is 34 assertions covering
oversell, restore maths on every cancel path, expiry, timeout, blocking,
contact-reveal gating and image GC; `supabase/tests/README.md` has the two-session
concurrency reproduction. Both were run against PostgreSQL 16 before this ZIP was
built and both pass. What is left is the RLS matrix asserted from each role's own
session, and a Playwright pass over photo compression and marker removal.

Nothing is silently missing: every deferred feature has a `// PHASE n` marker at
the exact place it plugs in, and unbuilt screens are honest placeholders rather
than broken imports.

---

## How the consistency bugs are prevented structurally

The previous build kept showing completed and expired food. This one cannot,
because the same rule is enforced in four places that would all have to fail
together.

**One source of truth.** `get_available_donations(center, radius, filters…)` is a
parameterized `SECURITY DEFINER` function, not a view, because delivery radius
and viewport both need the viewer's position. It enforces
`status in ('available','partially_claimed') and expires_at > now() and
servings_remaining > 0` server-side and returns a computed `distance_km` and
`delivery_available`. Distance uses an immutable haversine helper, so no PostGIS.
The client never filters status.

**RLS repeats the same rule.** The `SELECT` policy on `donations` allows a row
only if it is live, or yours, or one you have a request on. A client querying the
table directly still cannot see a stale listing, and Realtime evaluates the same
policy before delivering an event.

**Two meanings of "completed" stay apart.** Donation status governs the listing.
Request status governs the order. Contact reveal, tracking and address reveal all
gate on `request.status = 'accepted'` and never on donation status, which is what
lets a fully-claimed listing leave the map while a handover is still in progress.

**Expiry runs in the database.** `pg_cron` calls `expire_donations()` every
minute, in SQL, inside the same database as the data. It never touches accepted
requests, because a receiver may already be en route. Not Vercel Cron: Hobby only
runs daily, and food expires in hours.

**Claiming is atomic.** `accept_request()` locks the donation row with
`SELECT … FOR UPDATE`, then re-checks that the request is still pending, that the
listing has not expired and that enough servings remain, before decrementing.
Two simultaneous accepts of the last serving serialise on that lock and the
second one fails its re-check and rolls back whole. No overselling is possible.

**Nobody is stranded.** When servings hit zero, still-pending requests on that
listing are auto-rejected and notified inside the same transaction as the final
accept.

**One restore path.** Donor cancel, receiver cancel and the timeout sweeper all
call `nh_release_request()`, which restores with
`least(total_servings, remaining + requested)`, re-derives the status through the
single `nh_derive_donation_status()` helper, clears `live_locations`, deletes
`delivery_details` and queues the photo. Three callers, one implementation, so
they cannot drift and the maths cannot overshoot.

**Realtime, plus a floor.** The map subscribes to `donations`, optimistically
drops any marker that went terminal, then debounce-refetches the authoritative
function. Because a row that stops satisfying the policy may not produce a
deliverable event at all, there is also a 45-second refetch, a refetch when the
tab regains focus, and local removal the instant a countdown hits zero.

**Photos really get deleted.** SQL cannot call Storage, so completion, expiry,
cancellation and the orphan sweep all enqueue into `storage_gc` and null
`image_path`; `POST /api/gc/images` drains the queue with the service-role key.
A failed row insert deletes its own upload immediately. History keeps metadata
only.

---

## Security

- RLS on every table. `phone` is additionally protected at the **column** level:
  it is revoked from `anon` and `authenticated` entirely, so no query and no view
  can return it. `get_order_details()` is the only path, and it returns nothing
  once the order stops being accepted.
- `delivery_details` is a separate table for the same reason. The receiver reads
  it directly; the matched donor only ever sees it through the guarded function.
- Every state change goes through a `SECURITY DEFINER` function or a server
  action that re-checks `auth.uid()` and ownership. A trigger blocks a donor from
  editing `servings_remaining`, `total_servings` or `status` directly, detected by
  `current_user` so definer functions still work.
- Input is validated with Zod in the action **and** by CHECK constraints and
  triggers in the database: servings bounds, enum values, expiry window, self-request
  block, and a partial unique index that makes a duplicate active request impossible.
- Rate limiting on request creation lives in the database, where it cannot be
  bypassed by calling the RPC directly.
- The service-role key is imported through a module marked `server-only`, so
  bundling it into client code is a build error rather than a leak.
- No keys and no personal data are committed. `.env.example` documents every var.

---

## Performance

Landing page ships 108 kB of JS and is statically prerendered. Leaflet is a
client-only `dynamic()` import with `ssr: false` and a skeleton, and every marker
is a `divIcon`, so the default marker PNGs are never requested and never 404.
Map fetches are bounded by the visible radius, map moves and filter changes are
debounced, and geocoding only fires on explicit submit, which also respects
Nominatim's usage policy. Photos land at roughly 50 KB, which is what keeps the
free tier viable.

---

## Layout

```
src/
  app/
    page.tsx               landing, frozen port
    (app)/                 map, donate, orders, history, profile — bottom nav shell
    (auth)/                login, signup, onboarding
    auth/                  callback + signout route handlers
    api/gc/images/         storage garbage collection
  components/
    landing/               the frozen port, one component per section
    map/  donate/  orders/  auth/  app/  ui/
  hooks/                   geolocation, nearby donations, debounce
  lib/                     supabase clients + types, geo, image, validation, errors
  server/actions/          auth, donations, requests
  styles/                  tokens.css, globals.css
supabase/                  schema · policies · functions · storage · cron
design/                    the original HTML, kept for the freeze check
tools/                     verify-design-port.py
```

---

## Deploying

Push to a repo, import it on Vercel, set the same environment variables (with
`NEXT_PUBLIC_SITE_URL` pointing at the deployed URL), and add that URL to
Supabase Auth → URL Configuration → Redirect URLs. Free tier throughout.

`pg_cron` handles the scheduled correctness inside Supabase, so nothing depends
on Vercel Cron. The one thing worth scheduling on the hosting side is
`POST /api/gc/images`, which is safe to call as often as you like.
