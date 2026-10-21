# AURELIA UA — Project Rules & Coursework Compliance Checklist

> **Mandatory.** Every file generated or edited in this project must follow these rules without exception.
> Treat this document as the single source of truth for all code quality, structure, and design decisions.

---

## 0. Project Overview

| Field | Value |
|---|---|
| **App Name** | AURELIA UA |
| **Type** | Mobile-First Progressive Web App (PWA) |
| **Purpose** | Store Ukrainian supermarket loyalty QR/barcodes & compare store promotions |
| **Supported Stores** | Silpo, ATB, NOVUS, VARUS, METRO |
| **Frontend Host** | GitHub Pages (`client/`) |
| **Backend Host** | Render (`server/`) |
| **Language** | Ukrainian (UI), English (code & comments) |

---

## 1. Language Rule

- All **user-facing HTML content** — labels, headings, button text, placeholder text, `<title>`, `<meta name="description">`, `aria-label` values, `alt` attributes — **must be written in Ukrainian**.
- Every HTML file must open with `<html lang="uk">`.
- Code identifiers, comments, and documentation remain in English.

---

## 2. W3C HTML Compliance Checklist

Every `.html` file **must** include, in this exact order inside `<head>`:

```html
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>… (≤ 60 characters, unique per page)</title>
  <meta name="description" content="… (≤ 155 characters, unique per page)">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="css/normalize.css">
  <link rel="stylesheet" href="css/styles.css">
</head>
```

