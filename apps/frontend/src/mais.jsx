import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Context Providers
import { ChatContextProvider } from './context/ChatContext.jsx'
import { SocketContextProvider } from './context/SocketContext.jsx'
import { ThemeContextProvider } from './context/ThemeContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeContextProvider>
      <SocketContextProvider>
        <ChatContextProvider>
          <App />
        </ChatContextProvider>
      </SocketContextProvider>
    </ThemeContextProvider>
  </React.StrictMode>,
)