// tgcloud/lib/constants/actions.js
// Action and state identifiers for callback queries and FSM

export const ACTIONS = {
  // Solo Quiz Modes
  MODE_FULL: 'mode_full',
  MODE_RANGE: 'mode_range',
  MODE_RANDOM: 'mode_random',
  MODE_MISTAKES: 'mode_mistakes',

  // Quiz Lifecycle
  START_QUIZ_PREFIX: 'start_quiz:',
  START_GROUP_QUIZ_PREFIX: 'start_group:',
  VIEW_QUIZ_PREFIX: 'view_quiz:',
  CLONE_QUIZ_PREFIX: 'clone_quiz:',
  DELETE_QUIZ_PREFIX: 'delete_quiz:',
  CONFIRM_DELETE_PREFIX: 'confirm_del:',
  CHANGE_TIME_PREFIX: 'change_time:',
  SET_TIME_PREFIX: 'set_time:',
  TOGGLE_SHUFFLE_PREFIX: 'toggle_shuf:',
  STOP_QUIZ_PREFIX: 'stop_quiz:',
  NEXT_QUESTION_PREFIX: 'next_q:',
  REVIEW_MISTAKES_PREFIX: 'rev_mistakes:',
  CLEAR_MISTAKES_PREFIX: 'clear_mistakes:',
  RESUME_QUIZ_PREFIX: 'resume_quiz:',

  // Group Multiplayer Lobby
  LOBBY_JOIN_PREFIX: 'join_lobby:',
  LOBBY_START_PREFIX: 'start_lobby:',
  LOBBY_CANCEL_PREFIX: 'cancel_lobby:',
  CONFIRM_GROUP_QUIZ_PREFIX: 'conf_group:',

  // Navigation & Pagination
  MY_QUIZZES_PAGE_PREFIX: 'quizzes_page:',
  USERS_PAGE_PREFIX: 'users_page:',
  GROUPS_PAGE_PREFIX: 'groups_page:',
  BACK_TO_MENU: 'nav_main_menu',
  CANCEL_CURRENT: 'nav_cancel',

  // Language Selection
  SET_LANG_PREFIX: 'set_lang:',

  // Channel Subscription
  CHECK_SUB: 'check_subscription',

  // Admin Actions
  ADMIN_MENU: 'admin_menu',
  ADMIN_STATS: 'admin_stats',
  ADMIN_BROADCAST: 'admin_broadcast',
  ADMIN_BROADCAST_CONFIRM: 'admin_bcast_confirm',
  ADMIN_USERS: 'admin_users',
  ADMIN_GROUPS: 'admin_groups',
  ADMIN_CHANNELS: 'admin_channels',
  ADMIN_ADD_CHANNEL: 'admin_add_channel',
  ADMIN_DEL_CHANNEL_PREFIX: 'admin_del_channel:',
  ADMIN_PUBLISH_PREFIX: 'admin_publish:',
  ADMIN_MEDIA_CHANNEL: 'admin_media_channel',
  ADMIN_SET_MEDIA_CHANNEL: 'admin_set_media_channel',
  ADMIN_DEL_MEDIA_CHANNEL: 'admin_del_media_channel',
};

export const STATES = {
  IDLE: 'IDLE',
  AWAITING_QUIZ_FILE: 'AWAITING_QUIZ_FILE',
  SELECTING_MODE: 'SELECTING_MODE',
  WAITING_FOR_RANGE: 'WAITING_FOR_RANGE',
  WAITING_FOR_RANDOM_COUNT: 'WAITING_FOR_RANDOM_COUNT',
  ADMIN_BROADCAST_TEXT: 'ADMIN_BROADCAST_TEXT',
  ADMIN_ADD_CHANNEL: 'ADMIN_ADD_CHANNEL',
  WAITING_FOR_MEDIA_CHANNEL: 'WAITING_FOR_MEDIA_CHANNEL',
};

export default { ACTIONS, STATES };
