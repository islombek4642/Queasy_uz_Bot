# Turso Cloud (LibSQL) Migration Implementation Plan

- **Spec Reference:** `docs/superpowers/specs/2026-10-17-turso-database-migration-design.md`
- **Target App:** Queasy_uz_Bot (Telegram Serverless)
- **Execution Mode:** Phased & Non-Destructive (Current TG DB remains completely intact)

---

## Task 1: Generate Complete SQLite Database File (`queasy_ready.sqlite`)
- [ ] **Step 1.1**: Create `scripts/dump_tgcloud_data.mjs` to fetch all records of the 15 dynamic tables from TGCloud (`users`, `quizzes`, `categories`, `user_mistakes`, `quiz_sessions`, `group_answers`, `group_tournaments`, `tournament_participants`, `live_rooms`, `room_players`, `group_lobbies`, `groups`, `user_states`, `bot_settings`, `required_channels`) into JSON format.
- [ ] **Step 1.2**: Write Python script `scripts/build_full_sqlite_db.py` to:
  - Initialize `queasy_ready.sqlite` with the exact 16 tables and DDL from `tgcloud/schema.js`.
  - Populate the dynamic table records.
  - Populate all 848,845 questions from local parsed data / dataset.
  - Build all indexes (`idx_questions_quiz_id`, `idx_quizzes_category`, `idx_users_created_at`, etc.).
- [ ] **Step 1.3**: Run verification query locally on `queasy_ready.sqlite` to verify all row counts match 100%.

---

## Task 2: Turso Database Creation & Ingest
- [ ] **Step 2.1**: User uploads `queasy_ready.sqlite` to Turso via the web console (`app.turso.tech`) in Frankfurt (`fra`) region.
- [ ] **Step 2.2**: User copies Database URL and Auth Token.
- [ ] **Step 2.3**: Write and run `scripts/verify_turso_connection.mjs` to ping Turso and confirm all tables and row counts are live and healthy.

---

## Task 3: Build High-Performance Turso Client for Telegram Serverless
- [ ] **Step 3.1**: Create `tgcloud/lib/turso_client.js` using `import { fetch } from 'sdk'`.
  - Implement `/v2/pipeline` HTTP calls.
  - Implement methods: `query(sql, args)`, `get(sql, args)`, `all(sql, args)`, `run(sql, args)`, `batch(queries)`.
- [ ] **Step 3.2**: Add configuration parameters in `tgcloud/lib/constants/config.js` (`TURSO_URL`, `TURSO_TOKEN`, `USE_TURSO: false` by default).

---

## Task 4: Integration, Testing & Switch-Over
- [ ] **Step 4.1**: Connect services to `turso_client` when `USE_TURSO = true`.
- [ ] **Step 4.2**: Run integration tests using `node scratch/run_cloud_module.mjs` for:
  - `handlers/message`
  - `handlers/callback_query`
  - `endpoints/get_initial_data`
  - `endpoints/get_quiz_detail`
- [ ] **Step 4.3**: Set `USE_TURSO = true`, build Mini App (`npm run build`) and deploy to cloud (`npx @tgcloud/cli push`).
- [ ] **Step 4.4**: Verify live bot responses and WebApp in Telegram.
