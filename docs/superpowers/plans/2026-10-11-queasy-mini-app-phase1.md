# Queasy Mini App (Phase 1: MVP Foundation & Solo Arena) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, test, and deploy the Queasy Telegram Mini App Phase 1 (Foundation, Modular SoC Architecture, Dark/Light Theme Engine, 3-language i18n, Bottom Navigation, and Interactive Solo Quiz Arena) on Telegram Serverless.

**Architecture:** React 19 + Vite frontend utilizing Vanilla CSS design tokens for dark/light glassmorphism aesthetics, `@iconify/react` for icons, and KaTeX for mathematical formulas. Fully integrated with Telegram WebApp SDK, connecting to serverless SQLite through `tgcloud/endpoints/`, and hosted via `tgcloud.jsonc` at `https://app8869835041.tgcloud.ai/`.

**Tech Stack:** React 19, Vite, `@iconify/react`, KaTeX, Canvas-confetti, Telegram WebApp SDK, `@tgcloud/cli`.

**Spec:** [docs/superpowers/specs/2026-10-11-queasy-mini-app-design.md](file:///d:/Serverless/Queasy_uz_Bot/docs/superpowers/specs/2026-10-11-queasy-mini-app-design.md)

---

## Global Constraints

- **Zero Hardcoding:** All UI labels, routes, action types, theme keys, and endpoint names MUST live in `src/constants/` or `src/i18n/locales/`.
- **Tri-Lingual Support:** Every feature text must be provided in Uzbek (`UZ`), Russian (`RU`), and English (`EN`).
- **Theme Adaptivity:** Must support Dark, Light, and Auto (Telegram `colorScheme` sync).
- **Separation of Concerns (SoC):** Modules must stay decoupled: `components/` (pure UI), `views/` (screens), `context/` (state), `hooks/` (logic), `services/` (API), `constants/` & `i18n/` (data), `styles/` (CSS tokens).
- **Zero Foreign Keys in SQLite:** As per `docs/tgcloud-sdk.md`, SQLite tables do not use foreign keys; relational integrity is handled in application logic.
- **Serverless Endpoints:** Endpoints under `tgcloud/endpoints/` receive `(input, ctx)` and communicate with the frontend via `Telegram.WebApp.Serverless.call`.

---

## Review Focus

1. **Telegram Desktop vs Mobile WebApp viewport:** Safe area insets and viewport height (`100vh` vs `window.innerHeight` or `--tg-viewport-height`) to prevent bottom nav clipping.
2. **Offline/Local Development Fallback:** Running Vite locally without Telegram WebApp should gracefully fall back to mock data so UI development is testable without constant redeployments.
3. **KaTeX rendering with malformed LaTeX:** KaTeX parser errors should not crash the app; fallback to clean plain text.
4. **Theme synchronization:** Instant reactive change when user switches Telegram dark/light theme or uses the manual toggle.
5. **Fast Solo Quiz transitions:** Haptic feedback triggering reliably without blocking UI animations.

---

## Tasks

### Task 1: Scaffolding Vite + React Frontend and Dependencies

**Files:**
- Create: `package.json` (root frontend dependencies)
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.jsx`
- Create: `src/App.jsx`
- Modify: `tgcloud.jsonc`

**Interfaces:**
- Consumes: Node.js environment
- Produces: Runnable Vite dev server and `dist` build pipeline

- [ ] **Step 1: Install frontend dependencies**
  Install `react`, `react-dom`, `@iconify/react`, `katex`, `canvas-confetti` and dev dependencies `@vitejs/plugin-react`, `vite`.
- [ ] **Step 2: Configure Vite build**
  Create `vite.config.js` with React plugin, output dir `dist`, root `./`.
- [ ] **Step 3: Setup index.html with Telegram WebApp Script**
  Add `<script src="https://telegram.org/js/telegram-web-app.js"></script>` and root viewport tags.
- [ ] **Step 4: Verify local build**
  Run `npm run build` and ensure `dist/` is created successfully without errors.

---

### Task 2: CSS Design Tokens & Theme Engine (Dark, Light, Auto)

**Files:**
- Create: `src/styles/variables.css`
- Create: `src/styles/glassmorphism.css`
- Create: `src/styles/animations.css`
- Create: `src/styles/index.css`
- Create: `src/constants/theme.js`
- Create: `src/context/ThemeContext.jsx`
- Create: `src/hooks/useTheme.js`

**Interfaces:**
- Produces: `ThemeContext`, `useTheme()` providing `{ theme, resolvedTheme, setTheme, isDark }`

- [ ] **Step 1: Write Theme Constants & CSS Variables**
  Define `THEME_DARK`, `THEME_LIGHT`, `THEME_AUTO`. Define `[data-theme="dark"]` and `[data-theme="light"]` variables for surface, text, accents, glass borders.
- [ ] **Step 2: Implement ThemeContext**
  Detect `window.Telegram?.WebApp?.colorScheme` or `prefers-color-scheme`. Apply `data-theme` attribute to `document.documentElement`.
- [ ] **Step 3: Test theme switching**
  Verify toggling between Dark, Light, and Auto dynamically updates CSS tokens.

---

### Task 3: Zero-Hardcode Constants & Tri-Lingual i18n System

**Files:**
- Create: `src/constants/config.js`
- Create: `src/constants/routes.js`
- Create: `src/constants/endpoints.js`
- Create: `src/i18n/locales/uz.js`
- Create: `src/i18n/locales/ru.js`
- Create: `src/i18n/locales/en.js`
- Create: `src/i18n/index.js`
- Create: `src/hooks/useTranslation.js`

**Interfaces:**
- Produces: `useTranslation()` providing `{ t, lang, setLanguage, supportedLangs }`

- [ ] **Step 1: Create Constants**
  Map all navigation tabs (`NAV_HOME`, `NAV_MY_QUIZZES`, `NAV_GROUP_HOST`, `NAV_LEADERBOARD`, `NAV_PROFILE`, `NAV_ARENA`).
- [ ] **Step 2: Build i18n Catalogs**
  Create full parity catalogs for `UZ`, `RU`, and `EN` covering all UI labels, timer strings, score summaries, and error states.
- [ ] **Step 3: Test language switching**
  Verify `t('BTN_START_QUIZ')` translates correctly across UZ, RU, and EN.

---

### Task 4: Telegram WebApp SDK Integration & Haptic Hook

**Files:**
- Create: `src/context/TelegramContext.jsx`
- Create: `src/hooks/useTelegram.js`
- Create: `src/services/api.js`

**Interfaces:**
- Produces: `useTelegram()` providing `{ user, isExpanded, haptic, showBackButton, hideBackButton }`
- Produces: `callEndpoint(name, params)` bridge to `Telegram.WebApp.Serverless.call`

- [ ] **Step 1: Implement TelegramContext**
  Call `Telegram.WebApp.ready()`, `expand()`. Extract `initDataUnsafe.user`.
- [ ] **Step 2: Implement Haptic Helper**
  Wrap `impactOccurred`, `notificationOccurred`, and `selectionChanged` with fallback for non-telegram browser testing.
- [ ] **Step 3: Build Serverless Bridge with Mock Fallback**
  In `src/services/api.js`, call `Telegram.WebApp.Serverless.call(endpoint, params)`. If running in local browser without Telegram, return mock data.

---

### Task 5: Serverless Backend Endpoints (`tgcloud/endpoints/`)

**Files:**
- Create: `tgcloud/endpoints/get_initial_data.js`
- Create: `tgcloud/endpoints/get_quiz_detail.js`
- Create: `tgcloud/endpoints/submit_solo_result.js`

**Interfaces:**
- Consumes: `ctx.initData.user`, `db`, `quizzes`, `questions`, `quizSessions`
- Produces: Backend API endpoints callable from Mini App

- [ ] **Step 1: Implement `get_initial_data.js`**
  Fetch user profile, quizzes owned by caller, and overall stats in a single fast query.
- [ ] **Step 2: Implement `get_quiz_detail.js`**
  Fetch quiz by ID with full questions, parsed options, and time limits.
- [ ] **Step 3: Implement `submit_solo_result.js`**
  Record finished attempt, calculate score and accuracy percentage.
- [ ] **Step 4: Verify syntax & deploy readiness**
  Run `node tests/test_syntax.mjs` to ensure clean ES module exports.

---

### Task 6: UI Shell & Navigation Components

**Files:**
- Create: `src/components/navigation/Header.jsx`
- Create: `src/components/navigation/BottomNav.jsx`
- Create: `src/components/common/Button.jsx`
- Create: `src/components/common/Card.jsx`
- Create: `src/components/common/Badge.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Produces: Master layout with top header, dynamic active view rendering, and bottom nav

- [ ] **Step 1: Build Header Component**
  Render user avatar, display name, language dropdown (UZ/RU/EN), and theme switcher (Dark/Light).
- [ ] **Step 2: Build BottomNav Component**
  Render 5 glassmorphic tabs with Iconify icons (`home`, `quizzes`, `group`, `leaderboard`, `profile`), active indicator, and haptic vibration on click.
- [ ] **Step 3: Connect View Routing in App.jsx**
  Implement tab state switching between views.

---

### Task 7: Home View Component

**Files:**
- Create: `src/views/HomeView.jsx`
- Create: `src/services/quizService.js`

**Interfaces:**
- Produces: Home dashboard with user greeting, stats pills, recent quizzes carousel, and "Create Quiz" CTA

- [ ] **Step 1: Implement Home Dashboard UI**
  Show total quizzes, completed count, accuracy rate.
- [ ] **Step 2: Render My Quizzes Carousel**
  Display quiz cards with question count, time limit badge, and instant "Start" button.
- [ ] **Step 3: Action Handlers**
  Clicking a quiz transitions to the Solo Quiz Arena.

---

### Task 8: Solo Quiz Arena (Interactive Player)

**Files:**
- Create: `src/views/ArenaView.jsx`
- Create: `src/components/quiz/TimerRing.jsx`
- Create: `src/components/quiz/ProgressBar.jsx`
- Create: `src/components/quiz/OptionCard.jsx`
- Create: `src/components/quiz/MathText.jsx`
- Create: `src/hooks/useQuizTimer.js`

**Interfaces:**
- Produces: Fullscreen interactive quiz engine

- [ ] **Step 1: Build TimerRing & useQuizTimer**
  SVG countdown circle that smoothly depletes from 100% to 0%. When time expires, marks question wrong and advances.
- [ ] **Step 2: Build MathText (KaTeX integration)**
  Render math formulas (`$E=mc^2$`) cleanly with KaTeX.
- [ ] **Step 3: Build OptionCard with Haptics**
  Render option cards (A, B, C, D). On click: trigger light haptic, show green/red visual glow, display explanation, then advance to next question after 1.2s.
- [ ] **Step 4: Telegram BackButton integration**
  Show Telegram BackButton when in Arena. Clicking it prompts a confirmation dialog.

---

### Task 9: Result & Share Card Component

**Files:**
- Create: `src/components/quiz/ResultCard.jsx`

**Interfaces:**
- Produces: Celebration screen with confetti, score diploma, time spent, and share triggers

- [ ] **Step 1: Confetti & Diploma Card UI**
  Trigger `canvas-confetti` if score >= 70%. Display total score, correct vs wrong count, average time per question.
- [ ] **Step 2: Action Buttons**
  - "Qayta urinish" (Retry quiz)
  - "Xatolar ustida ishlash" (Review mistakes)
  - "Do'stlarga ulashish" (Share to Telegram chat via `switch_inline_query`)
- [ ] **Step 3: Return to Home**
  Restore bottom navigation bar and return to main screen.

---

### Task 10: Build, Integration Verification & Cloud Deployment

**Files:**
- Modify: `tgcloud.jsonc` (enable static source: "dist")
- Modify: `package.json`

**Interfaces:**
- Produces: Production bundle deployed to `https://app8869835041.tgcloud.ai/`

- [ ] **Step 1: Build Production Bundle**
  Run `npm run build` and ensure `dist/index.html` and assets are generated.
- [ ] **Step 2: Configure tgcloud.jsonc**
  Set `"static": { "source": "dist" }`.
- [ ] **Step 3: Verify existing backend tests**
  Run `node tests/test_messages_parity.mjs` and `npm test` to confirm bot stability.
- [ ] **Step 4: Deploy to Telegram Cloud**
  Run `npx @tgcloud/cli push` to upload both backend endpoints and static Mini App.
- [ ] **Step 5: Verify live Mini App**
  Check endpoint and static assets deployment status.
