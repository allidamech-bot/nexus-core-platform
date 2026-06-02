# Nexus Theme System

Nexus uses a frontend-only theme system backed by CSS variables. The selected theme is stored in `localStorage` under `nexus-theme` and applied to the document root as `data-theme`.

## Themes

- `matte-black` / Matte Black / أسود مطفي
  - Background `#0A0A0B`
  - Surface `#111113`
  - Elevated surface `#17171A`
  - Border `rgba(255,255,255,0.08)`
  - Foreground `#F4F4F5`
  - Muted foreground `#A1A1AA`
  - Accent `#38BDF8`

- `deep-black` / Deep Black / أسود داكن
  - Background `#02040A`
  - Surface `#070B14`
  - Elevated surface `#0B1020`
  - Border `rgba(96,165,250,0.14)`
  - Foreground `#F8FAFC`
  - Muted foreground `#94A3B8`
  - Accent `#38BDF8`

- `light-beige` / Light Beige / فاتح بيج
  - Background `#F6F1E8`
  - Surface `#FFFDF8`
  - Elevated surface `#FDF8EF`
  - Border `rgba(80,60,35,0.14)`
  - Foreground `#1F2933`
  - Muted foreground `#6B6258`
  - Accent `#2563EB`

## Token Strategy

Theme definitions live in `src/styles.css`. Tailwind color utilities map to CSS variables through `@theme inline`, so components should prefer semantic classes such as `bg-background`, `bg-surface`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, and `text-accent`.

The required token set is:

- `--background`
- `--foreground`
- `--surface`
- `--surface-elevated`
- `--muted`
- `--muted-foreground`
- `--border`
- `--accent`
- `--accent-foreground`
- `--ring`
- `--success`
- `--warning`
- `--danger`

Existing compatibility aliases such as `--card`, `--primary`, `--secondary`, `--destructive`, and `--input` remain mapped for current UI components.

## Adding A Future Theme

1. Add the theme id to `NEXUS_THEMES` in `src/features/theme/themeContext.tsx`.
2. Add labels in `src/features/theme/ThemeSelector.tsx`.
3. Add a matching `:root[data-theme="..."]` block in `src/styles.css`.
4. Use semantic tokens only; avoid hardcoded dark-only classes such as `text-zinc-200`, `bg-black/10`, and `border-white/5` in shared workspace surfaces.
5. Test Settings, app shell, chat, inspector, diagnostics, file inventory, and mobile drawers.

## Mobile Testing Checklist

- Test `390px` width and a real phone when possible.
- Switch all three themes from Settings and from the compact header selector where visible.
- Confirm refresh preserves the selected theme.
- Confirm no horizontal scroll in landing, chat, inspector drawer, Settings, and project sidebar.
- Confirm composer buttons remain full width below `768px`.
- Confirm prompt cards remain one-column below `768px`.

## Contrast Notes

Light Beige must never rely on white text or dark-only translucent surfaces. Use `text-foreground`, `text-muted-foreground`, `bg-surface`, `bg-muted`, and `border-border` so contrast follows the active token set. Status colors keep their semantic Tailwind hues but sit on tokenized surfaces and borders.
