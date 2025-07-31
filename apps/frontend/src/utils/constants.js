// Application constants
export const APP_CONFIG = {
    NAME: 'AI Chatbot',
    VERSION: '1.0.0',
    DESCRIPTION: 'Intelligent AI chatbot with knowledge base integration',
    AUTHOR: 'AI Chatbot Team',
    HOMEPAGE: 'https://your-domain.com',
    SUPPORT_EMAIL: 'support@your-domain.com',
  };
  
  // API Configuration
  export const API_CONFIG = {
    BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
    SOCKET_URL: import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000',
    TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
  };
  
  // Theme and UI constants
  export const THEME_MODES = {
    LIGHT: 'light',
    DARK: 'dark',
    SYSTEM: 'system',
  };
  
  export const COLORS = {
    PRIMARY: '#2563eb',
    SECONDARY: '#64748b',
    SUCCESS: '#10b981',
    WARNING: '#f59e0b',
    ERROR: '#ef4444',
    INFO: '#3b82f6',
  };
  
  export const BREAKPOINTS = {
    SM: 640,
    MD: 768,
    LG: 1024,
    XL: 1280,
    '2XL': 1536,
  };
  
  export const Z_INDEX = {
    DROPDOWN: 1000,
    STICKY: 1020,
    FIXED: 1030,
    MODAL_BACKDROP: 1040,
    MODAL: 1050,
    POPOVER: 1060,
    TOOLTIP: 1070,
    NOTIFICATION: 1080,
  };
  
  // Message and chat constants
  export const MESSAGE_TYPES = {
    TEXT: 'text',
    IMAGE: 'image',
    FILE: 'file',
    AUDIO: 'audio',
    VIDEO: 'video',
    SYSTEM: 'system',
    ERROR: 'error',
    TYPING: 'typing',
  };
  
  export const MESSAGE_STATUS = {
    SENDING: 'sending',
    SENT: 'sent',
    DELIVERED: 'delivered',
    READ: 'read',
    FAILED: 'failed',
  };
  
  export const SENDER_TYPES = {
    USER: 'user',
    ASSISTANT: 'assistant',
    SYSTEM: 'system',
  };
  
  export const CONVERSATION_STATUS = {
    ACTIVE: 'active',
    ARCHIVED: 'archived',
    DELETED: 'deleted',
  };
  
  // File upload constants
  export const FILE_TYPES = {
    PDF: 'application/pdf',
    DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    DOC: 'application/msword',
    TXT: 'text/plain',
    MD: 'text/markdown',
    JSON: 'application/json',
    CSV: 'text/csv',
    XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    XLS: 'application/vnd.ms-excel',
    PNG: 'image/png',
    JPG: 'image/jpeg',
    JPEG: 'image/jpeg',
    GIF: 'image/gif',
    WEBP: 'image/webp',
    MP3: 'audio/mpeg',
    MP4: 'video/mp4',
    WEBM: 'video/webm',
  };
  
  export const SUPPORTED_DOCUMENT_TYPES = [
    FILE_TYPES.PDF,
    FILE_TYPES.DOCX,
    FILE_TYPES.DOC,
    FILE_TYPES.TXT,
    FILE_TYPES.MD,
  ];
  
  export const SUPPORTED_IMAGE_TYPES = [
    FILE_TYPES.PNG,
    FILE_TYPES.JPG,
    FILE_TYPES.JPEG,
    FILE_TYPES.GIF,
    FILE_TYPES.WEBP,
  ];
  
  export const FILE_SIZE_LIMITS = {
    DOCUMENT: 10 * 1024 * 1024, // 10MB
    IMAGE: 5 * 1024 * 1024, // 5MB
    AUDIO: 20 * 1024 * 1024, // 20MB
    VIDEO: 50 * 1024 * 1024, // 50MB
  };
  
  // Socket events
  export const SOCKET_EVENTS = {
    // Connection events
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    CONNECT_ERROR: 'connect_error',
    RECONNECT: 'reconnect',
    RECONNECT_ATTEMPT: 'reconnect_attempt',
    RECONNECT_ERROR: 'reconnect_error',
    RECONNECT_FAILED: 'reconnect_failed',
  
    // Chat events
    JOIN_CONVERSATION: 'join_conversation',
    LEAVE_CONVERSATION: 'leave_conversation',
    NEW_MESSAGE: 'new_message',
    MESSAGE_SENT: 'message_sent',
    MESSAGE_DELIVERED: 'message_delivered',
    MESSAGE_READ: 'message_read',
    MESSAGE_ERROR: 'message_error',
    MESSAGE_UPDATED: 'message_updated',
    MESSAGE_DELETED: 'message_deleted',
  
    // Typing events
    TYPING_START: 'typing_start',
    TYPING_STOP: 'typing_stop',
    USER_TYPING: 'user_typing',
  
    // Presence events
    USER_ONLINE: 'user_online',
    USER_OFFLINE: 'user_offline',
    USER_STATUS: 'user_status',
  
    // Conversation events
    CONVERSATION_CREATED: 'conversation_created',
    CONVERSATION_UPDATED: 'conversation_updated',
    CONVERSATION_DELETED: 'conversation_deleted',
  
    // System events
    ERROR: 'error',
    NOTIFICATION: 'notification',
    PING: 'ping',
    PONG: 'pong',
  };
  
  // Connection status
  export const CONNECTION_STATUS = {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    RECONNECTING: 'reconnecting',
    ERROR: 'error',
    FAILED: 'failed',
  };
  
  // Document processing status
  export const DOCUMENT_STATUS = {
    UPLOADING: 'uploading',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    DELETED: 'deleted',
  };
  
  // Search and filtering constants
  export const SEARCH_TYPES = {
    CONVERSATIONS: 'conversations',
    MESSAGES: 'messages',
    DOCUMENTS: 'documents',
    GLOBAL: 'global',
  };
  
  export const SORT_OPTIONS = {
    DATE_ASC: 'date_asc',
    DATE_DESC: 'date_desc',
    RELEVANCE: 'relevance',
    TITLE: 'title',
    SIZE: 'size',
    STATUS: 'status',
  };
  
  // Notification types
  export const NOTIFICATION_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info',
  };
  
  // Animation durations (in milliseconds)
  export const ANIMATION_DURATION = {
    FAST: 150,
    NORMAL: 200,
    SLOW: 300,
    VERY_SLOW: 500,
  };
  
  // Keyboard shortcuts
  export const KEYBOARD_SHORTCUTS = {
    SEND_MESSAGE: 'Enter',
    NEW_LINE: 'Shift+Enter',
    NEW_CONVERSATION: 'Ctrl+N',
    SEARCH: 'Ctrl+K',
    SETTINGS: 'Ctrl+,',
    HELP: 'F1',
    TOGGLE_SIDEBAR: 'Ctrl+B',
    FOCUS_INPUT: 'Ctrl+L',
  };
  
  // Local storage keys
  export const STORAGE_KEYS = {
    THEME: 'ai-chatbot-theme',
    USER_PREFERENCES: 'ai-chatbot-preferences',
    CONVERSATION_DRAFTS: 'ai-chatbot-drafts',
    RECENT_SEARCHES: 'ai-chatbot-recent-searches',
    SIDEBAR_STATE: 'ai-chatbot-sidebar',
    FONT_SIZE: 'ai-chatbot-font-size',
    LANGUAGE: 'ai-chatbot-language',
    AUTH_TOKEN: 'ai-chatbot-auth-token',
    LAST_ACTIVE: 'ai-chatbot-last-active',
  };
  
  // Error messages
  export const ERROR_MESSAGES = {
    GENERIC: 'An unexpected error occurred. Please try again.',
    NETWORK: 'Network error. Please check your connection.',
    TIMEOUT: 'Request timeout. Please try again.',
    UNAUTHORIZED: 'You are not authorized to perform this action.',
    FORBIDDEN: 'Access denied.',
    NOT_FOUND: 'Resource not found.',
    VALIDATION: 'Please check your input and try again.',
    RATE_LIMIT: 'Too many requests. Please wait a moment.',
    SERVER_ERROR: 'Server error. Please try again later.',
    FILE_TOO_LARGE: 'File is too large. Please choose a smaller file.',
    INVALID_FILE_TYPE: 'Invalid file type. Please choose a supported file.',
    UPLOAD_FAILED: 'File upload failed. Please try again.',
    PROCESSING_FAILED: 'Document processing failed. Please try again.',
    SEARCH_FAILED: 'Search failed. Please try again.',
    CONNECTION_LOST: 'Connection lost. Attempting to reconnect...',
    MICROPHONE_ERROR: 'Could not access microphone. Please check permissions.',
    CAMERA_ERROR: 'Could not access camera. Please check permissions.',
  };
  
  // Success messages
  export const SUCCESS_MESSAGES = {
    MESSAGE_SENT: 'Message sent successfully',
    FILE_UPLOADED: 'File uploaded successfully',
    DOCUMENT_PROCESSED: 'Document processed successfully',
    CONVERSATION_CREATED: 'Conversation created successfully',
    CONVERSATION_DELETED: 'Conversation deleted successfully',
    SETTINGS_SAVED: 'Settings saved successfully',
    EXPORT_COMPLETE: 'Export completed successfully',
    IMPORT_COMPLETE: 'Import completed successfully',
    SEARCH_COMPLETE: 'Search completed',
    CONNECTION_RESTORED: 'Connection restored',
  };
  
  // Validation rules
  export const VALIDATION_RULES = {
    MESSAGE_MIN_LENGTH: 1,
    MESSAGE_MAX_LENGTH: 4000,
    CONVERSATION_TITLE_MIN_LENGTH: 1,
    CONVERSATION_TITLE_MAX_LENGTH: 100,
    SEARCH_QUERY_MIN_LENGTH: 2,
    SEARCH_QUERY_MAX_LENGTH: 200,
    FILE_NAME_MAX_LENGTH: 255,
    TAG_MAX_LENGTH: 50,
    DESCRIPTION_MAX_LENGTH: 500,
  };
  
  // Pagination defaults
  export const PAGINATION = {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    CONVERSATIONS_PAGE_SIZE: 15,
    MESSAGES_PAGE_SIZE: 50,
    DOCUMENTS_PAGE_SIZE: 20,
    SEARCH_RESULTS_PAGE_SIZE: 10,
  };
  
  // Time constants
  export const TIME_CONSTANTS = {
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
    WEEK: 7 * 24 * 60 * 60 * 1000,
    MONTH: 30 * 24 * 60 * 60 * 1000,
    YEAR: 365 * 24 * 60 * 60 * 1000,
  };
  
  // Feature flags
  export const FEATURE_FLAGS = {
    VOICE_INPUT: import.meta.env.VITE_FEATURE_VOICE_INPUT === 'true',
    FILE_UPLOAD: import.meta.env.VITE_FEATURE_FILE_UPLOAD === 'true',
    REAL_TIME_TYPING: import.meta.env.VITE_FEATURE_TYPING_INDICATORS === 'true',
    MESSAGE_REACTIONS: import.meta.env.VITE_FEATURE_MESSAGE_REACTIONS === 'true',
    CONVERSATION_SHARING: import.meta.env.VITE_FEATURE_SHARING === 'true',
    DARK_MODE: import.meta.env.VITE_FEATURE_DARK_MODE === 'true',
    ANALYTICS: import.meta.env.VITE_FEATURE_ANALYTICS === 'true',
    EXPORT_IMPORT: import.meta.env.VITE_FEATURE_EXPORT_IMPORT === 'true',
    ADMIN_PANEL: import.meta.env.VITE_FEATURE_ADMIN_PANEL === 'true',
    NOTIFICATIONS: import.meta.env.VITE_FEATURE_NOTIFICATIONS === 'true',
  };
  
  // Development flags
  export const DEV_FLAGS = {
    MOCK_API: import.meta.env.VITE_USE_MOCK_API === 'true',
    DEBUG_MODE: import.meta.env.DEV,
    SHOW_PERFORMANCE: import.meta.env.VITE_SHOW_PERFORMANCE === 'true',
    ENABLE_LOGGING: import.meta.env.VITE_ENABLE_LOGGING === 'true',
    BYPASS_AUTH: import.meta.env.VITE_BYPASS_AUTH === 'true',
  };
  
  // Regular expressions
  export const REGEX_PATTERNS = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
    PHONE: /^[\+]?[1-9][\d]{0,15}$/,
    ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
    FILENAME: /^[a-zA-Z0-9._-]+$/,
    HASHTAG: /#[a-zA-Z0-9_]+/g,
    MENTION: /@[a-zA-Z0-9_]+/g,
    MARKDOWN_LINK: /\[([^\]]+)\]\(([^\)]+)\)/g,
    MARKDOWN_BOLD: /\*\*([^\*]+)\*\*/g,
    MARKDOWN_ITALIC: /\*([^\*]+)\*/g,
    MARKDOWN_CODE: /`([^`]+)`/g,
  };
  
  // Default values
  export const DEFAULTS = {
    THEME_MODE: THEME_MODES.SYSTEM,
    FONT_SIZE: 'medium',
    FONT_FAMILY: 'inter',
    LANGUAGE: 'en',
    ANIMATIONS_ENABLED: true,
    NOTIFICATIONS_ENABLED: true,
    SOUND_ENABLED: true,
    TYPING_INDICATORS_ENABLED: true,
    READ_RECEIPTS_ENABLED: true,
    AUTO_SAVE_ENABLED: true,
    SIDEBAR_COLLAPSED: false,
    MESSAGE_PREVIEW_LENGTH: 100,
    SEARCH_DEBOUNCE_DELAY: 300,
    TYPING_TIMEOUT: 3000,
    HEARTBEAT_INTERVAL: 30000,
    CACHE_TTL: 300000, // 5 minutes
  };
  
  // Export all constants as a single object for convenience
  export const CONSTANTS = {
    APP_CONFIG,
    API_CONFIG,
    THEME_MODES,
    COLORS,
    BREAKPOINTS,
    Z_INDEX,
    MESSAGE_TYPES,
    MESSAGE_STATUS,
    SENDER_TYPES,
    CONVERSATION_STATUS,
    FILE_TYPES,
    SUPPORTED_DOCUMENT_TYPES,
    SUPPORTED_IMAGE_TYPES,
    FILE_SIZE_LIMITS,
    SOCKET_EVENTS,
    CONNECTION_STATUS,
    DOCUMENT_STATUS,
    SEARCH_TYPES,
    SORT_OPTIONS,
    NOTIFICATION_TYPES,
    ANIMATION_DURATION,
    KEYBOARD_SHORTCUTS,
    STORAGE_KEYS,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    VALIDATION_RULES,
    PAGINATION,
    TIME_CONSTANTS,
    FEATURE_FLAGS,
    DEV_FLAGS,
    REGEX_PATTERNS,
    DEFAULTS,
  };
  
  export default CONSTANTS;