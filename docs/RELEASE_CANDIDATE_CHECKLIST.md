# Nexus Core Release Candidate Checklist

This checklist defines the required manual and automated smoke validation steps to authorize a Release Candidate (RC) build for usable deployment. 

> [!IMPORTANT]
> Nexus Core is strictly **pre-execution** and **read-only** for project files. Direct execution, sandbox script running, object storage writeback, Stripe checkout, or autonomous changes remain disabled.

---

## 1. Automated Baseline Checks

Ensure these commands run and complete successfully without errors in the workspace:

```bash
pnpm install
pnpm run lint
pnpm exec tsc -p tsconfig.json --noEmit
pnpm build
pnpm test:e2e
```

---

## 2. Public Boundary & Localization Smoke

### A. Authentication Barriers
- [ ] Visit the deployment root `/` when unauthenticated. Confirm the landing/welcome page loads cleanly.
- [ ] Navigate to `/app`, `/app/settings`, `/app/admin`, or `/app/some-thread-id`. Confirm you are immediately redirected to `/login` without private UI flash or leakage.
- [ ] Attempt unauthenticated calls to `/api/chat` and `/api/projects/process-zip`. Confirm they return `401 Unauthorized` with an `x-correlation-id` header.

### B. Arabic/RTL Persisted Preference
- [ ] Click the language switch button to set preference to **Arabic**.
- [ ] Verify the page updates:
  - `html lang="ar"`
  - `dir="rtl"`
  - UI alignment shifts to RTL properly.
- [ ] Refresh the page or close and reopen the tab. Confirm that **Arabic RTL mode persists** across reloads without credentials.
- [ ] Switch back to **English** and verify alignment restores.

---

## 3. Upload & Ingestion Invariants

### A. ZIP Upload Safe Process
- [ ] Prepare a small `.zip` archive containing standard text/code files (e.g., `README.md`, `index.js`).
- [ ] Upload the ZIP inside the upload dialog.
- [ ] Confirm a safe metadata manifest is generated, and files are indexed safely.
- [ ] Confirm no scripts are executed or packages installed.

### B. Safe Error post-limit / Fallbacks
- [ ] Trigger an ingestion error (e.g., attempt to upload a ZIP when quota limits are reached or upload a corrupt file).
- [ ] Verify the error dialog does not crash or print stack traces.
- [ ] Verify the fallback message returned is `t("zipProcessingFailed")` ("ZIP processing failed") instead of saying upload succeeded.

---

## 4. Structured AI Workspace & Previews

### A. Workspace Initializing State
- [ ] Create a new AI Session.
- [ ] Verify that during workspace setup, the loading indicator displays the translated copy **"Initializing workspace..."** / **"جارٍ تهيئة مساحة العمل..."** (based on selected language).

### B. Previews Loading Indicator
- [ ] Open the patch or file preview panels.
- [ ] Verify the loading state displays **"Loading previews..."** / **"جارٍ تحميل المعاينات..."** instead of "Loading projects".

### C. Connect Repo Guard
- [ ] Hover over the **"Connect Repo"** button.
- [ ] Confirm the button is properly **disabled** with clear styling (reduced opacity).
- [ ] Verify a Radix **Tooltip** appears explaining: *"Repository connection is not supported in this phase."* / *"ربط المستودع غير مدعوم في هذه المرحلة."*

### D. Ingestion Status Text
- [ ] In the project inspector panel, check the Ingestion Status.
- [ ] Confirm status values with multiple underscores replace all underscores cleanly (e.g., `processing_failed` displays as `processing failed` instead of `processing_failed` or `processing failed_failed`).

---

## 5. Admin Governance & Writebacks

### A. Writeback Request Review Description
- [ ] Visit `/app/admin` using a verified admin account (`allidamech@gmail.com`).
- [ ] Confirm the **Writeback Review Workflow** header section displays a simplified, readable description:
  - *"Review submitted writeback requests. Approval authorizes future writeback; changes are not applied directly."* / *"مراجعة طلبات الكتابة المقدمة. الموافقة ترخص للكتابة المستقبلية؛ لا يتم تطبيق التغييرات مباشرة."*

### B. Request Actions
- [ ] Submit a writeback request from a non-admin account.
- [ ] Open `/app/admin` as an admin, select the request, and check safety invariants.
- [ ] Verify that approving the request displays a message stating approval is for **future writeback consideration only** and does not modify the source ZIP or project files.
