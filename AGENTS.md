<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# REAL — Project Agent Instructions

## 1. Project identity

REAL is the administrative application for Colegio REAL de Escuinapa.

Current stack:

- Next.js 16.3.1
- React 19
- TypeScript
- npm
- Tailwind CSS v4
- shadcn/ui
- Base UI
- Nova preset
- Geist
- Lucide
- Supabase/PostgreSQL
- `@supabase/supabase-js`
- `@supabase/ssr`
- Vercel Hobby
- Supabase Free

This is an implementation phase. Core business rules, DB architecture, authorization, functional UX flows, and navigation have already been designed and reviewed.

Do not treat the repository as a blank-slate product-design exercise.

---

## 2. Highest-level rule

Implement within the existing architecture.

Do not redesign business rules, DB structure, RLS, permissions, Auth, role semantics, primary navigation, financial behavior, academic behavior, or closed UX flows unless a real contradiction or technical blocker is found.

If such a blocker exists:

1. stop the affected implementation;
2. explain the concrete conflict;
3. identify the files/rules involved;
4. propose the smallest viable options;
5. ask for approval before changing the closed decision.

Do not silently “improve” closed rules.

---

## 3. Source-of-truth hierarchy

When instructions conflict, use this order:

1. existing business rules and closed functional handoffs;
2. Supabase schema, migrations, RLS, RPCs, and permissions;
3. `docs/ux_ui/ui-implementation-contract.md`;
4. relevant F2–F9 UX document for the module;
5. local implementation choices.

Relevant functional/architecture docs include:

```text
docs/business-rules.md
docs/target-data-model.md
docs/financial-model.md
docs/academic-model.md
docs/permissions.md
docs/handoffs/
supabase/migrations/
```

Do not infer new business behavior from mockups when a functional source already defines it.

---

## 4. Read only what the task needs

Do not load all UX documentation for every task.

Use this routing table:

```text
Global navigation / routes         → docs/ux_ui/F2-mapa-pantallas-navegacion.md
Login / shell / visual system      → docs/ux_ui/F3-login-shell-sistema-visual.md
Admin / students / account         → docs/ux_ui/F4-nucleo-administrativo.md
Enrollment / preregistration       → docs/ux_ui/F5-matricula-preinscripcion-ciclo.md
Payments / financial config        → docs/ux_ui/F6-pagos-configuracion-financiera.md
Academic / Professor               → docs/ux_ui/F7-academico-profesor.md
Tutor / Reports                    → docs/ux_ui/F8-tutor-reportes.md
Cross-cutting states / QA          → docs/ux_ui/F9-estados-QA-UX-handoff.md
```

Always follow:

```text
docs/ux_ui/ui-implementation-contract.md
```

for transversal UI behavior.

Use:

```text
docs/ux_ui/desing-inspo.png
```

as the canonical visual reference for whiteness, density, borders, spacing, hierarchy, and restrained financial-product styling. Do not copy its layout literally.

---

## 5. UI contract

The application must feel:

```text
clean
very white
minimal
fast
responsive
modern
predictable
accessible
```

Use shadcn primitives before creating custom primitives.

Do not recreate `Button`, `Input`, `Dialog`, `Sheet`, `Select`, `Tabs`, etc. manually when shadcn already provides the pattern.

Custom components should represent REAL domain concepts or reusable composition, for example:

```text
StudentRow
FinancialStatus
AccountSummary
PaymentRow
EnrollmentRow
GradeEditor
ChildSelector
ReportKPI
```

Avoid duplicate context-specific versions when composition/variants can share a base.

Avoid carditis, strong shadows, decorative gradients, excessive color, and generic dashboard-template styling.

---

## 6. Canonical interaction behavior

Follow `ui-implementation-contract.md`. In particular:

### Toasts

Use a global `top-center` toast position.

Toasts should feel like compact mobile notifications:

- icon + short message;
- no long copy;
- subtle border/shadow;
- do not cover sticky CTAs or navigation.

### Sheets

Desktop:

```text
normally ~50% viewport width
```

Tablet:

```text
roughly 60–75%
```

Mobile task/detail sheets:

```text
full-screen
```

Mobile full-screen sheets need their own header, clear back/close control, safe-area handling, internal scroll, and explicit primary/cancel actions when appropriate.

If a task becomes too large for a sheet, use a dedicated route/page.

### Dialogs

Use for small decisions and confirmations, not long workflows.

### Mobile

Design intentionally for mobile; do not shrink desktop tables or forms.

Primary QA widths:

```text
390px
768px
1440px
```

---

## 7. Existing Auth architecture — reuse it

Do not replace the current Supabase SSR/Auth integration.

