import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "./useSocket";

/**
 * Typing indicator hook with debouncing and auto-cleanup
 */
export const useTyping = (conversationId, options = {}) => {
  const {
    debounceDelay = 500,
    typingDuration = 3000,
    autoStop = true,
    enabled = true,
  } = options;

  const { startTyping, stopTyping, getTypingUsers, isConnected } = useSocket();

  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);

  const typingTimeoutRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // Update typing users when they change
  useEffect(() => {
    if (!conversationId) return;

    const users = getTypingUsers(conversationId);
    setTypingUsers(users);
  }, [conversationId, getTypingUsers]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Start typing indicator
  const startTypingIndicator = useCallback(() => {
    if (!enabled || !conversationId || !isConnected || isTypingRef.current) {
      return;
    }

    isTypingRef.current = true;
    setIsTyping(true);
    startTyping(conversationId);

    // Auto-stop typing after duration
    if (autoStop) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        stopTypingIndicator();
      }, typingDuration);
    }
  }, [
    enabled,
    conversationId,
    isConnected,
    autoStop,
    typingDuration,
    startTyping,
  ]);

  // Stop typing indicator
  const stopTypingIndicator = useCallback(() => {
    if (!conversationId || !isTypingRef.current) {
      return;
    }

    isTypingRef.current = false;
    setIsTyping(false);
    stopTyping(conversationId);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [conversationId, stopTyping]);

  // Debounced typing start
  const debouncedStartTyping = useCallback(() => {
    if (!enabled || !conversationId) return;

    // Clear existing debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // If already typing, refresh the timeout
    if (isTypingRef.current) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        stopTypingIndicator();
      }, typingDuration);
      return;
    }

    // Debounce the start typing
    debounceTimeoutRef.current = setTimeout(() => {
      startTypingIndicator();
    }, debounceDelay);
  }, [
    enabled,
    conversationId,
    debounceDelay,
    typingDuration,
    startTypingIndicator,
    stopTypingIndicator,
  ]);

  // Immediate stop (no debounce)
  const immediateStopTyping = useCallback(() => {
    // Clear debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    stopTypingIndicator();
  }, [stopTypingIndicator]);

  // Handle input change
  const handleInputChange = useCallback(
    (value) => {
      if (!enabled || !conversationId) return;

      if (value && value.trim().length > 0) {
        debouncedStartTyping();
      } else {
        immediateStopTyping();
      }
    },
    [enabled, conversationId, debouncedStartTyping, immediateStopTyping]
  );

  // Handle key press events
  const handleKeyPress = useCallback(
    (event) => {
      if (!enabled || !conversationId) return;

      // Stop typing on Enter (message sent)
      if (event.key === "Enter" && !event.shiftKey) {
        immediateStopTyping();
        return;
      }

      // Start typing on any other key
      if (
        event.key !== "Tab" &&
        event.key !== "Shift" &&
        event.key !== "Control"
      ) {
        debouncedStartTyping();
      }
    },
    [enabled, conversationId, debouncedStartTyping, immediateStopTyping]
  );

  // Handle blur (focus lost)
  const handleBlur = useCallback(() => {
    immediateStopTyping();
  }, [immediateStopTyping]);

  // Get typing status for specific user
  const isUserTyping = useCallback(
    (userId) => {
      return typingUsers.some((user) => user.userId === userId);
    },
    [typingUsers]
  );

  // Get typing message for display
  const getTypingMessage = useCallback(() => {
    const count = typingUsers.length;

    if (count === 0) return "";
    if (count === 1) return `${typingUsers[0].userId} is typing...`;
    if (count === 2)
      return `${typingUsers[0].userId} and ${typingUsers[1].userId} are typing...`;
    return `${typingUsers[0].userId} and ${count - 1} others are typing...`;
  }, [typingUsers]);

  // Get typing users display names
  const getTypingUsersDisplay = useCallback(
    (maxUsers = 3) => {
      const displayUsers = typingUsers.slice(0, maxUsers);
      const remaining = typingUsers.length - maxUsers;

      if (remaining > 0) {
        return [
          ...displayUsers,
          { userId: `+${remaining} more`, isPlaceholder: true },
        ];
      }

      return displayUsers;
    },
    [typingUsers]
  );

  // Check if anyone is typing
  const isAnyoneTyping = typingUsers.length > 0;

  // Reset typing state when conversation changes
  useEffect(() => {
    if (conversationId) {
      immediateStopTyping();
    }
  }, [conversationId, immediateStopTyping]);

  // Stop typing when disconnected
  useEffect(() => {
    if (!isConnected && isTypingRef.current) {
      setIsTyping(false);
      isTypingRef.current = false;
    }
  }, [isConnected]);

  return {
    // State
    isTyping,
    isAnyoneTyping,
    typingUsers,
    typingCount: typingUsers.length,

    // Actions
    startTyping: startTypingIndicator,
    stopTyping: stopTypingIndicator,

    // Event handlers
    handleInputChange,
    handleKeyPress,
    handleBlur,

    // Utilities
    isUserTyping,
    getTypingMessage,
    getTypingUsersDisplay,

    // Configuration
    isEnabled: enabled,
    debounceDelay,
    typingDuration,
  };
};

/**
 * Simplified typing hook for input components
 */
