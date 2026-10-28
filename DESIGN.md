web application/stitch/projects/15159124715891208984/screens/90a4f24389fb452e8939c07a4ea8252d
# DESIGN.md — Atlaslog Liquid Crimson Glass Design System

## 1. Brand Vision & Identity

**Atlaslog** is a high-performance athletic progression and strength-tracking platform built for serious lifters, hybrid athletes, and strength trainees. 

The design language embodies **"Liquid Crimson Glass"** — an evolution from raw kinetic neon into an obsidian, atmospheric, high-contrast dark aesthetic that merges fluid glassmorphism (specular edge highlights, blurred frosted depth, fluid ambient lighting) with tactical athletic data density.

- **Brand Personality**: Powerful, Disciplined, Tactile, Modern, High-Velocity.
- **Visual Metaphor**: Molten crimson energy forged behind smoked obsidian glass and ultra-clear optical surfaces.
- **Ergonomics**: Designed for gym conditions — high contrast under bright gym lights, oversized touch targets (min 44px–48px) operable with trembling hands or chalked fingers, glanceable typographic hierarchy.

---

## 2. Color System & Tokens

### 2.1 Theme Mode
- **Mode**: High-Contrast Atmospheric Dark Mode (Always Dark)
- **Base Canvas**: Smoked Obsidian Black `#0a0a0c` to Deep Onyx `#111114`

### 2.2 Color Palette Tokens

```yaml
colors:
  # Backgrounds & Surfaces
  canvas: '#0a0a0c'
  surface-lowest: '#0e0e11'
  surface: '#131318'
  surface-raised: '#1c1b22'
  surface-overlay: 'rgba(25, 23, 30, 0.65)'

  # Glass Material Fill & Borders
  glass-surface: 'rgba(255, 255, 255, 0.03)'
  glass-surface-hover: 'rgba(255, 255, 255, 0.06)'
  glass-border: 'rgba(255, 255, 255, 0.08)'
  glass-border-specular: 'rgba(255, 255, 255, 0.16)'
  glass-border-active: 'rgba(235, 14, 57, 0.45)'

  # Primary Brand & Accent (Crimson / Ruby / Liquid Flame)
  primary: '#ff1744'
  primary-glow: 'rgba(255, 23, 68, 0.35)'
  primary-container: '#3d0510'
  crimson-gradient-start: '#ff2d55'
  crimson-gradient-end: '#d90429'
  crimson-dark: '#8b0018'

  # Secondary & Functional Accents
  accent-ruby: '#f43f5e'
  accent-amber: '#ffb703'
  accent-emerald: '#10b981'

  # Typography & On-Surface
  text-primary: '#f8fafc'       # 98% opacity white / silver
  text-secondary: '#94a3b8'     # Slate secondary labels
  text-tertiary: '#64748b'      # Muted timestamps & units
  text-disabled: '#475569'      # Locked states
  text-brand-crimson: '#ff3b5c' # Highlight stats & tags

  # Status / Gamification
  status-unlocked: '#ff2d55'
  status-locked: '#334155'
  status-in-progress: '#ff9f1c'
```

---

## 3. Glassmorphism & Depth System

The Liquid Glass look relies on layered optical physics rather than flat background fills:

### 3.1 Glass Classes & Physics
- **Glass Panel (Standard Card)**:
  - `background: rgba(20, 18, 24, 0.6)`
  - `backdrop-filter: blur(20px) saturate(180%)`
  - `border: 1px solid rgba(255, 255, 255, 0.07)`
  - `box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5), inset 0 1px 1px 0 rgba(255, 255, 255, 0.12)`
- **Liquid Crimson Glow Card (Active / Hero)**:
  - `background: radial-gradient(circle at 85% 15%, rgba(235, 14, 57, 0.22) 0%, rgba(18, 16, 22, 0.75) 75%)`
  - `backdrop-filter: blur(24px)`
  - `border: 1px solid rgba(255, 45, 85, 0.25)`
  - `box-shadow: 0 10px 40px -10px rgba(255, 23, 68, 0.3), inset 0 1px 2px rgba(255, 100, 130, 0.3)`
- **Specular Top Highlight**:
  - `linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 100%)` as pseudo-element edge stroke.

---

## 4. Typography System

- **Primary Font Family**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `sans-serif`
- **Display / Kinetic Font Family (Headlines)**: `Inter` (Font weight: `800` Black or `900` Heavy) with tracking `-0.03em` for an aggressive, architectural look.
- **Numbers / Metrics**: Tabular numbers (`font-variant-numeric: tabular-nums`) with bold/black weights to prevent jitter during real-time counters.

### Type Scale (Mobile Portrait ~390px)

