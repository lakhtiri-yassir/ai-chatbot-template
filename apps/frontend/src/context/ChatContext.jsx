import React, { createContext, useContext, useReducer, useEffect } from "react";
import { chatService } from "../services/chat.service";

// Initial state
const initialState = {
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
  error: null,
  isTyping: false,
  connectionStatus: "disconnected",
  unreadCount: 0,
  searchQuery: "",
  filteredConversations: [],
  messageStatus: {}, // { messageId: 'sending' | 'sent' | 'delivered' | 'failed' }
};

// Action types
const CHAT_ACTIONS = {
  SET_LOADING: "SET_LOADING",
  SET_ERROR: "SET_ERROR",
  SET_CONVERSATIONS: "SET_CONVERSATIONS",
  ADD_CONVERSATION: "ADD_CONVERSATION",
  UPDATE_CONVERSATION: "UPDATE_CONVERSATION",
  DELETE_CONVERSATION: "DELETE_CONVERSATION",
  SET_CURRENT_CONVERSATION: "SET_CURRENT_CONVERSATION",
  SET_MESSAGES: "SET_MESSAGES",
  ADD_MESSAGE: "ADD_MESSAGE",
  UPDATE_MESSAGE: "UPDATE_MESSAGE",
  DELETE_MESSAGE: "DELETE_MESSAGE",
  SET_TYPING: "SET_TYPING",
  SET_CONNECTION_STATUS: "SET_CONNECTION_STATUS",
  SET_UNREAD_COUNT: "SET_UNREAD_COUNT",
  SET_SEARCH_QUERY: "SET_SEARCH_QUERY",
  SET_FILTERED_CONVERSATIONS: "SET_FILTERED_CONVERSATIONS",
  SET_MESSAGE_STATUS: "SET_MESSAGE_STATUS",
  CLEAR_MESSAGES: "CLEAR_MESSAGES",
  MARK_MESSAGES_READ: "MARK_MESSAGES_READ",
};

// Reducer function
const chatReducer = (state, action) => {
  switch (action.type) {
    case CHAT_ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload };

    case CHAT_ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };

    case CHAT_ACTIONS.SET_CONVERSATIONS:
      return {
        ...state,
        conversations: action.payload,
        filteredConversations: action.payload,
        isLoading: false,
      };

    case CHAT_ACTIONS.ADD_CONVERSATION:
      const newConversations = [action.payload, ...state.conversations];
      return {
        ...state,
        conversations: newConversations,
        filteredConversations: newConversations,
        currentConversation: action.payload,
      };

    case CHAT_ACTIONS.UPDATE_CONVERSATION:
      const updatedConversations = state.conversations.map((conv) =>
        conv._id === action.payload._id ? { ...conv, ...action.payload } : conv
      );
      return {
        ...state,
        conversations: updatedConversations,
        filteredConversations: updatedConversations,
        currentConversation:
          state.currentConversation?._id === action.payload._id
            ? { ...state.currentConversation, ...action.payload }
            : state.currentConversation,
      };

    case CHAT_ACTIONS.DELETE_CONVERSATION:
      const filteredConvs = state.conversations.filter(
        (conv) => conv._id !== action.payload
      );
      return {
        ...state,
        conversations: filteredConvs,
        filteredConversations: filteredConvs,
        currentConversation:
          state.currentConversation?._id === action.payload
            ? null
            : state.currentConversation,
        messages:
          state.currentConversation?._id === action.payload
            ? []
            : state.messages,
      };

    case CHAT_ACTIONS.SET_CURRENT_CONVERSATION:
      return {
        ...state,
        currentConversation: action.payload,
        messages: [],
        error: null,
      };

    case CHAT_ACTIONS.SET_MESSAGES:
      return {
        ...state,
        messages: action.payload,
        isLoading: false,
      };

    case CHAT_ACTIONS.ADD_MESSAGE:
      const newMessage = action.payload;
      const messageExists = state.messages.some(
        (msg) => msg._id === newMessage._id
      );

      if (messageExists) {
        return state;
      }

      return {
        ...state,
        messages: [...state.messages, newMessage],
        messageStatus: {
          ...state.messageStatus,
          [newMessage._id]: newMessage.status || "sent",
        },
      };

    case CHAT_ACTIONS.UPDATE_MESSAGE:
      const updatedMessages = state.messages.map((msg) =>
        msg._id === action.payload._id ? { ...msg, ...action.payload } : msg
      );
      return {
        ...state,
        messages: updatedMessages,
        messageStatus: {
          ...state.messageStatus,
          [action.payload._id]:
            action.payload.status || state.messageStatus[action.payload._id],
        },
      };

    case CHAT_ACTIONS.DELETE_MESSAGE:
      return {
        ...state,
        messages: state.messages.filter((msg) => msg._id !== action.payload),
        messageStatus: {
          ...state.messageStatus,
          [action.payload]: undefined,
        },
      };

    case CHAT_ACTIONS.SET_TYPING:
      return { ...state, isTyping: action.payload };

    case CHAT_ACTIONS.SET_CONNECTION_STATUS:
      return { ...state, connectionStatus: action.payload };

    case CHAT_ACTIONS.SET_UNREAD_COUNT:
      return { ...state, unreadCount: action.payload };

    case CHAT_ACTIONS.SET_SEARCH_QUERY:
      return { ...state, searchQuery: action.payload };

    case CHAT_ACTIONS.SET_FILTERED_CONVERSATIONS:
      return { ...state, filteredConversations: action.payload };

    case CHAT_ACTIONS.SET_MESSAGE_STATUS:
      return {
        ...state,
        messageStatus: {
          ...state.messageStatus,
          [action.payload.messageId]: action.payload.status,
        },
      };

    case CHAT_ACTIONS.CLEAR_MESSAGES:
      return { ...state, messages: [], messageStatus: {} };

    case CHAT_ACTIONS.MARK_MESSAGES_READ:
      const readMessages = state.messages.map((msg) => ({
        ...msg,
        read: true,
      }));
      return { ...state, messages: readMessages, unreadCount: 0 };

    default:
      return state;
  }
};

