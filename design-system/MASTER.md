# Multi-Tenant Booking App - Master Design System

## Core Identity
A highly adaptable, professional multi-tenant booking & scheduling application designed to instill trust natively across diverse industries (healthcare, spas, fitness centers, professional services). 
The aesthetic prioritizes **uncluttered minimalism**, **WCAG accessibility**, and **highly legible temporal data presentation (calendars, clocks)**.

### Target Audiences
- Corporate Users (Admins, Service Providers) running their specific business unit 
- General Public (End-users) seeking low-friction appointment bookings

---

## 1. Global Themes & Layouts

### Layout Architecture
- **Tenant Context (`apps/web` / public booking):** Centered, high-conversion mobile-first focus utilizing `max-w-3xl` form wrappers. Clear tenant branding blocks at the top of the viewport.
- **Provider Context (`apps/server` or logged-in portal):** Sidebar-navigation layout allowing dense calendar and schedule displays (`max-w-7xl`). Floating action buttons for primary booking modifications.

### Structural Behaviors
- Fixed top navigation, with tenant logos dynamically injected. 
- Interactive cards containing prominent dates, times, and provider profiles. 
- **Z-Index Strategy:** Modal windows (z-50) stack above sticky headers (z-40) and calendars (z-10).

---

## 2. Typography

Utilizing high-legibility Grotesque / Sans-serif styles appropriate for multi-industry scaling, relying strictly on standard system / Next.js font stacks so as not to overwhelm specific tenant brands.

- **Typeface Base:** `Inter` or standard `system-ui`.
- **H1 (Headings):** `text-3xl font-bold tracking-tight text-foreground`
- **H2 (Card Titles/Views):** `text-xl font-semibold tracking-tight text-foreground`
- **Body Base:** `text-sm text-foreground leading-relaxed`
- **Muted Text (sub-headers, dates, labels):** `text-sm text-muted-foreground font-medium`

---

## 3. Color Palette & Shadcn Variables

We employ a "Neutral Trust" color palette where the *tenant brand color* safely maps onto the `--primary` variable to instantly localize feeling without compromising contrast requirements.

### Neutral Base (Dark / Light Contexts appropriately tokenized via Tailwind v4 `@theme`)
- **Background (`--background`):** Crisp white in light mode (`#FFFFFF`) / Deep rich slate in dark (`#0B0F19`)
- **Foreground (`--foreground`):** Slate-900 (`#0F172A`) / Pure White (`#F8FAFC`)
- **Card Background (`--card`):** True white / Subtle elevated slate (`#151C2C`)
- **Muted (`--muted`):** Very light gray (`#F1F5F9`) for list items / Soft slate (`#1E293B`)
- **Borders (`--border`):** Soft, non-intrusive gray (`#E2E8F0` / `#334155`)

### Semantic Colors
- **Primary Brand (`--primary`):** Trusted Blue (`#2563EB`) as the strong, professional fallback if the tenant has no custom color mapped.
- **Success (`bg-emerald-500`):** Used universally for 'Slot Available' indicators.
- **Destructive/Error (`--destructive`):** (`#EF4444`) Used universally for 'Booking Cancelled', 'Slot Full', or strict validation errors.
- **Pending/Warning (`bg-amber-500`):** Used for 'Booking Awaiting Confirmation'.

---

## 4. UI Components (Atoms/Molecules)

### Buttons
- **Primary Actions:** Solid background (`bg-primary text-primary-foreground`) with a subtle `hover:opacity-90` reduction. `rounded-md` with `h-10 px-4`.
- **Secondary Actions:** `variant="outline"` (`border border-input bg-background hover:bg-accent`)
- Must ALWAYS include `cursor-pointer`.

### Inputs & Forms
- Rounded corners matching buttons (`rounded-md`).
- Active inputs receive `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.
- Mandatory error states use red outlined borders and supportive text strings. 

### Calendars (`react-big-calendar`)
- Time slot gutters must contrast actively with headers.
- Active Selection: Filled solid via `--primary`.
- Disabled / Past Slots: Opaque / muted (`opacity-50 cursor-not-allowed`).

---

## 5. Interaction Patterns & Tooling

### Interactions
- **Transitions:** Standard utility `transition-colors duration-200 ease-in-out` on all interactive links/buttons. 
- **Hover Feedback:** Cards with clickable booking targets lightly lower border contrast or elevate shadow (`hover:shadow-md hover:border-primary/50`). No aggressive scaling (`hover:scale-105`) to maintain professional tone.
- **Empty States:** Clearly communicate "No availability" with large, supportive SVG illustration or icons and direct calls to action (e.g. "Select another date").

### Modals & Dialogs 
- **Backdrop:** Dimmed black (`bg-black/50`).
- Dialog bounds are clamped structurally on mobile (`w-[95%]`) and fixed explicitly on desktop (`max-w-lg`).
- "Destructive" actions (like Canceling a Booking) trigger a mandatory secondary confirmation alert dialog `AlertDialog`.

---

## 6. Pre-Delivery Validations & Anti-patterns

### Do Not Use
- ❌ Non-SVG Icons (No emojis allowed for actions or states)
- ❌ Invisible buttons: Always give interactive elements structural feedback
- ❌ `bg-opacity-10` layered hacks for glassy effects; use strict Tailwind neutral tokens for professionalism.
- ❌ Hardcoded Hex values inside `apps/web/src` `.tsx` files; rely on `from-theme()` or strict `cn()` mapping.

### Mandatory Compliance
- ✅ Accessibility checking on all form elements (`<Label>` must specifically link to `<Input>`).
- ✅ Multi-language robust: All texts must route through `t()` from `i18next`. UI elements must not break layout when texts drastically increase in character width (e.g., German translations).
- ✅ Mobile booking tables MUST scroll horizontally gracefully without clipping temporal data.
