# AranyaValue — Mobile Fix Plan (for coding agent)

Scope: `site/` (vanilla HTML + `css/style.css` + `js/app.js`). 13 pages. No build step.
Target: **no horizontal scroll, no clipped/overflowing text, no distorted SVG, usable tap targets** at 320 / 360 / 390 / 414 / 768 px, portrait + landscape.

> Source of this plan: static read of `style.css` (607 lines), `app.js` shell, and grep of inline styles in all HTML pages. Not yet rendered in a browser. Items marked **VERIFY** need a quick look in DevTools before/after fixing. Do Phase 0 first to get real evidence.

---

## 0. ROOT CAUSES (read first — they explain ~80% of the bugs)

| # | Root cause | Evidence |
|---|-----------|----------|
| RC1 | **Inline `style="grid-template-columns:…"` / fixed `width` / `min-width` beats stylesheet media queries.** Only one rescue rule exists (`.grid[style*="grid-template-columns"]` at ≤600, `!important`). Anything that is not `.grid`, or is between 601–900px, never collapses. | style.css:607; inline list in §3 |
| RC2 | **Only 3 breakpoints (1280 / 900 / 600). Nothing for ≤480 or ≤360.** Phones 320–400 get the same rules as a 600px device. | style.css:546-607 |
| RC3 | **Fixed-px components** (330px notif, 282px upload, 122px docs, 118px date inputs, 150px select, 190px `.l` column, 110px offer bar, 90px/44px timeline cols). | see §2/§3 |
| RC4 | **Data-URI SVG backgrounds use `preserveAspectRatio='none'` + `100% 100%`** → mountains/trees stretch non-uniformly when container aspect changes (always on mobile). | style.css:3, 61, 509 |
| RC5 | **Table-ish rows hidden or crushed** instead of re-flowed (`.att-row` hides cols 4-7; 6-col tables only scroll). | style.css:572-573 |
| RC6 | **No `min-width:0` on flex text children, no `overflow-wrap`** → long strings (hashes, IDs, emails, product names) push containers wide. | `.mono`, `.sec-head .t`, `.row>div` |
| RC7 | `100vh` instead of `100dvh` (iOS/Android URL-bar jump), inputs 14px (iOS Safari auto-zooms on focus), tap targets 22–34px. | style.css:67,478,512; 151; 119-125 |

---

## PHASE 0 — Reproduce & measure (do before touching code)

1. Serve `site/` (`npx serve site` or VS Code Live Server). Open each page in Chrome DevTools device mode at **320, 360, 390, 414, 768**.
2. Paste in console on every page to list overflow culprits:
```js
(() => { const W = document.documentElement.clientWidth;
  console.table([...document.querySelectorAll('body *')]
   .filter(e => e.getBoundingClientRect().right > W + 1 && getComputedStyle(e).position !== 'fixed')
   .map(e => ({ el: e.tagName + '.' + e.className, right: Math.round(e.getBoundingClientRect().right), w: Math.round(e.getBoundingClientRect().width) }))
   .slice(0, 25));
  console.log('page scrollWidth', document.documentElement.scrollWidth, 'vs', W); })();
```
3. Screenshot each page at 360 and 320 into `site/_mobile-audit/before/` (page-width.png). Use for before/after.
4. Add a **temporary** debug rule while fixing (remove at end): `*{outline:1px solid rgba(255,0,0,.15)}` and `html{overflow-x:visible}` so overflow is visible, not hidden.

**Do NOT "fix" by adding `overflow-x:hidden` to body.** Allowed only as a last-resort safety net in Phase 9, after real causes are fixed.

---

## PHASE 1 — Global foundation (style.css) — P0

Add a new block at the **end** of style.css titled `/* ===== MOBILE FOUNDATION ===== */`. Don't scatter.

### 1.1 Base hygiene
```css
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
img,svg,video,canvas{max-width:100%}
.main,.card,.hero,.pagehead,.sec-head .t,.row>div,.det-head>div,.task .t,.rcard .r,.scard>div,.qitem>div,.act>div,.kv>div,.step>span{min-width:0}
.card,.sub,.hint,.kv span,.kv b,.sumline b,.mono,td,th,h1,h2,h3{overflow-wrap:anywhere}
.mono{word-break:break-all}               /* ledger hashes, QR URLs, tx ids (audit.html, passport) */
body,.login-page,.pub,.main{min-height:100dvh}   /* keep 100vh as fallback line above */
```
(Write the `100vh` line first, `100dvh` second, so old browsers fall back. `.main` is `calc(100vh - var(--top))` → add a `calc(100dvh - var(--top))` line after it.)

### 1.2 New breakpoints
Keep 1280/900. Add **`@media (max-width:600px)`** (extend existing), **`(max-width:480px)`**, **`(max-width:360px)`**. All new mobile rules go in these, not in 900.

