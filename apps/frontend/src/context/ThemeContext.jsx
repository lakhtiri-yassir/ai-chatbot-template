import React, { createContext, useContext, useEffect, useState } from 'react';

// Theme configuration
const themes = {
  light: {
    name: 'light',
    colors: {
      primary: '#2563eb',
      primaryHover: '#1d4ed8',
      secondary: '#64748b',
      accent: '#0ea5e9',
      background: '#ffffff',
      surface: '#f8fafc',
      surfaceHover: '#f1f5f9',
      border: '#e2e8f0',
      borderHover: '#cbd5e1',
      text: '#1e293b',
      textSecondary: '#64748b',
      textMuted: '#94a3b8',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    },
    shadows: {
      sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    },
    gradients: {
      primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      secondary: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      success: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    },
  },
  dark: {
    name: 'dark',
    colors: {
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      secondary: '#64748b',
      accent: '#06b6d4',
      background: '#0f172a',
      surface: '#1e293b',
      surfaceHover: '#334155',
      border: '#334155',
      borderHover: '#475569',
      text: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    },
    shadows: {
      sm: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
      md: '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4)',
      lg: '0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.4)',
      xl: '0 20px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.4)',
    },
    gradients: {
      primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      secondary: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      success: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    },
  },
  system: {
    name: 'system',
    // System theme will use light/dark based on user's OS preference
  },
};

// Available theme modes
const THEME_MODES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
};

// Local storage key
const THEME_STORAGE_KEY = 'ai-chatbot-theme';

// Initial state
const initialState = {
  mode: THEME_MODES.SYSTEM,
  currentTheme: themes.light,
  isSystemDark: false,
  fontSize: 'medium',
  fontFamily: 'inter',
  animations: true,
  highContrast: false,
  reducedMotion: false,
};

// Create context
const ThemeContext = createContext();