Reuse:

```text
lib/supabase/client.ts
lib/supabase/server.ts
lib/supabase/proxy.ts
proxy.ts
lib/auth/home-route.ts
lib/auth/require-role.ts
```

Current login route:

```text
/login
```

Current role homes:

```text
MASTER / ADMINISTRATIVO → /admin
PROFESOR                → /profesor
TUTOR                    → /tutor
```

Do not introduce separate login systems per role.

Do not introduce deprecated Supabase auth helpers or a parallel Supabase client architecture.

Do not put secret/service-role credentials in browser-accessible environment variables.

---

## 8. Authorization

The backend is authoritative.

UI must hide actions the current role cannot perform, but visual hiding is not authorization.

Respect existing:

- RLS;
- permissions;
- role mappings;
- RPC authorization;
- family access;
- academic access;
- financial access.

Do not loosen policies just to make a screen work.

If a legitimate screen is blocked, inspect the existing permission model before proposing any DB change.

---

## 9. DB ↔ app contract

Prefer existing transactional RPCs and canonical functions.

For sensitive mutations:

```text
App → existing transactional RPC
```

Do not reimplement one transaction through multiple unrelated client-side inserts/updates.

This is especially important for:

- payments;
- payment applications;
- credit use/correction;
- payment reversal/refund;
- enrollment financial initialization;
- financial plan changes;
- financial configuration changes;
- enrollment events;
- grade corrections.

For reads:

- select only required columns;
- prefer canonical functions/views/RPCs when available;
- avoid `SELECT *`;
- avoid loading full datasets just to filter in the browser;
- avoid duplicating critical derived logic in the client.

Before inventing a DB query pattern, inspect the relevant migrations/functions.

---

## 10. Performance and free-tier discipline

Vercel and Supabase are intentionally kept on free tiers.

Optimize for low resource use and speed.

Avoid by default:

- polling;
- global Realtime subscriptions;
- redundant queries;
- duplicate fetches between parent/child components;
- unnecessary API routes;
- large client bundles;
- heavy dependencies for trivial tasks;
- downloading large datasets to filter client-side;
- refetching unchanged data during every tab change;
- unnecessary preview/deployment behavior in app code.

Prefer:

- Server Components where appropriate;
- focused server-side reads;
- existing RPCs;
- incremental loading;
- local UI state for already-fetched context;
- route-level/data caching only when semantically safe.

Do not optimize by weakening correctness or authorization.

---

## 11. Perceived performance

REAL should feel fast when users:

- change tabs;
- move between modules;
- open/close sheets;
- search;
- open a student;
- review payments;
- navigate back.

Keep the shell stable.

Use skeletons for meaningful loading.

Do not use a full-screen spinner as the default loading pattern.

Avoid unnecessary layout shifts.

Preserve search/filter context and scroll when reasonably possible.

---

## 12. Financial implementation rule

Financial behavior is closed.

Do not invent:

- cash closing;
- cash drawer shifts;
- accounting concepts outside scope;
- automatic debt forgiveness;
- automatic credit application;
- new payment-allocation semantics;
- direct destructive edits of historical financial facts.

Use the existing financial model and RPCs.

If UI needs a behavior not obviously supported, inspect:

```text
docs/financial-model.md
docs/handoffs/caja-pagos-pos.md
docs/handoffs/descuentos-configuracion.md
supabase/migrations/
```

before proposing anything.

---

## 13. Academic implementation rule

Do not alter the closed academic semantics.

Respect:

- role-specific capture;
- open/closed capture windows;
- quantitative/qualitative constraints;
- official-average subject rules;
- read-only history;
- administrative correction rules;
- tutor publication/access rules.

Inspect:

```text
docs/academic-model.md
docs/handoffs/profesores-calificaciones.md
docs/ux_ui/F7-academico-profesor.md
```

when implementing academic work.

---

## 14. Routing and navigation

Do not invent a new information architecture.

F2 defines the navigation model.

Keep contextual actions contextual instead of promoting every action into main navigation.

Admin/Master, Professor, and Tutor should share primitives and infrastructure but have role-appropriate navigation and composition.

Deep links and refresh on detail routes should work.

Browser back should behave naturally.

---

## 15. Forms and sensitive actions

No auto-save for:

- payments;
- enrollment;
- financial changes;
- corrections;
- status changes;
- grades.

Disable submit while a mutation is in flight.

Do not mark sensitive mutations as successful before backend confirmation.

Preserve form values on recoverable errors.

Use inline validation for field errors.

Never expose technical DB/Auth error messages directly to end users.

---

## 16. Implementation workflow

Default to one main implementation thread and vertical slices.

