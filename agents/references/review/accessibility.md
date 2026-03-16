# Accessibility Review Checklist

> Sources: WCAG 2.2 (W3C Recommendation, 5 October 2023), WAI-ARIA Authoring Practices, Understanding WCAG 2.2
> Severity: Blocking / Suggestion / Observation
> Target: Level AA (all Level A + AA criteria)
> Updated: 2026-03-11
>
> Note: SC 4.1.1 Parsing was removed in WCAG 2.2 (obsolete — browsers handle malformed HTML consistently).

## 1. Semantic HTML

| # | Item | WCAG SC | Severity |
|---|------|---------|----------|
| 1.1 | Page uses landmark elements (`<header>`, `<nav>`, `<main>`, `<footer>`, `<aside>`) or ARIA landmark roles | 1.3.1 Info and Relationships (A) | Suggestion |
| 1.2 | Only one `<main>` element per page | 1.3.1 (A) | Blocking |
| 1.3 | Heading levels sequential, not skipped (no `<h1>` to `<h3>` jump) | 1.3.1 (A) | Suggestion |
| 1.4 | Lists use `<ul>`, `<ol>`, `<dl>` — not divs with visual bullets | 1.3.1 (A) | Suggestion |
| 1.5 | Data tables use `<table>`, `<th>`, `<thead>`, `<tbody>` — not styled divs | 1.3.1 (A) | Blocking |
| 1.6 | Complex tables use `scope` or `headers` to associate cells with headers | 1.3.1 (A) | Blocking |
| 1.7 | Interactive elements use native HTML (`<button>`, `<a>`, `<input>`, `<select>`) not `<div>` with click handlers | 1.3.1 (A) / 4.1.2 (A) | Blocking |
| 1.8 | Links (`<a>`) for navigation, buttons (`<button>`) for actions — not interchangeable | 4.1.2 Name, Role, Value (A) | Suggestion |
| 1.9 | `<a>` elements have `href` attribute (otherwise not keyboard-focusable by default) | 2.1.1 Keyboard (A) | Blocking |
| 1.10 | Meaningful reading order preserved in DOM, not just via CSS positioning | 1.3.2 Meaningful Sequence (A) | Blocking |

## 2. Images and Media

| # | Item | WCAG SC | Severity |
|---|------|---------|----------|
| 2.1 | All `<img>` have an `alt` attribute | 1.1.1 Non-text Content (A) | Blocking |
| 2.2 | Informative images have descriptive `alt` text conveying the same information | 1.1.1 (A) | Blocking |
| 2.3 | Decorative images use `alt=""` (empty) — not missing alt, not `alt="image"` | 1.1.1 (A) | Suggestion |
| 2.4 | SVGs have accessible name: `<title>` inside SVG, or `aria-label`/`aria-labelledby` on `<svg>` | 1.1.1 (A) | Blocking |
| 2.5 | SVGs conveying meaning include `role="img"` | 1.1.1 (A) | Suggestion |
| 2.6 | Decorative SVGs use `aria-hidden="true"` | 1.1.1 (A) | Suggestion |
| 2.7 | Icon-only buttons/links have accessible name (visually hidden text, `aria-label`, or `title`) | 1.1.1 (A) / 4.1.2 (A) | Blocking |
| 2.8 | Pre-recorded video has captions (`<track kind="captions">`) | 1.2.2 Captions Prerecorded (A) | Blocking |
| 2.9 | `<video>`/`<audio>` do not autoplay, or provide controls to pause/stop | 1.4.2 Audio Control (A) | Blocking |

## 3. Forms

| # | Item | WCAG SC | Severity |
|---|------|---------|----------|
| 3.1 | Every `<input>`, `<select>`, `<textarea>` has associated `<label>` via `for`/`id` or wrapping | 1.3.1 (A) / 3.3.2 Labels (A) | Blocking |
| 3.2 | Placeholder NOT used as only label | 3.3.2 (A) | Blocking |
| 3.3 | Related controls grouped with `<fieldset>` and `<legend>` (radio groups, checkbox groups) | 1.3.1 (A) | Suggestion |
| 3.4 | Required fields indicated programmatically (`required` or `aria-required="true"`), not just red asterisk | 3.3.2 (A) | Blocking |
| 3.5 | Error messages identify specific field and describe error in text | 3.3.1 Error Identification (A) | Blocking |
| 3.6 | Errors programmatically associated with field (`aria-describedby` or `aria-errormessage`) | 3.3.1 (A) | Blocking |
| 3.7 | Dynamic errors announced to screen readers (`aria-live`, `role="alert"`, or focus management) | 4.1.3 Status Messages (AA) | Blocking |
| 3.8 | Suggestions for correction provided when errors detected and suggestions known | 3.3.3 Error Suggestion (AA) | Suggestion |
| 3.9 | `autocomplete` attribute on inputs collecting personal data (name, email, address, phone) | 1.3.5 Identify Input Purpose (AA) | Suggestion |
| 3.10 | Previously entered info in multi-step process auto-populated — not re-requested | 3.3.7 Redundant Entry (A) — NEW in 2.2 | Suggestion |