### 1.3 Form controls (iOS zoom + touch)
```css
@media (max-width:900px){
  .inp,.sel,.txa,.searchbox .inp,.lang .sel,input,select,textarea{font-size:16px}  /* stops iOS focus-zoom */
  .inp,.sel{height:46px}
  .fgroup .sel{min-width:0;width:100%}
}
@media (pointer:coarse){
  .btn{min-height:44px}.btn.sm{min-height:40px}.btn.xs{min-height:36px;padding:0 12px}
  .iconbtn{width:44px;height:44px}
  .pager button{min-width:40px;height:40px}
  .tab{height:44px}
  .check{width:26px;height:26px}
  .switch{width:46px;height:26px}.switch i::after{width:22px;height:22px}.switch input:checked+i::after{left:22px}
  .photo button{width:32px;height:32px;top:2px;right:2px}   /* remove (×) on photos was 22px */
}
```
Inline-style overrides (`height:36px`, `height:42px`, `font-size:12.5px` on inputs in dashboard/schemes/audit/rejection) must be **moved into classes** (§3) or overridden with `!important` inside these media queries.

### 1.4 Buttons / text wrapping
At ≤600:
```css
.btn{white-space:normal;text-align:center;line-height:1.2;height:auto;min-height:44px;padding-block:8px}
.chip{white-space:normal}            /* long statuses */
.pagehead .actions{width:100%;margin-left:0}
.pagehead .actions .btn{flex:1 1 140px}
.pager{flex-wrap:wrap;justify-content:center}
```
Reason: `.btn` and `.chip` are `white-space:nowrap` with fixed heights → "Download Passport PDF", "Awaiting Assessment" overflow or clip.

### 1.5 Minimum readable font size
Many texts are 10–11.5px: `.quick a small 10.5`, `.qitem .tag 10.5`, `.bar-labels 10 (≤900)`, `.doc 11.5/11`, `.stage small 11.5`, `.mini 11.5`, `.donut small 11`, `.brand small 10.5`, `.tl small`, `.task .r 11.5`.
At ≤600 raise all to **≥12px** (use one grouped selector). Body copy 14px→15px optional.

### 1.6 Safe area + overlays
- `.toasts{right:20px;bottom:20px}` → at ≤600: `left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));align-items:stretch}` and `.toast{max-width:none}`.
- `.modal-bg{padding:16px}` ok; add at ≤600: `.modal{padding:18px;max-height:calc(100dvh - 32px);overflow:auto}` and `.modal .acts{flex-direction:column-reverse}` `.modal .acts .btn{width:100%}`.
- `.topbar` add `padding-top:env(safe-area-inset-top,0px)` only if viewport-fit=cover is added (optional; skip otherwise).

---

## PHASE 2 — App shell (app.js `shell()` + CSS) — P0

### 2.1 Notification dropdown clipped off-screen (**real bug**)
`.notif{width:330px}` is `position:absolute; right:0` of the **bell's** wrapper. The bell sits left of the avatar (~x=250 on a 360 screen) so the 330px panel extends ~80px past the **left** edge of the screen.
Fix at ≤900:
```css
@media (max-width:900px){
  .menu.notif{position:fixed;left:8px;right:8px;top:calc(var(--top) + 6px);width:auto;max-height:calc(100dvh - var(--top) - 20px);overflow:auto}
  #umenu{position:fixed;right:8px;left:auto;top:calc(var(--top) + 6px);min-width:220px;max-width:calc(100vw - 16px)}
}
```
(Parent wrapper `style="position:relative"` is inline in app.js:122,128 — fixed positioning escapes it; fine.)

### 2.2 Topbar overflow at 320–360
Contents: burger(24+12+10) + logo 46 + "AranyaValue" 21px (~115px) + bell + avatar 38 + chevron. ≈ 330px + 24 padding → overflows at 320, cramped at 360.
At ≤480:
```css
.brand .logo{width:36px;height:36px}
.brand b{font-size:18px}
.brand{gap:8px;min-width:0}
.brand div{min-width:0}
.burger{margin-right:2px;padding:8px}
.userbtn{padding:2px}.userbtn img,.userbtn .ph{width:34px;height:34px}
.userbtn>svg{display:none}          /* chevron */
.top-right{gap:4px}
```
At ≤360: `.brand b span{display:none}`? **No** — keep full name; instead `.brand b{font-size:16px}`.

### 2.3 Sidebar drawer
- `.sidebar` height: use `top:var(--top);bottom:0` (ok) but add `height:calc(100dvh - var(--top))`.
- `.side-tag` is `position:absolute;bottom:70px` and **overlaps the last nav items** on short screens (landscape, small phones; nav has 11 items × ~44px = 480px). At `(max-height:760px)`: `.side-tag,.side-art{display:none}`.
- `.side-art` SVG is `preserveAspectRatio='none'` 100%/100% → trees stretch (RC4). Change SVG attr to `preserveAspectRatio='xMidYMax slice'` and background-size to `cover`/`100% auto` + `bottom`. Same fix in §6.
- Hidden drawer is still tab-focusable. Add in `setNav()` (app.js:141): toggle `side.inert = !open` on ≤900 (use `matchMedia('(max-width:900px)')`), and `document.body.style.overflow = open ? 'hidden' : ''`. Also close drawer when a nav link is clicked.
- Add `overscroll-behavior:contain` on `.sidebar nav`.