Preferred loop:

```text
understand task
→ read only relevant docs
→ inspect existing code/schema needed
→ implement
→ run proportional QA
→ report result
→ human reviews
→ human commits
```

Do not create commits automatically unless explicitly requested.

Do not create worktrees or parallel subagents by default.

Use worktrees only when there is clear value, such as:

- isolated experiment;
- large risky refactor;
- truly independent work;
- explicit user request.

Avoid parallelizing small UI tasks because it duplicates context, QA, dependency work, and merge effort.

---

## 17. First implementation priority

The first serious vertical slice is:

```text
Login
→ Admin Inicio
→ Search student
→ Student detail
→ Account statement
→ Register payment
→ Confirmation
```

Validate it at:

```text
390px
1440px
```

before expanding broadly.

Then prioritize:

1. Professor mobile flow;
2. Tutor flow;
3. remaining modules.

Do not implement the entire app horizontally before validating the vertical core.

---

## 18. Mock data

Mock/control data may be used temporarily to validate:

- layout;
- responsive behavior;
- loading;
- empty;
- error;
- long names;
- large amounts.

Mocks must resemble REAL data.

Do not let mock schemas become an accidental second domain model.

When connecting backend, use the real schema/contracts.

---

## 19. QA expectations

QA should be proportional to the change.

For UI work, check as relevant:

```text
390px
768px
1440px
```

and:

- loading;
- empty;
- error;
- long content;
- large amounts;
- permissions;
- keyboard;
- focus;
- no horizontal overflow;
- back;
- refresh;
- direct URL;
- sheet/dialog behavior.

For code changes, run at minimum the relevant checks available in the repo, typically:

```bash
npm run build
npm run lint
```

Do not perform expensive exhaustive QA after every trivial edit if targeted validation is sufficient.

---

## 20. Next.js version discipline

This repository uses a current Next.js version with breaking changes.

Before implementing a Next.js API, convention, caching behavior, request API, routing pattern, proxy behavior, metadata behavior, or other version-sensitive feature, follow the managed Next.js instructions at the top of this file and read the relevant installed docs under:

```text
node_modules/next/dist/docs/
```

Do not assume older Next.js conventions are still correct.

---

## 21. Package discipline

Package manager:

```text
npm
```

Do not switch to pnpm, yarn, or bun.

Avoid global installs when `npx` or local dependencies are sufficient.

Before adding a dependency:

1. check whether the stack already solves the need;
2. prefer shadcn/Base UI/native browser/Next/Supabase capabilities;
3. justify large dependencies.

---

## 22. Environment and deployment

Local development uses:

```text
.env.local
```

Do not commit it.

Public frontend configuration currently uses:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

Do not add service-role/secret keys to `NEXT_PUBLIC_*`.

Deployment is intentionally:

```text
push to main
→ GitHub Actions
→ Vercel CLI
→ Vercel
```

Do not add or depend on Vercel Git Integration unless explicitly requested.

The current temporary deployment URL may change before launch. Use environment-aware URL helpers rather than hardcoding deployment domains.

Reuse:

```text
lib/site/url.ts
```

when a canonical site URL is needed.

---

## 23. Repository boundaries

Do not casually edit:

```text
supabase/migrations/
migration/input/
migration/output/
migration/reports/
```

during normal UI implementation.

DB migrations are deliberate architectural changes and require explicit approval unless the task specifically asks for them.

Historical ETL artifacts are reference/history, not app runtime code.

Do not modify generated or tool-managed files unless necessary.

Keep the managed Next.js block in this file intact.

---

## 24. Things to avoid

Do not:

- redesign closed business rules;
- create alternative Auth;
- loosen RLS to unblock UI;
- duplicate financial logic in React;
- create unnecessary API routes;
- add polling by default;
- use Realtime by default;
- add a second component library;
- recreate shadcn primitives;
- make every section a card;
- add decorative dashboard charts;
- hide critical actions behind icon-only controls;
- compress desktop tables into unreadable mobile tables;
- auto-save sensitive operations;
- show raw technical errors;
- add worktrees/subagents without clear benefit;
- commit automatically without request;
- read every project document for every task.

---

## 25. Definition of a good implementation

A good REAL implementation:

- matches closed functional behavior;
- uses the existing DB/Auth architecture;
- is simple to understand;
- feels fast;
- uses little unnecessary compute/network;
- is responsive by design;
- is easy to operate from mobile;
- shares components appropriately;
- handles loading/error/empty states;
- passes relevant QA;
- makes the smallest architectural change necessary.

When several implementations are valid, prefer the simplest one that preserves correctness, performance, maintainability, and the established UX contract.

