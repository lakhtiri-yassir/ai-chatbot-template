# AI Chatbot Template

A comprehensive, production-ready AI chatbot template with real-time chat capabilities, knowledge base integration, and modern web interface. Built with Node.js, React, Socket.IO, and powered by OpenRouter for AI capabilities.

## 🚀 Features

### Core Chat Features

- **Real-time Chat**: Instant messaging with Socket.IO
- **AI-Powered Responses**: Integration with OpenRouter API (supports multiple AI models)
- **Conversation History**: Persistent chat sessions with MongoDB
- **Typing Indicators**: Real-time typing status
- **Message Streaming**: Live streaming of AI responses
- **Markdown Support**: Rich text formatting with syntax highlighting

### Knowledge Base Integration

- **Document Processing**: Upload and process PDF, DOCX, TXT, MD files
- **Intelligent Chunking**: Automatic text segmentation for optimal AI retrieval
- **Vector Search**: Semantic search using embeddings
- **Context-Aware Responses**: AI responses enhanced with relevant knowledge
- **Document Management**: Upload, organize, and manage knowledge documents

### Advanced Features

- **Rate Limiting**: API protection and abuse prevention
- **Caching**: Redis-based caching for improved performance
- **Authentication**: JWT-based user authentication
- **Error Handling**: Comprehensive error management and logging
- **Health Monitoring**: System health checks and monitoring
- **Responsive Design**: Mobile-first responsive UI
- **Dark/Light Theme**: Theme switching capability
- **File Upload**: Drag-and-drop file upload interface

## 🏗️ Architecture

### Backend (Node.js/Express)

```
apps/backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Express middleware
│   ├── models/          # MongoDB models
│   ├── routes/          # API routes
│   ├── services/        # Business logic services
│   ├── sockets/         # Socket.IO handlers
│   └── utils/           # Utility functions
├── knowledge/           # Knowledge base storage
└── server.js           # Main server file
```

### Frontend (React/Vite)

```
apps/frontend/
├── src/
│   ├── components/      # React components
│   ├── context/         # React context providers
│   ├── hooks/           # Custom React hooks
│   ├── pages/           # Page components
│   ├── services/        # API services
│   ├── styles/          # CSS and styling
│   └── utils/           # Utility functions
└── public/              # Static assets
```

## 🛠️ Tech Stack

### Backend

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Socket.IO** - Real-time communication
- **MongoDB** - Primary database
- **Redis** - Caching and session storage
- **OpenRouter** - AI model integration
- **JWT** - Authentication
- **Multer** - File upload handling
- **Winston** - Logging

### Frontend

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Socket.IO Client** - Real-time communication
- **Tailwind CSS** - Styling framework
- **React Router** - Client-side routing
- **Framer Motion** - Animations
- **React Markdown** - Markdown rendering
- **Zustand** - State management

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- MongoDB instance
- Redis instance
- OpenRouter API key

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ai-chatbot-template
```

### 2. Environment Setup

#### Backend Environment

Create `.env` file in `apps/backend/`:

```env
# Server Configuration
PORT=8000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/ai-chatbot
REDIS_URL=redis://localhost:6379
REDIS_TTL=3600

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=10

# OpenRouter Configuration
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=openai/gpt-3.5-turbo
OPENROUTER_MAX_TOKENS=1000
OPENROUTER_TEMPERATURE=0.7

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# File Upload
MAX_FILE_SIZE=10485760

# Knowledge Base
KNOWLEDGE_DOCS_PATH=./knowledge/documents
KNOWLEDGE_PROCESSED_PATH=./knowledge/processed
AUTO_PROCESS_KNOWLEDGE=true
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
MAX_CHUNKS=100

# Logging
LOG_LEVEL=info
ENABLE_CONSOLE_LOG=true
ENABLE_FILE_LOG=false
```

#### Frontend Environment

Create `.env` file in `apps/frontend/`:

```env
VITE_API_URL=http://localhost:8000
VITE_SOCKET_URL=http://localhost:8000
VITE_APP_NAME=AI Chatbot
```

### 3. Install Dependencies

```bash
# Install backend dependencies
cd apps/backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 4. Start Development Servers

