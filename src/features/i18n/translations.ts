export const translations = {
  en: {
    // Language / a11y
    language: "Language",
    english: "English",
    arabic: "Arabic",
    switchToEnglish: "Switch interface to English",
    switchToArabic: "Switch interface to Arabic",

    // Auth
    loginTitle: "Sign in to Nexus Core",
    loginSubtitle: "Resume your sessions and continue project-aware planning.",
    signupTitle: "Create your workspace",
    signupSubtitle: "Create your first project-aware planning workspace in under a minute.",
    emailLabel: "Email",
    workEmailLabel: "Work email",
    passwordLabel: "Password",
    signIn: "Sign in",
    signingIn: "Authenticating...",
    noAccount: "No account?",
    createOne: "Create one",
    createAccount: "Create account",
    creatingAccount: "Provisioning...",
    alreadyHaveAccount: "Already have an account?",
    authEmailPasswordRequired: "Email and password are required.",
    authPasswordMinLength: "Password must be at least 6 characters.",
    signupSuccess: "Check your inbox to confirm your account.",
    authSupabaseMissing:
      "Supabase is not configured. Connect Supabase in Lovable Cloud or add the required environment variables.",
    authInvalidCredentials: "Email or password is incorrect.",
    authEmailNotConfirmed: "Confirm your email before signing in.",
    authServiceUnreachable:
      "Authentication service is unreachable. Check your connection and Supabase configuration.",
    authFailed: "Authentication failed. Please try again.",

    // Sidebar / nav
    workspace: "Workspace",
    quickActions: "Quick Actions",
    sessions: "Sessions",
    noSessions: "No sessions yet.",
    newSession: "New Session",
    untitled: "Untitled",
    workspaceOwner: "Workspace owner",
    signOut: "Sign out",
    adminControl: "Admin Control",
    businessWorkflow: "Business Workflow",
    soon: "Soon",
    settings: "Settings",
    projects: "Projects",

    // Upload dialog
    uploadZip: "Upload ZIP",
    uploadProjectArchive: "Upload project archive",
    uploadDescription:
      "Create a real project record, manifest, and safe text preview index from a ZIP archive or local folder.",
    selectZipArchive: "Select a .zip archive",
    zipOnly:
      "ZIP only, max {max}MB. Nexus Core reads small allowlisted text previews only and never executes project code. Use ZIP upload to enable safe file previews and grounded patch previews.",
    folderImportHint:
      "Folder import creates safe metadata inventory only. Raw file contents are not uploaded, text previews are not generated, and patch previews will stay inferred or illustrative. Use ZIP upload to enable safe file previews.",
    zipPreviewPath: "ZIP upload enables safe file previews for grounded proposal confidence.",
    folderInventoryOnly:
      "Folder import is inventory-only. Use ZIP upload when you need safe previews and grounded patch previews.",
    projectLimitReachedForUpload:
      "Project limit reached. Archive an existing project when project lifecycle is available, use a QA account with an open project slot, or upgrade your plan before uploading another ZIP.",
    monthlyUploadLimitReached:
      "Monthly successful ZIP upload limit reached. Wait for the monthly reset, use a QA account or plan with available uploads, upgrade your plan, or continue with an existing ZIP-backed project that already has safe previews.",
    zipUploadProcessingFailed:
      "ZIP upload could not be processed. Safe previews were not generated.",
    zipProcessingStarted: "ZIP processing started.",
    zipProcessedSuccessfully:
      "ZIP processed successfully. Indexed {indexed} files and skipped {skipped} files.",
    zipRejectedUnsafePaths: "ZIP rejected because it contains unsafe paths.",
    zipRejectedSizeLimits: "ZIP rejected because it exceeds file or size limits.",
    zipProcessingFailed: "ZIP processing failed.",
    indexedFiles: "Indexed files",
    skippedFiles: "Skipped files",
    unsupportedFilesSkippedSafely: "Unsupported files were skipped safely.",
    safeProjectPreviewReady: "Safe project preview is ready.",
    safePreview: "Safe preview",
    fileTree: "File tree",
    projectFiles: "Project files",
    previewReady: "Preview ready",
    noPreviewAvailable: "No preview available",
    thisFileWasSkipped: "This file was skipped",
    unsupportedFileType: "Unsupported file type",
    binaryFilePreviewDisabled: "Binary file preview is disabled",
    unsafeFileRejected: "Unsafe file was rejected",
    selectFileToPreview: "Select a file to preview",
    previewTruncatedForSafety: "Preview truncated for safety",
    projectNotProcessedYet: "Project has not been processed yet",
    groundedPatchPreview: "Grounded Patch Preview",
    createPatchPreview: "Create patch preview",
    patchPreviewOnly: "Patch preview only",
    thisPatchNotApplied: "This patch has not been applied",
    selectPreviewableFile: "Select a previewable file",
    searchText: "Search text",
    replacementText: "Replacement text",
    generatePreview: "Generate preview",
    unifiedDiff: "Unified diff",
    groundedFiles: "Grounded files",
    patchPreviewCreated: "Patch preview created",
    patchPreviewFailed: "Patch preview failed",
    oldTextNotFound: "Old text was not found in the available preview",
    fileCannotBePatched: "This file cannot be patched",
    binaryFilesCannotBePatched: "Binary files cannot be patched",
    skippedFilesCannotBePatched: "Skipped files cannot be patched",
    sensitiveFilesCannotBePatched: "Sensitive files cannot be patched",
    applyUnavailableYet: "Apply is not available yet",
    previewLimitedToIndexedText: "Preview is limited to indexed text",
    patchSandbox: "Patch sandbox",
    verifyInSandbox: "Verify in sandbox",
    sandboxVerified: "Sandbox verified",
    sandboxBlocked: "Sandbox blocked",
    sandboxFailed: "Sandbox failed",
    sandboxPartial: "Sandbox partial",
    noProjectFilesModified: "No project files were modified",
    sandboxLimitedToIndexedText: "Sandbox is limited to indexed preview text",
    before: "Before",
    after: "After",
    wouldChange: "Would change",
    blockers: "Blockers",
    conflicts: "Conflicts",
    stalePreviewDetected: "Stale preview detected",
    targetFileNoLongerPreviewable: "Target file is no longer previewable",
    oldTextAppearsMultipleTimes: "Old text appears multiple times",
    currentFileHashDiffers: "Current file hash differs from patch grounding",
    patchPreviewCannotBeAppliedSafelyYet: "Patch preview cannot be applied safely yet",
    applyRemainsDisabled: "Apply remains disabled",
    versionedPatchSnapshot: "Versioned patch snapshot",
    createVersionedSnapshot: "Create versioned snapshot",
    snapshotCreated: "Snapshot created",
    snapshotCreationFailed: "Snapshot creation failed",
    snapshotAlreadyExists: "Snapshot already exists",
    derivedSnapshotOnly: "Derived snapshot only",
    originalProjectFilesWereNotModified: "Original project files were not modified",
    patchedPreview: "Patched preview",
    originalPreview: "Original preview",
    snapshotFiles: "Snapshot files",
    changedFiles: "Changed files",
    noChangedFiles: "No changed files",
    cannotCreateSnapshotFromBlockedSandbox: "Cannot create snapshot from blocked sandbox",
    snapshotLimitedToIndexedText: "Snapshot is limited to indexed preview text",
    sourceWritebackUnavailableYet: "Source writeback is not available yet",
    versionedWorkingCopy: "Versioned working copy",
    createVersionedWorkingCopy: "Create versioned working copy",
    workingCopyCreated: "Working copy created",
    workingCopyAlreadyExists: "Working copy already exists",
    workingCopyCreationFailed: "Working copy creation failed",
    versionedWorkingCopyCreatedNotice:
      "This created a versioned working copy. Original project files were not modified.",
    sourceZipAndObjectStorageNotOverwritten: "Source ZIP and object storage were not overwritten.",
    sourceZipWasNotOverwritten: "Source ZIP was not overwritten",
    objectStorageWasNotModified: "Object storage was not modified",
    workingCopyFiles: "Working copy files",
    executedFromApprovedRequest: "Executed from approved request",
    requestMustBeApprovedBeforeExecution: "Request must be approved before execution",
    executionBlocked: "Execution blocked",
    executionDoesNotDeployChanges: "Execution does not deploy changes",
    productionSourceWritebackUnavailableYet: "Production/source writeback is not available yet",
    downloadWorkingCopyExport: "Download working copy export",
    exportWorkingCopy: "Export working copy",
    workingCopyExportCreated: "Working copy export created",
    workingCopyExportFailed: "Working copy export failed",
    versionedWorkingCopyBundle: "Versioned working copy bundle",
    exportLimitedToWorkingCopyText: "Export is limited to working copy text",
    workingCopyExportBlocked: "Working copy export blocked",
    workingCopyExportFileLimitExceeded: "Working copy export file limit exceeded",
    workingCopyExportSizeLimitExceeded: "Working copy export size limit exceeded",
    downloadSnapshotExport: "Download snapshot export",
    exportSnapshot: "Export snapshot",
    exportCreated: "Export created",
    exportFailed: "Export failed",
    exportLimitedToIndexedText: "Export is limited to indexed preview text",
    derivedPreviewBundle: "Derived preview bundle",
    snapshotExportIncludesPatchedPreviewFilesOnly:
      "Snapshot export includes patched preview files only",
    exportBlocked: "Export blocked",
    exportFileLimitExceeded: "Export file limit exceeded",
    exportSizeLimitExceeded: "Export size limit exceeded",
    snapshotExportReadme: "Snapshot export README",
    sourceWritebackNotIncluded: "Source writeback is not included",
    sourceWritebackReview: "Source writeback review",
    requestSourceWritebackReview: "Request source writeback review",
    writebackRequestCreated: "Writeback request created",
    writebackRequestSubmitted: "Writeback request submitted",
    writebackRequestCancelled: "Writeback request cancelled",
    writebackRequestBlocked: "Writeback request blocked",
    thisOnlyCreatesReviewRequest: "This only creates a review request",
    requestStatus: "Request status",
    reviewerNote: "Reviewer note",
    requesterNote: "Requester note",
    submitRequest: "Submit request",
    cancelRequest: "Cancel request",
    riskLevel: "Risk level",
    lowRisk: "Low risk",
    mediumRisk: "Medium risk",
    highRisk: "High risk",
    blockedRisk: "Blocked risk",
    governanceReviewRequired: "Governance review required",
    approvalDoesNotApplyChangesYet: "Approval does not apply changes yet",
    writebackReviewWorkflow: "Writeback review workflow",
    submittedWritebackRequests: "Submitted writeback requests",
    reviewRequest: "Review request",
    approveRequest: "Approve request",
    rejectRequest: "Reject request",
    requestApproved: "Request approved",
    requestRejected: "Request rejected",
    requestCannotBeApproved: "Request cannot be approved",
    requestHasBlockers: "Request has blockers",
    reviewer: "Reviewer",
    reviewedAt: "Reviewed at",
    reviewDecision: "Review decision",
    approvalDoesNotApplyChanges: "Approval does not apply changes",
    approvedForFutureWritebackConsideration: "Approved for future writeback consideration",
    rejectedByReviewer: "Rejected by reviewer",
    waitingForReview: "Waiting for review",
    noSubmittedRequests: "No submitted requests",
    reviewerNoteRequiredForRejection: "Reviewer note is required for rejection",
    aiPatchPreview: "AI patch preview",
    describeChangeYouWant: "Describe the change you want",
    generateAiPatchPreview: "Generate AI patch preview",
    generatingPatchPreview: "Generating patch preview",
    aiPatchPreviewCreated: "AI patch preview created",
    aiPatchPreviewFailed: "AI patch preview failed",
    aiOutputCouldNotBeValidated: "AI output could not be validated",
    selectAtLeastOnePreviewableFile: "Select at least one previewable file",
    tooManyFilesSelected: "Too many files selected",
    instructionTooLong: "Instruction is too long",
    generatedChanges: "Generated changes",
    aiProposedChanges: "AI proposed changes",
    thisAiPatchNotApplied: "This AI patch has not been applied",
    onlySelectedFilesUsed: "Only selected files were used",
    aiTriedUnavailableFile: "AI tried to modify an unavailable file",
    aiOldTextNotFound: "AI old text was not found",
    previewGenerationLimitedToIndexedText: "Preview generation is limited to indexed text",
    archiveProject: "Archive project",
    archiveProjectConfirm: "Archive this project?",
    archiveProjectWarning:
      "This will not delete files or sessions. It frees a project slot for new projects.",
    projectArchived: "Project archived",
    projectArchivedCanCreate: "Project archived. You can create a new project now.",
    archiveProjectFailed: "Failed to archive project.",
    archivedProject: "Archived project",
    noActiveProjectAvailable: "No active project available",
    archiveOldProjectToCreateNew: "Archive an old project to create a new one.",
    thisProjectIsArchived: "This project is archived.",
    selectFolderFirst: "Select a project folder first.",
    folderImportSuccess: "Folder manifest imported. Safe file inventory is ready.",
    selectZipFirst: "Select a .zip archive first.",
    uploadSuccess: "Project archive uploaded. Ingestion foundation is ready.",
    uploadStaged: "Project staged. Storage bucket is not configured yet.",
    projectName: "Project name",
    projectNamePlaceholder: "Nexus web application",
    description: "Description",
    descriptionPlaceholder: "Optional project context for operators.",
    cancel: "Cancel",
    createProject: "Create project",
    size: "Size",

    // Governance / usage meters
    quotaGovernance: "Usage governance",
    plan: "Plan",
    uploads: "Uploads",
    aiRequests: "AI requests",
    previews: "Previews",
    threads: "Threads",
    context: "Context",
    unlimited: "Unlimited",
    used: "used",
    limit: "limit",
    usageFormat: "{used} used / {limit} limit",
    nearLimit: "Approaching limit",
    limitReached: "Limit reached",
    upgradePrompt: "Upgrade to Pro for higher governance limits.",

    // Workspace home
    welcomeTitle: "Welcome to your AI operations workspace.",
    welcomeSubtitle:
      "Upload a project, inspect the safe manifest, select preview context, then open a session for structured AI planning. Execution remains disabled until the sandbox phase.",
    tellNexusToChange: "Tell Nexus what to change in your project.",
    nexusHelperText:
      "Nexus can plan and prepare project changes. Direct execution is not enabled yet.",
    examplePrompt1: "Fix the login redirect issue",
    examplePrompt2: "Review this project and find risks",
    examplePrompt3: "Add a pricing section",
    examplePrompt4: "Create an implementation plan for Project Memory",
    uploadOrImport: "Upload or import project",
    createAiSession: "Create AI session",
    creatingSession: "Creating session...",
    sessionQuotaReached:
      "Active thread limit reached. Open an existing session or upgrade your plan.",
    sessionCreateFailed: "Failed to create session. Please retry or open an existing session.",
    sessionMessageSaveFailed:
      "Session created, but your first message could not be saved. Please retry before opening it.",
    sessionAuthRequired: "Sign in again before creating a session.",
    openExistingSession: "Open existing session",
    openRecentSession: "Open recent session",
    archiveSession: "Archive session",
    archiveSessionConfirm: "Archive this session?",
    sessionArchived: "Session archived. You can start a new task now.",
    archiveSessionFailed: "Failed to archive session.",
    archivedSession: "Archived session",
    thisSessionIsArchived: "This session is archived.",
    archiveExistingSessionToStartNewTask: "Archive an existing session to start a new task.",
    startNewTaskAfterArchiving: "Start a new task after archiving an old session.",
    ingestionReady: "Project ingestion foundation is ready.",
    ingestionReadyBody:
      "Upload a ZIP or select a local folder to create project records, ingestion jobs, safe file inventory, and manifest context. Nexus never executes imported code.",
    activeProject: "Active project",
    projectContextAttached: "Project context attached",
    projectContextNotAttached: "Project context not attached",
    noProjectContextAvailable: "No project context available",
    attachThisProject: "Attach this project",
    attachedProject: "Attached project",
    assistantCanUseIndexedProjectContext: "Assistant can use indexed project context.",
    attachProjectToImproveProposals: "Attach this project to improve proposals.",
    responsesMayBeGeneralWithoutProjectContext: "Responses may be general without project context.",
    structuredPlanning: "Structured planning",
    structuredPlanningBody: "Understanding / Plan / Risks / Files",
    safeContext: "Safe project context",
    safeContextBody: "Manifest / Preview / File inventory",
    governedAccess: "Governed access",
    governedAccessBody: "Quota checks / Audit events / RLS",
    canDoNow: "What Nexus can do now",
    canDoItem1: "Ingest ZIP archives and folder manifests",
    canDoItem2: "Generate safe file inventory and preview context",
    canDoItem3: "Attach projects to threaded AI sessions",
    canDoItem4: "Meter usage and audit sensitive actions",
    notSupportedYet: "Not yet supported",
    notSupportedItem1: "No shell, terminal, sandbox, or dependency installation",
    notSupportedItem2: "No autonomous code modification or pull requests",
    notSupportedItem3: "No GitHub OAuth, embeddings, or payment checkout yet",

    // Project list / status
    loadingProjects: "Loading projects",
    noProjectsYet: "No projects yet",
    noProjectsBody: "Upload a ZIP to create the first real project record and ingestion job.",

    // Folder import
    folderImport: "Folder import",
    selectFolder: "Select folder",
    dragFolder: "Drop a project folder or ZIP archive here",
    folderImportReady: "Folder import preview is ready.",
    ignoredFiles: "Ignored files",
    acceptedFiles: "Accepted files",
    safeIngestion: "Safe ingestion",

    // Filter / context
    filterPreviews: "Filter previews",
    noPreviewMatch: "No previews match that filter.",
    selected: "Selected",
    select: "Select",

    // Admin
    controlPlane: "Control plane",
    adminFoundation: "Admin foundation",
    rlsEnforced: "RLS enforced",
    controlPlaneSubtitle:
      "Secure administrative visibility for roles, billing placeholders, project ingestion, security events, audit history, and system health.",
    recentActivity: "Recent activity",
    quotaViolations: "Quota violations",
    securityEvents: "Security events",
    billingPlans: "Billing plans",
    noRecords: "No records visible.",
    noSecurityEvents: "No security events visible.",
    noQuotaViolations: "No quota violations recorded.",
    noUsageEvents: "No usage events recorded.",
    paymentsNotConnected: "Payments not connected",
    roleRecords: "Role records",
    plans: "Plans",
    subscriptions: "Subscriptions",
    tokens: "Tokens",
    failures: "Failures",
    placeholderUsers: "Users",
    placeholderUsersDetail: "Role and account operations",
    placeholderSubs: "Subscriptions",
    placeholderSubsDetail: "Plan status and billing health",
    placeholderUsageLimits: "Usage limits",
    placeholderUsageLimitsDetail: "Quota policy and enforcement",
    placeholderUploads: "Project uploads",
    placeholderUploadsDetail: "Ingestion and storage visibility",
    placeholderSecurity: "Security events",
    placeholderSecurityDetail: "Suspicious upload and access events",
    placeholderAudit: "Audit logs",
    placeholderAuditDetail: "Admin and context-selection history",
    placeholderSystem: "System health",
    placeholderSystemDetail: "Runtime, queue, and provider status",
    planDistribution: "Plan distribution",
    storageIndexing: "Storage and indexing health",
    trackedStorage: "Tracked storage",
    contextSelections: "Context selections",
    auditEvents: "Audit events",
    previewHealth: "Preview health",
    stable: "Stable",
    review: "Review",
    systemHealth: "System health",
    migrationChecklist: "Migration checklist",
    operationalWarnings: "Operational warnings",
    authRls: "Auth/RLS",
    active: "Active",
    projectIngestion: "Project ingestion",
    ready: "Ready",
    aiGateway: "AI gateway",
    configuredByEnv: "Configured by env",
    executionRuntime: "Execution runtime",
    disabled: "Disabled",
    adminRoles: "Admin roles",
    detected: "Detected",
    noRecordsShort: "No records",
    seeded: "Seeded",
    receiving: "Receiving",
    empty: "Empty",
    billing: "Billing",
    providerNotConnected: "Provider not connected",
    teams: "Teams",
    notEnabled: "Not enabled",
    sandbox: "Sandbox",
    bundle: "Bundle",
    largeChunkWarning: "Large chunk warning",

    // Settings
    settingsTitle: "Workspace settings",
    settingsSubtitle:
      "Manage account preferences, language, plan visibility, usage posture, and future enterprise controls.",
    profile: "Profile",
    profileBody:
      "Profile editing, notification preferences, and identity metadata are reserved for the organization phase.",
    signedInUser: "Signed-in user",
    organization: "Organization",
    organizationBody:
      "Organization membership, roles, workspace permissions, and domain controls are planned but not active yet.",
    languageBody: "Language preference is saved locally and updates layout direction for Arabic.",
    apiAccess: "API and access",
    apiAccessBody:
      "API keys, SCIM, SSO, and service accounts are intentionally disabled until the enterprise security layer is ready.",
    dangerZone: "Danger zone",
    dangerZoneBody:
      "Workspace deletion and export controls will require admin approval and audit logging. No destructive settings are available in this phase.",
    currentPlan: "Current plan",
    currentPlanBody:
      "Billing is not connected. Limits are enforced through the governance foundation.",
  },
  ar: {
    // Language / a11y
    language: "اللغة",
    english: "الإنجليزية",
    arabic: "العربية",
    switchToEnglish: "تبديل الواجهة إلى الإنجليزية",
    switchToArabic: "تبديل الواجهة إلى العربية",

    // Auth
    loginTitle:
      "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0625\u0644\u0649 Nexus Core",
    loginSubtitle:
      "\u062a\u0627\u0628\u0639 \u062c\u0644\u0633\u0627\u062a\u0643 \u0648\u0623\u0643\u0645\u0644 \u0627\u0644\u062a\u062e\u0637\u064a\u0637 \u0627\u0644\u0645\u0631\u062a\u0628\u0637 \u0628\u0645\u0634\u0631\u0648\u0639\u0643.",
    signupTitle:
      "\u0625\u0646\u0634\u0627\u0621 \u0645\u0633\u0627\u062d\u0629 \u0639\u0645\u0644\u0643",
    signupSubtitle:
      "\u0623\u0646\u0634\u0626 \u0623\u0648\u0644 \u0645\u0633\u0627\u062d\u0629 \u062a\u062e\u0637\u064a\u0637 \u0645\u0631\u062a\u0628\u0637\u0629 \u0628\u0627\u0644\u0645\u0634\u0631\u0648\u0639 \u0641\u064a \u0623\u0642\u0644 \u0645\u0646 \u062f\u0642\u064a\u0642\u0629.",
    emailLabel:
      "\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a",
    workEmailLabel:
      "\u0628\u0631\u064a\u062f \u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a",
    passwordLabel: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631",
    signIn: "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644",
    signingIn:
      "\u062c\u0627\u0631\u064d \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644...",
    noAccount: "\u0644\u064a\u0633 \u0644\u062f\u064a\u0643 \u062d\u0633\u0627\u0628\u061f",
    createOne: "\u0623\u0646\u0634\u0626 \u062d\u0633\u0627\u0628\u064b\u0627",
    createAccount: "\u0625\u0646\u0634\u0627\u0621 \u062d\u0633\u0627\u0628",
    creatingAccount:
      "\u062c\u0627\u0631\u064d \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062d\u0633\u0627\u0628...",
    alreadyHaveAccount:
      "\u0644\u062f\u064a\u0643 \u062d\u0633\u0627\u0628 \u0628\u0627\u0644\u0641\u0639\u0644\u061f",
    authEmailPasswordRequired:
      "\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0637\u0644\u0648\u0628\u0627\u0646.",
    authPasswordMinLength:
      "\u064a\u062c\u0628 \u0623\u0646 \u062a\u062a\u0643\u0648\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0646 6 \u0623\u062d\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644.",
    signupSuccess:
      "\u062a\u062d\u0642\u0642 \u0645\u0646 \u0628\u0631\u064a\u062f\u0643 \u0644\u062a\u0623\u0643\u064a\u062f \u062d\u0633\u0627\u0628\u0643.",
    authSupabaseMissing:
      "\u0644\u0645 \u064a\u062a\u0645 \u0625\u0639\u062f\u0627\u062f Supabase. \u0635\u0650\u0644 Supabase \u0641\u064a Lovable Cloud \u0623\u0648 \u0623\u0636\u0641 \u0645\u062a\u063a\u064a\u0631\u0627\u062a \u0627\u0644\u0628\u064a\u0626\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629.",
    authInvalidCredentials:
      "\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063a\u064a\u0631 \u0635\u062d\u064a\u062d\u0629.",
    authEmailNotConfirmed:
      "\u0623\u0643\u062f \u0628\u0631\u064a\u062f\u0643 \u0642\u0628\u0644 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644.",
    authServiceUnreachable:
      "\u062e\u062f\u0645\u0629 \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629 \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629. \u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u062a\u0635\u0627\u0644\u0643 \u0648\u0625\u0639\u062f\u0627\u062f Supabase.",
    authFailed:
      "\u0641\u0634\u0644\u062a \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629. \u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.",
    // Sidebar / nav
    workspace: "مساحة العمل",
    quickActions: "إجراءات سريعة",
    sessions: "الجلسات",
    noSessions: "لا توجد جلسات بعد.",
    newSession: "جلسة جديدة",
    untitled: "بدون عنوان",
    workspaceOwner: "مالك مساحة العمل",
    signOut: "تسجيل الخروج",
    adminControl: "لوحة الإدارة",
    businessWorkflow: "سير العمل المؤسسي",
    soon: "قريبًا",
    settings: "الإعدادات",
    projects: "المشاريع",

    // Upload dialog
    uploadZip: "رفع ملف ZIP",
    uploadProjectArchive: "رفع أرشيف المشروع",
    uploadDescription:
      "أنشئ سجل مشروع رسمي مع بيان هيكلي وفهرس آمن لمعاينات النصوص انطلاقًا من أرشيف ZIP أو من مجلد محلي.",
    selectZipArchive: "اختر أرشيف ZIP",
    zipOnly:
      "ملفات ZIP فقط، بحد أقصى {max} ميغابايت. تقرأ منصة Nexus Core معاينات نصية محدودة ومصرّحًا بها فقط، ولا تنفّذ أي شيفرة من المشروع.",
    folderImportHint:
      "استيراد المجلد ينشئ فهرسًا آمنًا للبيانات الوصفية فقط. لا يتم رفع محتويات الملفات الخام ولا يتم إنشاء معاينات نصية من المجلدات. يبقى ZIP هو مسار الاستيعاب والمعاينة الخادمي.",
    zipPreviewPath: "رفع ZIP يفعّل معاينات ملفات آمنة لثقة مقترحات grounded.",
    folderInventoryOnly:
      "استيراد المجلد يوفر فهرسًا فقط. استخدم رفع ZIP عند الحاجة إلى معاينات آمنة ومقترحات grounded.",
    projectLimitReachedForUpload:
      "تم بلوغ حد المشاريع. أرشف مشروعًا موجودًا عندما تتوفر دورة حياة المشاريع، أو استخدم حساب QA لديه مساحة مشروع، أو قم بترقية الخطة قبل رفع ZIP آخر.",
    monthlyUploadLimitReached:
      "\u062a\u0645 \u0628\u0644\u0648\u063a \u062d\u062f \u0631\u0641\u0639\u0627\u062a ZIP \u0627\u0644\u0646\u0627\u062c\u062d\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631. \u0627\u0646\u062a\u0638\u0631 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0636\u0628\u0637 \u0627\u0644\u0634\u0647\u0631\u064a\u0629\u060c \u0623\u0648 \u0627\u0633\u062a\u062e\u062f\u0645 \u062d\u0633\u0627\u0628 QA \u0623\u0648 \u062e\u0637\u0629 \u0628\u0647\u0627 \u0631\u0641\u0639\u0627\u062a \u0645\u062a\u0627\u062d\u0629\u060c \u0623\u0648 \u0631\u0642\u0651 \u0627\u0644\u062e\u0637\u0629\u060c \u0623\u0648 \u062a\u0627\u0628\u0639 \u0628\u0645\u0634\u0631\u0648\u0639 ZIP \u0645\u0648\u062c\u0648\u062f \u0644\u062f\u064a\u0647 \u0645\u0639\u0627\u064a\u0646\u0627\u062a \u0622\u0645\u0646\u0629.",
    zipUploadProcessingFailed: "تعذرت معالجة رفع ZIP. لم يتم إنشاء معاينات آمنة.",
    zipProcessingStarted:
      "\u0628\u062f\u0623\u062a \u0645\u0639\u0627\u0644\u062c\u0629 \u0645\u0644\u0641 ZIP.",
    zipProcessedSuccessfully:
      "\u062a\u0645\u062a \u0645\u0639\u0627\u0644\u062c\u0629 \u0645\u0644\u0641 ZIP \u0628\u0646\u062c\u0627\u062d. \u062a\u0645\u062a \u0641\u0647\u0631\u0633\u0629 {indexed} \u0645\u0644\u0641\u0627\u062a \u0648\u062a\u062c\u0627\u0647\u0644 {skipped} \u0645\u0644\u0641\u0627\u062a.",
    zipRejectedUnsafePaths:
      "\u062a\u0645 \u0631\u0641\u0636 \u0645\u0644\u0641 ZIP \u0644\u0623\u0646\u0647 \u064a\u062d\u062a\u0648\u064a \u0639\u0644\u0649 \u0645\u0633\u0627\u0631\u0627\u062a \u063a\u064a\u0631 \u0622\u0645\u0646\u0629.",
    zipRejectedSizeLimits:
      "\u062a\u0645 \u0631\u0641\u0636 \u0645\u0644\u0641 ZIP \u0644\u0623\u0646\u0647 \u064a\u062a\u062c\u0627\u0648\u0632 \u062d\u062f\u0648\u062f \u0627\u0644\u0645\u0644\u0641\u0627\u062a \u0623\u0648 \u0627\u0644\u062d\u062c\u0645.",
    zipProcessingFailed:
      "\u0641\u0634\u0644\u062a \u0645\u0639\u0627\u0644\u062c\u0629 \u0645\u0644\u0641 ZIP.",
    indexedFiles:
      "\u0627\u0644\u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0645\u0641\u0647\u0631\u0633\u0629",
    skippedFiles:
      "\u0627\u0644\u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0645\u062a\u062c\u0627\u0647\u0644\u0629",
    unsupportedFilesSkippedSafely:
      "\u062a\u0645 \u062a\u062c\u0627\u0647\u0644 \u0627\u0644\u0645\u0644\u0641\u0627\u062a \u063a\u064a\u0631 \u0627\u0644\u0645\u062f\u0639\u0648\u0645\u0629 \u0628\u0623\u0645\u0627\u0646.",
    safeProjectPreviewReady:
      "\u0623\u0635\u0628\u062d\u062a \u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0645\u0634\u0631\u0648\u0639 \u0627\u0644\u0622\u0645\u0646\u0629 \u062c\u0627\u0647\u0632\u0629.",
    safePreview:
      "\u0627\u0644\u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0622\u0645\u0646\u0629",
    fileTree: "\u0634\u062c\u0631\u0629 \u0627\u0644\u0645\u0644\u0641\u0627\u062a",
    projectFiles: "\u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0645\u0634\u0631\u0648\u0639",
    previewReady: "\u0627\u0644\u0645\u0639\u0627\u064a\u0646\u0629 \u062c\u0627\u0647\u0632\u0629",
    noPreviewAvailable:
      "\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0639\u0627\u064a\u0646\u0629 \u0645\u062a\u0627\u062d\u0629",
    thisFileWasSkipped:
      "\u062a\u0645 \u062a\u062c\u0627\u0647\u0644 \u0647\u0630\u0627 \u0627\u0644\u0645\u0644\u0641",
    unsupportedFileType:
      "\u0646\u0648\u0639 \u0627\u0644\u0645\u0644\u0641 \u063a\u064a\u0631 \u0645\u062f\u0639\u0648\u0645",
    binaryFilePreviewDisabled:
      "\u062a\u0645 \u062a\u0639\u0637\u064a\u0644 \u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0645\u0644\u0641\u0627\u062a \u0627\u0644\u062b\u0646\u0627\u0626\u064a\u0629",
    unsafeFileRejected:
      "\u062a\u0645 \u0631\u0641\u0636 \u0627\u0644\u0645\u0644\u0641 \u063a\u064a\u0631 \u0627\u0644\u0622\u0645\u0646",
    selectFileToPreview:
      "\u0627\u062e\u062a\u0631 \u0645\u0644\u0641\u064b\u0627 \u0644\u0644\u0645\u0639\u0627\u064a\u0646\u0629",
    previewTruncatedForSafety:
      "\u062a\u0645 \u0627\u062e\u062a\u0635\u0627\u0631 \u0627\u0644\u0645\u0639\u0627\u064a\u0646\u0629 \u0644\u0644\u0623\u0645\u0627\u0646",
    projectNotProcessedYet:
      "\u0644\u0645 \u062a\u062a\u0645 \u0645\u0639\u0627\u0644\u062c\u0629 \u0627\u0644\u0645\u0634\u0631\u0648\u0639 \u0628\u0639\u062f",
    groundedPatchPreview:
      "\u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0645\u0648\u062b\u0642\u0629",
    createPatchPreview:
      "\u0625\u0646\u0634\u0627\u0621 \u0645\u0639\u0627\u064a\u0646\u0629 \u062a\u0639\u062f\u064a\u0644",
    patchPreviewOnly: "\u0647\u0630\u0647 \u0645\u0639\u0627\u064a\u0646\u0629 \u0641\u0642\u0637",
    thisPatchNotApplied:
      "\u0644\u0645 \u064a\u062a\u0645 \u062a\u0637\u0628\u064a\u0642 \u0647\u0630\u0627 \u0627\u0644\u062a\u0639\u062f\u064a\u0644",
    selectPreviewableFile:
      "\u0627\u062e\u062a\u0631 \u0645\u0644\u0641\u064b\u0627 \u0642\u0627\u0628\u0644\u064b\u0627 \u0644\u0644\u0645\u0639\u0627\u064a\u0646\u0629",
    searchText:
      "\u0627\u0644\u0646\u0635 \u0627\u0644\u0645\u0631\u0627\u062f \u0627\u0644\u0628\u062d\u062b \u0639\u0646\u0647",
    replacementText: "\u0627\u0644\u0646\u0635 \u0627\u0644\u0628\u062f\u064a\u0644",
    generatePreview:
      "\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0645\u0639\u0627\u064a\u0646\u0629",
    unifiedDiff: "\u0641\u0631\u0642 \u0645\u0648\u062d\u062f",
    groundedFiles:
      "\u0627\u0644\u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0645\u0648\u062b\u0642\u0629",
    patchPreviewCreated:
      "\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u062a\u0639\u062f\u064a\u0644",
    patchPreviewFailed:
      "\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u062a\u0639\u062f\u064a\u0644",
    oldTextNotFound:
      "\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0646\u0635 \u0627\u0644\u0642\u062f\u064a\u0645 \u0636\u0645\u0646 \u0627\u0644\u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0645\u062a\u0627\u062d\u0629",
    fileCannotBePatched:
      "\u0644\u0627 \u064a\u0645\u0643\u0646 \u062a\u0639\u062f\u064a\u0644 \u0647\u0630\u0627 \u0627\u0644\u0645\u0644\u0641",
    binaryFilesCannotBePatched:
      "\u0644\u0627 \u064a\u0645\u0643\u0646 \u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0645\u0644\u0641\u0627\u062a \u0627\u0644\u062b\u0646\u0627\u0626\u064a\u0629",
    skippedFilesCannotBePatched:
      "\u0644\u0627 \u064a\u0645\u0643\u0646 \u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0645\u062a\u062c\u0627\u0647\u0644\u0629",
    sensitiveFilesCannotBePatched:
      "\u0644\u0627 \u064a\u0645\u0643\u0646 \u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0645\u0644\u0641\u0627\u062a \u0627\u0644\u062d\u0633\u0627\u0633\u0629",
    applyUnavailableYet:
      "\u0627\u0644\u062a\u0637\u0628\u064a\u0642 \u063a\u064a\u0631 \u0645\u062a\u0627\u062d \u0628\u0639\u062f",
    previewLimitedToIndexedText:
      "\u0627\u0644\u0645\u0639\u0627\u064a\u0646\u0629 \u0645\u062d\u062f\u0648\u062f\u0629 \u0628\u0627\u0644\u0646\u0635 \u0627\u0644\u0645\u0641\u0647\u0631\u0633",
    patchSandbox:
      "\u0628\u064a\u0626\u0629 \u0627\u062e\u062a\u0628\u0627\u0631 \u0627\u0644\u062a\u0639\u062f\u064a\u0644",
    verifyInSandbox:
      "\u0627\u0644\u062a\u062d\u0642\u0642 \u0641\u064a \u0628\u064a\u0626\u0629 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631",
    sandboxVerified:
      "\u062a\u0645 \u0627\u0644\u062a\u062d\u0642\u0642 \u0641\u064a \u0628\u064a\u0626\u0629 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631",
    sandboxBlocked:
      "\u062a\u0645 \u062d\u0638\u0631 \u0628\u064a\u0626\u0629 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631",
    sandboxFailed:
      "\u0641\u0634\u0644\u062a \u0628\u064a\u0626\u0629 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631",
    sandboxPartial:
      "\u062a\u062d\u0642\u0642 \u062c\u0632\u0626\u064a \u0641\u064a \u0628\u064a\u0626\u0629 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631",
    noProjectFilesModified:
      "\u0644\u0645 \u064a\u062a\u0645 \u062a\u0639\u062f\u064a\u0644 \u0623\u064a \u0645\u0644\u0641\u0627\u062a \u0641\u064a \u0627\u0644\u0645\u0634\u0631\u0648\u0639",
    sandboxLimitedToIndexedText:
      "\u0628\u064a\u0626\u0629 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u0645\u062d\u062f\u0648\u062f\u0629 \u0628\u0627\u0644\u0646\u0635 \u0627\u0644\u0645\u0641\u0647\u0631\u0633",
    before: "\u0642\u0628\u0644",
    after: "\u0628\u0639\u062f",
    wouldChange: "\u0633\u064a\u062a\u0645 \u062a\u063a\u064a\u064a\u0631\u0647",
    blockers: "\u0627\u0644\u0639\u0648\u0627\u0626\u0642",
    conflicts: "\u0627\u0644\u062a\u0639\u0627\u0631\u0636\u0627\u062a",
    stalePreviewDetected:
      "\u062a\u0645 \u0627\u0643\u062a\u0634\u0627\u0641 \u0645\u0639\u0627\u064a\u0646\u0629 \u0642\u062f\u064a\u0645\u0629",
    targetFileNoLongerPreviewable:
      "\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0647\u062f\u0641 \u0644\u0645 \u064a\u0639\u062f \u0642\u0627\u0628\u0644\u064b\u0627 \u0644\u0644\u0645\u0639\u0627\u064a\u0646\u0629",
    oldTextAppearsMultipleTimes:
      "\u0627\u0644\u0646\u0635 \u0627\u0644\u0642\u062f\u064a\u0645 \u064a\u0638\u0647\u0631 \u0623\u0643\u062b\u0631 \u0645\u0646 \u0645\u0631\u0629",
    currentFileHashDiffers:
      "\u0628\u0635\u0645\u0629 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u062d\u0627\u0644\u064a\u0629 \u062a\u062e\u062a\u0644\u0641 \u0639\u0646 \u062a\u0648\u062b\u064a\u0642 \u0627\u0644\u062a\u0639\u062f\u064a\u0644",
    patchPreviewCannotBeAppliedSafelyYet:
      "\u0644\u0627 \u064a\u0645\u0643\u0646 \u062a\u0637\u0628\u064a\u0642 \u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u062a\u0639\u062f\u064a\u0644 \u0628\u0623\u0645\u0627\u0646 \u0628\u0639\u062f",
    applyRemainsDisabled:
      "\u0644\u0627 \u064a\u0632\u0627\u0644 \u0627\u0644\u062a\u0637\u0628\u064a\u0642 \u0645\u0639\u0637\u0644\u064b\u0627",
    versionedPatchSnapshot:
      "\u0644\u0642\u0637\u0629 \u062a\u0639\u062f\u064a\u0644 \u0628\u0625\u0635\u062f\u0627\u0631 \u0645\u0633\u062a\u0642\u0644",
    createVersionedSnapshot:
      "\u0625\u0646\u0634\u0627\u0621 \u0644\u0642\u0637\u0629 \u0628\u0625\u0635\u062f\u0627\u0631 \u0645\u0633\u062a\u0642\u0644",
    snapshotCreated:
      "\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0644\u0642\u0637\u0629",
    snapshotCreationFailed:
      "\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0644\u0642\u0637\u0629",
    snapshotAlreadyExists:
      "\u0627\u0644\u0644\u0642\u0637\u0629 \u0645\u0648\u062c\u0648\u062f\u0629 \u0645\u0633\u0628\u0642\u064b\u0627",
    derivedSnapshotOnly:
      "\u0647\u0630\u0647 \u0644\u0642\u0637\u0629 \u0645\u0634\u062a\u0642\u0629 \u0641\u0642\u0637",
    originalProjectFilesWereNotModified:
      "\u0644\u0645 \u064a\u062a\u0645 \u062a\u0639\u062f\u064a\u0644 \u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0645\u0634\u0631\u0648\u0639 \u0627\u0644\u0623\u0635\u0644\u064a\u0629",
    patchedPreview:
      "\u0627\u0644\u0645\u0639\u0627\u064a\u0646\u0629 \u0628\u0639\u062f \u0627\u0644\u062a\u0639\u062f\u064a\u0644",
    originalPreview:
      "\u0627\u0644\u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0623\u0635\u0644\u064a\u0629",
    snapshotFiles: "\u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0644\u0642\u0637\u0629",
    changedFiles:
      "\u0627\u0644\u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0645\u062a\u063a\u064a\u0631\u0629",
    noChangedFiles:
      "\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0644\u0641\u0627\u062a \u0645\u062a\u063a\u064a\u0631\u0629",
    cannotCreateSnapshotFromBlockedSandbox:
      "\u0644\u0627 \u064a\u0645\u0643\u0646 \u0625\u0646\u0634\u0627\u0621 \u0644\u0642\u0637\u0629 \u0645\u0646 \u0628\u064a\u0626\u0629 \u0627\u062e\u062a\u0628\u0627\u0631 \u0645\u062d\u0638\u0648\u0631\u0629",
    snapshotLimitedToIndexedText:
      "\u0627\u0644\u0644\u0642\u0637\u0629 \u0645\u062d\u062f\u0648\u062f\u0629 \u0628\u0627\u0644\u0646\u0635 \u0627\u0644\u0645\u0641\u0647\u0631\u0633",
    sourceWritebackUnavailableYet:
      "\u0627\u0644\u0643\u062a\u0627\u0628\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u0635\u062f\u0631 \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629 \u0628\u0639\u062f",
    versionedWorkingCopy:
      "\u0646\u0633\u062e\u0629 \u0639\u0645\u0644 \u0628\u0625\u0635\u062f\u0627\u0631 \u0645\u0633\u062a\u0642\u0644",
    createVersionedWorkingCopy:
      "\u0625\u0646\u0634\u0627\u0621 \u0646\u0633\u062e\u0629 \u0639\u0645\u0644 \u0628\u0625\u0635\u062f\u0627\u0631 \u0645\u0633\u062a\u0642\u0644",
    workingCopyCreated:
      "\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0646\u0633\u062e\u0629 \u0627\u0644\u0639\u0645\u0644",
    workingCopyAlreadyExists:
      "\u0646\u0633\u062e\u0629 \u0627\u0644\u0639\u0645\u0644 \u0645\u0648\u062c\u0648\u062f\u0629 \u0645\u0633\u0628\u0642\u064b\u0627",
    workingCopyCreationFailed:
      "\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0646\u0633\u062e\u0629 \u0627\u0644\u0639\u0645\u0644",
    versionedWorkingCopyCreatedNotice:
      "\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0646\u0633\u062e\u0629 \u0639\u0645\u0644 \u0628\u0625\u0635\u062f\u0627\u0631 \u0645\u0633\u062a\u0642\u0644. \u0644\u0645 \u064a\u062a\u0645 \u062a\u0639\u062f\u064a\u0644 \u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0645\u0634\u0631\u0648\u0639 \u0627\u0644\u0623\u0635\u0644\u064a\u0629.",
    sourceZipAndObjectStorageNotOverwritten:
      "\u0644\u0645 \u064a\u062a\u0645 \u0627\u0633\u062a\u0628\u062f\u0627\u0644 \u0645\u0644\u0641 ZIP \u0627\u0644\u0623\u0635\u0644\u064a \u0623\u0648 \u062a\u062e\u0632\u064a\u0646 \u0627\u0644\u0645\u0644\u0641\u0627\u062a.",
    sourceZipWasNotOverwritten:
      "\u0644\u0645 \u064a\u062a\u0645 \u0627\u0633\u062a\u0628\u062f\u0627\u0644 \u0645\u0644\u0641 ZIP \u0627\u0644\u0623\u0635\u0644\u064a",
    objectStorageWasNotModified:
      "\u0644\u0645 \u064a\u062a\u0645 \u062a\u0639\u062f\u064a\u0644 \u062a\u062e\u0632\u064a\u0646 \u0627\u0644\u0645\u0644\u0641\u0627\u062a",
    workingCopyFiles:
      "\u0645\u0644\u0641\u0627\u062a \u0646\u0633\u062e\u0629 \u0627\u0644\u0639\u0645\u0644",
    executedFromApprovedRequest:
      "\u062a\u0645 \u0627\u0644\u062a\u0646\u0641\u064a\u0630 \u0645\u0646 \u0637\u0644\u0628 \u0645\u0648\u0627\u0641\u0642 \u0639\u0644\u064a\u0647",
    requestMustBeApprovedBeforeExecution:
      "\u064a\u062c\u0628 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0627\u0644\u0637\u0644\u0628 \u0642\u0628\u0644 \u0627\u0644\u062a\u0646\u0641\u064a\u0630",
    executionBlocked: "\u062a\u0645 \u062d\u0638\u0631 \u0627\u0644\u062a\u0646\u0641\u064a\u0630",
    executionDoesNotDeployChanges:
      "\u0627\u0644\u062a\u0646\u0641\u064a\u0630 \u0644\u0627 \u064a\u0646\u0634\u0631 \u0627\u0644\u062a\u063a\u064a\u064a\u0631\u0627\u062a",
    productionSourceWritebackUnavailableYet:
      "\u0627\u0644\u0643\u062a\u0627\u0628\u0629 \u0627\u0644\u0641\u0639\u0644\u064a\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u0635\u062f\u0631 \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629 \u0628\u0639\u062f",
    downloadWorkingCopyExport:
      "\u062a\u0646\u0632\u064a\u0644 \u062a\u0635\u062f\u064a\u0631 \u0646\u0633\u062e\u0629 \u0627\u0644\u0639\u0645\u0644",
    exportWorkingCopy:
      "\u062a\u0635\u062f\u064a\u0631 \u0646\u0633\u062e\u0629 \u0627\u0644\u0639\u0645\u0644",
    workingCopyExportCreated:
      "\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u062a\u0635\u062f\u064a\u0631 \u0646\u0633\u062e\u0629 \u0627\u0644\u0639\u0645\u0644",
    workingCopyExportFailed:
      "\u0641\u0634\u0644 \u062a\u0635\u062f\u064a\u0631 \u0646\u0633\u062e\u0629 \u0627\u0644\u0639\u0645\u0644",
    versionedWorkingCopyBundle:
      "\u062d\u0632\u0645\u0629 \u0646\u0633\u062e\u0629 \u0639\u0645\u0644 \u0628\u0625\u0635\u062f\u0627\u0631 \u0645\u0633\u062a\u0642\u0644",
    exportLimitedToWorkingCopyText:
      "\u0627\u0644\u062a\u0635\u062f\u064a\u0631 \u0645\u062d\u062f\u0648\u062f \u0628\u0646\u0635 \u0646\u0633\u062e\u0629 \u0627\u0644\u0639\u0645\u0644",
    workingCopyExportBlocked:
      "\u062a\u0645 \u062d\u0638\u0631 \u062a\u0635\u062f\u064a\u0631 \u0646\u0633\u062e\u0629 \u0627\u0644\u0639\u0645\u0644",
    workingCopyExportFileLimitExceeded:
      "\u062a\u0645 \u062a\u062c\u0627\u0648\u0632 \u062d\u062f \u0645\u0644\u0641\u0627\u062a \u062a\u0635\u062f\u064a\u0631 \u0646\u0633\u062e\u0629 \u0627\u0644\u0639\u0645\u0644",
    workingCopyExportSizeLimitExceeded:
      "\u062a\u0645 \u062a\u062c\u0627\u0648\u0632 \u062d\u062f \u062d\u062c\u0645 \u062a\u0635\u062f\u064a\u0631 \u0646\u0633\u062e\u0629 \u0627\u0644\u0639\u0645\u0644",
    downloadSnapshotExport:
      "\u062a\u0646\u0632\u064a\u0644 \u062a\u0635\u062f\u064a\u0631 \u0627\u0644\u0644\u0642\u0637\u0629",
    exportSnapshot: "\u062a\u0635\u062f\u064a\u0631 \u0627\u0644\u0644\u0642\u0637\u0629",
    exportCreated:
      "\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062a\u0635\u062f\u064a\u0631",
    exportFailed: "\u0641\u0634\u0644 \u0627\u0644\u062a\u0635\u062f\u064a\u0631",
    exportLimitedToIndexedText:
      "\u0627\u0644\u062a\u0635\u062f\u064a\u0631 \u0645\u062d\u062f\u0648\u062f \u0628\u0627\u0644\u0646\u0635 \u0627\u0644\u0645\u0641\u0647\u0631\u0633",
    derivedPreviewBundle:
      "\u062d\u0632\u0645\u0629 \u0645\u0639\u0627\u064a\u0646\u0629 \u0645\u0634\u062a\u0642\u0629",
    snapshotExportIncludesPatchedPreviewFilesOnly:
      "\u064a\u062a\u0636\u0645\u0646 \u062a\u0635\u062f\u064a\u0631 \u0627\u0644\u0644\u0642\u0637\u0629 \u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0645\u0639\u062f\u0644\u0629 \u0641\u0642\u0637",
    exportBlocked: "\u062a\u0645 \u062d\u0638\u0631 \u0627\u0644\u062a\u0635\u062f\u064a\u0631",
    exportFileLimitExceeded:
      "\u062a\u0645 \u062a\u062c\u0627\u0648\u0632 \u062d\u062f \u0645\u0644\u0641\u0627\u062a \u0627\u0644\u062a\u0635\u062f\u064a\u0631",
    exportSizeLimitExceeded:
      "\u062a\u0645 \u062a\u062c\u0627\u0648\u0632 \u062d\u062f \u062d\u062c\u0645 \u0627\u0644\u062a\u0635\u062f\u064a\u0631",
    snapshotExportReadme:
      "\u0645\u0644\u0641 \u0634\u0631\u062d \u062a\u0635\u062f\u064a\u0631 \u0627\u0644\u0644\u0642\u0637\u0629",
    sourceWritebackNotIncluded:
      "\u0627\u0644\u0643\u062a\u0627\u0628\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u0635\u062f\u0631 \u063a\u064a\u0631 \u0645\u0636\u0645\u0646\u0629",
    sourceWritebackReview:
      "\u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u0643\u062a\u0627\u0628\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u0635\u062f\u0631",
    requestSourceWritebackReview:
      "\u0637\u0644\u0628 \u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u0643\u062a\u0627\u0628\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u0635\u062f\u0631",
    writebackRequestCreated:
      "\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0637\u0644\u0628 \u0627\u0644\u0643\u062a\u0627\u0628\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u0635\u062f\u0631",
    writebackRequestSubmitted:
      "\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0627\u0644\u0643\u062a\u0627\u0628\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u0635\u062f\u0631",
    writebackRequestCancelled:
      "\u062a\u0645 \u0625\u0644\u063a\u0627\u0621 \u0637\u0644\u0628 \u0627\u0644\u0643\u062a\u0627\u0628\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u0635\u062f\u0631",
    writebackRequestBlocked:
      "\u062a\u0645 \u062d\u0638\u0631 \u0637\u0644\u0628 \u0627\u0644\u0643\u062a\u0627\u0628\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u0635\u062f\u0631",
    thisOnlyCreatesReviewRequest:
      "\u0647\u0630\u0627 \u064a\u0646\u0634\u0626 \u0637\u0644\u0628 \u0645\u0631\u0627\u062c\u0639\u0629 \u0641\u0642\u0637",
    requestStatus: "\u062d\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628",
    reviewerNote: "\u0645\u0644\u0627\u062d\u0638\u0629 \u0627\u0644\u0645\u0631\u0627\u062c\u0639",
    requesterNote:
      "\u0645\u0644\u0627\u062d\u0638\u0629 \u0645\u0642\u062f\u0645 \u0627\u0644\u0637\u0644\u0628",
    submitRequest: "\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0637\u0644\u0628",
    cancelRequest: "\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u0637\u0644\u0628",
    riskLevel: "\u0645\u0633\u062a\u0648\u0649 \u0627\u0644\u0645\u062e\u0627\u0637\u0631",
    lowRisk: "\u0645\u062e\u0627\u0637\u0631 \u0645\u0646\u062e\u0641\u0636\u0629",
    mediumRisk: "\u0645\u062e\u0627\u0637\u0631 \u0645\u062a\u0648\u0633\u0637\u0629",
    highRisk: "\u0645\u062e\u0627\u0637\u0631 \u0639\u0627\u0644\u064a\u0629",
    blockedRisk: "\u0645\u062e\u0627\u0637\u0631 \u0645\u062d\u0638\u0648\u0631\u0629",
    governanceReviewRequired:
      "\u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u062d\u0648\u0643\u0645\u0629 \u0645\u0637\u0644\u0648\u0628\u0629",
    approvalDoesNotApplyChangesYet:
      "\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0644\u0627 \u062a\u0637\u0628\u0642 \u0627\u0644\u062a\u063a\u064a\u064a\u0631\u0627\u062a \u0628\u0639\u062f",
    writebackReviewWorkflow:
      "\u0633\u064a\u0631 \u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u0643\u062a\u0627\u0628\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u0635\u062f\u0631",
    submittedWritebackRequests:
      "\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0643\u062a\u0627\u0628\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u0635\u062f\u0631 \u0627\u0644\u0645\u0631\u0633\u0644\u0629",
    reviewRequest: "\u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u0637\u0644\u0628",
    approveRequest:
      "\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0627\u0644\u0637\u0644\u0628",
    rejectRequest: "\u0631\u0641\u0636 \u0627\u0644\u0637\u0644\u0628",
    requestApproved:
      "\u062a\u0645\u062a \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0627\u0644\u0637\u0644\u0628",
    requestRejected: "\u062a\u0645 \u0631\u0641\u0636 \u0627\u0644\u0637\u0644\u0628",
    requestCannotBeApproved:
      "\u0644\u0627 \u064a\u0645\u0643\u0646 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0627\u0644\u0637\u0644\u0628",
    requestHasBlockers:
      "\u064a\u062d\u062a\u0648\u064a \u0627\u0644\u0637\u0644\u0628 \u0639\u0644\u0649 \u0639\u0648\u0627\u0626\u0642",
    reviewer: "\u0627\u0644\u0645\u0631\u0627\u062c\u0639",
    reviewedAt: "\u062a\u0645\u062a \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629 \u0641\u064a",
    reviewDecision: "\u0642\u0631\u0627\u0631 \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629",
    approvalDoesNotApplyChanges:
      "\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0644\u0627 \u062a\u0637\u0628\u0642 \u0627\u0644\u062a\u063a\u064a\u064a\u0631\u0627\u062a",
    approvedForFutureWritebackConsideration:
      "\u062a\u0645\u062a \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0644\u0644\u0646\u0638\u0631 \u0641\u064a \u0627\u0644\u0643\u062a\u0627\u0628\u0629 \u0644\u0627\u062d\u0642\u064b\u0627",
    rejectedByReviewer:
      "\u062a\u0645 \u0627\u0644\u0631\u0641\u0636 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0645\u0631\u0627\u062c\u0639",
    waitingForReview:
      "\u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629",
    noSubmittedRequests:
      "\u0644\u0627 \u062a\u0648\u062c\u062f \u0637\u0644\u0628\u0627\u062a \u0645\u0631\u0633\u0644\u0629",
    reviewerNoteRequiredForRejection:
      "\u0645\u0644\u0627\u062d\u0638\u0629 \u0627\u0644\u0645\u0631\u0627\u062c\u0639 \u0645\u0637\u0644\u0648\u0628\u0629 \u0639\u0646\u062f \u0627\u0644\u0631\u0641\u0636",
    aiPatchPreview:
      "\u0645\u0639\u0627\u064a\u0646\u0629 \u062a\u0639\u062f\u064a\u0644 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a",
    describeChangeYouWant:
      "\u0635\u0641 \u0627\u0644\u062a\u063a\u064a\u064a\u0631 \u0627\u0644\u0630\u064a \u062a\u0631\u064a\u062f\u0647",
    generateAiPatchPreview:
      "\u0625\u0646\u0634\u0627\u0621 \u0645\u0639\u0627\u064a\u0646\u0629 \u062a\u0639\u062f\u064a\u0644 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a",
    generatingPatchPreview:
      "\u062c\u0627\u0631\u064d \u0625\u0646\u0634\u0627\u0621 \u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u062a\u0639\u062f\u064a\u0644",
    aiPatchPreviewCreated:
      "\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u062a\u0639\u062f\u064a\u0644 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a",
    aiPatchPreviewFailed:
      "\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u062a\u0639\u062f\u064a\u0644 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a",
    aiOutputCouldNotBeValidated:
      "\u062a\u0639\u0630\u0631 \u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0645\u062e\u0631\u062c\u0627\u062a \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a",
    selectAtLeastOnePreviewableFile:
      "\u0627\u062e\u062a\u0631 \u0645\u0644\u0641\u064b\u0627 \u0648\u0627\u062d\u062f\u064b\u0627 \u0642\u0627\u0628\u0644\u064b\u0627 \u0644\u0644\u0645\u0639\u0627\u064a\u0646\u0629 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644",
    tooManyFilesSelected:
      "\u062a\u0645 \u0627\u062e\u062a\u064a\u0627\u0631 \u0645\u0644\u0641\u0627\u062a \u0643\u062b\u064a\u0631\u0629 \u062c\u062f\u064b\u0627",
    instructionTooLong:
      "\u0627\u0644\u062a\u0639\u0644\u064a\u0645\u0627\u062a \u0637\u0648\u064a\u0644\u0629 \u062c\u062f\u064b\u0627",
    generatedChanges:
      "\u0627\u0644\u062a\u063a\u064a\u064a\u0631\u0627\u062a \u0627\u0644\u0646\u0627\u062a\u062c\u0629",
    aiProposedChanges:
      "\u0627\u0644\u062a\u063a\u064a\u064a\u0631\u0627\u062a \u0627\u0644\u0645\u0642\u062a\u0631\u062d\u0629 \u0645\u0646 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a",
    thisAiPatchNotApplied:
      "\u0644\u0645 \u064a\u062a\u0645 \u062a\u0637\u0628\u064a\u0642 \u0647\u0630\u0627 \u0627\u0644\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0645\u0642\u062a\u0631\u062d",
    onlySelectedFilesUsed:
      "\u062a\u0645 \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0627\u0644\u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0645\u062d\u062f\u062f\u0629 \u0641\u0642\u0637",
    aiTriedUnavailableFile:
      "\u062d\u0627\u0648\u0644 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u062a\u0639\u062f\u064a\u0644 \u0645\u0644\u0641 \u063a\u064a\u0631 \u0645\u062a\u0627\u062d",
    aiOldTextNotFound:
      "\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0646\u0635 \u0627\u0644\u0642\u062f\u064a\u0645 \u0627\u0644\u0645\u0642\u062a\u0631\u062d",
    previewGenerationLimitedToIndexedText:
      "\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0645\u0639\u0627\u064a\u0646\u0629 \u0645\u062d\u062f\u0648\u062f \u0628\u0627\u0644\u0646\u0635 \u0627\u0644\u0645\u0641\u0647\u0631\u0633",
    archiveProject: "أرشفة المشروع",
    archiveProjectConfirm: "هل تريد أرشفة هذا المشروع؟",
    archiveProjectWarning:
      "لن يتم حذف الملفات أو الجلسات. سيؤدي ذلك إلى تحرير مساحة مشروع لإنشاء مشاريع جديدة.",
    projectArchived: "تمت أرشفة المشروع",
    projectArchivedCanCreate: "تمت أرشفة المشروع. يمكنك الآن إنشاء مشروع جديد.",
    archiveProjectFailed: "فشلت أرشفة المشروع.",
    archivedProject: "مشروع مؤرشف",
    noActiveProjectAvailable: "لا يوجد مشروع نشط متاح",
    archiveOldProjectToCreateNew: "أرشف مشروعًا قديمًا لإنشاء مشروع جديد.",
    thisProjectIsArchived: "هذا المشروع مؤرشف.",
    selectFolderFirst: "يرجى اختيار مجلد المشروع أولًا.",
    folderImportSuccess: "تم استيراد بيان المجلد. فهرس الملفات الآمن جاهز.",
    selectZipFirst: "يرجى اختيار أرشيف ZIP أولًا.",
    uploadSuccess: "تم رفع أرشيف المشروع. أساس الاستيعاب جاهز.",
    uploadStaged: "تم تجهيز المشروع. حاوية التخزين لم تُهيّأ بعد.",
    projectName: "اسم المشروع",
    projectNamePlaceholder: "تطبيق Nexus على الويب",
    description: "الوصف",
    descriptionPlaceholder: "سياق اختياري للمشروع يستخدمه المشغّلون.",
    cancel: "إلغاء",
    createProject: "إنشاء المشروع",
    size: "الحجم",

    // Governance / usage meters
    quotaGovernance: "حوكمة الاستخدام",
    plan: "الخطة",
    uploads: "عمليات الرفع",
    aiRequests: "طلبات الذكاء الاصطناعي",
    previews: "المعاينات",
    threads: "الجلسات",
    context: "السياق",
    unlimited: "غير محدود",
    used: "المستخدم",
    limit: "الحد",
    usageFormat: "المستخدم {used} من أصل {limit}",
    nearLimit: "تقترب من الحد المسموح",
    limitReached: "تم بلوغ الحد المسموح",
    upgradePrompt: "قم بالترقية إلى خطة Pro للحصول على حدود حوكمة أعلى.",

    // Workspace home
    welcomeTitle: "أهلًا بك في مساحة عمليات الذكاء الاصطناعي.",
    welcomeSubtitle:
      "ارفع مشروعك، وراجع البيان الآمن، واختر سياق المعاينة، ثم افتح جلسة للتخطيط المنظّم بالذكاء الاصطناعي. يبقى التنفيذ معطّلًا حتى مرحلة البيئة المعزولة.",
    tellNexusToChange: "اكتب هنا ماذا تريد من Nexus أن يفعل في مشروعك.",
    nexusHelperText:
      "يمكن لـ Nexus التخطيط وتحضير التغييرات في المشروع. التنفيذ المباشر غير مفعّل بعد.",
    examplePrompt1: "إصلاح مشكلة إعادة التوجيه عند تسجيل الدخول",
    examplePrompt2: "مراجعة هذا المشروع والبحث عن المخاطر",
    examplePrompt3: "إضافة قسم للأسعار",
    examplePrompt4: "إنشاء خطة تنفيذ لميزة ذاكرة المشروع",
    uploadOrImport: "رفع أو استيراد مشروع",
    createAiSession: "إنشاء جلسة ذكاء اصطناعي",
    creatingSession: "جارٍ إنشاء الجلسة...",
    sessionQuotaReached: "تم بلوغ حد الجلسات النشطة. افتح جلسة موجودة أو قم بترقية خطتك.",
    sessionCreateFailed: "تعذر إنشاء الجلسة. حاول مرة أخرى أو افتح جلسة موجودة.",
    sessionMessageSaveFailed:
      "تم إنشاء الجلسة، لكن تعذر حفظ رسالتك الأولى. حاول مرة أخرى قبل فتحها.",
    sessionAuthRequired: "سجّل الدخول مرة أخرى قبل إنشاء جلسة.",
    openExistingSession: "فتح جلسة موجودة",
    openRecentSession: "فتح جلسة حديثة",
    archiveSession: "\u0623\u0631\u0634\u0641 \u0627\u0644\u062c\u0644\u0633\u0629",
    archiveSessionConfirm:
      "\u0647\u0644 \u062a\u0631\u064a\u062f \u0623\u0631\u0634\u0641\u0629 \u0647\u0630\u0647 \u0627\u0644\u062c\u0644\u0633\u0629\u061f",
    sessionArchived:
      "\u062a\u0645\u062a \u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u062c\u0644\u0633\u0629. \u064a\u0645\u0643\u0646\u0643 \u0628\u062f\u0621 \u0645\u0647\u0645\u0629 \u062c\u062f\u064a\u062f\u0629 \u0627\u0644\u0622\u0646.",
    archiveSessionFailed:
      "\u062a\u0639\u0630\u0631\u062a \u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u062c\u0644\u0633\u0629.",
    archivedSession: "\u062c\u0644\u0633\u0629 \u0645\u0624\u0631\u0634\u0641\u0629",
    thisSessionIsArchived:
      "\u0647\u0630\u0647 \u0627\u0644\u062c\u0644\u0633\u0629 \u0645\u0624\u0631\u0634\u0641\u0629.",
    archiveExistingSessionToStartNewTask:
      "\u0623\u0631\u0634\u0641 \u062c\u0644\u0633\u0629 \u0645\u0648\u062c\u0648\u062f\u0629 \u0644\u0628\u062f\u0621 \u0645\u0647\u0645\u0629 \u062c\u062f\u064a\u062f\u0629.",
    startNewTaskAfterArchiving:
      "\u0627\u0628\u062f\u0623 \u0645\u0647\u0645\u0629 \u062c\u062f\u064a\u062f\u0629 \u0628\u0639\u062f \u0623\u0631\u0634\u0641\u0629 \u062c\u0644\u0633\u0629 \u0642\u062f\u064a\u0645\u0629.",
    ingestionReady: "أساس استيعاب المشاريع جاهز.",
    ingestionReadyBody:
      "ارفع ملف ZIP أو اختر مجلدًا محليًا لإنشاء سجلات المشاريع ومهام الاستيعاب وفهرس الملفات الآمن وسياق البيان. لا تنفّذ Nexus أي شيفرة مستوردة.",
    activeProject: "المشروع النشط",
    projectContextAttached: "سياق المشروع مرفق",
    projectContextNotAttached: "سياق المشروع غير مرفق",
    noProjectContextAvailable: "لا يوجد سياق مشروع متاح",
    attachThisProject: "إرفاق هذا المشروع",
    attachedProject: "المشروع المرفق",
    assistantCanUseIndexedProjectContext: "يمكن للمساعد استخدام سياق المشروع المفهرس.",
    attachProjectToImproveProposals: "أرفق هذا المشروع لتحسين المقترحات.",
    responsesMayBeGeneralWithoutProjectContext: "قد تكون الردود عامة بدون سياق المشروع.",
    structuredPlanning: "تخطيط منظّم",
    structuredPlanningBody: "الفهم / الخطة / المخاطر / الملفات",
    safeContext: "سياق مشروع آمن",
    safeContextBody: "البيان / المعاينة / فهرس الملفات",
    governedAccess: "وصول محوكَم",
    governedAccessBody: "فحوصات الحصص / سجلات التدقيق / RLS",
    canDoNow: "ما يمكن لـ Nexus فعله الآن",
    canDoItem1: "استيعاب أرشيفات ZIP وبيانات المجلدات",
    canDoItem2: "توليد فهرس ملفات آمن وسياق معاينة",
    canDoItem3: "ربط المشاريع بجلسات ذكاء اصطناعي متعددة",
    canDoItem4: "قياس الاستخدام وتدقيق الإجراءات الحساسة",
    notSupportedYet: "غير مدعوم حاليًا",
    notSupportedItem1: "لا توجد طرفية أو بيئة معزولة أو تثبيت تبعيات",
    notSupportedItem2: "لا توجد تعديلات تلقائية على الشيفرة أو طلبات دمج",
    notSupportedItem3: "لا يوجد دعم لـ GitHub OAuth أو التضمينات أو الدفع بعد",

    // Project list / status
    loadingProjects: "جارٍ تحميل المشاريع",
    noProjectsYet: "لا توجد مشاريع بعد",
    noProjectsBody: "ارفع ملف ZIP لإنشاء أول سجل مشروع رسمي ومهمة استيعاب.",

    // Folder import
    folderImport: "استيراد مجلد",
    selectFolder: "اختيار مجلد",
    dragFolder: "أسقط مجلد مشروع أو أرشيف ZIP هنا",
    folderImportReady: "معاينة استيراد المجلد جاهزة.",
    ignoredFiles: "الملفات المستبعدة",
    acceptedFiles: "الملفات المقبولة",
    safeIngestion: "استيعاب آمن",

    // Filter / context
    filterPreviews: "تصفية المعاينات",
    noPreviewMatch: "لا توجد معاينات تطابق هذا المرشّح.",
    selected: "محدّد",
    select: "تحديد",

    // Admin
    controlPlane: "مركز التحكم",
    adminFoundation: "أساس الإدارة",
    rlsEnforced: "محمي بسياسات RLS",
    controlPlaneSubtitle:
      "رؤية إدارية آمنة للأدوار، وعناصر الفوترة، واستيعاب المشاريع، وأحداث الأمان، وسجلات التدقيق، وصحة النظام.",
    recentActivity: "النشاط الأخير",
    quotaViolations: "تجاوزات الحصص",
    securityEvents: "أحداث الأمان",
    billingPlans: "خطط الاشتراك",
    noRecords: "لا توجد سجلات للعرض.",
    noSecurityEvents: "لا توجد أحداث أمان للعرض.",
    noQuotaViolations: "لا توجد تجاوزات حصص مسجّلة.",
    noUsageEvents: "لا توجد أحداث استخدام مسجّلة.",
    paymentsNotConnected: "الدفع غير موصول",
    roleRecords: "سجلات الأدوار",
    plans: "الخطط",
    subscriptions: "الاشتراكات",
    tokens: "الرموز",
    failures: "الإخفاقات",
    placeholderUsers: "المستخدمون",
    placeholderUsersDetail: "عمليات الأدوار والحسابات",
    placeholderSubs: "الاشتراكات",
    placeholderSubsDetail: "حالة الخطة وصحة الفوترة",
    placeholderUsageLimits: "حدود الاستخدام",
    placeholderUsageLimitsDetail: "سياسات الحصص وتطبيقها",
    placeholderUploads: "رفع المشاريع",
    placeholderUploadsDetail: "رؤية الاستيعاب والتخزين",
    placeholderSecurity: "أحداث الأمان",
    placeholderSecurityDetail: "محاولات الرفع والوصول المشبوهة",
    placeholderAudit: "سجلات التدقيق",
    placeholderAuditDetail: "سجل الإدارة واختيارات السياق",
    placeholderSystem: "صحة النظام",
    placeholderSystemDetail: "حالة التشغيل والطوابير والمزوّدين",
    planDistribution: "توزيع الخطط",
    storageIndexing: "صحة التخزين والفهرسة",
    trackedStorage: "التخزين المتعقَّب",
    contextSelections: "اختيارات السياق",
    auditEvents: "أحداث التدقيق",
    previewHealth: "صحة المعاينة",
    stable: "مستقرة",
    review: "تحتاج مراجعة",
    systemHealth: "صحة النظام",
    migrationChecklist: "قائمة التحقق من الترحيل",
    operationalWarnings: "تنبيهات تشغيلية",
    authRls: "المصادقة وسياسات RLS",
    active: "نشِط",
    projectIngestion: "استيعاب المشاريع",
    ready: "جاهز",
    aiGateway: "بوابة الذكاء الاصطناعي",
    configuredByEnv: "مهيّأة عبر البيئة",
    executionRuntime: "بيئة التنفيذ",
    disabled: "معطّلة",
    adminRoles: "أدوار الإدارة",
    detected: "تم الكشف",
    noRecordsShort: "لا توجد سجلات",
    seeded: "مُهيّأة",
    receiving: "تستقبل البيانات",
    empty: "فارغة",
    billing: "الفوترة",
    providerNotConnected: "المزوّد غير موصول",
    teams: "الفِرَق",
    notEnabled: "غير مفعّلة",
    sandbox: "البيئة المعزولة",
    bundle: "حزمة البناء",
    largeChunkWarning: "تحذير حجم الحزمة",

    // Settings
    settingsTitle: "إعدادات مساحة العمل",
    settingsSubtitle:
      "إدارة تفضيلات الحساب واللغة وحالة الخطة ومؤشرات الاستخدام وضوابط المؤسسة المستقبلية.",
    profile: "الملف الشخصي",
    profileBody: "تحرير الملف الشخصي وتفضيلات الإشعارات وبيانات الهوية محجوزة لمرحلة المؤسسات.",
    signedInUser: "المستخدم المسجّل",
    organization: "المؤسسة",
    organizationBody:
      "عضوية المؤسسة والأدوار وصلاحيات مساحة العمل وضوابط النطاق مخطّط لها ولم تُفعَّل بعد.",
    languageBody: "يُحفظ تفضيل اللغة محليًا، ويُحدِّث اتجاه التخطيط تلقائيًا عند اختيار العربية.",
    apiAccess: "واجهات API والوصول",
    apiAccessBody:
      "مفاتيح API و SCIM و SSO وحسابات الخدمة معطّلة قصدًا إلى أن تجهز طبقة أمان المؤسسة.",
    dangerZone: "منطقة الخطر",
    dangerZoneBody:
      "حذف مساحة العمل وعناصر التصدير ستتطلّب موافقة المسؤول وتسجيلًا للتدقيق. لا توجد إعدادات تدميرية متاحة في هذه المرحلة.",
    currentPlan: "الخطة الحالية",
    currentPlanBody: "الفوترة غير موصولة. تُطبَّق الحدود من خلال أساس الحوكمة.",
  },
} as const;

export type Locale = keyof typeof translations;
export type TranslationKey = keyof typeof translations.en;
