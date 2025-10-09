# Quote of the Day Application

A full-stack web application that displays inspirational quotes, built for the Cloud-Native Learning Path.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   React         │    │   Node.js       │    │   PostgreSQL    │
│   Frontend      │◄──►│   Backend       │◄──►│   Database      │
│   (Port 3000)   │    │   (Port 3001)   │    │   (Port 5432)   │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Features

- **Daily Quotes**: Get a random inspirational quote
- **Quote Library**: Browse all available quotes
- **Categories**: Quotes organized by themes
- **Responsive Design**: Works on desktop and mobile
- **REST API**: Full CRUD operations for quotes
- **Database Integration**: PostgreSQL for data persistence
- **Fallback Mode**: Works without database using sample data

## 📁 Project Structure

```
app/
├── frontend/           # React application
│   ├── public/
│   ├── src/
│   └── package.json
├── backend/            # Node.js API
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── database/           # Database scripts
│   └── init.sql
└── README.md          # This file
```

## 🛠️ Local Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL (optional - app works without it)
- Git

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npm start
```

The API will be available at `http://localhost:3001`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm start
```

The web app will be available at `http://localhost:3000`

### 3. Database Setup (Optional)

If you have PostgreSQL installed:

```bash
# Create database and user
psql -U postgres
CREATE DATABASE quotes_db;
CREATE USER quotes_user WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE quotes_db TO quotes_user;
\q

# Initialize with sample data
psql -U quotes_user -d quotes_db -f database/init.sql
```

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/quotes` | Get all quotes |
| GET | `/api/quotes/random` | Get random quote |
| GET | `/api/quotes/:id` | Get quote by ID |
| GET | `/api/quotes/category/:category` | Get quotes by category |
| POST | `/api/quotes` | Add new quote |

### Example API Usage

```bash
# Get random quote
curl http://localhost:3001/api/quotes/random

# Get all quotes
curl http://localhost:3001/api/quotes

# Add new quote
curl -X POST http://localhost:3001/api/quotes \
  -H "Content-Type: application/json" \
  -d '{"text":"Your quote here","author":"Author Name","category":"inspiration"}'
```

## 🐳 Docker Usage

This application is designed to be containerized. See the learning modules for detailed Docker instructions:

- **Module 1A**: Single container workflow
- **Module 1B**: Multi-container with Docker Compose
- **Module 2+**: Kubernetes deployment

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
cd frontend
npm test
```

### Manual Testing
1. Visit `http://localhost:3000`
2. Click "New Quote" to get random quotes
3. Click "View All Quotes" to see the complete library
4. Verify API responses at `http://localhost:3001/api/quotes/random`

## 🔧 Configuration

### Environment Variables

**Backend (.env)**:
```env
PORT=3001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=quotes_db
DB_USER=postgres
DB_PASSWORD=password
```

**Frontend**:
```env
REACT_APP_API_URL=http://localhost:3001
```

## 📊 Monitoring

The application includes:
- Health check endpoint (`/health`)
- Request logging with Morgan
- Error handling middleware
- CORS configuration
- Security headers with Helmet

## 🚀 Production Considerations

- Use environment variables for configuration
- Enable HTTPS
- Set up proper database connection pooling
- Implement rate limiting
- Add authentication if needed
- Set up monitoring and logging
- Use a reverse proxy (nginx)

## 🤝 Contributing

This is a learning project! Feel free to:
- Add new quote categories
- Improve the UI/UX
- Add new API endpoints
- Enhance error handling
- Add more tests

## 📝 License

MIT License - feel free to use this code for learning and projects.