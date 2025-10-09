-- Create the quotes database
CREATE DATABASE quotes_db;

-- Connect to the quotes database
\c quotes_db;

-- Create the quotes table
CREATE TABLE IF NOT EXISTS quotes (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    author VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'general',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample quotes
INSERT INTO quotes (text, author, category) VALUES
('The only way to do great work is to love what you do.', 'Steve Jobs', 'motivation'),
('Innovation distinguishes between a leader and a follower.', 'Steve Jobs', 'innovation'),
('Life is what happens to you while you''re busy making other plans.', 'John Lennon', 'life'),
('The future belongs to those who believe in the beauty of their dreams.', 'Eleanor Roosevelt', 'dreams'),
('It is during our darkest moments that we must focus to see the light.', 'Aristotle', 'inspiration'),
('Success is not final, failure is not fatal: it is the courage to continue that counts.', 'Winston Churchill', 'courage'),
('The way to get started is to quit talking and begin doing.', 'Walt Disney', 'action'),
('Don''t be afraid to give up the good to go for the great.', 'John D. Rockefeller', 'ambition'),
('If you really look closely, most overnight successes took a long time.', 'Steve Jobs', 'success'),
('The only impossible journey is the one you never begin.', 'Tony Robbins', 'journey'),
('In the middle of difficulty lies opportunity.', 'Albert Einstein', 'opportunity'),
('Believe you can and you''re halfway there.', 'Theodore Roosevelt', 'belief'),
('The only person you are destined to become is the person you decide to be.', 'Ralph Waldo Emerson', 'destiny'),
('What lies behind us and what lies before us are tiny matters compared to what lies within us.', 'Ralph Waldo Emerson', 'inner-strength'),
('You miss 100% of the shots you don''t take.', 'Wayne Gretzky', 'opportunity'),
('Whether you think you can or you think you can''t, you''re right.', 'Henry Ford', 'mindset'),
('The best time to plant a tree was 20 years ago. The second best time is now.', 'Chinese Proverb', 'action'),
('Your limitation—it''s only your imagination.', 'Unknown', 'limitation'),
('Push yourself, because no one else is going to do it for you.', 'Unknown', 'self-motivation'),
('Great things never come from comfort zones.', 'Unknown', 'growth'),
('Dream it. Wish it. Do it.', 'Unknown', 'dreams'),
('Success doesn''t just find you. You have to go out and get it.', 'Unknown', 'success'),
('The harder you work for something, the greater you''ll feel when you achieve it.', 'Unknown', 'achievement'),
('Dream bigger. Do bigger.', 'Unknown', 'ambition'),
('Don''t stop when you''re tired. Stop when you''re done.', 'Unknown', 'perseverance');

-- Create an index on category for faster queries
CREATE INDEX idx_quotes_category ON quotes(category);

-- Create an index on author for faster queries
CREATE INDEX idx_quotes_author ON quotes(author);

-- Display the inserted data
SELECT COUNT(*) as total_quotes FROM quotes;
SELECT DISTINCT category FROM quotes ORDER BY category;