#### Backend

```bash
cd apps/backend
npm run dev
```

#### Frontend

```bash
cd apps/frontend
npm run dev
```

The application will be available at:

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Health Check: http://localhost:8000/health

## 📚 API Documentation

### Chat Endpoints

#### POST /api/chat/message

Send a message to the AI chatbot.

**Request Body:**

```json
{
  "message": "Hello, how are you?",
  "conversationId": "optional-conversation-id",
  "options": {
    "model": "openai/gpt-3.5-turbo",
    "temperature": 0.7,
    "maxTokens": 1000
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "messageId": "msg_123",
    "content": "Hello! I'm doing well, thank you for asking.",
    "model": "openai/gpt-3.5-turbo",
    "usage": {
      "promptTokens": 10,
      "completionTokens": 15,
      "totalTokens": 25
    },
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET /api/chat/conversations

Get user's conversation history.

#### DELETE /api/chat/conversations/:id

Delete a conversation.

### Knowledge Base Endpoints

#### POST /api/knowledge/upload

Upload a document to the knowledge base.

**Request:** Multipart form data with file and metadata.

#### GET /api/knowledge/documents

Get all documents in the knowledge base.

#### GET /api/knowledge/search

Search the knowledge base.

**Query Parameters:**

- `q`: Search query
- `limit`: Number of results (default: 10)
- `threshold`: Similarity threshold (default: 0.7)

## 🔧 Configuration

### AI Model Configuration

The chatbot supports multiple AI models through OpenRouter. Configure your preferred model in the environment variables:

```env
OPENROUTER_MODEL=openai/gpt-3.5-turbo  # or anthropic/claude-3-sonnet, etc.
```

### Knowledge Base Configuration

Adjust chunking and processing parameters:

```env
CHUNK_SIZE=1000        # Characters per chunk
CHUNK_OVERLAP=200      # Overlap between chunks
MAX_CHUNKS=100         # Maximum chunks per document
```

### Rate Limiting

Configure API rate limiting:

```env
RATE_LIMIT_WINDOW=900000  # 15 minutes in milliseconds
RATE_LIMIT_MAX=100        # Requests per window
```

## 🧪 Testing

### Backend Tests

```bash
cd apps/backend
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage
```

### Frontend Tests

```bash
cd apps/frontend
npm test              # Run all tests
npm run test:ui       # Run tests with UI
npm run coverage      # Run tests with coverage
```

## 🚀 Deployment

### Production Build

#### Backend

```bash
cd apps/backend
npm run build
npm start
```

#### Frontend

```bash
cd apps/frontend
npm run build
```

### Docker Deployment

Create a `docker-compose.yml` file:

```yaml
version: "3.8"

services:
  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"

  backend:
    build: ./apps/backend
    ports:
      - "8000:8000"
    environment:
      - MONGODB_URI=mongodb://mongodb:27017/ai-chatbot
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongodb
      - redis

  frontend:
    build: ./apps/frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  mongodb_data:
```

### Environment Variables for Production

Ensure all required environment variables are set in your production environment:

- `MONGODB_URI`
- `REDIS_URL`
- `OPENROUTER_API_KEY`
- `JWT_SECRET`
- `NODE_ENV=production`

## 🔒 Security Considerations

1. **API Keys**: Never commit API keys to version control
2. **JWT Secret**: Use a strong, unique JWT secret
3. **Rate Limiting**: Configure appropriate rate limits
4. **CORS**: Configure CORS properly for production
5. **Input Validation**: All inputs are validated and sanitized
6. **File Upload**: File types and sizes are restricted

## 📊 Monitoring and Logging

### Health Checks

- Backend health: `GET /health`
- Database connectivity
- Redis connectivity
- Knowledge base status

### Logging

The application uses Winston for structured logging:

- Console logging (development)
- File logging (production)
- Error tracking
- Performance monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Check the documentation
- Review the code examples

## 🔄 Changelog

### Version 1.0.0

- Initial release
- Real-time chat functionality
- Knowledge base integration
- AI model support via OpenRouter
- Modern React frontend
- Production-ready backend

---

**Built with ❤️ by Yvexan Agency**
