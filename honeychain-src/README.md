# AranyaValue

Forest produce quality-to-price platform. React + Vite (frontend), Express + SQLite (backend).

## Run

```powershell
cd backend
npm install
npm run seed     # resets the demo database
npm start        # http://localhost:4000
```

```powershell
cd frontend
npm install
npm run dev      # http://localhost:5173 (proxies /api to :4000)
```

Demo logins (also quick-fill buttons on the login page):

| Role | Email | Password |
|---|---|---|
| Collector | mina@aranya.demo | collector123 |
| Buyer | buyer.haat@aranya.demo | buyer12345 |

Sample prices, buyers, and centres are labelled demonstration data.

## Frontend layout (`frontend/app`)

```
app/
  main.jsx, App.jsx        providers, lazy routes, auth/role guards
  api/queries.js           TanStack Query hooks for every endpoint
  context/                 AuthContext, UIContext (toasts + confirm dialog)
  components/ui/           Icon, Button, Card, Chip, Field, Tabs, Pagination, states
  components/layout/       AppShell (top bar, sidebar, page transitions), PageHero
  components/motion/       CountUp (GSAP), Stagger/Item/Reveal (Framer Motion)
  pages/                   one file per screen
  lib/                     api client, formatters, motion variants, guidance content
  styles/                  tokens, base, components, pages, responsive, motion
```

Animation: Framer Motion handles page transitions, list staggers, shared-layout
tab/nav indicators, dialogs and toasts. GSAP drives the login timeline, hero
pointer drift, sidebar intro and number count-ups. `prefers-reduced-motion` is
respected (`MotionConfig reducedMotion="user"` and explicit GSAP checks).

Images: drop files into `frontend/public/img/` (see `IMAGES-NEEDED.md` there).
Missing images fall back to emoji tiles.

`frontend/src/` is the previous multi-role UI, kept for reference. It is no
longer loaded (`index.html` points at `/app/main.jsx`).