// Theme provider component
export const ThemeProvider = ({ children }) => {
  const [state, setState] = useState(() => {
    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme) {
      try {
        return { ...initialState, ...JSON.parse(savedTheme) };
      } catch (error) {
        console.warn('Failed to parse saved theme:', error);
      }
    }
    return initialState;
  });

  // Detect system dark mode preference
  const [isSystemDark, setIsSystemDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
      setIsSystemDark(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // Detect reduced motion preference
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handleChange = (e) => {
      setState(prev => ({ ...prev, reducedMotion: e.matches }));
    };

    mediaQuery.addEventListener('change', handleChange);
    setState(prev => ({ ...prev, reducedMotion: mediaQuery.matches }));
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // Determine current theme based on mode and system preference
  const getCurrentTheme = () => {
    switch (state.mode) {
      case THEME_MODES.LIGHT:
        return themes.light;
      case THEME_MODES.DARK:
        return themes.dark;
      case THEME_MODES.SYSTEM:
        return isSystemDark ? themes.dark : themes.light;
      default:
        return themes.light;
    }
  };

  // Update current theme when mode or system preference changes
  useEffect(() => {
    const currentTheme = getCurrentTheme();
    setState(prev => ({ 
      ...prev, 
      currentTheme,
      isSystemDark 
    }));
  }, [state.mode, isSystemDark]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    const theme = state.currentTheme;

    // Apply CSS custom properties
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    Object.entries(theme.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--shadow-${key}`, value);
    });

    Object.entries(theme.gradients).forEach(([key, value]) => {
      root.style.setProperty(`--gradient-${key}`, value);
    });

    // Apply theme class to body
    document.body.className = document.body.className
      .split(' ')
      .filter(cls => !cls.startsWith('theme-'))
      .concat(`theme-${theme.name}`)
      .join(' ');

    // Apply font size
    root.style.setProperty('--font-size-base', getFontSizeValue(state.fontSize));
    
    // Apply font family
    root.style.setProperty('--font-family-base', getFontFamilyValue(state.fontFamily));
    
    // Apply animation preferences
    root.style.setProperty('--animation-duration', state.animations ? '200ms' : '0ms');
    root.style.setProperty('--transition-duration', state.animations ? '150ms' : '0ms');
    
    // Apply accessibility preferences
    if (state.highContrast) {
      root.style.setProperty('--color-border', theme.colors.text);
      root.style.setProperty('--color-textSecondary', theme.colors.text);
    }
    
    if (state.reducedMotion) {
      root.style.setProperty('--animation-duration', '0ms');
      root.style.setProperty('--transition-duration', '0ms');
    }

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme.colors.primary);
    }
  }, [state]);

  // Save theme to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
    }
  }, [state]);

  // Helper functions
  const getFontSizeValue = (size) => {
    const sizes = {
      small: '14px',
      medium: '16px',
      large: '18px',
      xl: '20px',
    };
    return sizes[size] || sizes.medium;
  };

  const getFontFamilyValue = (family) => {
    const families = {
      inter: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
    };
    return families[family] || families.inter;
  };

  // Theme actions
  const actions = {
    setMode: (mode) => {
      if (Object.values(THEME_MODES).includes(mode)) {
        setState(prev => ({ ...prev, mode }));
      }
    },

    setFontSize: (fontSize) => {
      const validSizes = ['small', 'medium', 'large', 'xl'];
      if (validSizes.includes(fontSize)) {
        setState(prev => ({ ...prev, fontSize }));
      }
    },

    setFontFamily: (fontFamily) => {
      const validFamilies = ['inter', 'system', 'mono'];
      if (validFamilies.includes(fontFamily)) {
        setState(prev => ({ ...prev, fontFamily }));
      }
    },

    toggleAnimations: () => {
      setState(prev => ({ ...prev, animations: !prev.animations }));
    },

    setAnimations: (animations) => {
      setState(prev => ({ ...prev, animations }));
    },

    toggleHighContrast: () => {
      setState(prev => ({ ...prev, highContrast: !prev.highContrast }));
    },

    setHighContrast: (highContrast) => {
      setState(prev => ({ ...prev, highContrast }));
    },

    resetTheme: () => {
      setState(initialState);
      localStorage.removeItem(THEME_STORAGE_KEY);
    },

    // Quick theme switching
    toggleTheme: () => {
      const currentMode = state.mode;
      if (currentMode === THEME_MODES.LIGHT) {
        actions.setMode(THEME_MODES.DARK);
      } else if (currentMode === THEME_MODES.DARK) {
        actions.setMode(THEME_MODES.LIGHT);
      } else {
        // If system, switch to opposite of current system preference
        actions.setMode(isSystemDark ? THEME_MODES.LIGHT : THEME_MODES.DARK);
      }
    },
  };

  // Computed values
  const computed = {
    isDark: state.currentTheme.name === 'dark',
    isLight: state.currentTheme.name === 'light',
    isSystemMode: state.mode === THEME_MODES.SYSTEM,
    effectiveTheme: state.currentTheme.name,
    canAnimate: state.animations && !state.reducedMotion,
  };

  // CSS-in-JS helper for dynamic styles
  const getStyles = (styles) => {
    if (typeof styles === 'function') {
      return styles(state.currentTheme);
    }
    return styles;
  };

  // CSS class helper
  const getThemeClasses = (...classes) => {
    return classes
      .filter(Boolean)
      .map(cls => `${cls} theme-${state.currentTheme.name}`)
      .join(' ');
  };

  const value = {
    ...state,
    ...actions,
    ...computed,
    themes,
    THEME_MODES,
    getStyles,
    getThemeClasses,
    getCurrentTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Higher-order component for theme-aware components
export const withTheme = (Component) => {
  return function ThemedComponent(props) {
    const theme = useTheme();
    return <Component {...props} theme={theme} />;
  };
};

// CSS-in-JS styled component helper
export const styled = {
  create: (baseStyles) => (theme) => ({
    ...baseStyles,
    ...(typeof baseStyles === 'function' ? baseStyles(theme) : {}),
  }),
};

export { THEME_MODES };
export default ThemeContext;