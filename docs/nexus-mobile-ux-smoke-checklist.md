# Nexus Mobile UX Smoke Checklist

Nexus treats every viewport under `768px` as a native-feeling mobile workspace, not a squeezed desktop layout.

## Viewports

- [ ] Test `320px`, `390px`, and `430px` widths.
- [ ] Confirm on a real phone when possible; DevTools zoom must not be used to dismiss problems inside the emulated viewport.
- [ ] No horizontal scroll on home, chat, Projects drawer, Inspector drawer, Settings, or any composer state.
- [ ] No primary label or CTA uses tiny unreadable text.

## Header

- [ ] Menu button is at least `44px`.
- [ ] Inspector button is at least `44px`.
- [ ] NX mark and project identity remain readable.
- [ ] Project title truncates cleanly.
- [ ] Status/meta never crushes the title.
- [ ] Secondary actions are hidden from the phone header or moved into drawers.
- [ ] Header works in Matte Black, Deep Black, and Light Beige.

## Home Command Screen

- [ ] `/app` feels like a premium mobile AI command screen.
- [ ] Hero title is readable, roughly `text-2xl` or larger on mobile.
- [ ] Subtitle/helper copy appears below the title.
- [ ] Composer is full width and visually framed.
- [ ] Textarea is at least `120px` tall.
- [ ] Create AI session CTA is accent-colored, full width, and at least `52px` tall.
- [ ] Helper line appears below the CTA.
- [ ] Recent sessions are readable, wrapping, and at least `44px` tappable.
- [ ] Suggested prompts are one-column premium cards below `768px`.

## Projects Drawer

- [ ] Drawer reads as a mobile Projects screen with a clear title.
- [ ] Active project summary is visible when available.
- [ ] Upload/import button is full width, accent-colored, and at least `48px` tall.
- [ ] Filters are segmented controls, not tiny tabs.
- [ ] Project rows are at least `64px` tall.
- [ ] Project name, meta, and status are readable.
- [ ] Active project row is clearly highlighted.
- [ ] Drawer has no horizontal overflow.

## Inspector Drawer

- [ ] Inspector sheet is near full-screen (`95vw`) on mobile.
- [ ] Header is sticky and readable.
- [ ] Diagnostics are readable without tiny badges.
- [ ] A primary Next safe action CTA appears above advanced actions when possible.
- [ ] Advanced pipeline actions stack full width and remain tappable.
- [ ] Project files list is readable.
- [ ] Buttons and badges are not clipped.

## Bottom Navigation

- [ ] Mobile-only bottom bar appears below `768px`.
- [ ] Contains Projects, Workspace, and Inspector.
- [ ] Minimum height is at least `56px`.
- [ ] Buttons are at least `44px` tappable.
- [ ] Uses safe-area bottom padding.
- [ ] Does not cover the composer or important content.
- [ ] Surface and border are theme-aware.

## Theme Sweep

- [ ] Matte Black is soft and professional.
- [ ] Deep Black is higher contrast and premium.
- [ ] Light Beige has readable text, visible borders, and no white-on-beige failures.
- [ ] Status colors and badges remain readable in all themes.
- [ ] Composer, CTA, prompt cards, drawers, diagnostics, and bottom nav update with theme tokens.
