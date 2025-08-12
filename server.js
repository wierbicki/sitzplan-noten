
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// Initialize database tables
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        grid_rows INTEGER DEFAULT 5,
        grid_columns INTEGER DEFAULT 6,
        show_grades BOOLEAN DEFAULT false,
        starting_grade DECIMAL DEFAULT 4.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        photo TEXT,
        counter INTEGER DEFAULT 0,
        seat_position INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database tables initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Routes

// Get all classes
app.get('/api/classes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM classes ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new class
app.post('/api/classes', async (req, res) => {
  const { name, gridRows = 5, gridColumns = 6, showGrades = false, startingGrade = 4.0 } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO classes (name, grid_rows, grid_columns, show_grades, starting_grade) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, gridRows, gridColumns, showGrades, startingGrade]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating class:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a class
app.put('/api/classes/:id', async (req, res) => {
  const { id } = req.params;
  const { name, gridRows, gridColumns, showGrades, startingGrade } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE classes SET name = $1, grid_rows = $2, grid_columns = $3, show_grades = $4, starting_grade = $5 WHERE id = $6 RETURNING *',
      [name, gridRows, gridColumns, showGrades, startingGrade, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating class:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a class
app.delete('/api/classes/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.query('DELETE FROM classes WHERE id = $1', [id]);
    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Error deleting class:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get students for a specific class
app.get('/api/classes/:id/students', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query('SELECT * FROM students WHERE class_id = $1 ORDER BY created_at', [id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new student
app.post('/api/classes/:id/students', async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, photo = null } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO students (class_id, first_name, last_name, photo) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, firstName, lastName, photo]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a student
app.put('/api/students/:id', async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, photo, counter, seatPosition } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE students SET first_name = $1, last_name = $2, photo = $3, counter = $4, seat_position = $5 WHERE id = $6 RETURNING *',
      [firstName, lastName, photo, counter, seatPosition, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a student
app.delete('/api/students/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.query('DELETE FROM students WHERE id = $1', [id]);
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update student seat positions
app.post('/api/classes/:id/seat-assignments', async (req, res) => {
  const { id } = req.params;
  const { assignments } = req.body; // Array of {studentId, seatPosition}
  
  try {
    // Reset all seat positions for this class
    await pool.query('UPDATE students SET seat_position = NULL WHERE class_id = $1', [id]);
    
    // Set new seat positions
    for (const assignment of assignments) {
      await pool.query(
        'UPDATE students SET seat_position = $1 WHERE id = $2 AND class_id = $3',
        [assignment.seatPosition, assignment.studentId, id]
      );
    }
    
    res.json({ message: 'Seat assignments updated successfully' });
  } catch (error) {
    console.error('Error updating seat assignments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve static files
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize database and start server
initializeDatabase().then(() => {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
  });
});