### 2.4 Main content padding
`.main{padding:10px 12px 24px}` at ≤900 — OK. At ≤480 keep 12px; card inner padding 16 → **14** at ≤480 (`.card{padding:14px}`) to reclaim 4px/side on 320.

---

## PHASE 3 — Page-by-page fixes

General recipe for each inline grid: **move the inline `grid-template-columns` into a named class** in style.css with a desktop value and a mobile override. Never leave a column template in `style=""`. Where inline `flex:N`/`width:Npx` exists on filter rows, replace with classes in §3.0.

### 3.0 Reusable classes to create
```css
.filters{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}
.filters>*{min-width:0}
.filters .grow{flex:1 1 220px}
.filters .fixed{flex:0 0 auto}
@media (max-width:600px){ .filters>*{flex:1 1 100%} .filters .half{flex:1 1 calc(50% - 5px)} .filters .sel,.filters .inp{width:100%} }

.split-2{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:12px}
.split-main-side{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:12px;align-items:start}
.cols-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.cols-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.cols-4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
@media (max-width:900px){.split-2,.split-main-side{grid-template-columns:minmax(0,1fr)}.cols-4,.cols-3{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:480px){.cols-2,.cols-3{grid-template-columns:minmax(0,1fr)}}  /* .cols-4 stays 2-up */
```

### 3.1 `login.html` — P0
| Issue | Fix |
|---|---|
| `.login-left .brand b` 38px + logo 76px ≈ 290px + 24px padding → overflows at 320 | ≤480: logo 52px, `b` 28px; ≤360: 24px |
| `.lang` is `position:absolute; top:14px; right:14px; width:180px` → **overlaps brand/logo** on phones | ≤900: make `.lang` `position:static`, place it at top of `.login-left` or above card (move DOM in login.html or use `order`), `.lang .sel{width:100%;max-width:220px}` |
| `.login-card h2` 36px, `.lead` 19px, `.btn.primary` 62px/19px, inputs 56px → oversized | ≤600: h2 28px, lead 16px, btn 52px/17px, inputs 50px/16px, card padding `24px 18px` |
| `.secure` svg 36px + padding 16/20 steals width | ≤480: svg 28px, padding 12/14, gap 12 |
| `.login-card::after` trees: SVG stretched 100%/100% (viewBox 560×130, `none`) → squashed on 300px card; also **paints above non-positioned content** (z-index 1) | `preserveAspectRatio='xMidYMax slice'`, `background-size:auto 100px`, `z-index:0`; give `.login-card>*{position:relative;z-index:1}` |
| `min-height:100vh` | add `100dvh` |
| `.login-left h1` 32px @≤900 → 26px @≤480; `.tag-line` 17→15 | |
| `.feats` gap 30 → 14 at ≤480; `.feat .sec-ic` 46→38 | |

### 3.2 `dashboard.html` — P0
| Issue | Fix |
|---|---|
| Inline `style="grid-template-columns:minmax(0,1fr) minmax(0,.95fr)"` (line 40): collapses only ≤600 via hack; 601-900 stays 2-col with a 6-col table | replace with `class="grid split-2"`-like class that collapses ≤900 |
| `#stats` (5 cards) → 1 col at ≤600 = 5 tall cards | ≤600: 2-col grid; `.stat{flex-direction:column;align-items:flex-start;padding:12px}` `.stat .sec-ic{width:40px;height:40px;font-size:20px}` `.stat b{font-size:22px}`; last odd card `grid-column:1/-1` |
| `row between` with `<select style="width:140px">` (line 22) — non-wrapping; heading squeezed | `.row.between{flex-wrap:wrap}` at ≤600; select `width:100%` via class |
| **Bar chart** `.bars`: 26px left margin, 170px height, labels 10px at ≤900, `i{width:62%}`; with 5-6 bars each ≈ 40px → product names collide/wrap unevenly | ≤600: `.bar-labels span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}`; keep `margin-left:18px` on both `.bars` and `.bar-labels` (must match); `.bars .b em{font-size:11px}`. If > 5 bars: allow `.bars-wrap{overflow-x:auto}` with `min-width:300px` |
| **Donut + legend** `.row.mt16` inline `gap:22px`, non-wrapping: 130px donut + legend at 264px inner width | ≤480: `flex-direction:column;align-items:center`; donut centred; legend `width:100%` |
| `.att-row` ("Batches needing attention"): ≤900 grid `30px 1fr 90px` with `>:nth-child(n+4){display:none}` → **hides status/quantity/date** | Re-flow: ≤900 `grid-template-areas:"ic main btn" "ic meta meta"`; show all fields as a 2-line card; remove the `display:none` rule. Needs a small markup tweak in dashboard.html render function (wrap cols 3-6 into `<span class="meta">`) |
| "Recently Updated" table: 6 cols in `.tblwrap` (scrolls, no hint) | Add `.tbl{min-width:520px}` inside `.tblwrap`; add fade-shadow scroll hint (see §5); or hide cols 3 & 5 at ≤480 |
| Q2P insight: img `82×64` inline + text in non-wrapping `.row` | `.row.mt12{flex-wrap:wrap}`; image `flex:none` |
| `.promo h3{margin-top:-34px;text-shadow…}` overlap hack: on narrow width title wraps to 3 lines and sits over image & body edge | ≤600: `margin-top:0;text-shadow:none`; `.promo .img{height:100px}` (inline `height:120px` → `!important`) |
| `.quick` text 10.5/11.5px | ≥12px; `.quick a{padding:10px;min-height:56px}` |
| `.hero .hero-cta` inline `height:46px;padding:0 24px` | fine, but at ≤480 `.hero-cta{display:flex;width:100%}` |
| `.hero` image overlay: gradient only goes transparent at 78%; on mobile text is wider than 78% of box so photo sits behind text | ≤600: `background:linear-gradient(90deg,#f8fbf4 0%,rgba(248,251,244,.92) 100%),var(--hero-img…) right/cover` so text stays legible |

