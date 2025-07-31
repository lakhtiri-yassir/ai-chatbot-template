import { TIME_CONSTANTS } from "./constants.js";

/**
 * Date and time formatting utilities
 */
export const dateFormatters = {
  // Format timestamp to relative time (e.g., "2 minutes ago")
  relative: (timestamp) => {
    if (!timestamp) return "";

    try {
      const now = new Date();
      const date = new Date(timestamp);
      const diff = now.getTime() - date.getTime();

      if (diff < TIME_CONSTANTS.MINUTE) {
        return "just now";
      } else if (diff < TIME_CONSTANTS.HOUR) {
        const minutes = Math.floor(diff / TIME_CONSTANTS.MINUTE);
        return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
      } else if (diff < TIME_CONSTANTS.DAY) {
        const hours = Math.floor(diff / TIME_CONSTANTS.HOUR);
        return `${hours} hour${hours > 1 ? "s" : ""} ago`;
      } else if (diff < TIME_CONSTANTS.WEEK) {
        const days = Math.floor(diff / TIME_CONSTANTS.DAY);
        return `${days} day${days > 1 ? "s" : ""} ago`;
      } else if (diff < TIME_CONSTANTS.MONTH) {
        const weeks = Math.floor(diff / TIME_CONSTANTS.WEEK);
        return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
      } else if (diff < TIME_CONSTANTS.YEAR) {
        const months = Math.floor(diff / TIME_CONSTANTS.MONTH);
        return `${months} month${months > 1 ? "s" : ""} ago`;
      } else {
        const years = Math.floor(diff / TIME_CONSTANTS.YEAR);
        return `${years} year${years > 1 ? "s" : ""} ago`;
      }
    } catch (error) {
      return "";
    }
  },

  // Format timestamp to short time (e.g., "2:30 PM")
  shortTime: (timestamp) => {
    if (!timestamp) return "";

    try {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      return "";
    }
  },

  // Format timestamp to short date (e.g., "Dec 25")
  shortDate: (timestamp) => {
    if (!timestamp) return "";

    try {
      return new Date(timestamp).toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      return "";
    }
  },

  // Format timestamp to long date (e.g., "December 25, 2023")
  longDate: (timestamp) => {
    if (!timestamp) return "";

    try {
      return new Date(timestamp).toLocaleDateString([], {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      return "";
    }
  },

  // Format timestamp to full date and time
  fullDateTime: (timestamp) => {
    if (!timestamp) return "";

    try {
      return new Date(timestamp).toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      return "";
    }
  },

  // Format timestamp for chat messages (smart formatting)
  chatMessage: (timestamp) => {
    if (!timestamp) return "";

    try {
      const now = new Date();
      const date = new Date(timestamp);
      const diff = now.getTime() - date.getTime();

      if (diff < TIME_CONSTANTS.DAY) {
        return dateFormatters.shortTime(timestamp);
      } else if (diff < TIME_CONSTANTS.WEEK) {
        return date.toLocaleDateString([], { weekday: "short" });
      } else {
        return dateFormatters.shortDate(timestamp);
      }
    } catch (error) {
      return "";
    }
  },

  // Format timestamp for conversation list
  conversationList: (timestamp) => {
    if (!timestamp) return "";

    try {
      const now = new Date();
      const date = new Date(timestamp);
      const diff = now.getTime() - date.getTime();

      if (diff < TIME_CONSTANTS.MINUTE) {
        return "now";
      } else if (diff < TIME_CONSTANTS.HOUR) {
        const minutes = Math.floor(diff / TIME_CONSTANTS.MINUTE);
        return `${minutes}m`;
      } else if (diff < TIME_CONSTANTS.DAY) {
        const hours = Math.floor(diff / TIME_CONSTANTS.HOUR);
        return `${hours}h`;
      } else if (diff < TIME_CONSTANTS.WEEK) {
        const days = Math.floor(diff / TIME_CONSTANTS.DAY);
        return `${days}d`;
      } else {
        return dateFormatters.shortDate(timestamp);
      }
    } catch (error) {
      return "";
    }
  },

  // Format duration (e.g., "2h 30m")
  duration: (milliseconds) => {
    if (!milliseconds || milliseconds < 0) return "0s";

    const hours = Math.floor(milliseconds / TIME_CONSTANTS.HOUR);
    const minutes = Math.floor(
      (milliseconds % TIME_CONSTANTS.HOUR) / TIME_CONSTANTS.MINUTE
    );
    const seconds = Math.floor((milliseconds % TIME_CONSTANTS.MINUTE) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  },
};

/**
 * File size formatting utilities
 */
export const fileSizeFormatters = {
  // Format bytes to human readable format
  humanReadable: (bytes, decimals = 2) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    if (bytes < 0) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  },

  // Format upload progress
  uploadProgress: (loaded, total) => {
    if (!loaded || !total || total === 0) {
      return {
        percentage: 0,
        text: "0 Bytes / 0 Bytes",
        loaded: "0 Bytes",
        total: "0 Bytes",
      };
    }

    const percentage = Math.round((loaded / total) * 100);
    const loadedFormatted = fileSizeFormatters.humanReadable(loaded);
    const totalFormatted = fileSizeFormatters.humanReadable(total);

    return {
      percentage,
      text: `${loadedFormatted} / ${totalFormatted}`,
      loaded: loadedFormatted,
      total: totalFormatted,
    };
  },
};

/**
 * Number formatting utilities
 */
export const numberFormatters = {
  // Format number with thousand separators
  thousands: (num) => {
    if (num === null || num === undefined || isNaN(num)) return "0";
    return new Intl.NumberFormat().format(num);
  },

  // Format number to compact form (e.g., 1.2K, 1.5M)
  compact: (num) => {
    if (num === null || num === undefined || isNaN(num)) return "0";
    return new Intl.NumberFormat("en", { notation: "compact" }).format(num);
  },

  // Format percentage
  percentage: (num, decimals = 1) => {
    if (num === null || num === undefined || isNaN(num)) return "0%";
    return `${(num * 100).toFixed(decimals)}%`;
  },

  // Format decimal percentage
  decimalPercentage: (num, decimals = 1) => {
    if (num === null || num === undefined || isNaN(num)) return "0%";
    return `${num.toFixed(decimals)}%`;
  },

  // Format currency
  currency: (amount, currency = "USD") => {
    if (amount === null || amount === undefined || isNaN(amount))
      return "$0.00";

    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }).format(amount);
    } catch (error) {
      return `$${amount.toFixed(2)}`;
    }
  },

  // Format ordinal numbers (1st, 2nd, 3rd, etc.)
  ordinal: (num) => {
    if (num === null || num === undefined || isNaN(num)) return "0th";

    const suffixes = ["th", "st", "nd", "rd"];
    const v = num % 100;
    return num + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
  },

  // Format file count
  fileCount: (count) => {
    if (!count || count === 0) return "No files";
    if (count === 1) return "1 file";
    return `${numberFormatters.thousands(count)} files`;
  },

  // Format message count
  messageCount: (count) => {
    if (!count || count === 0) return "No messages";
    if (count === 1) return "1 message";
    return `${numberFormatters.thousands(count)} messages`;
  },
};

