# Safe Customization System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Add safe developer customization, declarative widgets, scoped CSS, and offline ZIP import/export without allowing arbitrary code.

**Architecture:** Normalize all active customization under `theme.customization`, validate it through pure services, and store imported packages in a separate IndexedDB library. The builder opens one reusable side editor for every custom entry, while LovePhone OS converts validated tokens and scoped CSS into the live preview.

**Tech Stack:** Vanilla ES modules, IndexedDB, GridStack, fflate ZIP codec, Node test runner, Electron.

---

### Task 1: Customization model and security

**Files:**
- Create: `src/services/customizationModel.js`
- Test: `tests/customization-model.test.mjs`
- Modify: `src/config/defaultConfig.js`
- Modify: `src/config/schema.js`

**Steps:**
1. Add failing tests for defaults, token limits, CSS sanitizing, widget data sources/actions, and unknown-field removal.
2. Implement normalization and CSS validation without DOM dependencies.
3. Add `theme.customization` defaults and preserve valid customization during schema migration.
4. Run `node --test tests/customization-model.test.mjs`.

### Task 2: Separate package and asset storage

**Files:**
- Create: `src/storage/customizationStore.js`
- Test: `tests/customization-store.test.mjs`

**Steps:**
1. Add tests using a fake IndexedDB adapter boundary.
2. Implement package/asset CRUD, size accounting, duplicate handling, and stable IDs.
3. Keep the store independent from current config backups.
4. Run the focused test.

### Task 3: Theme package codec

**Files:**
- Create: `src/services/themePackageService.js`
- Create: `assets/vendor/fflate/fflate.js`
- Create: `assets/vendor/fflate/LICENSE`
- Test: `tests/theme-package.test.mjs`
- Modify: `THIRD_PARTY_NOTICES.md`

**Steps:**
1. Add fflate and vendor its browser module.
2. Test manifest validation, forbidden files, external URL rejection, hashes, ZIP round trip, and size limits.
3. Implement import inspection, library save, and selected/full export.
4. Run focused tests and `npm audit`.

### Task 4: Reusable side editor

**Files:**
- Create: `src/builder/CustomizationDrawer.js`
- Modify: `src/builder/AppearancePanel.js`
- Modify: `src/main.js`
- Modify: `src/styles/builder.css`

**Steps:**
1. Add “+ 自定义” entries to every agreed section.
2. Add reusable drawer navigation, developer mode, preview draft, apply, cancel, reset, import, and export.
3. Ensure opening a drawer does not lengthen the base two-page flow.
4. Verify desktop and mobile builder screenshots.

### Task 5: Live phone and App styling

**Files:**
- Create: `src/system/customizationRuntime.js`
- Modify: `src/system/LovePhoneOS.js`
- Modify: `src/system/appAppearance.js`
- Modify: `src/system/HomeScreen.js`
- Modify: `src/styles/phone-system.css`
- Test: `tests/customization-runtime.test.mjs`

**Steps:**
1. Convert validated tokens, shell settings, desktop settings and App variables into CSS variables.
2. Scope custom CSS to `.phone-frame`, the selected `.app-theme-*`, or a widget ID.
3. Resolve custom icon packs with safe fallback.
4. Test that one App cannot style another App or the builder.

### Task 6: Declarative custom widgets

**Files:**
- Create: `src/system/customWidgetRuntime.js`
- Modify: `src/system/widgetCatalog.js`
- Modify: `src/system/HomeScreen.js`
- Modify: `src/system/HomeWidgetActions.js`
- Modify: `src/system/GridStackWidgets.js`
- Test: `tests/custom-widget.test.mjs`

**Steps:**
1. Support whitelisted sources for time, weather, active character, music, anniversaries, diary, memory and mood.
2. Support whitelisted open-App, music, role, chat, diary and anniversary actions.
3. Render text/image/progress/list declaratively with escaped values.
4. Verify drag persistence and action routing.

### Task 7: Integration, migration and release validation

**Files:**
- Modify: `sw.js`
- Modify: `index.html`
- Modify: `README.md`
- Modify: `docs/RELEASE_AUDIT.md`

**Steps:**
1. Bump schema and browser cache versions without resetting user data.
2. Add integration tests for old configuration migration and package import/export.
3. Run `npm test` and `npm audit`.
4. Perform Electron desktop/mobile UI smoke tests.
5. Rebuild and verify the Windows installer.