| Role | Font Size | Line Height | Weight | Letter Spacing | Case / Usage |
|---|---|---|---|---|---|
| **Display Hero** | 28px - 32px | 34px - 38px | 900 (Black) | `-0.03em` | Uppercase athlete ranks, tier titles |
| **Headline Medium**| 20px - 22px | 26px - 28px | 800 (Extrabold) | `-0.02em` | Section headers ("4 Core EXP Pillars") |
| **Headline Small** | 16px - 18px | 22px - 24px | 700 (Bold) | `-0.01em` | Card titles ("Ironforged", "Consistency") |
| **Stat Numbers**   | 24px - 30px | 30px - 36px | 800 (Extrabold) | `-0.02em` | Main numeric stats (e.g. `4,250`) |
| **Body Default**   | 14px | 20px | 400 - 500 | `0` | Subtitles, descriptions |
| **Label / Tag**    | 11px - 12px | 16px | 700 (Bold) | `+0.05em` | All-caps metadata, badges (`LV. 28`, `TIER 3`) |
| **Micro Caption**  | 10px - 11px | 14px | 600 (Semibold) | `+0.08em` | EXP deltas, timestamp tags |

---

## 5. Spacing, Grid & Layout Rules

- **Mobile Viewport Target**: 390px × 844px (Base iPhone frame)
- **Base Spacing Unit**: 4px scale (`4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`)
- **Screen Margins**: `px-4` (16px) or `px-5` (20px) horizontal gutter
- **Vertical Card Stacking**: `gap-3.5` (14px) to `gap-4` (16px)
- **Corner Radii (Roundness)**:
  - Small Pills / Badges: `rounded-full` (9999px)
  - Interactive Action Chips: `rounded-xl` (12px)
  - Content Cards / Glass Panels: `rounded-2xl` (16px to 20px)
  - Hero Containers: `rounded-3xl` (24px)
  - Primary Full CTA Buttons: `rounded-2xl` or `rounded-full`

---

## 6. Gamification & Progression Components

### 6.1 Athlete Tier & EXP Hero
- **Avatar Frame**: Circular with tier-colored specular border (`#ff2d55`), accompanied by level pill overlay (`Lv. 28`).
- **EXP Liquid Progress Bar**:
  - Track: Height 8px–10px, dark translucent obsidian tube with inner shadow (`inset 0 2px 4px rgba(0,0,0,0.8)`).
  - Fill: Linear gradient (`#ff416c` to `#ff1744`) with outer drop shadow glow (`0 0 12px rgba(255, 23, 68, 0.7)`).
  - Head Pin: Glowing white/crimson dot indicating current accumulation.

### 6.2 The 4 Core EXP Pillars (2x2 Grid)
1. **Consistency**: Flame icon + Streak tracker.
2. **Volume & Effort**: Dumbbell/Tonnage icon + Kilograms lifted.
3. **Mastery & PRs**: Trophy icon + PR goals.
4. **Diversity**: Bolt/Split icon + Routine balance.
- **Card Styling**: Frosted glass card with micro progress bar at bottom of each card glowing red upon completion.

### 6.3 Tier Roadmap Timeline
- **Vertical Line**: 2px dark spine running down the timeline.
- **Node States**:
  - `Unlocked`: Solid red badge with white checkmark.
  - `Current / In Progress`: Pulsing concentric ring (`border-2 border-primary ring-4 ring-primary/20`).
  - `Locked`: Dimmed padlock icon with translucent grey node.
- **Milestone Cards**: Indented with highlight border for the current active tier target.

---

## 7. Interactive Components & States

### 7.1 Buttons & Touch Targets
- **Primary CTA ("Log Next Workout to Level Up")**:
  - Height: `h-14` (56px) for effortless tapping.
  - Background: Glossy liquid crimson gradient (`linear-gradient(135deg, #ff2a54 0%, #cf022b 100%)`).
  - Glow: `box-shadow: 0 8px 25px -4px rgba(255, 23, 68, 0.55), inset 0 1px 1px rgba(255, 255, 255, 0.35)`.
  - Icon: Lightning bolt / Fitness center glyph leading text in bold uppercase.
  - Active State: `active:scale-[0.98] transition-transform duration-100`.

### 7.2 Navigation Bars
- **Top App Bar**:
  - Sticky / Fixed with `backdrop-blur-xl bg-[#0a0a0c]/80`.
  - Brand logo with crimson kinetic accent on the letter `O` or icon badge.
  - Secondary notification button with dark frosted circular background.
- **Bottom Navigation Bar**:
  - Docked floating or docked full-width with glass blur (`backdrop-blur-2xl bg-[#0f0e14]/85`).
  - Active Tab: Crimson icon + dot indicator + font-bold.
  - Inactive Tabs: Muted slate (`#64748b`) with hover transition.

---

## 8. Motion, Feedback & Micro-Interactions

- **Ambient Shimmer**: Subtle 6s looped radial gradient shift behind hero tier cards.
- **Level-Up EXP Fill**: Ease-out cubic bezier curve (`cubic-bezier(0.16, 1, 0.3, 1)`) for satisfying progression bar animations.
- **Haptic & Visual Feedback**: Quick specular scale down (`active:scale-95`) on all buttons and badge cards.