### 3.3 `my-batches.html`
- Inline `width:210px` (line 22) and `height:44px` (line 18) on filter controls → use `.filters` classes; `.searchbox{min-width:200px}` → `min-width:0;flex:1 1 100%` at ≤480.
- Table: add `min-width` + scroll hint, or convert rows to cards ≤600 (preferred): hide thead, `tr{display:grid;grid-template-columns:auto 1fr auto}`; `td::before{content:attr(data-label)}` — requires adding `data-label` attrs in render function. At minimum: keep scroll + hint.
- `.pager` wrap (see 1.4). Thumb 28px inline fine.

### 3.4 `create-batch.html` — P0
| Issue | Fix |
|---|---|
| `.stepper` 4 → 2 → 1 col: four 40px circles stacked ≈ 200px tall before the form | ≤600: single row, `display:flex;overflow-x:auto;gap:6px;padding:10px`; `.step{flex:none}` show label **only for `.active`** (`.step:not(.active) span{display:none}`); circles 32px; add `scroll-snap`; JS: `activeStep.scrollIntoView({inline:'center'})` |
| Photo uploader inline `width:282px;height:103px` (line 40) → overflows card at 320 (inner ≈ 264px) | class `.upload.photo-up{width:100%;height:auto;min-height:96px}`; `.photo{width:calc(33.33% - 8px);aspect-ratio:1;height:auto}` at ≤480 |
| `.form-grid>*{grid-column:span 6 !important}` at ≤900 → *everything* single col, even short fields (qty + unit, date + time) | ≤900: allow `.c2/.c3` pairs to stay 2-up when ≥480: use `.form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}` + `.c6,.c4{grid-column:1/-1}` + `.c2,.c3{grid-column:auto}` and force single col only at ≤480 |
| `.cb-grid` summary panel (340px) falls below form; user can't see summary while editing | OK to stack. Add sticky bottom action bar: `.formbar{position:sticky;bottom:0;z-index:20;margin-inline:-12px;border-radius:0;padding-bottom:calc(10px + env(safe-area-inset-bottom))}` at ≤600 |
| `.sumline` 16px gap, `b` right-aligned; long values wrap fine after §1.1 | — |
| `.chipsel span` padding 7/14 — tap target ~34px | `min-height:40px;display:inline-flex;align-items:center` coarse pointer |
| `.ptype` / `.ptype .ph` fine | — |

### 3.5 `passport.html` — P0
| Issue | Fix |
|---|---|
| Line 82 inline `style="grid-template-columns:minmax(0,1.9fr) minmax(0,.9fr)"` — **VERIFY** if element has `.grid` class; if only `.pp-grid`, inline wins and 2 columns persist on mobile (note: an earlier fix refactored some of this — check this one remains) | move to class, collapse ≤900 |
| `.pp-head`: `.pic` 158×110 + title `h2 26px inline` + chip + `.grade-box 228px` (static, margin 8/16, width auto ≤600). At 601-900 `.grade-box` is 228px fixed & `flex-wrap` leaves odd gaps | ≤900: `.pp-head{flex-direction:column;align-items:stretch;gap:0}` `.pp-head .pic{width:100%;height:160px}` `.pp-head>div{padding:12px 14px}` `.grade-box{width:auto;margin:0 14px 14px}`; `h2{font-size:22px;display:block;margin:0 0 4px}` |
| `.pp-head` background gradient `#fff 0→35%` assumes image on right; on column layout shows ugly half-fade | ≤900: `background:#fff` |
| `.qgrid` (3 → 2 → 1): 1-col gives 6+ tall rows; `.qitem .tag` `margin-left:auto;nowrap` | keep **2-col until ≤360**; `.qitem{flex-wrap:wrap}` `.qitem .tag{margin:4px 0 0}` |
| `.doc{width:122px}` fixed → leaves ragged gap in 264-304px container | `.docs{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr))}` `.doc{width:auto}` |
| `.qr` 96px | fine; ensure QR block `flex-wrap:wrap` at ≤480; QR URL text `.mono` break-all |
| Tabs (`.tabs.line` nowrap + scroll) — scrollbar visible & no hint; active tab may be off-screen | hide scrollbar (`scrollbar-width:none`), add edge fade, JS `scrollIntoView` for active |
| `.kv-2` 1fr 1fr → 1 col ≤600 OK | |
| `.timeline .tl` fine; ensure `.tl>div{min-width:0}` | |
| `.what .inner` fine | |

