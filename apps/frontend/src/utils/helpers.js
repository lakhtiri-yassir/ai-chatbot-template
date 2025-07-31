import {
  STORAGE_KEYS,
  REGEX_PATTERNS,
  FILE_TYPES,
  SUPPORTED_DOCUMENT_TYPES,
} from "./constants.js";

/**
 * Local storage utilities
 */
export const storage = {
  // Get item from localStorage with error handling
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn(`Error reading from localStorage for key "${key}":`, error);
      return defaultValue;
    }
  },

  // Set item in localStorage with error handling
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`Error writing to localStorage for key "${key}":`, error);
      return false;
    }
  },

  // Remove item from localStorage
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`Error removing from localStorage for key "${key}":`, error);
      return false;
    }
  },

  // Clear all localStorage
  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.warn("Error clearing localStorage:", error);
      return false;
    }
  },

  // Check if localStorage is available
  isAvailable: () => {
    try {
      const test = "__localStorage_test__";
      localStorage.setItem(test, "test");
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  },

  // Get storage usage information
  getUsage: () => {
    if (!storage.isAvailable()) return null;

    let totalSize = 0;
    const items = {};

    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        const value = localStorage.getItem(key);
        const size = new Blob([value]).size;
        items[key] = size;
        totalSize += size;
      }
    }

    return {
      totalSize,
      items,
      formattedSize: formatBytes(totalSize),
    };
  },
};

/**
 * Validation utilities
 */
export const validators = {
  // Email validation
  email: (email) => {
    return REGEX_PATTERNS.EMAIL.test(email);
  },

  // URL validation
  url: (url) => {
    return REGEX_PATTERNS.URL.test(url);
  },

  // Phone number validation
  phone: (phone) => {
    return REGEX_PATTERNS.PHONE.test(phone);
  },

  // Filename validation
  filename: (filename) => {
    return REGEX_PATTERNS.FILENAME.test(filename);
  },

  // File type validation
  fileType: (file, allowedTypes = SUPPORTED_DOCUMENT_TYPES) => {
    return allowedTypes.includes(file.type);
  },

  // File size validation
  fileSize: (file, maxSize) => {
    return file.size <= maxSize;
  },

  // Required field validation
  required: (value) => {
    return value !== null && value !== undefined && value !== "";
  },

  // Minimum length validation
  minLength: (value, min) => {
    return value && value.length >= min;
  },

  // Maximum length validation
  maxLength: (value, max) => {
    return value && value.length <= max;
  },

  // Range validation
  range: (value, min, max) => {
    const num = parseFloat(value);
    return !isNaN(num) && num >= min && num <= max;
  },

  // JSON validation
  json: (value) => {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  },

  // Password strength validation
  passwordStrength: (password) => {
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasMinLength = password.length >= 8;

    const score = [
      hasLower,
      hasUpper,
      hasNumber,
      hasSymbol,
      hasMinLength,
    ].filter(Boolean).length;

    return {
      score,
      isValid: score >= 3,
      strength: score <= 2 ? "weak" : score <= 4 ? "medium" : "strong",
      requirements: {
        hasLower,
        hasUpper,
        hasNumber,
        hasSymbol,
        hasMinLength,
      },
    };
  },
};

/**
 * Utility functions
 */
export const utils = {
  // Generate unique ID
  generateId: (prefix = "id") => {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 9);
    return `${prefix}_${timestamp}_${randomStr}`;
  },

  // Generate UUID v4
  generateUUID: () => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  // Deep clone object
  deepClone: (obj) => {
    if (obj === null || typeof obj !== "object") return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map((item) => utils.deepClone(item));
    if (typeof obj === "object") {
      const cloned = {};
      Object.keys(obj).forEach((key) => {
        cloned[key] = utils.deepClone(obj[key]);
      });
      return cloned;
    }
  },

  // Deep merge objects
  deepMerge: (target, source) => {
    const result = { ...target };

    Object.keys(source).forEach((key) => {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        result[key] = utils.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    });

    return result;
  },

  // Check if object is empty
  isEmpty: (obj) => {
    if (obj === null || obj === undefined) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === "object") return Object.keys(obj).length === 0;
    if (typeof obj === "string") return obj.trim().length === 0;
    return false;
  },

  // Pick specific properties from object
  pick: (obj, keys) => {
    const result = {};
    keys.forEach((key) => {
      if (key in obj) {
        result[key] = obj[key];
      }
    });
    return result;
  },

  // Omit specific properties from object
  omit: (obj, keys) => {
    const result = { ...obj };
    keys.forEach((key) => {
      delete result[key];
    });
    return result;
  },

  // Flatten nested object
  flatten: (obj, prefix = "") => {
    const flattened = {};

    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === "object" && !Array.isArray(value)) {
        Object.assign(flattened, utils.flatten(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    });

    return flattened;
  },

  // Group array by property
  groupBy: (array, key) => {
    return array.reduce((groups, item) => {
      const group = item[key];
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  },

  // Sort array by property
  sortBy: (array, key, order = "asc") => {
    return array.sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];

      if (aVal < bVal) return order === "asc" ? -1 : 1;
      if (aVal > bVal) return order === "asc" ? 1 : -1;
      return 0;
    });
  },

  // Remove duplicates from array
  unique: (array, key = null) => {
    if (key) {
      const seen = new Set();
      return array.filter((item) => {
        const value = item[key];
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
      });
    }
    return [...new Set(array)];
  },

  // Chunk array into smaller arrays
  chunk: (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  },

  // Shuffle array
  shuffle: (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  // Sample random items from array
  sample: (array, count = 1) => {
    const shuffled = utils.shuffle(array);
    return shuffled.slice(0, count);
  },
};