/**
 * Text formatting utilities
 */
export const textFormatters = {
  // Truncate text with ellipsis
  truncate: (text, maxLength = 100, suffix = "...") => {
    if (!text || typeof text !== "string") return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
  },

  // Capitalize first letter
  capitalize: (text) => {
    if (!text || typeof text !== "string") return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  },

  // Convert to title case
  titleCase: (text) => {
    if (!text || typeof text !== "string") return "";
    return text.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  },

  // Convert to camel case
  camelCase: (text) => {
    if (!text || typeof text !== "string") return "";
    return text
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
      })
      .replace(/\s+/g, "");
  },

  // Convert to kebab case
  kebabCase: (text) => {
    if (!text || typeof text !== "string") return "";
    return text.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  },

  // Convert to snake case
  snakeCase: (text) => {
    if (!text || typeof text !== "string") return "";
    return text.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  },

  // Remove HTML tags
  stripHtml: (html) => {
    if (!html || typeof html !== "string") return "";
    return html.replace(/<[^>]*>/g, "");
  },

  // Format initials from name
  initials: (name, maxLength = 2) => {
    if (!name || typeof name !== "string") return "";
    const words = name.trim().split(" ");
    const initials = words.map((word) => word.charAt(0).toUpperCase()).join("");
    return initials.substring(0, maxLength);
  },

  // Format file extension
  fileExtension: (filename) => {
    if (!filename || typeof filename !== "string") return "";
    const ext = filename.split(".").pop();
    return ext ? `.${ext.toLowerCase()}` : "";
  },

  // Format filename without extension
  filenameWithoutExtension: (filename) => {
    if (!filename || typeof filename !== "string") return "";
    return filename.replace(/\.[^/.]+$/, "");
  },

  // Format search query highlight
  highlightSearch: (text, query) => {
    if (
      !text ||
      !query ||
      typeof text !== "string" ||
      typeof query !== "string"
    )
      return text;
    const regex = new RegExp(`(${query})`, "gi");
    return text.replace(regex, "<mark>$1</mark>");
  },

  // Format plural/singular
  pluralize: (count, singular, plural = null) => {
    if (count === 1) return singular;
    return plural || singular + "s";
  },

  // Format word count
  wordCount: (text) => {
    if (!text || typeof text !== "string") return 0;
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  },

  // Format character count
  characterCount: (text) => {
    if (!text || typeof text !== "string") return 0;
    return text.length;
  },

  // Format reading time estimate
  readingTime: (text, wordsPerMinute = 200) => {
    if (!text || typeof text !== "string") return "0 min read";

    const words = textFormatters.wordCount(text);
    const minutes = Math.ceil(words / wordsPerMinute);
    return `${minutes} min read`;
  },
};

