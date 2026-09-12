---
name: responsive-design
description: >-
  Mobile-first responsive layout for ParishHub web apps (smartphone and tablet).
  Use when adapting UI for mobile/pad, fixing overflow, stacking layouts,
  touch targets, sticky headers/nav, or reviewing church-catechesis /
  church-liturgy screens at 375–1024px viewports.
paths:
  - "**/church-catechesis/**/*.{html,css,js}"
  - "**/church-liturgy/**/*.{html,css,js}"
  - "**/*.{css,html}"
---

# Responsive Design (ParishHub)

Preserve the existing Marian Blue / Catholic Sunday School visual language.
Do not redesign aesthetics from scratch — adapt layout, density, and interaction for phone and tablet.

## Subject & audience

- Product: parish Sunday school ops (attendance, schedule, grace points, directory)
- Users: teachers/admins on phone between Mass and class; sometimes tablet
- Job on mobile: reach the right tab fast, complete one task without horizontal scroll

## Breakpoints (mobile-first base, then enhance)

| Token | Width | Device |
|-------|-------|--------|
| base | ≤479px | phone portrait (iPhone SE+) |
| `sm` | ≥480px | large phone |
| `md` | ≥768px | tablet portrait |
| `lg` | ≥960px | tablet landscape / small laptop |
| `xl` | ≥1280px | desktop |

Prefer CSS that starts from a single-column phone layout, then adds columns at `md`/`lg`.
Avoid desktop-only inline `grid-template-columns: 2fr 1fr` without a matching media query or utility class.

## Hard requirements

1. **No page-level horizontal scroll** at 375px / 390px / 768px. Tab bars may scroll internally.
2. **Touch targets ≥ 44×44px** for primary actions (attendance toggles, nav tabs, CTA buttons).
3. **Sticky chrome stays compact**: header + nav combined should not dominate the first viewport. Collapse secondary chrome (demo badges, long English subtitles, “reset data”) on phone.
4. **One job per screen fold**: on phone, D-Day photo → headline → progress; summary cards below.
5. **Tables**: on phone (≤768), replace wide data tables with compact `.mobile-card-list` cards (title + few meta fields + actions). Keep tables on tablet/desktop via `.data-view-desktop`. Do not dump every column as labeled rows (taller than the table).
6. **Charts**: give a horizontal scroll shell with `min-width` on the chart track (e.g. monthly 10-bar chart).
7. **Modals**: bottom-sheet style on phone (`align-items: flex-end`, full width, thumb-reachable footer buttons).
8. **Images**: keep 4:3 hero crops; `object-fit: cover; object-position: center`; no fixed `max-height` that clips hearts/faces.
9. **Safe area**: respect `env(safe-area-inset-*)` for sticky header/footer/toast when present.
10. **`prefers-reduced-motion`**: disable decorative hover scales / bounce if the user requests reduced motion.

## Layout patterns

### Phone (base)

```
[ brand | essential actions ]
[ scrollable nav tabs ...... ]
[ hero image full bleed card ]
[ title + CTA ]
[ progress ]
[ 1-col or 2-col KPIs ]
[ stacked sections ]
```

- Stack split grids (`dashboard-split`, `activities-layout`, stats charts) to `1fr`.
- Nav: horizontal scroll, no wrap, hide scrollbar, `-webkit-overflow-scrolling: touch`.
- Brand title: short Korean label on phone; full title from `md` up.

### Tablet (`md`–`lg`)

- 2-column KPIs and feast cards OK.
- D-Day can stay stacked until `lg` if the photo needs full width; at `lg` restore side-by-side.
- Toolbars may stay wrapping; avoid forcing single-row overflow.

## CSS checklist before shipping

- [ ] Replace fragile inline grids with classes + `@media`
- [ ] `minmax(min(100%, Npx), 1fr)` instead of bare `minmax(300px, 1fr)`
- [ ] `min-width: 0` on grid children that contain tables
- [ ] `overflow-x: clip` on `body` only after root overflow causes are fixed
- [ ] Verify 375, 390, 768, 1024 in browser (screenshot)
- [ ] Primary flows: Dashboard, Schedule, Attendance, Stats

## Anti-patterns

- Hamburger that hides the only weekly workflow tabs behind an extra tap (prefer scrollable tab bar for ≤7 tabs)
- Shrinking type below ~12px for critical labels
- Desktop hover-only affordances without pressed/active states
- Purple SaaS / cream-terracotta / newspaper defaults (existing brand wins)
- Packing demo/admin controls into the sticky header on phone

## Process

1. Audit overflow and sticky height at 390px.
2. Fix structural grids/toolbars/header first.
3. Then density (padding, type scale), then polish.
4. Screenshot phone + tablet before calling done.
