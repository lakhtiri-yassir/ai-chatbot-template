import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Context Providers
import { ThemeProvider } from './context/ThemeContext';
import { ChatProvider } from './context/ChatContext';
import { SocketProvider } from './context/SocketContext';

// Pages
import Chat from './pages/Chat/Chat';
import Admin from './pages/Admin/Admin';
import NotFound from './pages/NotFound/NotFound';

// Layout Components
import Layout from './components/layout/Layout/Layout';

// Services
import { healthCheck } from './services/api';

// Styles
import './styles/globals.css';
import './styles/tailwind.css';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    });
    
    // Log error to console in development
    if (import.meta.env.DEV) {
      console.error('Error Boundary caught an error:', error, errorInfo);
    }
    
    // Here you could send error to logging service
    // logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Something went wrong
                </h3>
              </div>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-300 mb-4">
              We apologize for the inconvenience. Please refresh the page to try again.
            </div>
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
                  Error Details (Development)
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-auto max-h-32">
                  {this.state.error.toString()}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Refresh Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-md transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading Component
const AppLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        Loading AI Chatbot
      </h2>
      <p className="text-gray-500 dark:text-gray-400">
        Please wait while we initialize the application...
      </p>
    </div>
  </div>
);

// Connection Status Component
const ConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineMessage(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineMessage(true);
      
      // Hide the message after 5 seconds if back online
      setTimeout(() => {
        if (navigator.onLine) {
          setShowOfflineMessage(false);
        }
      }, 5000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showOfflineMessage && isOnline) {
    return null;
  }

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${
      isOnline ? 'bg-green-600' : 'bg-red-600'
    } text-white text-center py-2 px-4 text-sm transition-all duration-300`}>
      {isOnline ? (
        <span className="flex items-center justify-center">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Connection restored
        </span>
      ) : (
        <span className="flex items-center justify-center">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          No internet connection
        </span>
      )}
    </div>
  );
};

// Main App Component
function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isHealthy, setIsHealthy] = useState(true);
  const [healthError, setHealthError] = useState(null);

  // Initialize application
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check API health
        await healthCheck();
        setIsHealthy(true);
        setHealthError(null);
      } catch (error) {
        console.warn('API health check failed:', error);
        setIsHealthy(false);
        setHealthError(error.message);
        // Continue loading even if health check fails
      } finally {
        // Minimum loading time for better UX
        setTimeout(() => {
          setIsLoading(false);
        }, 1000);
      }
    };

    initializeApp();
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Global keyboard shortcuts
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'k':
            event.preventDefault();
            // Focus search input (you can implement this later)
            console.log('Search shortcut triggered');
            break;
          case 'n':
            event.preventDefault();
            // New conversation shortcut
            console.log('New conversation shortcut triggered');
            break;
          case ',':
            event.preventDefault();
            // Settings shortcut
            console.log('Settings shortcut triggered');
            break;
          default:
            break;
        }
      }

      // Escape key shortcuts
      if (event.key === 'Escape') {
        // Close modals, dropdowns, etc.
        console.log('Escape key pressed');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Show loading screen
  if (isLoading) {
    return <AppLoading />;
  }

  // Show API connection error (but still allow app to work)
  const ApiHealthWarning = () => {
    if (isHealthy || !healthError) return null;

    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700 dark:text-yellow-200">
              <strong>API Connection Warning:</strong> Some features may be limited. 
              {import.meta.env.DEV && ` (${healthError})`}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ChatProvider>
          <SocketProvider>
            <Router>
              <div className="App">
                <ConnectionStatus />
                
                <Routes>
                  {/* Main chat interface */}
                  <Route path="/" element={
                    <Layout>
                      <ApiHealthWarning />
                      <Chat />
                    </Layout>
                  } />
                  
                  {/* Chat with specific conversation */}
                  <Route path="/chat/:conversationId" element={
                    <Layout>
                      <ApiHealthWarning />
                      <Chat />
                    </Layout>
                  } />
                  
                  {/* New conversation */}
                  <Route path="/chat/new" element={
                    <Layout>
                      <ApiHealthWarning />
                      <Chat />
                    </Layout>
                  } />
                  
                  {/* Admin panel */}
                  <Route path="/admin/*" element={
                    <Layout>
                      <ApiHealthWarning />
                      <Admin />
                    </Layout>
                  } />
                  
                  {/* Knowledge base */}
                  <Route path="/knowledge" element={
                    <Layout>
                      <ApiHealthWarning />
                      <Chat />
                    </Layout>
                  } />
                  
                  {/* Settings */}
                  <Route path="/settings" element={
                    <Layout>
                      <ApiHealthWarning />
                      <Chat />
                    </Layout>
                  } />
                  
                  {/* Redirect old routes */}
                  <Route path="/conversations/:id" element={<Navigate to="/chat/:id" replace />} />
                  
                  {/* 404 page */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
            </Router>
          </SocketProvider>
        </ChatProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;