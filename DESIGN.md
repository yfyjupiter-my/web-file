# Sunset — Design System

> A warm, light "soft-paper" UI theme built on coral → amber accents.
> Reverse-extracted from `themes_1.html` (Installer Vault themes playground).

Sunset is one of three themes in the playground; this document isolates it into a
standalone, reusable design system: tokens, base styles, and every UI component.

---

## 1. Design Language

| Trait | Description |
|-------|-------------|
| **Mood** | Warm, friendly, editorial. Cream paper backgrounds with sunset-glow accents. |
| **Light/Dark** | Light theme only. High-legibility warm neutrals. |
| **Accent** | Coral (`#f0654d`) → Amber (`#f4a340`) gradient, used for all primary actions, marks, and highlights. |
| **Surfaces** | Pure white cards floating over a peach-tinted, radial-glow page background. No glass blur. |
| **Shape** | Generously rounded — `18px` containers, `11px` controls, `999px` pills. |
| **Depth** | Soft, warm-tinted shadows (never neutral gray/black). |
| **Motion** | Subtle 0.15s lifts and brightness shifts on hover. |

---

## 2. Design Tokens

All styling flows from CSS custom properties. Apply on a theme root
(`:root` or `[data-theme="sunset"]`).

```css
[data-theme="sunset"]{
  /* Backgrounds */
  --bg:            #fdf6f0;   /* page base (warm cream)        */
  --bg-2:          #fbeee4;   /* secondary background          */

  /* Surfaces */
  --surface:       #ffffff;   /* cards / panels                */
  --surface-2:     #fbeede;   /* insets: inputs, thumbs, chips */
  --surface-solid: #ffffff;   /* opaque nav / drawer surfaces  */

  /* Borders */
  --border:        #efd9c8;   /* hairline dividers & outlines  */
  --border-strong: #e3b79a;   /* emphasized / dashed borders   */

  /* Text */
  --text:          #3a2b26;   /* primary (warm near-black)     */
  --text-dim:      #8a6f63;   /* secondary / meta              */
  --text-faint:    #b9a294;   /* tertiary / disabled / labels  */

  /* Accent */
  --accent:        #f0654d;   /* coral — primary accent        */
  --accent-2:      #f4a340;   /* amber — gradient end stop     */
  --accent-grad:   linear-gradient(120deg,#f0654d 0%, #f4a340 100%);
  --accent-soft:   rgba(240,101,77,0.12); /* tinted fills/hover */
  --on-accent:     #ffffff;   /* text/icons on accent          */

  /* Effects */
  --shadow:        0 18px 40px -22px rgba(180,90,60,0.35); /* warm-tinted */
  --radius:        18px;      /* containers / cards            */
  --radius-sm:     11px;      /* buttons / inputs              */
  --glass-blur:    0px;       /* Sunset is flat (no blur)      */

  /* Page background — layered sunset glow */
  --page-bg:
    radial-gradient(900px 600px at 90% -5%, rgba(244,163,64,0.20), transparent 55%),
    radial-gradient(800px 600px at 0% 10%, rgba(240,101,77,0.10), transparent 55%),
    var(--bg);

  /* Typography */
  --font: "Inter","Segoe UI",system-ui,-apple-system,sans-serif;
}
```

### Palette swatches

| Token | Hex / value | Role |
|-------|-------------|------|
| `--bg` | `#fdf6f0` | Page base |
| `--bg-2` | `#fbeee4` | Secondary bg |
| `--surface` | `#ffffff` | Card |
| `--surface-2` | `#fbeede` | Inset fill |
| `--border` | `#efd9c8` | Divider |
| `--border-strong` | `#e3b79a` | Emphasis border |
| `--text` | `#3a2b26` | Primary text |
| `--text-dim` | `#8a6f63` | Secondary text |
| `--text-faint` | `#b9a294` | Tertiary text |
| `--accent` | `#f0654d` | Coral |
| `--accent-2` | `#f4a340` | Amber |
| `--accent-soft` | `rgba(240,101,77,.12)` | Tinted state |

---

## 3. Scales & Primitives

### Radius
| Token | Value | Use |
|-------|-------|-----|
| `--radius` | `18px` | Cards, screens, drawers, toasts |
| `--radius-sm` | `11px` | Buttons, inputs, search fields |
| pill | `999px` | Badges, tags, status pills |
| circle | `50%` | Avatars |