/**
 * Message formatting utilities
 */
export const messageFormatters = {
  // Format message preview for conversation list
  preview: (content, maxLength = 100) => {
    if (!content || typeof content !== "string") return "";

    // Strip markdown and HTML
    const cleanContent = content
      .replace(/[#*`_~\[\]()]/g, "")
      .replace(/<[^>]*>/g, "")
      .trim();

    return textFormatters.truncate(cleanContent, maxLength);
  },

  // Format typing indicator message
  typingIndicator: (users) => {
    if (!users || !Array.isArray(users) || users.length === 0) return "";

    const names = users.map((user) => user.name || user.userId || "Unknown");

    if (names.length === 1) {
      return `${names[0]} is typing...`;
    } else if (names.length === 2) {
      return `${names[0]} and ${names[1]} are typing...`;
    } else {
      return `${names[0]} and ${names.length - 1} others are typing...`;
    }
  },

  // Format message status
  status: (status) => {
    if (!status) return "";

    const statusMap = {
      sending: "Sending...",
      sent: "Sent",
      delivered: "Delivered",
      read: "Read",
      failed: "Failed to send",
    };

    return statusMap[status] || status;
  },

  // Format message sender
  sender: (message) => {
    if (!message) return "";

    if (message.sender === "user") {
      return "You";
    } else if (message.sender === "assistant") {
      return "Assistant";
    } else if (message.sender === "system") {
      return "System";
    }

    return message.senderName || message.sender || "Unknown";
  },

  // Format message type icon
  typeIcon: (type) => {
    if (!type) return "💬";

    const iconMap = {
      text: "💬",
      image: "🖼️",
      file: "📎",
      audio: "🎵",
      video: "🎥",
      system: "⚙️",
      error: "❌",
    };

    return iconMap[type] || "💬";
  },
};

/**
 * URL and link formatting utilities
 */
export const urlFormatters = {
  // Format URL to display format
  display: (url) => {
    if (!url || typeof url !== "string") return "";

    try {
      const urlObj = new URL(url);
      return urlObj.hostname + urlObj.pathname;
    } catch (error) {
      return url;
    }
  },

  // Format URL to show domain only
  domain: (url) => {
    if (!url || typeof url !== "string") return "";

    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return url;
    }
  },

  // Add protocol if missing
  addProtocol: (url) => {
    if (!url || typeof url !== "string") return "";

    if (!/^https?:\/\//i.test(url)) {
      return `https://${url}`;
    }

    return url;
  },

  // Check if URL is valid
  isValid: (url) => {
    if (!url || typeof url !== "string") return false;

    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  },
};

/**
 * Error formatting utilities
 */
export const errorFormatters = {
  // Format API error message
  apiError: (error) => {
    if (!error) return "An unexpected error occurred";

    if (error.message) {
      return error.message;
    } else if (error.data && error.data.message) {
      return error.data.message;
    } else if (typeof error === "string") {
      return error;
    }

    return "An unexpected error occurred";
  },

  // Format validation errors
  validationErrors: (errors) => {
    if (!errors) return [];

    if (Array.isArray(errors)) {
      return errors.map((error) => errorFormatters.apiError(error));
    } else if (typeof errors === "object") {
      return Object.values(errors)
        .flat()
        .map((error) => errorFormatters.apiError(error));
    }

    return [errorFormatters.apiError(errors)];
  },

  // Format network error
  networkError: (error) => {
    if (!error) return "Network error occurred";

    if (error.code === "NETWORK_ERROR") {
      return "Please check your internet connection";
    } else if (error.code === "TIMEOUT") {
      return "Request timeout - please try again";
    } else if (error.status === 0) {
      return "Unable to connect to server";
    }

    return errorFormatters.apiError(error);
  },
};

/**
 * Search and filter formatting utilities
 */
export const searchFormatters = {
  // Format search results count
  resultsCount: (count, query = "") => {
    if (!count || count === 0) {
      return query ? `No results for "${query}"` : "No results found";
    } else if (count === 1) {
      return query ? `1 result for "${query}"` : "1 result found";
    } else {
      const formattedCount = numberFormatters.thousands(count);
      return query
        ? `${formattedCount} results for "${query}"`
        : `${formattedCount} results found`;
    }
  },

  // Format search query for display
  queryDisplay: (query) => {
    if (!query || typeof query !== "string") return "";
    return textFormatters.truncate(query, 50);
  },

  // Format search filters
  filtersDisplay: (filters) => {
    if (
      !filters ||
      typeof filters !== "object" ||
      Object.keys(filters).length === 0
    )
      return "";

    const activeFilters = Object.entries(filters)
      .filter(
        ([_, value]) => value !== null && value !== undefined && value !== ""
      )
      .map(([key, value]) => {
        const formattedKey = textFormatters.titleCase(
          key.replace(/([A-Z])/g, " $1")
        );
        return `${formattedKey}: ${value}`;
      });

    return activeFilters.join(", ");
  },
};

/**
 * Conversation formatting utilities
 */
export const conversationFormatters = {
  // Format conversation title
  title: (conversation) => {
    if (!conversation) return "Untitled Conversation";

    if (conversation.title) {
      return conversation.title;
    } else if (conversation.messages && conversation.messages.length > 0) {
      const firstMessage = conversation.messages[0];
      return textFormatters.truncate(firstMessage.content, 50);
    }

    return "New Conversation";
  },

  // Format conversation subtitle (last message preview)
  subtitle: (conversation) => {
    if (!conversation || !conversation.lastMessage) return "";

    return messageFormatters.preview(conversation.lastMessage.content, 60);
  },

  // Format conversation participant count
  participantCount: (count) => {
    if (!count || count <= 1) return "";
    return `${count} participants`;
  },

  // Format conversation status
  status: (status) => {
    if (!status) return "";

    const statusMap = {
      active: "Active",
      archived: "Archived",
      deleted: "Deleted",
    };

    return statusMap[status] || status;
  },
};

/**
 * Document formatting utilities
 */
export const documentFormatters = {
  // Format document title
  title: (document) => {
    if (!document) return "Untitled Document";

    return (
      document.title ||
      document.originalName ||
      document.filename ||
      "Untitled Document"
    );
  },

  // Format document type
  type: (document) => {
    if (!document || !document.type) return "Unknown";

    const typeMap = {
      "application/pdf": "PDF",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "Word Document",
      "application/msword": "Word Document",
      "text/plain": "Text File",
      "text/markdown": "Markdown",
      "application/json": "JSON",
      "text/csv": "CSV",
    };

    return typeMap[document.type] || textFormatters.titleCase(document.type);
  },

  // Format document status
  status: (status) => {
    if (!status) return "";

    const statusMap = {
      uploading: "Uploading...",
      processing: "Processing...",
      completed: "Ready",
      failed: "Failed",
      deleted: "Deleted",
    };

    return statusMap[status] || status;
  },

  // Format document metadata
  metadata: (document) => {
    if (!document) return "";

    const parts = [];

    if (document.size) {
      parts.push(fileSizeFormatters.humanReadable(document.size));
    }

    if (document.pageCount) {
      parts.push(
        `${document.pageCount} page${document.pageCount !== 1 ? "s" : ""}`
      );
    }

    if (document.wordCount) {
      parts.push(
        `${numberFormatters.thousands(document.wordCount)} word${
          document.wordCount !== 1 ? "s" : ""
        }`
      );
    }

    if (document.createdAt) {
      parts.push(`Created ${dateFormatters.relative(document.createdAt)}`);
    }

    return parts.join(" • ");
  },
};

/**
 * User formatting utilities
 */
export const userFormatters = {
  // Format user display name
  displayName: (user) => {
    if (!user) return "Unknown User";

    return (
      user.displayName ||
      user.name ||
      user.username ||
      user.email ||
      "Unknown User"
    );
  },

  // Format user initials
  initials: (user) => {
    if (!user) return "U";

    const name = userFormatters.displayName(user);
    return textFormatters.initials(name);
  },

  // Format user status
  status: (user) => {
    if (!user) return "offline";

    return user.status || "offline";
  },

  // Format user role
  role: (user) => {
    if (!user || !user.role) return "";

    return textFormatters.titleCase(user.role);
  },
};

/**
 * Notification formatting utilities
 */
export const notificationFormatters = {
  // Format notification title
  title: (notification) => {
    if (!notification) return "";

    return notification.title || "Notification";
  },

  // Format notification message
  message: (notification) => {
    if (!notification) return "";

    return notification.message || notification.body || "";
  },

  // Format notification type
  type: (type) => {
    if (!type) return "";

    const typeMap = {
      success: "Success",
      error: "Error",
      warning: "Warning",
      info: "Info",
    };

    return typeMap[type] || type;
  },
};

/**
 * Export all formatters
 */
export const formatters = {
  date: dateFormatters,
  fileSize: fileSizeFormatters,
  number: numberFormatters,
  text: textFormatters,
  message: messageFormatters,
  url: urlFormatters,
  error: errorFormatters,
  search: searchFormatters,
  conversation: conversationFormatters,
  document: documentFormatters,
  user: userFormatters,
  notification: notificationFormatters,
};

export default formatters;
