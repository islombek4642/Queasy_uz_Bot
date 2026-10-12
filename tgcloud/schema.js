// tgcloud/schema.js
// SQLite database schema for Telegram Serverless QuizBot

import { table, integer, text, sql } from 'sdk/db';

// 1. Users table
export const users = table('users', {
  telegramId:   integer('telegram_id').primaryKey(),
  firstName:    text('first_name').notNull(),
  lastName:     text('last_name'),
  username:     text('username'),
  lang:         text('lang').notNull().default('UZ'),
  isBlocked:    integer('is_blocked', { mode: 'boolean' }).notNull().default(false),
  createdAt:    integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  lastActiveAt: integer('last_active_at', { mode: 'timestamp' }),
});

// 2. Connected Groups table
export const groups = table('groups', {
  groupId:   integer('group_id').primaryKey(),
  title:     text('title').notNull(),
  username:  text('username'),
  isActive:  integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// 3. Quizzes table
export const quizzes = table('quizzes', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  ownerId:        integer('owner_id').notNull(),
  title:          text('title').notNull(),
  description:    text('description'),
  category:       text('category'),
  isPublic:       integer('is_public', { mode: 'boolean' }).notNull().default(false),
  timeLimit:      integer('time_limit').notNull().default(30),
  shuffleOptions: integer('shuffle_options', { mode: 'boolean' }).notNull().default(true),
  createdAt:      integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// 4. Questions table
export const questions = table('questions', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  quizId:          integer('quiz_id').notNull(),
  orderIndex:      integer('order_index').notNull().default(0),
  questionText:    text('question_text').notNull(),
  optionsJson:     text('options_json').notNull(), // JSON Array: ["A", "B", "C", "D"]
  correctOptionId: integer('correct_option_id').notNull(), // 0-based index
  explanation:     text('explanation'),
  photoFileId:     text('photo_file_id'),
  photoCaption:    text('photo_caption'),
});

// 5. User Mistakes table (Xatolar ustida ishlash)
export const userMistakes = table('user_mistakes', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  userId:          integer('user_id').notNull(),
  questionText:    text('question_text').notNull(),
  optionsJson:     text('options_json').notNull(),
  correctOptionId: integer('correct_option_id').notNull(),
  explanation:     text('explanation'),
  photoFileId:     text('photo_file_id'),
  originalQuizId:  integer('original_quiz_id'),
  originalNum:     integer('original_num'),
  createdAt:       integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// 6. Active & Finished Quiz Sessions
export const quizSessions = table('quiz_sessions', {
  id:                    integer('id').primaryKey({ autoIncrement: true }),
  quizId:                integer('quiz_id').notNull(),
  chatId:                integer('chat_id').notNull(),
  userId:                integer('user_id').notNull(),
  isGroup:               integer('is_group', { mode: 'boolean' }).notNull().default(false),
  mode:                  text('mode').notNull().default('full'), // full, range, random, mistakes
  currentIndex:          integer('current_index').notNull().default(0),
  totalQuestions:        integer('total_questions').notNull(),
  correctCount:          integer('correct_count').notNull().default(0),
  wrongCount:            integer('wrong_count').notNull().default(0),
  isActive:              integer('is_active', { mode: 'boolean' }).notNull().default(true),
  lastPollId:            text('last_poll_id'),
  lastPollMessageId:     integer('last_poll_msg_id'),
  lastPollSentAt:        integer('last_poll_sent_at'),
  selectedQuestionsJson: text('selected_questions_json'),
  startedAt:             integer('started_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// 7. Group Multiplayer Answers Tracker
export const groupAnswers = table('group_answers', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  sessionId:     integer('session_id').notNull(),
  pollId:        text('poll_id').notNull(),
  userId:        integer('user_id').notNull(),
  userName:      text('user_name').notNull(),
  questionIndex: integer('question_index').notNull(),
  isCorrect:     integer('is_correct', { mode: 'boolean' }).notNull(),
  timeTaken:     integer('time_taken').default(0),
  answeredAt:    integer('answered_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// 8. Required Channels for Force Subscription
export const requiredChannels = table('required_channels', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  channelId:       text('channel_id').notNull(),
  channelUsername: text('channel_username'),
  title:           text('title').notNull(),
  inviteLink:      text('invite_link').notNull(),
  isActive:        integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt:       integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// 9. FSM State Manager
export const userStates = table('user_states', {
  userId:          integer('user_id').primaryKey(),
  state:           text('state').notNull(),
  contextDataJson: text('context_data_json'),
  updatedAt:       integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// 10. Dynamic Bot Settings
export const botSettings = table('bot_settings', {
  key:       text('key').primaryKey(),
  value:     text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// 11. Group Quiz Lobbies
export const groupLobbies = table('group_lobbies', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  chatId:         integer('chat_id').notNull(),
  messageId:      integer('message_id'),
  quizId:         integer('quiz_id').notNull(),
  ownerId:        integer('owner_id').notNull(),
  status:         text('status').notNull().default('waiting'),
  readyUsersJson: text('ready_users_json').notNull().default('[]'),
  createdAt:      integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// 12. Hierarchical Category Registry for Bot Navigation (64-byte safe)
export const categories = table('categories', {
  id:   integer('id').primaryKey({ autoIncrement: true }),
  path: text('path').notNull().unique(),
});

// 13. Group Tournaments (WebApp Group Challenge)
export const groupTournaments = table('group_tournaments', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  quizId:    integer('quiz_id').notNull(),
  creatorId: integer('creator_id').notNull(),
  title:     text('title').notNull(),
  shareCode: text('share_code').notNull().unique(),
  isActive:  integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// 14. Tournament Participants (Leaderboard tracker)
export const tournamentParticipants = table('tournament_participants', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  tournamentId:     integer('tournament_id').notNull(),
  userId:           integer('user_id').notNull(),
  userName:         text('user_name').notNull(),
  userAvatar:       text('user_avatar'),
  score:            integer('score').notNull().default(0),
  totalQuestions:   integer('total_questions').notNull(),
  totalTimeSeconds: integer('total_time_seconds').notNull().default(0),
  finishedAt:       integer('finished_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// 15. Live Multiplayer Rooms (Kahoot Style)
export const liveRooms = table('live_rooms', {
  id:                   integer('id').primaryKey({ autoIncrement: true }),
  roomCode:             text('room_code').notNull().unique(),
  quizId:               integer('quiz_id').notNull(),
  hostId:               integer('host_id').notNull(),
  status:               text('status').notNull().default('waiting'), // waiting, active, finished
  currentQuestionIndex: integer('current_question_index').notNull().default(0),
  createdAt:            integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