/**
 * Debounce function
 */
export const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

/**
 * Throttle function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Async utilities
 */
export const asyncUtils = {
  // Sleep/delay function
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

  // Timeout wrapper for promises
  timeout: (promise, ms) => {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Operation timeout")), ms)
      ),
    ]);
  },

  // Retry function with exponential backoff
  retry: async (fn, maxAttempts = 3, delay = 1000) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        await asyncUtils.sleep(delay * Math.pow(2, attempt - 1));
      }
    }
  },

  // Batch async operations
  batch: async (items, asyncFn, batchSize = 10) => {
    const results = [];
    const chunks = utils.chunk(items, batchSize);

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(chunk.map(asyncFn));
      results.push(...chunkResults);
    }

    return results;
  },

  // Queue async operations
  queue: (concurrency = 1) => {
    const queue = [];
    let running = 0;

    const process = async () => {
      if (running >= concurrency || queue.length === 0) return;

      running++;
      const { fn, resolve, reject } = queue.shift();

      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        running--;
        process();
      }
    };

    return {
      add: (fn) => {
        return new Promise((resolve, reject) => {
          queue.push({ fn, resolve, reject });
          process();
        });
      },
      size: () => queue.length,
      running: () => running,
    };
  },
};

/**
 * File utilities
 */
export const fileUtils = {
  // Read file as text
  readAsText: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  },

  // Read file as data URL
  readAsDataURL: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // Read file as array buffer
  readAsArrayBuffer: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  },

  // Get file extension
  getExtension: (filename) => {
    return filename.split(".").pop()?.toLowerCase() || "";
  },

  // Get file name without extension
  getNameWithoutExtension: (filename) => {
    return filename.replace(/\.[^/.]+$/, "");
  },

  // Check if file is image
  isImage: (file) => {
    return file.type.startsWith("image/");
  },

  // Check if file is document
  isDocument: (file) => {
    return SUPPORTED_DOCUMENT_TYPES.includes(file.type);
  },

  // Create file from blob
  createFile: (blob, filename, type) => {
    return new File([blob], filename, { type });
  },

  // Download file
  download: (data, filename, type = "text/plain") => {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

/**
 * Format bytes to human readable format
 */
export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand("copy");
      return true;
    } catch (err) {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
};

/**
 * Scroll to element
 */
export const scrollToElement = (element, options = {}) => {
  const defaultOptions = {
    behavior: "smooth",
    block: "center",
    inline: "nearest",
  };

  if (element) {
    element.scrollIntoView({ ...defaultOptions, ...options });
  }
};

/**
 * Check if element is in viewport
 */
export const isInViewport = (element) => {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <=
      (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
};

/**
 * Get device information
 */
export const getDeviceInfo = () => {
  const ua = navigator.userAgent;

  return {
    isMobile:
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua),
    isTablet: /iPad|Android(?!.*Mobile)/i.test(ua),
    isDesktop:
      !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        ua
      ),
    isIOS: /iPad|iPhone|iPod/.test(ua),
    isAndroid: /Android/.test(ua),
    isSafari: /^((?!chrome|android).)*safari/i.test(ua),
    isChrome: /Chrome/.test(ua),
    isFirefox: /Firefox/.test(ua),
    isEdge: /Edge/.test(ua),
    userAgent: ua,
  };
};

/**
 * Color utilities
 */
export const colorUtils = {
  // Convert hex to RGB
  hexToRgb: (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  },

  // Convert RGB to hex
  rgbToHex: (r, g, b) => {
    return (
      "#" +
      [r, g, b]
        .map((x) => {
          const hex = x.toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        })
        .join("")
    );
  },

  // Generate random color
  randomColor: () => {
    return "#" + Math.floor(Math.random() * 16777215).toString(16);
  },

  // Check if color is light
  isLight: (hex) => {
    const rgb = colorUtils.hexToRgb(hex);
    if (!rgb) return false;
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness > 155;
  },
};

/**
 * Export all utilities
 */
export const helpers = {
  storage,
  validators,
  utils,
  debounce,
  throttle,
  asyncUtils,
  fileUtils,
  formatBytes,
  copyToClipboard,
  scrollToElement,
  isInViewport,
  getDeviceInfo,
  colorUtils,
};

export default helpers;
