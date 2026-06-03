# Nexus Mobile UX Smoke Checklist

Nexus treats every viewport under `768px` as a native-feeling mobile workspace, not a squeezed desktop layout.

## Viewports

- [ ] Test `320px`, `390px`, and `430px` widths.
- [ ] Confirm on a real phone when possible; DevTools zoom must not be used to dismiss problems inside the emulated viewport.
- [ ] No horizontal scroll on home, chat, Projects drawer, Inspector drawer, Settings, or any composer state.
- [ ] No primary label or CTA uses tiny unreadable text.

## Header

- [ ] Header respects `env(safe-area-inset-top)` on mobile.
- [ ] Header has comfortable mobile top spacing and is at least `56px` tall below the safe area.
- [ ] Menu button is at least `44px`.
- [ ] Menu button has a forgiving tap zone and does not require tapping a tiny icon.
- [ ] Inspector button is at least `44px`.
- [ ] NX mark and project identity remain readable.
- [ ] Project title truncates cleanly.
- [ ] Status/meta never crushes the title.
- [ ] Secondary actions are hidden from the phone header or moved into drawers.
- [ ] Header works in Matte Black, Deep Black, and Light Beige.

## Home Command Screen

- [ ] `/app` feels like a premium mobile AI command screen.
- [ ] Workspace hero starts with visible breathing room below the app header.
- [ ] Hero title is readable, roughly `text-2xl` or larger on mobile.
- [ ] Subtitle/helper copy appears below the title.
- [ ] Composer is full width and visually framed.
- [ ] Textarea is at least `120px` tall.
- [ ] Create AI session CTA is accent-colored, full width, and at least `52px` tall.
- [ ] Helper line appears below the CTA.
- [ ] Recent sessions are readable, wrapping, and at least `44px` tappable.
- [ ] Recent sessions and prompt cards are not covered by the bottom nav.
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
- [ ] Contains Projects, Workspace, Inspector, and More.
- [ ] Minimum height is at least `56px`.
- [ ] Buttons are at least `44px` tappable.
- [ ] Uses safe-area bottom padding.
- [ ] Does not cover the composer or important content.
- [ ] Workspace tab routes to `/app` and has a full `44px` tap target.
- [ ] Surface and border are theme-aware.

## Mobile Navigation Completeness

- [ ] More is reachable from mobile without relying on desktop header actions.
- [ ] More sheet has a readable subtitle under the More title.
- [ ] More sheet actions are grouped into Navigation, Preferences, Project tools, Danger zone, and Account.
- [ ] Settings/Admin rows have clear icon, title, and secondary description.
- [ ] Settings is reachable from More and renders as a mobile-readable page.
- [ ] Admin Control appears in mobile navigation only for allowed admin users.
- [ ] Language switching is reachable on mobile, visible in Preferences, and has tappable controls.
- [ ] Theme selection is reachable on mobile, visible in Preferences, and works in all supported themes.
- [ ] Upload ZIP is reachable from Projects and More with a full-width tappable CTA.
- [ ] Folder import is reachable from Projects and More with a full-width tappable CTA of equal visual weight.
- [ ] Archive project is under Danger zone, styled destructively, and shows confirmation before action.
- [ ] Sign out is under Account, not mixed with project tools.
- [ ] More sheet has no horizontal overflow at `320px`, `390px`, or `430px`.

## Settings Page

- [ ] Settings has a mobile-first hero/header with clear title and subtitle.
- [ ] Quick controls appear near the top before secondary account cards.
- [ ] Theme and Language are visible near the top on mobile.
- [ ] Quick control cards are one-column below `640px`.
- [ ] Admin Control quick card appears only for allowed admin users.
- [ ] Project tools quick card appears when an active project exists.
- [ ] Danger Zone is visually separated and not mixed with normal account settings.
- [ ] All Settings page buttons are at least `44px` tappable.

## Theme Sweep

- [ ] Matte Black is soft and professional.
- [ ] Deep Black is higher contrast and premium.
- [ ] Light Beige has readable text, visible borders, and no white-on-beige failures.
- [ ] Light Beige selector contrast is readable for selected and unselected theme/language states.
- [ ] Status colors and badges remain readable in all themes.
- [ ] Composer, CTA, prompt cards, drawers, diagnostics, and bottom nav update with theme tokens.