### Typography
| Element | Size | Weight | Notes |
|---------|------|--------|-------|
| Display (`h1`) | `30px` | 700 | `letter-spacing:-.5px` |
| Section title | `16px` | 700 | Nav logo, toast/drawer headers |
| Body | `14px` | 400–600 | Default control text |
| Meta / small | `12–13px` | 400–600 | `--text-dim` |
| Label (uppercase) | `11px` | 600 | `letter-spacing:.6px`, `--text-dim` |
| Eyebrow / page-label | `12px` | 600 | `letter-spacing:2.5px`, uppercase, `--text-faint` |
| Stat number | `30px` | 700 | `letter-spacing:-1px` |

### Elevation
- **Flat inset**: `--surface-2` fill, `1px --border`. (inputs, thumbnails)
- **Raised card**: `--surface`, `1px --border`, `--shadow` on hover.
- **Floating**: `--shadow` always (toast, drawer uses directional shadow).

### Spacing
Common paddings: `14px` (cards), `20–24px` (sections), `56–64px` (hero form).
Common gaps: `6px` (tabs), `10–14px` (rows), `16–18px` (grids).

---

## 4. Base Styles

```css
*{box-sizing:border-box;}
html,body{margin:0;}
body{
  font-family:var(--font);
  background:var(--page-bg);
  background-attachment:fixed;
  color:var(--text);
  -webkit-font-smoothing:antialiased;
  transition:background .4s ease, color .3s ease;
}
```

---

## 5. UI Components

Each component below lists its purpose, the reference CSS (Sunset tokens), and
example markup.

### 5.1 Button

Primary = gradient fill with warm glow shadow. Ghost = outlined, transparent.

```css
.btn{
  border:none; cursor:pointer; font-family:inherit; font-weight:600;
  color:var(--on-accent); background:var(--accent-grad);
  border-radius:var(--radius-sm); letter-spacing:.3px;
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  box-shadow:0 8px 20px -10px var(--accent);
  transition:transform .15s ease, filter .15s ease, box-shadow .15s ease;
}
.btn:hover{transform:translateY(-1px); filter:brightness(1.06);}

.btn.ghost{
  background:transparent; color:var(--text);
  border:1px solid var(--border-strong); box-shadow:none;
}
.btn.ghost:hover{background:var(--accent-soft);}
```

```html
<button class="btn">Unlock Vault →</button>
<button class="btn ghost">Cancel</button>
```

### 5.2 Pill / Badge

Soft-tinted status chip.

```css
.pill{
  font-size:11px; font-weight:600; padding:5px 11px; border-radius:999px;
  background:var(--accent-soft); color:var(--accent);
  display:inline-flex; align-items:center; gap:6px;
}
```

```html
<span class="pill">● Secure Access</span>
```

### 5.3 Icon Chip

Gradient-filled square used for file-type / brand marks.

```css
.chip-icon{
  display:inline-flex; align-items:center; justify-content:center;
  font-weight:700; font-size:12px; letter-spacing:.5px;
  color:var(--on-accent); background:var(--accent-grad); border-radius:9px;
}
/* brand mark variant */
.mark{width:26px; height:26px; border-radius:8px; background:var(--accent-grad);}
```

### 5.4 Input Field

Inset fill with an accent focus ring (`--accent-soft` glow + accent border).

```css
.field{
  height:48px; border-radius:var(--radius-sm);
  background:var(--surface-2); border:1px solid var(--border);
  display:flex; align-items:center; padding:0 16px; gap:10px;
  font-size:14px; color:var(--text-dim);
}
.field:focus-within{border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft);}
.field input{
  border:none; background:transparent; outline:none; flex:1;
  font-family:inherit; font-size:14px; color:var(--text);
}
```

```html
<div class="field">🔑 <input type="password" placeholder="Enter shared password…"></div>
```

### 5.5 Card (File Card)

Raised container with a gradient-tinted thumbnail, badge, body, and split footer.

```css
.file-card{
  border:1px solid var(--border); border-radius:var(--radius); overflow:hidden;
  background:var(--surface);
  transition:transform .18s ease, box-shadow .18s ease, border-color .18s;
}
.file-card:hover{transform:translateY(-4px); box-shadow:var(--shadow); border-color:var(--border-strong);}
.card-thumb{
  height:92px; position:relative; display:flex; align-items:center; justify-content:center;
  background:linear-gradient(135deg,var(--surface-2),var(--surface));
  border-bottom:1px solid var(--border);
}
.card-thumb .type{font-size:15px; font-weight:800; letter-spacing:1px; color:var(--accent);}
.card-badge{
  position:absolute; top:10px; right:10px; font-size:10px; font-weight:700;
  padding:3px 8px; border-radius:999px; background:var(--accent-soft); color:var(--accent);
}
.card-body{padding:14px 16px;}
.card-title{font-size:14px; font-weight:600; margin-bottom:4px;}
.card-meta{font-size:12px; color:var(--text-dim); display:flex; justify-content:space-between;}
.card-footer{display:flex; border-top:1px solid var(--border);}
.card-footer > div{
  flex:1; height:40px; display:flex; align-items:center; justify-content:center;
  font-size:12px; font-weight:600; cursor:pointer; color:var(--text-dim);
}
.card-footer > div:hover{color:var(--text);}
.card-footer .dl{background:var(--accent-soft); color:var(--accent); border-right:1px solid var(--border);}
```