## 4. ARIA Usage

| # | Item | WCAG SC | Severity |
|---|------|---------|----------|
| 4.1 | ARIA only used when native HTML cannot achieve same semantics (first rule of ARIA) | 4.1.2 (A) | Suggestion |
| 4.2 | All `role` values are valid WAI-ARIA roles (no typos or made-up roles) | 4.1.2 (A) | Blocking |
| 4.3 | Required ARIA states/properties present for role (e.g., `role="checkbox"` has `aria-checked`) | 4.1.2 (A) | Blocking |
| 4.4 | `aria-hidden="true"` NOT on focusable elements or ancestors of focusable elements | 4.1.2 (A) | Blocking |
| 4.5 | `aria-expanded` toggled on disclosure/accordion triggers | 4.1.2 (A) | Suggestion |
| 4.6 | `aria-live` regions use appropriate politeness: `polite` for non-urgent, `assertive` for critical only | 4.1.3 Status Messages (AA) | Suggestion |
| 4.7 | Status messages use `role="status"` or `aria-live="polite"` | 4.1.3 (AA) | Blocking |
| 4.8 | `role="alert"` reserved for time-sensitive errors, not general notifications | 4.1.3 (AA) | Suggestion |
| 4.9 | IDs referenced by ARIA attributes are unique in document | 4.1.2 (A) | Blocking |
| 4.10 | Custom widgets follow WAI-ARIA Authoring Practices patterns (tabs, menus, comboboxes) | 4.1.2 (A) | Suggestion |
| 4.11 | `aria-invalid="true"` set on fields with validation errors | 3.3.1 (A) | Suggestion |

## 5. Keyboard & Focus

| # | Item | WCAG SC | Severity |
|---|------|---------|----------|
| 5.1 | All interactive elements reachable via Tab key | 2.1.1 Keyboard (A) | Blocking |
| 5.2 | No functionality requires mouse-specific events only (`mousedown`/`mouseover` without keyboard equivalents) | 2.1.1 (A) | Blocking |
| 5.3 | Custom interactive elements have `tabindex="0"` | 2.1.1 (A) | Blocking |
| 5.4 | `tabindex` > 0 NOT used (disrupts natural tab order) | 2.4.3 Focus Order (A) | Blocking |
| 5.5 | Focus order follows logical, meaningful sequence matching visual layout | 2.4.3 (A) | Blocking |
| 5.6 | No keyboard trap: users can always Tab/Shift+Tab out (except modals with escape mechanism) | 2.1.2 No Keyboard Trap (A) | Blocking |
| 5.7 | Modals trap focus within and return focus to trigger on close | 2.1.2 (A) / 2.4.3 (A) | Blocking |
| 5.8 | Skip navigation link present as first focusable element | 2.4.1 Bypass Blocks (A) | Suggestion |
| 5.9 | Focus indicator visible: `:focus`/`:focus-visible` styles not removed without replacement | 2.4.7 Focus Visible (AA) | Blocking |
| 5.10 | `outline: none`/`outline: 0` NOT used without visible replacement | 2.4.7 (AA) | Blocking |
| 5.11 | Focused element not entirely hidden behind sticky headers/footers/overlays | 2.4.11 Focus Not Obscured (AA) — NEW in 2.2 | Blocking |
| 5.12 | `Escape` key closes modals, dropdowns, overlays | 2.1.1 (A) | Blocking |
| 5.13 | Hover/focus-triggered content (tooltips, submenus) dismissible (Esc), hoverable, persistent | 1.4.13 Content on Hover or Focus (AA) | Suggestion |

## 6. Color & Contrast

| # | Item | WCAG SC | Severity |
|---|------|---------|----------|
| 6.1 | Normal text (<18pt / <14pt bold): ≥ 4.5:1 contrast ratio | 1.4.3 Contrast Minimum (AA) | Blocking |
| 6.2 | Large text (≥18pt / ≥14pt bold): ≥ 3:1 contrast ratio | 1.4.3 (AA) | Blocking |
| 6.3 | UI components (borders, icons, form boundaries): ≥ 3:1 contrast | 1.4.11 Non-text Contrast (AA) | Blocking |
| 6.4 | Focus indicators: ≥ 3:1 contrast against adjacent background | 1.4.11 (AA) | Blocking |
| 6.5 | Color not sole means of conveying info (links need underline or other cue beyond color) | 1.4.1 Use of Color (A) | Blocking |
| 6.6 | Error states not indicated only by color (must include icon, text, or `aria-invalid`) | 1.4.1 (A) | Blocking |
| 6.7 | Required fields not indicated only by color | 1.4.1 (A) | Blocking |
| 6.8 | Charts/graphs use patterns or labels in addition to color | 1.4.1 (A) | Suggestion |

