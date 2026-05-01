// server.js (FIXED VERSION)
import 'dotenv/config';
import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 3. REPLACE your current 'const db' block with this exactly:
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 28745,
    ssl: {
        rejectUnauthorized: false // REQUIRED for Aiven cloud
    }
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        process.exit(1);
    }
    
    console.log('Connected to Aiven MySQL database successfully!');
    createTables();
});

function createTables() {
    // Check if users table exists and has correct structure
    db.query(`CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS hazards (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT,
        hazard_type VARCHAR(255) NOT NULL,
        location VARCHAR(255) NOT NULL,
        severity VARCHAR(50) DEFAULT 'Low',
        latitude DECIMAL(10,8) DEFAULT NULL,
        longitude DECIMAL(11,8) DEFAULT NULL,
        photo_url VARCHAR(500),
        radius INT DEFAULT 0,
        people_affected INT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS notifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT,
        user_role VARCHAR(50),
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'info',
        is_read BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS activity_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        action VARCHAR(255) NOT NULL,
        user_name VARCHAR(255),
        hazard_type VARCHAR(255),
        location VARCHAR(255),
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    console.log('Tables ready');
    
    // Check if admin exists
    db.query('SELECT * FROM users WHERE role = "admin" LIMIT 1', (err, results) => {
        if (err) return;
        if (results && results.length === 0) {
            db.query('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
                ['admin', 'admin123', 'admin@oceanpulse.com', 'admin']);
            console.log('Admin created: admin@oceanpulse.com / admin123');
        }
    });
    
    // Check if demo user exists
    db.query('SELECT * FROM users WHERE username = "demo"', (err, results) => {
        if (err) return;
        if (results && results.length === 0) {
            db.query('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
                ['demo', 'demo123', 'demo@test.com', 'user']);
            console.log('Demo user created: demo / demo123');
        }
    });
}

const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ACCURATE location coordinates database
const getCoordinatesForLocation = (location) => {
    const locationMap = {
        'mumbai': [19.0760, 72.8777], 'delhi': [28.6139, 77.2090], 'bangalore': [12.9716, 77.5946],
        'hyderabad': [17.3850, 78.4867], 'ahmedabad': [23.0225, 72.5714], 'chennai': [13.0827, 80.2707],
        'kolkata': [22.5726, 88.3639], 'surat': [21.1702, 72.8311], 'pune': [18.5204, 73.8567],
        'jaipur': [26.9124, 75.7873], 'lucknow': [26.8467, 80.9462], 'kanpur': [26.4499, 80.3319],
        'nagpur': [21.1458, 79.0882], 'indore': [22.7196, 75.8577], 'thane': [19.2183, 72.9781],
        'bhopal': [23.2599, 77.4126], 'visakhapatnam': [17.6868, 83.2185], 'vizag': [17.6868, 83.2185],
        'patna': [25.5941, 85.1376], 'vadodara': [22.3072, 73.1812], 'guwahati': [26.1445, 91.7362],
        'bhubaneswar': [20.2961, 85.8245], 'coimbatore': [11.0168, 76.9558], 'mysore': [12.2958, 76.6394],
        'kochi': [9.9312, 76.2673], 'thiruvananthapuram': [8.5241, 76.9366], 'trivandrum': [8.5241, 76.9366],
        'goa': [15.2993, 74.1240], 'puducherry': [11.9139, 79.8145], 'calicut': [11.2588, 75.7804]
    };
    
    const lowerLocation = location.toLowerCase().trim();
    
    if (locationMap[lowerLocation]) return locationMap[lowerLocation];
    
    for (const [key, coords] of Object.entries(locationMap)) {
        if (lowerLocation.includes(key) || key.includes(lowerLocation)) {
            return coords;
        }
    }
    
    return [28.6139, 77.2090];
};

function createNotification(userId, userRole, message, type = 'info') {
    return new Promise((resolve, reject) => {
        db.query('INSERT INTO notifications (user_id, user_role, message, type) VALUES (?, ?, ?, ?)',
            [userId, userRole, message, type], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
    });
}

function createActivityLog(action, userName, hazardType, location, details = '') {
    db.query('INSERT INTO activity_logs (action, user_name, hazard_type, location, details) VALUES (?, ?, ?, ?, ?)',
        [action, userName, hazardType, location, details]);
}

function requireEditor(req, res, next) {
    const adminRole = req.headers['x-admin-role'];
    if (adminRole !== 'editor') {
        return res.status(403).json({ error: 'Edit mode required' });
    }
    next();
}

// ============== AUTH ROUTES ==============

// SIGNUP ROUTE - FIXED
app.post('/api/signup', (req, res) => {
    const { username, password, email } = req.body;
    
    // Validate input
    if (!username || !password || !email) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check if username already exists
    db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if (err) {
            console.error('Signup error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        // Check if email already exists
        db.query('SELECT * FROM users WHERE email = ?', [email], (err, emailResults) => {
            if (err) {
                console.error('Signup error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (emailResults.length > 0) {
                return res.status(400).json({ error: 'Email already registered' });
            }
            
            // Insert new user
            db.query('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
                [username, password, email, 'user'], (err2, result) => {
                    if (err2) {
                        console.error('Insert error:', err2);
                        return res.status(500).json({ error: 'Registration failed. Please try again.' });
                    }
                    
                    // Create welcome notification
                    createNotification(result.insertId, 'user', 'Welcome to OceanPulse! Your account has been created successfully.', 'success');
                    
                    console.log(`New user registered: ${username} (${email})`);
                    res.status(201).json({ 
                        message: 'Account created successfully!',
                        id: result.insertId, 
                        username, 
                        email, 
                        role: 'user' 
                    });
                });
        });
    });
});

// LOGIN ROUTE
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, results) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length > 0) {
            const user = results[0];
            console.log(`User logged in: ${username}`);
            res.json({ id: user.id, username: user.username, email: user.email, role: user.role });
        } else {
            res.status(401).json({ error: 'Invalid username or password' });
        }
    });
});

// ADMIN LOGIN ROUTE
app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    
    db.query('SELECT * FROM users WHERE email = ? AND password = ? AND role = ?', [email, password, 'admin'], (err, results) => {
        if (err) {
            console.error('Admin login error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length > 0) {
            const admin = results[0];
            console.log(`Admin logged in: ${admin.username}`);
            res.json({ id: admin.id, username: admin.username, email: admin.email, role: 'viewer' });
        } else {
            res.status(401).json({ error: 'Invalid admin credentials' });
        }
    });
});

// VERIFY PASSKEY ROUTE
app.post('/api/admin/verify-passkey', (req, res) => {
    const { passkey } = req.body;
    if (passkey !== 'admin2024') return res.status(401).json({ error: 'Invalid passkey' });
    res.json({ role: 'editor', message: 'Edit mode enabled' });
});

// ============== LEADERBOARD ROUTE ==============
app.get('/api/top-locations', (req, res) => {
    db.query(`SELECT location, COUNT(*) as total FROM hazards GROUP BY location ORDER BY total DESC LIMIT 5`, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ============== HAZARD ROUTES ==============
app.get('/api/hazards', (req, res) => {
    db.query(`SELECT h.*, u.username as reporter_name FROM hazards h LEFT JOIN users u ON h.user_id = u.id ORDER BY h.created_at DESC`, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/user-hazards/:userId', (req, res) => {
    db.query('SELECT * FROM hazards WHERE user_id = ? ORDER BY created_at DESC', [req.params.userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/hazards', upload.single('photo'), async (req, res) => {
    const { user_id, hazard_type, location, severity, radius, people_affected } = req.body;
    const photo_url = req.file ? req.file.filename : null;
    const [latitude, longitude] = getCoordinatesForLocation(location);
    
    db.query(`INSERT INTO hazards (user_id, hazard_type, location, severity, radius, people_affected, photo_url, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [user_id, hazard_type, location, severity, radius, people_affected, photo_url, latitude, longitude],
        async (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            db.query('SELECT username FROM users WHERE id = ?', [user_id], (err2, users) => {
                createActivityLog('Hazard Reported', users[0]?.username || 'Unknown', hazard_type, location, `Severity: ${severity}`);
            });
            await createNotification(user_id, 'user', `Your ${hazard_type} report at ${location} has been submitted.`, 'success');
            if (severity === 'High') {
                await createNotification(user_id, 'user', `⚠️ HIGH SEVERITY: ${hazard_type} at ${location} needs immediate attention!`, 'danger');
            }
            res.status(201).json({ message: 'Report submitted', id: result.insertId });
        });
});