### 3.6 `quality-price.html`
- Inline `flex:1` (lines 14,18,78) in non-wrapping rows → add `flex-wrap:wrap` at ≤600.
- `.cmp` buyer comparison table: ≥5 columns, `.offer-bar{width:110px}`, chips → inside `.tblwrap` scroll. Better: ≤600 stack each buyer as a card (data-label approach §3.3). Minimum: `.cmp{min-width:560px}`, sticky first column: `.cmp td:first-child,.cmp th:first-child{position:sticky;left:0;background:#fff;z-index:1}`.
- `.sel-batch` (img 50 + overlay select) fine; ensure text `min-width:0;overflow:hidden;text-overflow:ellipsis`.
- `.flow` already stacks (arrow rotated 90° — OK).
- `.imp` rows fine; `.imp b` wraps.
- `.qp-top` right panel 370px stacks. OK.

### 3.7 `buyers.html`
| Issue | Fix |
|---|---|
| Master–detail: detail panel (470px col) renders **below the whole list** on mobile; tapping a buyer card changes nothing visible | ≤900: on card click, open detail in a **bottom sheet / full-screen modal** (`position:fixed;inset:0;overflow:auto;z-index:90;background:var(--bg)` + back button), or `detail.scrollIntoView({behavior:'smooth'})` as minimum. JS change in buyers.html script |
| `.kvt` 3-col (`auto 1fr 1.4fr`) has **no mobile rule** → value column ~100px | ≤600: `grid-template-columns:20px 1fr`; value `grid-column:2` |
| `.supp` 4 → 2 → **1 col** at ≤600 (huge images) | keep 2-col at ≤600; 1 col ≤360 |
| `.det-head` flex no-wrap, `.blogo` 56px | `flex-wrap:wrap` ≤480; `.blogo{width:44px;height:44px;font-size:24px}` |
| Inline `flex:2` (line 12), `height:44px;padding:0 24px` (16) on filter row | `.filters` classes |
| `.bcard h3 inline` + chips + meta can overflow | `min-width:0`, wrap |

### 3.8 `post-harvest.html` — P0
| Issue | Fix |
|---|---|
| **Inline `grid-template-columns:minmax(0,1fr) 340px`** (line 20) → fixed 340px column on a 320-414px screen = horizontal scroll (unless element has `.grid`, and even then 601-900 is broken) | class `.split-main-side` (§3.0) |
| Inline `minmax(0,1.5fr) minmax(0,1fr)` (line 25) | `.split-2` |
| `.ph-stages` 5 cols → 3 → 2 → 1: five stacked 60px cards | ≤900: horizontal scroll-snap strip: `display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:8px;margin-inline:-12px;padding-inline:12px` `.stage{flex:0 0 190px;scroll-snap-align:start}`; active stage `scrollIntoView` |
| `.task` flex gap 14, right column `.r` (status + button) | ≤480: `flex-wrap:wrap`; `.task .r{flex-direction:row;width:100%;justify-content:space-between}` |
| Inline `width:140px;font-size:12px;text-align:right` (line 62) | ≤600 `width:auto;text-align:left` — move to class |
| Line 72 `style="width:100%;background:none;border:0;border-top:…"` button rows fine, but icon `40×40` inline | ok; ensure text `min-width:0` |
| Photo thumbs line 77 `height:80px` + remove btn 22px | grid 3-col, 32px remove btn (coarse pointer rule) |
| `.gside` rows | fine after §1.1 |

### 3.9 `rejection.html` — P0
| Issue | Fix |
|---|---|
| Filter row inline (lines 16-19): search `flex:1.4;min-width:130px`, two date inputs `width:118px;height:42px;padding-left:8px`, select `font-size:12.5px;padding:0 10px` — one non-wrapping line | `.filters` (§3.0): search full row, dates `.half` side by side, 16px font |
| Line 56 inline `1fr 1fr`, line 60 inline **`1.1fr 1.3fr .9fr` (3 cols!)** | classes `.cols-2`, `.cols-3-uneven` → single col ≤600 |
| `.rcard`: img 62 + `.l` 190px + `.r flex:1`; wrap rule only at ≤900 makes `.r` drop below with `width:auto` | ≤600: `.rcard{display:grid;grid-template-columns:62px 1fr;align-items:start}` `.rcard .l,.rcard .r{grid-column:1/-1;width:auto}` |
| `.rpill` row (4 filter pills, height 32) | `display:flex;overflow-x:auto;flex-wrap:nowrap` or wrap; coarse pointer height 40 |
| `.steps-n`, `.alert-red` fine | |
| Textarea `min-height:58px` inline | ok |