```html
<div class="file-card">
  <div class="card-thumb"><span class="type">EXE</span><span class="card-badge">v2.4</span></div>
  <div class="card-body">
    <div class="card-title">Setup Wizard</div>
    <div class="card-meta"><span>84 MB</span><span>Jun 28</span></div>
  </div>
  <div class="card-footer"><div class="dl">Download</div><div>⋯</div></div>
</div>
```

### 5.6 Tabs

Underline-style tabs; active tab colored with accent + accent underline.

```css
.tab{
  height:38px; padding:0 18px; border-radius:10px 10px 0 0;
  display:flex; align-items:center; font-size:13px; color:var(--text-dim);
  cursor:pointer; font-weight:500; border-bottom:2px solid transparent;
}
.tab:hover{color:var(--text);}
.tab.active{color:var(--accent); font-weight:700; border-bottom:2px solid var(--accent);}
```

```html
<div class="tabs-row">
  <div class="tab active">All (24)</div>
  <div class="tab">Utilities</div>
</div>
```

### 5.7 Segmented / View Toggle

```css
.view-toggle{display:flex; border:1px solid var(--border); border-radius:var(--radius-sm); overflow:hidden;}
.view-toggle > div{
  width:40px; height:42px; display:flex; align-items:center; justify-content:center;
  cursor:pointer; color:var(--text-faint); background:var(--surface-2);
}
.view-toggle > div.active{background:var(--accent); color:var(--on-accent);}
```

### 5.8 Stat Cell

```css
.stat-cell{padding:22px 24px; border-right:1px solid var(--border);}
.stat-num{font-size:30px; font-weight:700; letter-spacing:-1px;}
.stat-num .up{font-size:13px; color:var(--accent); font-weight:600; margin-left:6px;}
.stat-label{font-size:12px; color:var(--text-dim); margin-top:4px;}
```

```html
<div class="stat-cell">
  <div class="stat-num">24 <span class="up">▲ 3</span></div>
  <div class="stat-label">Total installers</div>
</div>
```

### 5.9 Top Navigation Bar

```css
.app-topnav{
  height:66px; border-bottom:1px solid var(--border);
  display:flex; align-items:center; justify-content:space-between; padding:0 26px;
  background:var(--surface-solid);
}
.app-topnav .logo{display:flex; align-items:center; gap:11px; font-weight:700; font-size:16px;}
.avatar{width:36px; height:36px; border-radius:50%; background:var(--accent-grad); flex-shrink:0;}
```

### 5.10 Drawer (Slide-in Panel)

Right-hand panel with directional shadow, scrollable body, sticky footer.

```css
.drawer{
  width:410px; flex-shrink:0; background:var(--surface-solid);
  border-left:1px solid var(--border-strong); display:flex; flex-direction:column;
  box-shadow:-24px 0 50px -30px rgba(0,0,0,.5);
}
.drawer-header{
  height:60px; border-bottom:1px solid var(--border);
  display:flex; align-items:center; justify-content:space-between; padding:0 22px; font-weight:700;
}
.drawer-header .x{
  width:30px; height:30px; border-radius:8px; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  background:var(--surface-2); color:var(--text-dim);
}
.drawer-body{padding:22px; flex:1; overflow:auto;}
.drawer-footer{border-top:1px solid var(--border); padding:18px 22px; display:flex; gap:12px;}
.drawer-footer .btn{flex:1; height:44px;}
```

### 5.11 Dropzone

```css
.drawer-dropzone{
  height:130px; border:2px dashed var(--border-strong); border-radius:var(--radius);
  background:var(--accent-soft);
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px;
}
.drawer-dropzone .up{
  width:44px; height:44px; border-radius:12px; background:var(--accent-grad);
  display:flex; align-items:center; justify-content:center; color:#fff; font-size:20px;
}
```

### 5.12 Labeled Field (form)

```css
.drawer-field label{
  display:block; font-size:11px; text-transform:uppercase; letter-spacing:.6px;
  color:var(--text-dim); margin-bottom:7px; font-weight:600;
}
.drawer-input{
  width:100%; height:42px; border-radius:var(--radius-sm);
  background:var(--surface-2); border:1px solid var(--border);
  padding:0 14px; font-family:inherit; font-size:14px; color:var(--text); outline:none;
}
.drawer-input:focus{border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft);}
textarea.drawer-input{height:70px; padding-top:11px; resize:none;}
```