export const useTypingInput = (conversationId, options = {}) => {
  const typing = useTyping(conversationId, options);

  // Input event handlers
  const handleChange = useCallback(
    (event) => {
      const value = event.target.value;
      typing.handleInputChange(value);
    },
    [typing]
  );

  const handleKeyDown = useCallback(
    (event) => {
      typing.handleKeyPress(event);
    },
    [typing]
  );

  const handleFocus = useCallback(() => {
    // Focus-specific logic can be added here
  }, []);

  const handleBlur = useCallback(() => {
    typing.handleBlur();
  }, [typing]);

  // Props to spread on input components
  const inputProps = {
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onFocus: handleFocus,
    onBlur: handleBlur,
  };

  return {
    // Input props
    inputProps,

    // Typing state
    isTyping: typing.isTyping,
    isAnyoneTyping: typing.isAnyoneTyping,
    typingUsers: typing.typingUsers,
    typingCount: typing.typingCount,

    // Actions
    startTyping: typing.startTyping,
    stopTyping: typing.stopTyping,

    // Utilities
    isUserTyping: typing.isUserTyping,
    getTypingMessage: typing.getTypingMessage,
    getTypingUsersDisplay: typing.getTypingUsersDisplay,
  };
};

/**
 * Typing indicator display hook for UI components
 */
export const useTypingIndicator = (conversationId, options = {}) => {
  const {
    fadeDelay = 300,
    animationDuration = 200,
    ...typingOptions
  } = options;

  const typing = useTyping(conversationId, typingOptions);

  const [isVisible, setIsVisible] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  const fadeTimeoutRef = useRef(null);
  const animationTimeoutRef = useRef(null);

  // Handle visibility and animation states
  useEffect(() => {
    if (typing.isAnyoneTyping) {
      // Show immediately
      setIsVisible(true);

      // Start animation after a brief delay
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }

      animationTimeoutRef.current = setTimeout(() => {
        setShouldAnimate(true);
      }, 50);

      // Clear any existing fade timeout
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    } else {
      // Stop animation immediately
      setShouldAnimate(false);

      // Hide after fade delay
      fadeTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, fadeDelay);
    }

    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [typing.isAnyoneTyping, fadeDelay]);

  // Generate display message
  const displayMessage = typing.getTypingMessage();

  // Generate typing dots animation
  const getTypingDots = useCallback(() => {
    if (!shouldAnimate) return "...";

    // This would be used in conjunction with CSS animations
    return "...";
  }, [shouldAnimate]);

  // Get CSS classes for styling
  const getIndicatorClasses = useCallback(
    (baseClass = "") => {
      const classes = [baseClass];

      if (isVisible) classes.push("visible");
      if (shouldAnimate) classes.push("animate");
      if (typing.isAnyoneTyping) classes.push("typing");

      return classes.filter(Boolean).join(" ");
    },
    [isVisible, shouldAnimate, typing.isAnyoneTyping]
  );

  // Get inline styles for animation
  const getIndicatorStyles = useCallback(() => {
    return {
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? "translateY(0)" : "translateY(10px)",
      transition: `opacity ${animationDuration}ms ease-in-out, transform ${animationDuration}ms ease-in-out`,
    };
  }, [isVisible, animationDuration]);

  return {
    // State
    isVisible,
    shouldAnimate,
    displayMessage,
    typingUsers: typing.typingUsers,
    typingUsersDisplay: typing.getTypingUsersDisplay(),

    // Utilities
    getTypingDots,
    getIndicatorClasses,
    getIndicatorStyles,

    // Original typing state
    isTyping: typing.isTyping,
    isAnyoneTyping: typing.isAnyoneTyping,
    typingCount: typing.typingCount,
  };
};

/**
 * Advanced typing hook with customizable behaviors
 */
export const useAdvancedTyping = (conversationId, options = {}) => {
  const {
    enableSmartDelay = true,
    minTypingTime = 1000,
    maxTypingTime = 5000,
    adaptiveDelay = true,
    userActivityThreshold = 100,
    ...baseOptions
  } = options;

  const typing = useTyping(conversationId, baseOptions);

  const [activityLevel, setActivityLevel] = useState(0);
  const [smartDelay, setSmartDelay] = useState(
    baseOptions.debounceDelay || 500
  );

  const activityTimeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  // Track user activity for adaptive delay
  const trackActivity = useCallback(() => {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;

    if (timeSinceLastActivity < userActivityThreshold) {
      setActivityLevel((prev) => Math.min(prev + 1, 10));
    } else {
      setActivityLevel((prev) => Math.max(prev - 1, 0));
    }

    lastActivityRef.current = now;

    // Clear existing timeout
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    // Decrease activity after inactivity
    activityTimeoutRef.current = setTimeout(() => {
      setActivityLevel((prev) => Math.max(prev - 2, 0));
    }, 1000);
  }, [userActivityThreshold]);

  // Adaptive delay calculation
  useEffect(() => {
    if (adaptiveDelay) {
      const baseDelay = baseOptions.debounceDelay || 500;
      const activityMultiplier = 1 - activityLevel / 20; // Reduce delay for high activity
      const newDelay = Math.max(baseDelay * activityMultiplier, 100);
      setSmartDelay(newDelay);
    }
  }, [activityLevel, adaptiveDelay, baseOptions.debounceDelay]);

  // Enhanced input change handler
  const handleInputChange = useCallback(
    (value) => {
      if (enableSmartDelay) {
        trackActivity();
      }

      typing.handleInputChange(value);
    },
    [typing, enableSmartDelay, trackActivity]
  );

  // Enhanced key press handler
  const handleKeyPress = useCallback(
    (event) => {
      if (enableSmartDelay) {
        trackActivity();
      }

      typing.handleKeyPress(event);
    },
    [typing, enableSmartDelay, trackActivity]
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Enhanced handlers
    handleInputChange,
    handleKeyPress,
    handleBlur: typing.handleBlur,

    // State
    ...typing,

    // Advanced features
    activityLevel,
    smartDelay,
    adaptiveDelay,

    // Utilities
    trackActivity,
  };
};

export default useTyping;