### 3.10 `audit.html` — P0
| Issue | Fix |
|---|---|
| Filter row inline `flex:1.6`, `flex:1;height:44px`, `flex:1.3` with nested date inputs (`flex:1;min-width:0`) (lines 15-19) | `.filters` classes; date-range wrapper full width |
| **Hash / tx strings** in event rows and detail panel (`.mono`) can't wrap → overflow | `.mono{word-break:break-all}` (§1.1); in detail panel `grid-template-columns:110px 1fr` (line 72, inline) → ≤480 `1fr` with label above, or `90px 1fr` |
| Inline `min-width:150px` (line 63) | `min-width:0` ≤600 |
| Events table | scroll+hint or cards; `.evrow` tap highlight; detail panel (410px) is below list → same sheet pattern as buyers |
| `.evic` 36–42px inline | ok |
| Pagination | wrap |

### 3.11 `schemes.html`
- `.scard`: img `112×104` (and inline `100×90`, line 52) + body + `.r` 150px. ≤900 `flex-wrap` and `.r` full width — OK, but image + text row at 304px: image 112 leaves 170px text. ≤480: image `width:84px;height:84px`; `.scard .r{flex-direction:row;flex-wrap:wrap}`.
- Inline `flex:1.6` (15), `height:44px;padding:0 24px` (19), `width:140px;height:36px` (24), `height:46px` (62-63) → classes.
- `.kvs` 3-col → handled at ≤900 (`28px 1fr`), but **VERIFY** that the middle element (`<b>` label, 140px col) now stacks over value (`:last-child{grid-column:2}` puts value on row 2 — good).
- Detail panel below list → sheet pattern.

### 3.12 `profile.html` — P0
| Issue | Fix |
|---|---|
| Line 28: inline `flex:1;min-width:280px;grid-template-columns:repeat(2,1fr)` → forces ≥280px & 2 cols inside a 264–304px card → input text clipped/overflow | class `.cols-2` with ≤480 single col; `min-width:0` |
| Line 39 `repeat(2,1fr)`; **line 49 `repeat(4,1fr)`** (4 cols on phone ≈ 62px each) | `.cols-4` → 2-up ≤900 |
| `max-width:340px` / `330px` inline (25, 60) | fine as max; add `width:100%` |
| `.dl` grid `30px 1fr 1.2fr` — **no mobile rule** | ≤600: `30px 1fr`, value `grid-column:2` |
| `.pref b{min-width:160px}` handled ≤900 (wrap) but `.pref span{flex:1}` + switch → switch drops under text; set `.pref{flex-wrap:nowrap}`, `.pref b{min-width:0;flex:1}`, `.pref span{flex-basis:100%;order:3}` |
| Avatar edit button inline absolute 26px | tap target → 32px coarse |
| `.ring` 70px + progress text rows | stack ≤480 |
| Inline `height:46px;padding:0 34px` on buttons (79) | `.btn.block` ≤600 |
| `.tabs` (non-line) wrap into 3 rows of 42px | make horizontal scroll strip like `.tabs.line` at ≤600 |

### 3.13 `verify.html` (public page) — P0
| Issue | Fix |
|---|---|
| `.pub-hero` padding 20/48 → 16/18 OK; `.pub-wrap` side padding stays **24px** and `margin:-36px` overlap | ≤600: `padding:0 12px 32px` |
| `.pub-nav` brand + links (`.btn` remains) + `flex-wrap` | ≤480: logo 40, `b` 20px; link button `.btn.sm` |
| `.pub-hero h1` 30px → 26 ≤480; `h2` 23→18 | |
| Inline `grid-template-columns:1.5fr 1fr` (line 28) | class; collapse ≤900 |
| Line 22 `flex:1`, 24 `max-width:190px;align-self:flex-start` search form | `.filters` pattern; stack input over button ≤480 |
| `.prod-top img` 178×150 → `width:100%` ≤900 but **height stays 150** with `object-fit:cover` → fine; set `height:180px;aspect-ratio:auto` | |
| `.mini-stats` 4 → 2 col; `svg 26px` | ok |
| `.ttl` timeline `90px 44px 1fr` = 134 + 24 gaps leaves 146px of 304 | ≤480: `grid-template-columns:40px 1fr` with date moved under title (`.d{grid-column:2;order:3}`) |
| `.vrow b{min-width:120px}` → squeezes value | ≤600 `min-width:0;flex:1 1 40%`, `.vrow{flex-wrap:wrap}` |
| `.gal` **4 cols, no mobile rule** (≈65px images) | ≤600 `repeat(2,1fr)` |
| Line 51 `max-width:720px` fine. Line 67 `th width:36%` in `.tbl.pub` | ≤480: `width:auto` |
| `.tbl.pub` tables | wrap in `.tblwrap` if not already (**VERIFY**) |

---

## PHASE 4 — Tables (all pages) — P1