## 7. Motion & Timing

| # | Item | WCAG SC | Severity |
|---|------|---------|----------|
| 7.1 | Animations/transitions respect `prefers-reduced-motion` media query | 2.3.1 Three Flashes (A) | Blocking |
| 7.2 | No content flashes more than 3 times per second | 2.3.1 (A) | Blocking |
| 7.3 | Auto-updating content (tickers, carousels) has pause/stop/hide mechanism | 2.2.2 Pause, Stop, Hide (A) | Blocking |
| 7.4 | Time limits have mechanism to extend, turn off, or adjust (20-second warning minimum) | 2.2.1 Timing Adjustable (A) | Blocking |
| 7.5 | No auto-scrolling or auto-advancing without user control | 2.2.2 (A) | Blocking |

## 8. Dynamic Content

| # | Item | WCAG SC | Severity |
|---|------|---------|----------|
| 8.1 | Modals use `<dialog>` or `role="dialog"` with `aria-modal="true"` | 4.1.2 (A) | Blocking |
| 8.2 | Dialogs have accessible name (`aria-label` or `aria-labelledby` pointing to heading) | 4.1.2 (A) | Blocking |
| 8.3 | Opening modal moves focus to dialog (first focusable element or dialog itself) | 2.4.3 (A) | Blocking |
| 8.4 | Closing modal returns focus to triggering element | 2.4.3 (A) | Blocking |
| 8.5 | Toast/snackbar notifications use `role="status"` or `aria-live="polite"` | 4.1.3 (AA) | Blocking |
| 8.6 | Toasts remain visible long enough to read, or pausable on hover/focus | 2.2.1 (A) | Suggestion |
| 8.7 | Error toasts persist until dismissed (not auto-dismissing for critical errors) | 4.1.3 (AA) | Blocking |
| 8.8 | SPA route changes announce new page title (`document.title` + focus management or live region) | 2.4.2 Page Titled (A) / 4.1.3 (AA) | Blocking |
| 8.9 | Loading states announced (`aria-busy="true"` or live region announcing "Loading...") | 4.1.3 (AA) | Suggestion |
| 8.10 | Dynamically injected content in logical DOM position, not just visually positioned | 1.3.2 (A) | Suggestion |

## 9. WCAG 2.2 New Criteria

### 2.4.11 Focus Not Obscured (Minimum) — AA

| # | Item | Severity |
|---|------|----------|
| 9.1 | Sticky headers/footers don't entirely cover focused element — use `scroll-padding-top`/`bottom` | Blocking |
| 9.2 | Cookie banners, chat widgets, sticky CTAs don't fully obscure focused items | Blocking |

### 2.5.7 Dragging Movements — AA

| # | Item | Severity |
|---|------|----------|
| 9.3 | Drag-and-drop has non-dragging alternative (move up/down buttons, cut/paste, select-then-place) | Blocking |
| 9.4 | Sortable lists provide button-based reorder controls, not just drag handles | Blocking |
| 9.5 | File upload drop zones also have traditional file input/button | Blocking |
| 9.6 | Slider components operable via keyboard (arrow keys) | Blocking |

### 2.5.8 Target Size (Minimum) — AA

| # | Item | Severity |
|---|------|----------|
| 9.7 | Click/tap targets at least 24x24 CSS pixels | Suggestion |
| 9.8 | If smaller than 24x24, sufficient spacing so 24px circle doesn't overlap adjacent targets | Suggestion |
| 9.9 | Icon buttons (close, hamburger, actions) meet 24x24 minimum including padding | Suggestion |

### 3.2.6 Consistent Help — A

| # | Item | Severity |
|---|------|----------|
| 9.10 | Help mechanisms (chat, contact link, FAQ) in same relative position across pages | Suggestion |

### 3.3.7 Redundant Entry — A

| # | Item | Severity |
|---|------|----------|
| 9.11 | Multi-step forms auto-populate previously entered data in later steps | Suggestion |
| 9.12 | Shipping/billing offers "same as" checkbox instead of re-entry | Suggestion |

### 3.3.8 Accessible Authentication (Minimum) — AA

| # | Item | Severity |
|---|------|----------|
| 9.13 | Password fields do NOT have `autocomplete="off"` — allow password managers | Blocking |
| 9.14 | No `onpaste` handlers preventing paste into password/code fields | Blocking |
| 9.15 | CAPTCHAs not solely cognitive-function tests — provide alternative | Blocking |
| 9.16 | OTP/verification code fields allow paste from clipboard | Suggestion |