app.put('/api/hazards/:id/status', requireEditor, async (req, res) => {
    const { status } = req.body;
    const hazardId = req.params.id;
    db.query('SELECT * FROM hazards WHERE id = ?', [hazardId], async (err, hazards) => {
        if (err || hazards.length === 0) return res.status(404).json({ error: 'Not found' });
        const hazard = hazards[0];
        db.query('UPDATE hazards SET status = ?, updated_at = NOW() WHERE id = ?', [status, hazardId], async (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            if (hazard.user_id) {
                await createNotification(hazard.user_id, 'user', `Your ${hazard.hazard_type} report status changed to ${status}`, 'info');
            }
            res.json({ message: 'Status updated' });
        });
    });
});

app.delete('/api/hazards/:id', requireEditor, async (req, res) => {
    const hazardId = req.params.id;
    db.query('SELECT * FROM hazards WHERE id = ?', [hazardId], async (err, hazards) => {
        if (err || hazards.length === 0) return res.status(404).json({ error: 'Not found' });
        const hazard = hazards[0];
        db.query('DELETE FROM hazards WHERE id = ?', [hazardId], async (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            db.query('SELECT username FROM users WHERE id = ?', [hazard.user_id], (err3, users) => {
                createActivityLog('Hazard Deleted', users[0]?.username || 'Unknown', hazard.hazard_type, hazard.location, 'Deleted by admin');
            });
            if (hazard.user_id) {
                await createNotification(hazard.user_id, 'user', `Your ${hazard.hazard_type} report at ${hazard.location} has been deleted.`, 'warning');
            }
            res.json({ message: 'Hazard deleted successfully' });
        });
    });
});