**Validation:**
- [ ] `<!DOCTYPE html>` on line 1
- [ ] `<html lang="uk">`
- [ ] `<meta charset="UTF-8">` is the **first** tag inside `<head>`
- [ ] `<meta name="viewport" ...>` present
- [ ] `<title>` is unique, ≤ 60 chars
- [ ] `<meta name="description">` is unique, ≤ 155 chars
- [ ] Favicon linked as SVG
- [ ] Both `normalize.css` and `styles.css` linked externally
- [ ] Page passes [W3C HTML Validator](https://validator.w3.org/) with zero errors

---

## 3. No Inline Styles Rule

- **NEVER** use `<style>` tags inside any `.html` file.
- **NEVER** use `style="..."` inline attributes on any HTML element.
- **ALL** visual styling must live in `client/css/styles.css` (or scoped component CSS files).
- JavaScript files must be loaded with the `defer` attribute:
  ```html
  <script src="js/app.js" defer></script>
  ```
- No `<script>` tags with inline JavaScript inside HTML files.

---

## 4. Semantic Markup & Heading Hierarchy

### Required Structural Elements
Every page must use appropriate semantic HTML5 elements:

| Element | Purpose |
|---|---|
| `<header>` | Site-wide top bar with logo + navigation |
| `<nav>` | Primary navigation links |
| `<main>` | Primary page content (one per page) |
| `<section>` | Thematic groupings within `<main>` |
| `<article>` | Self-contained content (card, loyalty card item) |
| `<footer>` | Site-wide footer with links & copyright |

### Heading Hierarchy Rules
- Exactly **one** `<h1>` per page — the primary page title.
- `<h2>` for section headings, `<h3>` for subsection headings.
- **Never skip** heading levels (no jumping from `<h1>` to `<h3>`).
- **Never use** headings purely for visual sizing — use CSS classes instead.

### Image Rules
- Every `<img>` must have a **descriptive** `alt` attribute in Ukrainian.
- Decorative images use `alt=""` and `role="presentation"`.
- Always specify `width` and `height` attributes to prevent layout shift.

---

## 5. Mobile-First & Responsive Design

### CSS Architecture
- Write **base styles for mobile** (smallest viewport) first — no `max-width` media queries.
- Progressively enhance with `min-width` breakpoints:

```css
/* Mobile base (default — no media query) */

/* Tablet */
@media (min-width: 768px) { … }

/* Desktop */
@media (min-width: 1200px) { … }
```

### Layout Requirements
- Use **CSS Flexbox** for one-dimensional layouts (nav bar, card rows).
- Use **CSS Grid** for two-dimensional layouts (card grids, page layout).
- **Zero horizontal scrollbar** at any viewport width — test at 320px minimum.
- Implement a **responsive burger menu** for mobile:
  - Hamburger icon (☰) visible on mobile, hidden on desktop.
  - Menu slides in/out without page reload.
  - Closes when clicking outside or pressing `Escape`.

### Touch & Accessibility
- Minimum touch target size: **44×44 px**.
- Visible `:focus-visible` outline on all interactive elements.
- Sufficient color contrast (WCAG AA minimum — 4.5:1 for normal text).

---

## 6. Forms & Modals

### Form Rules
- Every `<input>`, `<select>`, `<textarea>` must have an explicit `<label for="inputId">`.
- Use appropriate `type` attributes: `type="email"`, `type="tel"`, `type="search"`, `type="text"`, etc.
- All required fields must have the `required` attribute.
- Validate inputs client-side **before** submission; show inline Ukrainian error messages.
- Never rely solely on browser default validation UI.

### Modal Rules
- Modals must open and close **without page reload**.
- Every modal must have:
  - A close button (`×` or an icon) inside the modal.
  - Backdrop overlay that closes the modal on click ("miss click").
  - `Escape` key binding to close.
- While a modal is open, background page scroll must be locked (`overflow: hidden` on `<body>`).
- Use `<dialog>` element or ARIA `role="dialog"` with `aria-modal="true"`.
- Focus must be trapped inside the open modal.

---

## 7. SVG Sprite System

- **All** repeating icons and supermarket logos/badges are stored in `client/assets/sprite.svg`.
- Reference icons in HTML using:
  ```html
  <svg class="icon" aria-hidden="true">
    <use href="assets/sprite.svg#icon-id"></use>
  </svg>
  ```
- For accessible icons (standalone, no visible label), add `role="img"` and `<title>`:
  ```html
  <svg class="icon" role="img" aria-label="Пошук">
    <use href="assets/sprite.svg#icon-search"></use>
  </svg>
  ```
- **Never** embed raw SVG markup inline in HTML for repeating icons.
- Icon class sizing is controlled exclusively by CSS (e.g., `.icon { width: 24px; height: 24px; }`).

### Required Sprite Symbols

| Symbol ID | Purpose |
|---|---|
| `icon-qr` | QR code icon |
| `icon-barcode` | Barcode icon |
| `icon-camera` | Camera / scan icon |
| `icon-upload` | Upload / import icon |
| `icon-search` | Search magnifier |
| `icon-filter` | Filter / funnel icon |
| `icon-cart` | Shopping cart |
| `icon-plus` | Add / create |
| `icon-edit` | Edit / pencil |
| `icon-trash` | Delete / bin |
| `icon-close` | Close / ✕ |
| `icon-sun` | Light theme toggle |
| `icon-moon` | Dark theme toggle |
| `icon-check` | Confirm / checkmark |
| `logo-silpo` | Silpo supermarket badge |
| `logo-atb` | ATB supermarket badge |
| `logo-novus` | NOVUS supermarket badge |
| `logo-varus` | VARUS supermarket badge |
| `logo-metro` | METRO supermarket badge |

---

## 8. Design System — Minimalist Luxury

### CSS Custom Properties (Dark Theme — Default)

```css
:root {
  /* Backgrounds */
  --bg-primary:   #09090B;
  --bg-card:      #131318;
  --bg-surface:   #1C1C23;

  /* Accent */
  --accent-gold:  #D4AF37;
  --accent-gold-hover: #B8962E;

  /* Text */
  --text-main:    #F4F4F6;
  --text-muted:   #8E8E9A;
  --text-inverse: #09090B;

  /* Borders */
  --border:       #2A2A35;
  --border-focus: #D4AF37;

  /* Feedback */
  --success:      #22C55E;
  --error:        #EF4444;
  --warning:      #F59E0B;

  /* Sizing */
  --radius-sm:    6px;
  --radius-md:    12px;
  --radius-lg:    20px;
  --shadow-card:  0 4px 24px rgba(0, 0, 0, 0.5);

  /* Typography */
  --font-sans:    'Inter', system-ui, -apple-system, sans-serif;
  --font-mono:    'JetBrains Mono', 'Fira Code', monospace;
}
```

### Light Theme Override

```css
[data-theme="light"] {
  --bg-primary:   #F8F8FA;
  --bg-card:      #FFFFFF;
  --bg-surface:   #EFEFF3;
  --text-main:    #09090B;
  --text-muted:   #6B6B78;
  --text-inverse: #F4F4F6;
  --border:       #DDDDE5;
  --shadow-card:  0 4px 24px rgba(0, 0, 0, 0.08);
}
```

### Theme Persistence
- On page load, read `localStorage.getItem('aurelia-theme')`.
- Apply `document.documentElement.setAttribute('data-theme', theme)` before first paint.
- Toggle button must update both `data-theme` and `localStorage`.

### Typography Scale

| Variable | Value | Usage |
|---|---|---|
| `--text-xs` | `0.75rem` | Labels, badges |
| `--text-sm` | `0.875rem` | Secondary text |
| `--text-base` | `1rem` | Body copy |
| `--text-lg` | `1.125rem` | Sub-headings |
| `--text-xl` | `1.25rem` | Section headings |
| `--text-2xl` | `1.5rem` | Page headings |
| `--text-3xl` | `1.875rem` | Hero headings |

---

## 9. File Structure Reference

```
Project X/
├── GEMINI.md                    ← This file
│
├── client/                      ← GitHub Pages root
│   ├── index.html               ← Home / loyalty card catalog
│   ├── catalog.html             ← Promotions catalog
│   ├── basket.html              ← Shopping basket / comparison
│   ├── admin.html               ← Admin panel (protected)
│   ├── 404.html                 ← Custom 404 page
│   │
│   ├── css/
│   │   ├── normalize.css        ← Cross-browser reset (fully implemented)
│   │   └── styles.css           ← App design system & all component styles
│   │
│   ├── js/
│   │   ├── api.js               ← Fetch wrapper & API calls to backend
│   │   ├── app.js               ← Global app init, theme, burger menu
│   │   ├── qr.js                ← QR/barcode scanning & display logic
│   │   └── admin.js             ← Admin panel logic
│   │
│   ├── assets/
│   │   ├── sprite.svg           ← All SVG icons & logos (fully implemented)
│   │   └── favicon.svg          ← Gold monogram favicon (fully implemented)
│   │
│   ├── manifest.json            ← PWA web app manifest
│   └── sw.js                    ← Service Worker (offline caching)
│
└── server/                      ← Render backend
    ├── server.js                ← Express entry point
    ├── package.json             ← Node.js dependencies
    ├── .env.example             ← Environment variable template
    ├── routes/                  ← Express route definitions
    ├── controllers/             ← Business logic handlers
    ├── middleware/              ← Auth, validation, error handling
    └── db/                      ← Database connection & models
```

---

## 10. Git & Code Quality

- Commit messages follow **Conventional Commits**: `feat:`, `fix:`, `style:`, `refactor:`, `docs:`, `chore:`.
- No secrets, API keys, or `.env` files are ever committed.
- `.gitignore` must exclude `node_modules/`, `.env`, `dist/`, `.DS_Store`.
- All JavaScript uses **ES2020+** syntax (`async/await`, optional chaining, nullish coalescing).
- No `var` — use `const` and `let` only.
- Functions are concise, single-responsibility, and documented with JSDoc where non-obvious.

---

## 11. PWA Requirements

- `manifest.json` must define: `name`, `short_name`, `start_url`, `display: "standalone"`, `theme_color`, `background_color`, icons at 192×192 and 512×512.
- `sw.js` must implement a **Cache-First** strategy for static assets and a **Network-First** strategy for API calls.
- The app must be **fully functional offline** for previously viewed loyalty cards.
- Lighthouse PWA score target: **≥ 90**.

---

## 12. Backend Rules (`server/`)

- Framework: **Express.js** with `cors`, `helmet`, `express-rate-limit`.
- Database: **PostgreSQL** via `pg` (or `mongoose` for MongoDB — decide before starting).
- Authentication: **JWT** (`jsonwebtoken`) — admin routes are protected.
- All routes validated with **Joi** or **Zod**.
- Error responses always return JSON: `{ "error": "message", "code": "ERROR_CODE" }`.
- Never expose stack traces in production responses.
- Use `dotenv` for environment variables — never hardcode secrets.

---

*Last updated: 2026-10-19 | Version: 1.0.0*

