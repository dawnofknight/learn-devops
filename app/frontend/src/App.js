import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// API base URL - will be different in different environments
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function App() {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [allQuotes, setAllQuotes] = useState([]);
  const [showAllQuotes, setShowAllQuotes] = useState(false);

  // Fetch random quote
  const fetchRandomQuote = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/quotes/random`);
      setQuote(response.data.data);
    } catch (err) {
      setError('Failed to fetch quote. Please try again.');
      console.error('Error fetching quote:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all quotes
  const fetchAllQuotes = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/quotes`);
      setAllQuotes(response.data.data);
      setShowAllQuotes(true);
    } catch (err) {
      setError('Failed to fetch quotes. Please try again.');
      console.error('Error fetching quotes:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load initial quote on component mount
  useEffect(() => {
    fetchRandomQuote();
  }, []);

  return (
    <div className="App">
      <div className="container">
        <header className="app-header">
          <h1>💬 Quote of the Day</h1>
          <p>Daily inspiration and wisdom</p>
        </header>

        <main className="main-content">
          {/* Current Quote Section */}
          <section className="quote-section">
            <div className="card quote-card">
              {loading && !showAllQuotes ? (
                <div className="loading-container">
                  <div className="loading"></div>
                  <p>Loading your daily inspiration...</p>
                </div>
              ) : quote ? (
                <div className="quote-content fade-in">
                  <blockquote className="quote-text">
                    "{quote.text}"
                  </blockquote>
                  <cite className="quote-author">— {quote.author}</cite>
                  {quote.category && (
                    <span className="quote-category">{quote.category}</span>
                  )}
                </div>
              ) : null}

              {error && (
                <div className="error">
                  {error}
                </div>
              )}

              <div className="quote-actions">
                <button 
                  className="btn btn-primary" 
                  onClick={fetchRandomQuote}
                  disabled={loading}
                >
                  {loading && !showAllQuotes ? <div className="loading"></div> : '🎲 New Quote'}
                </button>
                
                <button 
                  className="btn btn-secondary" 
                  onClick={fetchAllQuotes}
                  disabled={loading}
                >
                  {loading && showAllQuotes ? <div className="loading"></div> : '📚 View All Quotes'}
                </button>
              </div>
            </div>
          </section>

          {/* All Quotes Section */}
          {showAllQuotes && (
            <section className="all-quotes-section">
              <div className="card">
                <div className="section-header">
                  <h2>All Quotes ({allQuotes.length})</h2>
                  <button 
                    className="btn btn-outline"
                    onClick={() => setShowAllQuotes(false)}
                  >
                    ✕ Close
                  </button>
                </div>
                
                <div className="quotes-grid">
                  {allQuotes.map((q) => (
                    <div key={q.id} className="quote-item fade-in">
                      <blockquote className="quote-text-small">
                        "{q.text}"
                      </blockquote>
                      <cite className="quote-author-small">— {q.author}</cite>
                      {q.category && (
                        <span className="quote-category-small">{q.category}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </main>

        <footer className="app-footer">
          <p>Built with ❤️ for the Cloud-Native Learning Path</p>
          <div className="tech-stack">
            <span>React</span>
            <span>Node.js</span>
            <span>PostgreSQL</span>
            <span>Docker</span>
            <span>Kubernetes</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;