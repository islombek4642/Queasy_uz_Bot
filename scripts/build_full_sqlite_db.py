import sqlite3
import json
import os
import glob
import sys

DB_FILE = 'd:/Serverless/Queasy_uz_Bot/queasy_ready.sqlite'
DUMP_DIR = 'd:/Serverless/Queasy_uz_Bot/scratch/tg_dump'

def init_schema(cursor):
    cursor.executescript('''
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    -- 1. Users
    CREATE TABLE IF NOT EXISTS users (
      telegram_id INTEGER PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT,
      username TEXT,
      lang TEXT NOT NULL DEFAULT 'UZ',
      is_blocked INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      last_active_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at);

    -- 2. Groups
    CREATE TABLE IF NOT EXISTS "groups" (
      group_id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      username TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_groups_created_at ON "groups" (created_at);
    CREATE INDEX IF NOT EXISTS idx_groups_is_active ON "groups" (is_active);

    -- 3. Quizzes
    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      is_public INTEGER NOT NULL DEFAULT 0,
      time_limit INTEGER NOT NULL DEFAULT 30,
      shuffle_options INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_quizzes_owner_id ON quizzes (owner_id);
    CREATE INDEX IF NOT EXISTS idx_quizzes_category ON quizzes (category);
    CREATE INDEX IF NOT EXISTS idx_quizzes_is_public ON quizzes (is_public);

    -- 4. Questions
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      question_text TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_option_id INTEGER NOT NULL,
      explanation TEXT,
      photo_file_id TEXT,
      photo_caption TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions (quiz_id);

    -- 5. User Mistakes
    CREATE TABLE IF NOT EXISTS user_mistakes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_option_id INTEGER NOT NULL,
      explanation TEXT,
      photo_file_id TEXT,
      original_quiz_id INTEGER,
      original_num INTEGER,
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_mistakes_user_id ON user_mistakes (user_id);

    -- 6. Quiz Sessions
    CREATE TABLE IF NOT EXISTS quiz_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      chat_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      is_group INTEGER NOT NULL DEFAULT 0,
      mode TEXT NOT NULL DEFAULT 'full',
      current_index INTEGER NOT NULL DEFAULT 0,
      total_questions INTEGER NOT NULL,
      correct_count INTEGER NOT NULL DEFAULT 0,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_poll_id TEXT,
      last_poll_msg_id INTEGER,
      last_poll_sent_at INTEGER,
      selected_questions_json TEXT,
      started_at INTEGER DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON quiz_sessions (user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON quiz_sessions (is_active);

    -- 7. Group Answers
    CREATE TABLE IF NOT EXISTS group_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      poll_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      question_index INTEGER NOT NULL,
      is_correct INTEGER NOT NULL,
      time_taken INTEGER DEFAULT 0,
      answered_at INTEGER DEFAULT (unixepoch())
    );

    -- 8. Required Channels
    CREATE TABLE IF NOT EXISTS required_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      channel_username TEXT,
      title TEXT NOT NULL,
      invite_link TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    );

    -- 9. User States
    CREATE TABLE IF NOT EXISTS user_states (
      user_id INTEGER PRIMARY KEY,
      state TEXT NOT NULL,
      context_data_json TEXT,
      updated_at INTEGER DEFAULT (unixepoch())
    );

    -- 10. Bot Settings
    CREATE TABLE IF NOT EXISTS bot_settings (
      "key" TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch())
    );

    -- 11. Group Lobbies
    CREATE TABLE IF NOT EXISTS group_lobbies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      message_id INTEGER,
      quiz_id INTEGER NOT NULL,
      owner_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      ready_users_json TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER DEFAULT (unixepoch())
    );

    -- 12. Categories
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE
    );

    -- 13. Group Tournaments
    CREATE TABLE IF NOT EXISTS group_tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      creator_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      share_code TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    );

    -- 14. Tournament Participants
    CREATE TABLE IF NOT EXISTS tournament_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      user_avatar TEXT,
      score INTEGER NOT NULL DEFAULT 0,
      total_questions INTEGER NOT NULL,
      total_time_seconds INTEGER NOT NULL DEFAULT 0,
      finished_at INTEGER DEFAULT (unixepoch())
    );

    -- 15. Live Rooms
    CREATE TABLE IF NOT EXISTS live_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL UNIQUE,
      quiz_id INTEGER NOT NULL,
      host_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      current_question_index INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    );

    -- 16. Room Players
    CREATE TABLE IF NOT EXISTS room_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      joined_at INTEGER DEFAULT (unixepoch())
    );
    ''')

print("Schema initialized.")
