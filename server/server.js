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

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 28745,
    ssl: { rejectUnauthorized: false }
});

db.connect((err) => {
    if (err) console.error('Database connection failed:', err);
    else console.log('Connected to Aiven MySQL database successfully!');
});

const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

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
        if (lowerLocation.includes(key)) return coords;
    }
    return [28.6139, 77.2090];
};

// AUTH ROUTES
app.post('/api/signup', (req, res) => {
    const { username, password, email } = req.body;
    db.query('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, "user")', [username, password, email], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        db.query('INSERT INTO notifications (user_id, message, type) VALUES (?, "Welcome to OceanPulse!", "success")', [result.insertId]);
        res.status(201).json({ message: 'Success', id: result.insertId });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, results) => {
        if (err || results.length === 0) return res.status(401).json({ error: 'Invalid' });
        res.json(results[0]);
    });
});

app.post('/api/admin/login', (req, res) => {
    // We trim spaces and lowercase the email to avoid typing errors
    const email = req.body.email?.toLowerCase().trim();
    const password = req.body.password?.trim();

    console.log(`Admin login attempt: ${email}`);

    const sql = 'SELECT * FROM users WHERE LOWER(email) = ? AND password = ? AND role = "admin"';
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            console.error("Login DB Error:", err);
            return res.status(500).json({ error: "DB Error" });
        }
        
        if (results.length > 0) {
            console.log("Admin login SUCCESS");
            res.json(results[0]);
        } else {
            console.log("Admin login FAILED - Check credentials in CMD");
            res.status(401).json({ error: 'Invalid' });
        }
    });
});

app.post('/api/admin/verify-passkey', (req, res) => {
    if (req.body.passkey === 'admin2024') res.json({ role: 'editor' });
    else res.status(401).json({ error: 'Invalid' });
});

// HAZARD ROUTES
app.post('/api/hazards', upload.single('photo'), (req, res) => {
    const { user_id, hazard_type, location, severity, radius, people_affected } = req.body;
    const [lat, lng] = getCoordinatesForLocation(location);
    const photo = req.file ? req.file.filename : null;

    const sql = "INSERT INTO hazards (user_id, hazard_type, location, severity, radius, people_affected, photo_url, latitude, longitude, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')";
    db.query(sql, [user_id, hazard_type, location, severity, radius, people_affected, photo, lat, lng], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Populate Activity Logs & Notifications
        db.query("INSERT INTO activity_logs (action, user_name, hazard_type, location) VALUES ('Hazard Reported', 'User', ?, ?)", [hazard_type, location]);
        db.query("INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'info')", [user_id, `Hazard ${hazard_type} reported at ${location}`]);
        
        res.status(201).json({ message: 'Success', id: result.insertId });
    });
});

app.get('/api/hazards', (req, res) => {
    db.query('SELECT h.*, u.username as reporter_name FROM hazards h LEFT JOIN users u ON h.user_id = u.id ORDER BY h.created_at DESC', (err, results) => {
        res.json(results);
    });
});

app.get('/api/user-hazards/:userId', (req, res) => {
    db.query('SELECT * FROM hazards WHERE user_id = ? ORDER BY created_at DESC', [req.params.userId], (err, results) => {
        res.json(results);
    });
});

app.put('/api/hazards/:id/status', (req, res) => {
    const { status } = req.body;
    db.query('UPDATE hazards SET status = ? WHERE id = ?', [status, req.params.id], (err) => {
        db.query("SELECT user_id, hazard_type, location FROM hazards WHERE id = ?", [req.params.id], (e, r) => {
            if (r.length > 0) {
                db.query("INSERT INTO activity_logs (action, user_name, hazard_type, location) VALUES (?, 'Admin', ?, ?)", [`Status Updated: ${status}`, r[0].hazard_type, r[0].location]);
                db.query("INSERT INTO notifications (user_id, message) VALUES (?, ?)", [r[0].user_id, `Your ${r[0].hazard_type} report status changed to ${status}`]);
            }
        });
        res.json({ message: 'Updated' });
    });
});

app.delete('/api/hazards/:id', (req, res) => {
    db.query('DELETE FROM hazards WHERE id = ?', [req.params.id], () => res.json({ message: 'Deleted' }));
});

// STATS ROUTES
app.get('/api/hazard-stats', (req, res) => {
    db.query('SELECT hazard_type, COUNT(*) as count FROM hazards GROUP BY hazard_type', (err, results) => res.json(results));
});

app.get('/api/status-stats', (req, res) => {
    db.query('SELECT status, COUNT(*) as count FROM hazards GROUP BY status', (err, results) => res.json(results));
});

app.get('/api/activity-logs', (req, res) => {
    db.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 10', (err, results) => res.json(results));
});

app.get('/api/notifications/:userId', (req, res) => {
    db.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [req.params.userId], (err, results) => res.json(results));
});

app.get('/api/top-locations', (req, res) => {
    db.query('SELECT location, COUNT(*) as total FROM hazards GROUP BY location ORDER BY total DESC LIMIT 5', (err, results) => res.json(results));
});

app.get('/api/view-image/:filename', (req, res) => {
    const filepath = path.join(__dirname, 'uploads', req.params.filename);
    if (fs.existsSync(filepath)) res.sendFile(filepath);
    else res.status(404).json({ error: 'Image not found' });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));