// ============== NOTIFICATION ROUTES ==============
app.get('/api/notifications/:userId', (req, res) => {
    db.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC', [req.params.userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/admin/notifications', (req, res) => {
    db.query('SELECT * FROM notifications WHERE user_role = "admin" ORDER BY created_at DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.put('/api/notifications/:id/read', (req, res) => {
    db.query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Marked as read' });
    });
});

app.delete('/api/notifications/clear/:userId', (req, res) => {
    const userId = req.params.userId;
    const query = userId === 'admin' ? 'DELETE FROM notifications WHERE user_role = "admin"' : 'DELETE FROM notifications WHERE user_id = ?';
    db.query(query, userId === 'admin' ? [] : [userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Cleared' });
    });
});

// ============== STATS ROUTES ==============
app.get('/api/hazard-stats', (req, res) => {
    db.query('SELECT hazard_type, COUNT(*) as count FROM hazards GROUP BY hazard_type', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/status-stats', (req, res) => {
    db.query('SELECT status, COUNT(*) as count FROM hazards GROUP BY status', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/activity-logs', (req, res) => {
    db.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 20', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ============== IMAGE ROUTE ==============
app.get('/api/view-image/:filename', (req, res) => {
    const filepath = path.join(__dirname, 'uploads', req.params.filename);
    if (fs.existsSync(filepath)) res.sendFile(filepath);
    else res.status(404).json({ error: 'Image not found' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});