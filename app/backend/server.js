const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'quotes_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

// Sample quotes data (fallback if database is not available)
const sampleQuotes = [
  {
    id: 1,
    text: "The only way to do great work is to love what you do.",
    author: "Steve Jobs",
    category: "motivation"
  },
  {
    id: 2,
    text: "Innovation distinguishes between a leader and a follower.",
    author: "Steve Jobs",
    category: "innovation"
  },
  {
    id: 3,
    text: "Life is what happens to you while you're busy making other plans.",
    author: "John Lennon",
    category: "life"
  },
  {
    id: 4,
    text: "The future belongs to those who believe in the beauty of their dreams.",
    author: "Eleanor Roosevelt",
    category: "dreams"
  },
  {
    id: 5,
    text: "It is during our darkest moments that we must focus to see the light.",
    author: "Aristotle",
    category: "inspiration"
  }
];

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Get all quotes
app.get('/api/quotes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM quotes ORDER BY id');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.log('Database not available, using sample data');
    res.json({
      success: true,
      data: sampleQuotes,
      count: sampleQuotes.length,
      source: 'sample_data'
    });
  }
});

// Get random quote (Quote of the Day)
app.get('/api/quotes/random', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM quotes ORDER BY RANDOM() LIMIT 1');
    if (result.rows.length > 0) {
      res.json({
        success: true,
        data: result.rows[0]
      });
    } else {
      throw new Error('No quotes found in database');
    }
  } catch (error) {
    console.log('Database not available, using sample data');
    const randomIndex = Math.floor(Math.random() * sampleQuotes.length);
    res.json({
      success: true,
      data: sampleQuotes[randomIndex],
      source: 'sample_data'
    });
  }
});

// Get quote by ID
app.get('/api/quotes/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query('SELECT * FROM quotes WHERE id = $1', [id]);
    if (result.rows.length > 0) {
      res.json({
        success: true,
        data: result.rows[0]
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }
  } catch (error) {
    console.log('Database not available, using sample data');
    const quote = sampleQuotes.find(q => q.id === parseInt(id));
    if (quote) {
      res.json({
        success: true,
        data: quote,
        source: 'sample_data'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }
  }
});

// Get quotes by category
app.get('/api/quotes/category/:category', async (req, res) => {
  const { category } = req.params;
  
  try {
    const result = await pool.query('SELECT * FROM quotes WHERE category = $1', [category]);
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.log('Database not available, using sample data');
    const filteredQuotes = sampleQuotes.filter(q => q.category === category);
    res.json({
      success: true,
      data: filteredQuotes,
      count: filteredQuotes.length,
      source: 'sample_data'
    });
  }
});

// Add new quote (POST)
app.post('/api/quotes', async (req, res) => {
  const { text, author, category } = req.body;
  
  if (!text || !author) {
    return res.status(400).json({
      success: false,
      message: 'Text and author are required'
    });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO quotes (text, author, category) VALUES ($1, $2, $3) RETURNING *',
      [text, author, category || 'general']
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Quote added successfully'
    });
  } catch (error) {
    console.error('Error adding quote:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding quote to database'
    });
  }
});

// Initialize database tables
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quotes (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        author VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'general',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Check if we have any quotes, if not, insert sample data
    const result = await pool.query('SELECT COUNT(*) FROM quotes');
    if (parseInt(result.rows[0].count) === 0) {
      console.log('Inserting sample quotes into database...');
      for (const quote of sampleQuotes) {
        await pool.query(
          'INSERT INTO quotes (text, author, category) VALUES ($1, $2, $3)',
          [quote.text, quote.author, quote.category]
        );
      }
      console.log('Sample quotes inserted successfully');
    }
  } catch (error) {
    console.log('Database initialization failed, will use sample data:', error.message);
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Quote API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 Random quote: http://localhost:${PORT}/api/quotes/random`);
  
  // Initialize database
  await initializeDatabase();
});

module.exports = app;