Pattern for every `.tbl` (≈35 occurrences across 11 pages):
1. Must sit inside `.tblwrap` (overflow-x:auto). **VERIFY** each; `.tbl.pub` in verify.html, `.cmp` in quality-price.html, any `.tbl` directly inside `.card` leaks width.
2. `.tbl{min-width:var(--tbl-min,520px)}` so columns don't crush; override per table via inline CSS var.
3. Scroll affordance: add
```css
.tblwrap{background:linear-gradient(to right,#fff 30%,transparent),linear-gradient(to right,transparent,#fff 70%) 100% 0,radial-gradient(farthest-side at 0 50%,rgba(0,0,0,.18),transparent),radial-gradient(farthest-side at 100% 50%,rgba(0,0,0,.18),transparent) 100% 0;background-repeat:no-repeat;background-size:40px 100%,40px 100%,14px 100%,14px 100%;background-attachment:local,local,scroll,scroll;-webkit-overflow-scrolling:touch}
```
4. Optional (P2): card-ify at ≤600 using `data-label` attributes (my-batches, audit, quality-price, dashboard recent).
5. `.tbl th{white-space:nowrap}` stays; `td{overflow-wrap:anywhere}`.

---

## PHASE 5 — SVG issues (consolidated) — P1

| # | SVG | Problem | Fix |
|---|-----|---------|-----|
| S1 | `--hero-fb` data-URI (style.css:3), used on `.hero`, `.pp-head`, `.promo .img`, `.login-page`, `.pub-hero` | `viewBox 400×120`, `preserveAspectRatio='none'`, `right center/60% 100%` → on mobile hero is taller/narrower so mountains **stretch vertically into spikes** and the block covers only 60% | change to `preserveAspectRatio='xMaxYMax slice'`, use `background-size:cover` (or `auto 100%` + `right bottom`); test `.hero` at 320 (tall, wrapped text) and `.promo .img` (wide, short) |
| S2 | `.side-art` (style.css:61) | viewBox 200×340 `none`, `100% 100%` on 260px × variable height → distorted trees | `xMidYMax slice`, `background-size:100% auto`, `bottom` ; hide on short screens (§2.3) |
| S3 | `.login-card::after` trees (style.css:509) | viewBox 560×130 `none` on 340px card → squashed; z-index above content | see §3.1 |
| S4 | Logo `svg.logo` (app.js:96) | Fixed 46/54/76px, no responsive sizes; gradient id `avgrad` — **if the logo is inlined more than once on a page (topbar + login/pub), duplicate IDs; and a gradient defined inside a `display:none` SVG breaks others** | sizes per §2.2/§3.1/§3.13; give `<defs>` a unique id per instance (`avgrad-${n++}`) or move the gradient to one hidden-but-rendered `<svg width="0" height="0" style="position:absolute">` |
| S5 | Icon sprite `svg.i` (`1em`) | Size depends on parent font-size; several parents have fixed big sizes: `.notice>svg 30px`, `.secure svg 36px`, `.login-foot svg 36px`, `.mini-stats svg 26px`, `.empty svg 36px`, `.upload svg 26px`, `.side-tag svg 30px` | at ≤480 cut each by ~25%; add `flex:none` already set — ensure parents that are not flex (`.empty`, `.upload` are fine) |
| S6 | Icons next to wrapping text | `.list-check li svg`, `.act`, `.notice` align to top – OK; `.notice{align-items:center}` with 30px icon centres vs 3-line text → change to `flex-start` ≤600 | |
| S7 | QR (`.qr` 96px, passport + verify) | **VERIFY** how rendered (canvas/img/svg). If SVG, needs `viewBox` + `shape-rendering="crispEdges"` + `width:100%;max-width:140px;aspect-ratio:1`; must not shrink below ~96px (scan reliability) → `flex:none` | |
| S8 | `.donut` | CSS conic-gradient (not SVG) — scale sizes per §3.2; `.ring` same | |
| S9 | Emoji image fallback (`app.js:80-93`) | `font-size` computed **once** from `getBoundingClientRect()` in rAF → wrong after rotation/resize and if element is `display:none` at error time (tab panels) | re-run sizing on `resize` + when panels show; or CSS-only: `.ph{font-size:clamp(14px,5vw,40px)}` with `container-type:size` + `font-size:50cqmin` |
| S10 | Missing real images (`IMAGES-NEEDED.md`: hero-banner.jpg, login-bg.jpg, verify-bg.jpg, honey.jpg…) | 404s fall to SVG/gradient fallbacks that look worst on mobile | Supply assets, export **mobile-cropped variants** (`-m.jpg` 800w) and use `image-set`/`@media` swap; add `loading="lazy"` and `width/height` attributes on `<img>` to avoid layout shift |

---

## PHASE 6 — Hero & header blocks — P1
- `.hero` (min-height 96, padding 18/24): ≤600 padding `14px`; `.hero h1` 22px; `.hero p` 13.5px, `max-width:none`.
- `.hero-row`: `flex-wrap:wrap`; `.hero-icon` 48px.
- `.pagehead h1` 31px → 24 (≤900) → 22 (≤480); `align-items:flex-start` ≤600; `.actions` full-width (§1.4).
- `.crumbs` overflow: `flex-wrap:wrap` or `overflow:hidden;white-space:nowrap;text-overflow:ellipsis` on last item.
- `.sec-head` : `.t{min-width:0}`; icon 42→36 ≤480.
- `.welcome h1` emoji + long name: `overflow-wrap:anywhere`.