### 5.13 Toast / Alert Card

Floating card with gradient top strip and icon header.

**Backdrop.** When used as the upload conflict dialog (`ConflictToast`), the card
is centered over a fixed, semi-opaque scrim — `.toast-overlay` (`position:fixed;
inset:0; z-index:10; background:rgba(58,43,38,0.35)`), a warm-tinted dim of the
`--sunset-*` palette. The dialog carries `role="alertdialog"` / `aria-modal="true"`.
The alternate `.toast-wrap` class is the inline (non-overlay) placement used in
the static mockup.

```css
.toast{
  width:480px; border-radius:var(--radius); overflow:hidden;
  background:var(--surface); border:1px solid var(--border); box-shadow:var(--shadow);
}
.toast-strip{height:5px; background:var(--accent-grad);}
.toast-body{padding:24px;}
.toast-head{display:flex; align-items:center; gap:12px; margin-bottom:12px;}
.toast-head .ic{
  width:38px; height:38px; border-radius:11px;
  background:var(--accent-soft); color:var(--accent);
  display:flex; align-items:center; justify-content:center; font-size:18px;
}
.toast-title{font-size:16px; font-weight:700;}
.toast-text{font-size:13px; color:var(--text-dim); line-height:1.55; margin-bottom:6px;}
.toast-actions{display:flex; gap:12px; margin-top:18px;}
.toast-actions .btn{flex:1; height:40px; font-size:13px;}
```

```html
<div class="toast">
  <div class="toast-strip"></div>
  <div class="toast-body">
    <div class="toast-head"><div class="ic">⚠</div><div class="toast-title">File already exists</div></div>
    <div class="toast-text">An installer named <b>setup-wizard.exe</b> already exists…</div>
    <div class="toast-actions">
      <button class="btn ghost">Keep Both</button>
      <button class="btn">Replace File</button>
    </div>
  </div>
</div>
```

### 5.14 Bottom Navigation (mobile shell)

```css
.narrow-bottom-nav{height:64px; border-top:1px solid var(--border); display:flex; background:var(--surface-solid);}
.narrow-bottom-nav > div{
  flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:5px; color:var(--text-faint); font-size:11px; cursor:pointer;
}
.narrow-bottom-nav .nav-dot{width:22px; height:22px; border-radius:8px; background:var(--surface-2);}
.narrow-bottom-nav > div.active{color:var(--accent);}
.narrow-bottom-nav > div.active .nav-dot{background:var(--accent-grad);}
```

### 5.15 Screen / Panel Container

```css
.screen{
  max-width:1240px; margin:0 auto 60px;
  background:var(--surface); border:1px solid var(--border);
  border-radius:var(--radius); overflow:hidden; box-shadow:var(--shadow);
}
```

---

## 6. Patterns

### Split Hero (auth gate)
Two-column grid: full-bleed `--accent-grad` visual panel (with radial white
highlights via `::before`, `mix-blend-mode:screen`) beside a white form panel.

```css
.split{display:grid; grid-template-columns:1fr 1fr; min-height:480px;}
.split-visual{background:var(--accent-grad); position:relative; overflow:hidden;}
.split-visual::before{
  content:""; position:absolute; inset:0; mix-blend-mode:screen;
  background:
    radial-gradient(300px 300px at 20% 30%, rgba(255,255,255,.28), transparent 60%),
    radial-gradient(280px 280px at 80% 75%, rgba(255,255,255,.18), transparent 60%);
}
```

### Responsive
```css
@media(max-width:820px){
  .split{grid-template-columns:1fr;}
  .stat-strip{grid-template-columns:repeat(2,1fr);}
  .card-grid{grid-template-columns:repeat(2,1fr);}
  .drawer{width:100%;}
}
```

---

## 7. Usage Rules

- **Accent is a gradient**, not a flat color — use `--accent-grad` for fills
  (buttons, marks, active states) and `--accent` for text/icons/borders.
- **Tinted states**: hover and selected backgrounds use `--accent-soft`, never gray.
- **Shadows are warm** — always the `--shadow` token (warm brown tint), never neutral black.
- **No blur**: Sunset sets `--glass-blur:0`; surfaces are solid, not glass.
- **Text hierarchy**: `--text` → `--text-dim` → `--text-faint`. Labels/eyebrows use `--text-faint`/`--text-dim` with uppercase + letter-spacing.
- **Focus rings**: `border-color:var(--accent)` + `box-shadow:0 0 0 3px var(--accent-soft)`.

---

*Extracted from `themes_1.html`. To retheme, swap the token block in §2 — all components inherit automatically.*