// Create context
const ChatContext = createContext();

// Context provider component
export const ChatProvider = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  // Filter conversations based on search query
  useEffect(() => {
    if (!state.searchQuery.trim()) {
      dispatch({
        type: CHAT_ACTIONS.SET_FILTERED_CONVERSATIONS,
        payload: state.conversations,
      });
    } else {
      const filtered = state.conversations.filter(
        (conv) =>
          conv.title?.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
          conv.lastMessage?.content
            ?.toLowerCase()
            .includes(state.searchQuery.toLowerCase())
      );
      dispatch({
        type: CHAT_ACTIONS.SET_FILTERED_CONVERSATIONS,
        payload: filtered,
      });
    }
  }, [state.searchQuery, state.conversations]);

  // Action creators
  const actions = {
    setLoading: (loading) =>
      dispatch({ type: CHAT_ACTIONS.SET_LOADING, payload: loading }),

    setError: (error) =>
      dispatch({ type: CHAT_ACTIONS.SET_ERROR, payload: error }),

    setConversations: (conversations) =>
      dispatch({
        type: CHAT_ACTIONS.SET_CONVERSATIONS,
        payload: conversations,
      }),

    addConversation: (conversation) =>
      dispatch({
        type: CHAT_ACTIONS.ADD_CONVERSATION,
        payload: conversation,
      }),

    updateConversation: (conversation) =>
      dispatch({
        type: CHAT_ACTIONS.UPDATE_CONVERSATION,
        payload: conversation,
      }),

    deleteConversation: (conversationId) =>
      dispatch({
        type: CHAT_ACTIONS.DELETE_CONVERSATION,
        payload: conversationId,
      }),

    setCurrentConversation: (conversation) =>
      dispatch({
        type: CHAT_ACTIONS.SET_CURRENT_CONVERSATION,
        payload: conversation,
      }),

    setMessages: (messages) =>
      dispatch({
        type: CHAT_ACTIONS.SET_MESSAGES,
        payload: messages,
      }),

    addMessage: (message) =>
      dispatch({
        type: CHAT_ACTIONS.ADD_MESSAGE,
        payload: message,
      }),

    updateMessage: (message) =>
      dispatch({
        type: CHAT_ACTIONS.UPDATE_MESSAGE,
        payload: message,
      }),

    deleteMessage: (messageId) =>
      dispatch({
        type: CHAT_ACTIONS.DELETE_MESSAGE,
        payload: messageId,
      }),

    setTyping: (isTyping) =>
      dispatch({
        type: CHAT_ACTIONS.SET_TYPING,
        payload: isTyping,
      }),

    setConnectionStatus: (status) =>
      dispatch({
        type: CHAT_ACTIONS.SET_CONNECTION_STATUS,
        payload: status,
      }),

    setUnreadCount: (count) =>
      dispatch({
        type: CHAT_ACTIONS.SET_UNREAD_COUNT,
        payload: count,
      }),

    setSearchQuery: (query) =>
      dispatch({
        type: CHAT_ACTIONS.SET_SEARCH_QUERY,
        payload: query,
      }),

    setMessageStatus: (messageId, status) =>
      dispatch({
        type: CHAT_ACTIONS.SET_MESSAGE_STATUS,
        payload: { messageId, status },
      }),

    clearMessages: () => dispatch({ type: CHAT_ACTIONS.CLEAR_MESSAGES }),

    markMessagesRead: () => dispatch({ type: CHAT_ACTIONS.MARK_MESSAGES_READ }),

    // Async actions
    loadConversations: async () => {
      try {
        actions.setLoading(true);
        const conversations = await chatService.getConversations();
        actions.setConversations(conversations);
      } catch (error) {
        actions.setError(error.message);
      }
    },

    loadMessages: async (conversationId) => {
      try {
        actions.setLoading(true);
        const messages = await chatService.getMessages(conversationId);
        actions.setMessages(messages);
      } catch (error) {
        actions.setError(error.message);
      }
    },

    sendMessage: async (content, conversationId = null) => {
      try {
        const tempId = `temp-${Date.now()}`;
        const tempMessage = {
          _id: tempId,
          content,
          sender: "user",
          timestamp: new Date().toISOString(),
          conversationId: conversationId || state.currentConversation?._id,
        };

        // Add temporary message immediately
        actions.addMessage(tempMessage);
        actions.setMessageStatus(tempId, "sending");

        // Send message to backend
        const response = await chatService.sendMessage(content, conversationId);

        // Update with real message from backend
        actions.updateMessage({
          ...tempMessage,
          _id: response.message._id,
          timestamp: response.message.timestamp,
        });

        actions.setMessageStatus(response.message._id, "sent");

        // Update current conversation if needed
        if (response.conversation) {
          if (!state.currentConversation) {
            actions.setCurrentConversation(response.conversation);
          }
          actions.updateConversation(response.conversation);
        }

        return response;
      } catch (error) {
        actions.setError(error.message);
        throw error;
      }
    },

    createConversation: async (title = "New Conversation") => {
      try {
        const conversation = await chatService.createConversation(title);
        actions.addConversation(conversation);
        return conversation;
      } catch (error) {
        actions.setError(error.message);
        throw error;
      }
    },
  };

  const value = {
    ...state,
    ...actions,
    CHAT_ACTIONS,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

// Custom hook to use chat context
export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};

export { CHAT_ACTIONS };
export default ChatContext;