---

## PHASE 7 — JS (app.js) changes — P1
1. `setNav()`: set `inert`/`aria-hidden` on closed drawer, lock body scroll, close on link click and on `resize > 900`.
2. Menus: close notif/user menu on `scroll` and `resize`; clamp inside viewport.
3. `toast()`: no change except CSS.
4. Emoji fallback re-size on resize (S9).
5. For tabs/steppers/stages: after activation call `el.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'})`.
6. Master-detail pages (buyers, audit, schemes, rejection): on ≤900 open detail as sheet (shared helper `openSheet(node)`), with close button + Esc + back-gesture friendly (`history.pushState`).
7. `confirmBox()` uses `aria-label="${title}"` via innerHTML — escape title (tiny XSS/overflow hazard; not mobile-specific but touch while here).

---

## PHASE 8 — Meta & misc — P2
- All pages have `width=device-width,initial-scale=1`. Keep. Do **not** add `maximum-scale=1` (a11y). Optionally add `viewport-fit=cover` + safe-area padding if you want notch support.
- `<meta name="theme-color" content="#0b3a29">` on all pages.
- Add `-webkit-tap-highlight-color:rgba(34,160,90,.15)`.
- `html{scroll-behavior:smooth}` → wrap in `@media (prefers-reduced-motion:no-preference)`.
- `@media print` block exists; keep.
- Remove debug outline (Phase 0.4).

---

## PHASE 9 — Safety net (last, only after everything above)
```css
@media (max-width:900px){ html,body{overflow-x:clip} }
```
`clip` (not `hidden`) so sticky/fixed still work. If this ever *hides* something in testing, that's a bug to fix at source.

---

## ACCEPTANCE CHECKLIST (agent must tick each, per page, at 320 / 360 / 390 / 768)

For all 13 pages: `index.html, login, dashboard, my-batches, create-batch, passport, quality-price, buyers, post-harvest, rejection, audit, schemes, profile, verify`
- [ ] `document.documentElement.scrollWidth === clientWidth` (console script from Phase 0 prints nothing)
- [ ] No text clipped, overlapped, or running under another element; long hash/ID wraps
- [ ] No SVG (logo, icons, hero, trees, QR) stretched or cropped oddly; logo ratio 1:1
- [ ] Topbar fits at 320 without wrapping; notif + user menus fully on-screen
- [ ] Drawer opens/closes, scrim works, body doesn't scroll behind, last nav item reachable in landscape
- [ ] All interactive elements ≥ 44×44 CSS px (coarse pointer) — check via DevTools "Show tap targets" or the snippet: `[...document.querySelectorAll('a,button,input,select,.tab,.chipsel span')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.width<40||r.height<40)})`
- [ ] Inputs don't trigger iOS zoom (font-size ≥16px)
- [ ] Tables scroll with visible hint or are card-ified
- [ ] Forms: create-batch all 4 steps completable with on-screen keyboard (sticky bar not covering fields; use `scroll-padding-bottom`)
- [ ] Master-detail pages: tapping an item visibly shows detail
- [ ] No inline `grid-template-columns` / fixed `width` left in HTML except `max-width` or CSS variables: `grep -nE 'style="[^"]*(grid-template-columns|[^-]width:\s*[0-9]+px|min-width:\s*[0-9]+px)' site/*.html` returns 0 rows
- [ ] Landscape 640×360 usable
- [ ] Before/after screenshots saved to `site/_mobile-audit/{before,after}/`

## SUGGESTED EXECUTION ORDER (commit after each)
1. Phase 0 audit + screenshots
2. Phase 1 foundation → Phase 2 shell (fixes all pages' top area at once)
3. §3.0 helper classes, then migrate inline styles page by page (post-harvest, profile, rejection, audit, passport, dashboard first — worst offenders)
4. Phase 4 tables
5. Phase 5 SVG fixes
6. Phase 3 remaining per-page polish (login, verify, create-batch stepper, buyers sheet)
7. Phase 6/7/8, then Phase 9, then full acceptance pass

## WORST OFFENDERS (fix first)
1. Notification dropdown clipped off-screen left (app.js/style.css:49)
2. `post-harvest.html:20` fixed 340px column
3. `profile.html:28,49` forced 2/4-col grids + `min-width:280`
4. `rejection.html:56,60` inline multi-col grids + 118px date inputs
5. `login.html` brand 76px/38px overflow + `.lang` overlapping brand
6. Dashboard `.att-row` hiding data; bar-chart label collisions; donut row overflow
7. Stretched SVG backgrounds (hero/side-art/login trees)
8. `.gal` 4-col & `.kvt`/`.dl` 3-col with no mobile rule
9. iOS input zoom + 28–34px tap targets everywhere
10. Hash/ID strings with no wrapping on audit/passport/verify
