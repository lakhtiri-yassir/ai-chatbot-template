import axios from 'axios';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_TIMEOUT = 30000; // 30 seconds

// Create axios instance with default configuration
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor for authentication and logging
api.interceptors.request.use(
  (config) => {
    // Add timestamp to prevent caching
    config.params = {
      ...config.params,
      _t: Date.now(),
    };

    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add request ID for tracking
    config.metadata = {
      startTime: Date.now(),
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    // Log request in development
    if (import.meta.env.DEV) {
      console.log(`🚀 API Request [${config.metadata.requestId}]:`, {
        method: config.method?.toUpperCase(),
        url: config.url,
        params: config.params,
        data: config.data,
      });
    }

    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and logging
api.interceptors.response.use(
  (response) => {
    const { config } = response;
    const duration = Date.now() - config.metadata.startTime;

    // Log response in development
    if (import.meta.env.DEV) {
      console.log(`✅ API Response [${config.metadata.requestId}] (${duration}ms):`, {
        status: response.status,
        data: response.data,
      });
    }

    return response;
  },
  (error) => {
    const { config, response } = error;
    const duration = config?.metadata ? Date.now() - config.metadata.startTime : 0;

    // Log error in development
    if (import.meta.env.DEV) {
      console.error(`❌ API Error [${config?.metadata?.requestId}] (${duration}ms):`, {
        status: response?.status,
        message: error.message,
        data: response?.data,
      });
    }

    // Handle different error types
    if (response) {
      // Server responded with error status
      const errorData = response.data;
      
      switch (response.status) {
        case 401:
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('auth_token');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          break;
        case 403:
          // Forbidden
          throw new APIError('Access forbidden', 403, errorData);
        case 404:
          // Not found
          throw new APIError('Resource not found', 404, errorData);
        case 422:
          // Validation error
          throw new APIError('Validation failed', 422, errorData);
        case 429:
          // Rate limit exceeded
          throw new APIError('Rate limit exceeded', 429, errorData);
        case 500:
          // Server error
          throw new APIError('Internal server error', 500, errorData);
        default:
          throw new APIError(
            errorData?.message || 'An error occurred',
            response.status,
            errorData
          );
      }
    } else if (error.request) {
      // Network error
      throw new APIError('Network error - please check your connection', 0, {
        type: 'network',
        originalError: error.message,
      });
    } else {
      // Request setup error
      throw new APIError('Request configuration error', 0, {
        type: 'config',
        originalError: error.message,
      });
    }
  }
);

// Custom API Error class
export class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

// API utility functions
export const apiUtils = {
  // Build URL with query parameters
  buildUrl: (endpoint, params = {}) => {
    const url = new URL(endpoint, API_BASE_URL);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
    return url.toString();
  },

  // Format form data for file uploads
  createFormData: (data, options = {}) => {
    const formData = new FormData();
    
    Object.entries(data).forEach(([key, value]) => {
      if (value instanceof File) {
        formData.append(key, value);
      } else if (value instanceof Array) {
        value.forEach((item, index) => {
          if (item instanceof File) {
            formData.append(`${key}[${index}]`, item);
          } else {
            formData.append(`${key}[${index}]`, JSON.stringify(item));
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, value);
      }
    });
    
    return formData;
  },

  // Handle file download
  downloadFile: async (url, filename, options = {}) => {
    try {
      const response = await api.get(url, {
        responseType: 'blob',
        ...options,
      });
      
      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      return response;
    } catch (error) {
      console.error('Download error:', error);
      throw error;
    }
  },

  // Upload with progress tracking
  uploadWithProgress: async (url, data, onProgress) => {
    try {
      const formData = apiUtils.createFormData(data);
      
      const response = await api.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(percentCompleted);
          }
        },
      });
      
      return response;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  },

  // Retry failed requests
  retryRequest: async (requestFn, maxRetries = 3, delay = 1000) => {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        
        if (i === maxRetries - 1) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
    
    throw lastError;
  },

  // Check if error is retryable
  isRetryableError: (error) => {
    if (!error.status) return true; // Network errors
    return error.status >= 500 || error.status === 429;
  },

  // Handle concurrent requests
  concurrent: async (requests, maxConcurrency = 5) => {
    const results = [];
    const executing = [];
    
    for (const request of requests) {
      const promise = Promise.resolve(request()).then(result => {
        executing.splice(executing.indexOf(promise), 1);
        return result;
      });
      
      results.push(promise);
      executing.push(promise);
      
      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
      }
    }
    
    return Promise.all(results);
  },
};

// Health check endpoint
export const healthCheck = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

// Generic CRUD operations
export const crud = {
  // GET request
  get: async (endpoint, params = {}) => {
    const response = await api.get(endpoint, { params });
    return response.data;
  },

  // POST request
  post: async (endpoint, data = {}) => {
    const response = await api.post(endpoint, data);
    return response.data;
  },

  // PUT request
  put: async (endpoint, data = {}) => {
    const response = await api.put(endpoint, data);
    return response.data;
  },

  // PATCH request
  patch: async (endpoint, data = {}) => {
    const response = await api.patch(endpoint, data);
    return response.data;
  },

  // DELETE request
  delete: async (endpoint) => {
    const response = await api.delete(endpoint);
    return response.data;
  },
};

// Request cancellation
export const cancelToken = {
  create: () => axios.CancelToken.source(),
  isCancel: (error) => axios.isCancel(error),
};

// Mock API for development
export const mockApi = {
  enabled: import.meta.env.VITE_USE_MOCK_API === 'true',
  
  delay: (ms = 1000) => new Promise(resolve => setTimeout(resolve, ms)),
  
  mockResponse: async (data, delay = 1000) => {
    if (mockApi.enabled) {
      await mockApi.delay(delay);
      return { data };
    }
    throw new Error('Mock API is not enabled');
  },
};

// Export configured axios instance
export default api;