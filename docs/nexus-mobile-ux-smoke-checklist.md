# Nexus Mobile UX Smoke Checklist

This checklist documents the invariants and viewport testing requirements for the Nexus Core Platform mobile experience. The platform uses a mobile-first responsive design, treating viewports under `768px` as a single-column layout.

## 1. Viewport Scaling & Zoom
- [ ] `viewport` meta tag must include `width=device-width, initial-scale=1, maximum-scale=1`.
- [ ] UI must not feel "squeezed" or scaled down; typography and spacing should remain legible without zooming.
- [ ] Prefer a real phone test for final judgment; Chrome DevTools zoom can be misleading, but layout problems inside the emulated phone viewport are still real regressions.

## 2. Layout Structure (< 768px)
- [ ] **Single Column:** The main chat/workspace area takes full width. Left (Sidebar) and Right (Inspector) panels must be hidden by default.
- [ ] **Height constraints:** The layout should use `h-[100dvh]` to account for mobile browser address bars.
- [ ] **Header:** The top navigation bar must wrap or collapse cleanly (e.g., using icons or hiding text labels like "Nexus").
- [ ] **Regression Check:** App must not render as a centered narrow frame on mobile.
- [ ] **No Desktop Max Width:** Main mobile landing/chat content must not use centered desktop constraints such as `max-w-3xl`; use `w-full max-w-none` below `768px` and restore max width only at larger breakpoints.
- [ ] **Readable Titles:** Landing and chat titles must remain readable with controlled line-height, truncating long project/session names instead of squeezing header actions.

## 3. Navigation Controls (Drawers/Sheets)
- [ ] **Left Drawer (Projects):** A hamburger menu icon (`Menu`) on the left side of the header opens the `ProjectSidebar`.
- [ ] **Right Drawer (Inspector):** An activity/inspector icon (`Activity`) on the right side of the header opens the `ProjectInspector`.
- [ ] **Sheet Constraints:** Drawers should take up `85vw` to `90vw` on mobile, allowing a sliver of the background to be clicked for closing. They must be scrollable if content overflows.

## 4. Action Buttons & Touch Targets
- [ ] **Touch Target Size:** All action buttons must be at least `44px` high (`min-h-[44px]`).
- [ ] **Full Width Actions:** In the `ProjectInspector` Pipeline actions, buttons must stack and take full width (`w-full`) instead of wrapping awkwardly.
- [ ] **Padding/Margins:** Icons inside buttons should have sufficient padding to avoid accidental misclicks.

## 5. Input Composer
- [ ] **Positioning:** The main chat composer must stay sticky or positioned cleanly at the bottom.
- [ ] **Padding:** Textarea padding must accommodate the "Send" button without overlapping text (`pb-14` or similar).
- [ ] **Send Button:** The "Send" button should be positioned intuitively (e.g., bottom left/right) and remain easily tappable.
- [ ] **Full Width Composer:** Landing and chat composers must be full width on mobile, with the primary action stacked full-width under the input below `768px`.
- [ ] **Recent Chips:** "Recent session" chips and example prompt cards must wrap (`flex-wrap`) and scale to single columns (`grid-cols-1`).
- [ ] **Prompt Cards:** Suggested prompt cards must stay one-column, full-width, and touch friendly below `768px`; no two-column grid should appear on phones.

## 6. Testing Procedure
1. Open Chrome DevTools.
2. Toggle Device Toolbar (`Ctrl+Shift+M` / `Cmd+Shift+M`).
3. Set width to `390px` (e.g., iPhone 12 Pro).
4. Verify the top header, drawers (left and right), and composer match the invariants above.
5. Tap Pipeline action buttons to ensure they are full width and easily clickable.
