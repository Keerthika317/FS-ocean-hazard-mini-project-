// index.ts
import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import nodemailer from 'nodemailer';
import multer from 'multer';
dotenv.config();
const app = express();
const server = http.createServer(app);
// Use FRONTEND_URL from .env so it works locally AND when deployed
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});
app.use(cors());
app.use(express.json());
// UPDATED DATABASE CONNECTION
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT),
    ssl: {
        // This reads the ca.pem file you downloaded
        ca: fs.readFileSync(path.join(process.cwd(), 'ca.pem')),
    },
});
db.connect((err) => {
    if (err) {
        console.error('Error connecting to Aiven MySQL:', err);
        return;
    }
    console.log('Connected to Aiven MySQL Database!');
});
// Use dynamic port for Render
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
// Create tables
db.query(`CREATE TABLE IF NOT EXISTS social_alerts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    platform VARCHAR(100),
    username VARCHAR(255),
    content TEXT,
    location VARCHAR(255),
    sentiment VARCHAR(50),
    hazard_detected VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
db.query(`CREATE TABLE IF NOT EXISTS hazard_reports (
    id INT PRIMARY KEY AUTO_INCREMENT,
    reporter_name VARCHAR(255),
    reporter_email VARCHAR(255),
    user_id INT,
    hazard_type VARCHAR(255),
    location VARCHAR(255),
    severity VARCHAR(100),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    photo_url VARCHAR(500),
    impact_radius INT,
    risk_count INT,
    status VARCHAR(100) DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
db.query(`CREATE TABLE IF NOT EXISTS hazard_archive (
    id INT PRIMARY KEY AUTO_INCREMENT,
    original_id INT,
    reporter_name VARCHAR(255),
    reporter_email VARCHAR(255),
    hazard_type VARCHAR(255),
    location VARCHAR(255),
    severity VARCHAR(100),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    photo_url VARCHAR(500),
    impact_radius INT,
    risk_count INT,
    status VARCHAR(100),
    created_at DATETIME,
    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletion_reason VARCHAR(255)
)`);
db.query(`CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    email VARCHAR(255),
    role VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
// Add columns if needed
db.query(`SHOW COLUMNS FROM hazard_reports LIKE 'user_id'`, (err, results) => {
    if (err)
        console.error("Error checking user_id column:", err);
    else if (results.length === 0) {
        db.query(`ALTER TABLE hazard_reports ADD COLUMN user_id INT`);
    }
});
db.query(`SHOW COLUMNS FROM hazard_reports LIKE 'reporter_email'`, (err, results) => {
    if (err)
        console.error("Error checking reporter_email column:", err);
    else if (results.length === 0) {
        db.query(`ALTER TABLE hazard_reports ADD COLUMN reporter_email VARCHAR(255)`);
    }
});
db.query(`SHOW COLUMNS FROM users LIKE 'email'`, (err, results) => {
    if (err)
        console.error("Error checking email column:", err);
    else if (results.length === 0) {
        db.query(`ALTER TABLE users ADD COLUMN email VARCHAR(255)`);
    }
});
// Store active notifications for popups
const activeNotifications = [];
io.on('connection', (socket) => {
    socket.emit('initial-notifications', activeNotifications);
    socket.on('disconnect', () => { });
});
const sendPopupNotification = (type, title, message, details = {}) => {
    const notification = {
        id: Date.now(),
        type: type,
        title: title,
        message: message,
        timestamp: new Date().toISOString(),
        read: false,
        ...details
    };
    activeNotifications.unshift(notification);
    if (activeNotifications.length > 100)
        activeNotifications.pop();
    io.emit('new-notification', notification);
    console.log(` POPUP: ${title} - ${message}`);
};
// ============ EMAIL CONFIGURATION ============
console.log(" Email Configuration Check:");
console.log("EMAIL_USER:", process.env.EMAIL_USER ? " Set" : " Missing");
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? " Set" : " Missing");
console.log("ADMIN_EMAIL:", process.env.ADMIN_EMAIL ? " Set" : " Missing");
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});
transporter.verify((error, success) => {
    if (error) {
        console.error(" Email error:", error.message);
    }
    else {
        console.log(" Email service ready!");
    }
});
// ============ RANDOM DATE GENERATOR ============
const getRandomPastDate = () => {
    const now = new Date();
    const daysToSubtract = Math.floor(Math.random() * 30) + 1;
    const hoursToSubtract = Math.floor(Math.random() * 24);
    const minutesToSubtract = Math.floor(Math.random() * 60);
    const secondsToSubtract = Math.floor(Math.random() * 60);
    now.setDate(now.getDate() - daysToSubtract);
    now.setHours(now.getHours() - hoursToSubtract);
    now.setMinutes(now.getMinutes() - minutesToSubtract);
    now.setSeconds(now.getSeconds() - secondsToSubtract);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};
// ============ EMAIL FUNCTIONS ============
const sendReportToAdmin = async (reportData, photoUrl) => {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
    if (!adminEmail)
        return false;
    try {
        const severityIcon = { 'Low': '🟢', 'Medium': '🟡', 'High': '🟠', 'Critical': '🔴' }[reportData.severity] || '⚠️';
        const mailOptions = {
            from: `"OceanPulse Alert" <${process.env.EMAIL_USER}>`,
            to: adminEmail,
            subject: ` NEW HAZARD: ${reportData.hazard_type.toUpperCase()} at ${reportData.location}`,
            html: `
                <div style="font-family: Arial; max-width: 700px; margin: auto; padding: 20px; border: 3px solid #00d2ff; border-radius: 15px;">
                    <h2 style="color: #00d2ff;"> NEW HAZARD REPORT</h2>
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 10px;">
                        <p><strong> Hazard:</strong> ${reportData.hazard_type.toUpperCase()}</p>
                        <p><strong> Location:</strong> ${reportData.location}</p>
                        <p><strong> Severity:</strong> ${severityIcon} ${reportData.severity}</p>
                        <p><strong> Radius:</strong> ${reportData.impact_radius || 0} KM</p>
                        <p><strong> Affected:</strong> ${reportData.risk_count || 0} people</p>
                        <p><strong> Reporter:</strong> ${reportData.reporter_name}</p>
                        <p><strong> Email:</strong> ${reportData.reporter_email || 'Not provided'}</p>
                    </div>
                    ${photoUrl ? `<p><a href="${photoUrl}"> VIEW PHOTO</a></p>` : ''}
                </div>
            `
        };
        await transporter.sendMail(mailOptions);
        console.log(` Admin email sent`);
        sendPopupNotification('EMAIL_SENT', ' Email Sent', `Admin notified`);
        return true;
    }
    catch (error) {
        console.error(' Admin email error:', error.message);
        return false;
    }
};
const sendStatusEmailToReporter = async (reportData, newStatus, oldStatus) => {
    const reporterEmail = reportData.reporter_email;
    if (!reporterEmail || reporterEmail === 'undefined')
        return false;
    try {
        const mailOptions = {
            from: `"OceanPulse Updates" <${process.env.EMAIL_USER}>`,
            to: reporterEmail,
            subject: ` Status Update: ${reportData.hazard_type} - OceanPulse`,
            html: `
                <div style="font-family: Arial; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #00d2ff; border-radius: 10px;">
                    <h2 style="color: #00d2ff;"> OceanPulse - Status Update</h2>
                    <p>Dear ${reportData.reporter_name},</p>
                    <p>Your hazard report status: <strong>${newStatus}</strong> (was ${oldStatus})</p>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
                        <p><strong> Hazard:</strong> ${reportData.hazard_type}</p>
                        <p><strong> Location:</strong> ${reportData.location}</p>
                    </div>
                </div>
            `
        };
        await transporter.sendMail(mailOptions);
        console.log(` Status email sent to: ${reporterEmail}`);
        sendPopupNotification('EMAIL_SENT', ' Email Sent', `Status update sent to ${reportData.reporter_name}`);
        return true;
    }
    catch (error) {
        console.error(' Status email error:', error.message);
        return false;
    }
};
const sendArchiveEmailToReporter = async (reportData, reason) => {
    const reporterEmail = reportData.reporter_email;
    if (!reporterEmail || reporterEmail === 'undefined')
        return false;
    try {
        const mailOptions = {
            from: `"OceanPulse Updates" <${process.env.EMAIL_USER}>`,
            to: reporterEmail,
            subject: ` Hazard Archived - OceanPulse`,
            html: `
                <div style="font-family: Arial; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ffc107; border-radius: 10px;">
                    <h2 style="color: #ffc107;"> Hazard Archived</h2>
                    <p>Dear ${reportData.reporter_name},</p>
                    <p>Your reported hazard has been archived.</p>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
                        <p><strong> Hazard:</strong> ${reportData.hazard_type}</p>
                        <p><strong> Location:</strong> ${reportData.location}</p>
                        <p><strong> Reason:</strong> ${reason || 'Administrative action'}</p>
                    </div>
                </div>
            `
        };
        await transporter.sendMail(mailOptions);
        console.log(` Archive email sent to: ${reporterEmail}`);
        sendPopupNotification('EMAIL_SENT', ' Email Sent', `Archive notification sent`);
        return true;
    }
    catch (error) {
        console.error(' Archive email error:', error.message);
        return false;
    }
};
// ============================================
// DELETE EMAIL FUNCTION - FIXED
// ============================================
const sendDeleteEmailToReporter = async (reportData) => {
    const reporterEmail = reportData.reporter_email;
    console.log(`\n DELETION EMAIL FUNCTION CALLED `);
    console.log(`   To: ${reporterEmail}`);
    console.log(`   Reporter: ${reportData.reporter_name}`);
    console.log(`   Hazard: ${reportData.hazard_type}`);
    console.log(`   Location: ${reportData.location}`);
    if (!reporterEmail || reporterEmail === 'undefined' || reporterEmail === 'null' || reporterEmail === '') {
        console.log(` No valid email - cannot send deletion email`);
        sendPopupNotification('WARNING', ' No Email', `Reporter has no email address`);
        return false;
    }
    try {
        const mailOptions = {
            from: `"OceanPulse System" <${process.env.EMAIL_USER}>`,
            to: reporterEmail,
            subject: ` Your Hazard Report has been Deleted - OceanPulse`,
            html: `
                <div style="font-family: Arial; max-width: 600px; margin: auto; padding: 20px; border: 2px solid #dc3545; border-radius: 10px;">
                    <h2 style="color: #dc3545;"> HAZARD REPORT DELETED</h2>
                    <p>Dear ${reportData.reporter_name},</p>
                    <p>Your reported hazard has been <strong>permanently deleted</strong> from the system.</p>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
                        <p><strong> Hazard:</strong> ${reportData.hazard_type}</p>
                        <p><strong> Location:</strong> ${reportData.location}</p>
                        <p><strong> Severity:</strong> ${reportData.severity}</p>
                        <p><strong> Deleted:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                    <p>If you believe this was a mistake, please contact the administrator.</p>
                </div>
            `
        };
        const info = await transporter.sendMail(mailOptions);
        console.log(`DELETION EMAIL SENT SUCCESSFULLY to: ${reporterEmail}`);
        console.log(`   Message ID: ${info.messageId}`);
        sendPopupNotification('EMAIL_SENT', ' Deletion Email Sent', `Email sent to ${reportData.reporter_name}`);
        return true;
    }
    catch (error) {
        console.error(` DELETION EMAIL FAILED:`, error.message);
        sendPopupNotification('EMAIL_FAILED', ' Email Failed', `Could not send deletion email`);
        return false;
    }
};
// ============ ADMIN ROLE MANAGEMENT ============
let adminEditMode = false;
let adminEditModeExpiry = null;
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    if (username !== adminUsername)
        return res.status(401).json({ error: 'Invalid Admin Username' });
    if (password !== adminPassword)
        return res.status(401).json({ error: 'Invalid Password' });
    adminEditMode = false;
    sendPopupNotification('SUCCESS', 'Login Successful', 'Welcome Admin');
    res.json({ id: 1, username: 'admin', role: 'viewer', adminRole: 'viewer' });
});
app.post('/api/admin/verify-passkey', (req, res) => {
    const { passkey } = req.body;
    const adminPasskey = process.env.ADMIN_PASSKEY || '202325';
    if (!passkey)
        return res.status(400).json({ error: 'Passkey required' });
    if (passkey !== adminPasskey)
        return res.status(401).json({ error: 'Invalid Passkey' });
    adminEditMode = true;
    adminEditModeExpiry = Date.now() + 30 * 60 * 1000;
    sendPopupNotification('SUCCESS', ' Edit Mode Enabled', 'You can now delete/archive hazards');
    res.json({ role: 'editor', adminRole: 'editor', message: 'Edit mode enabled' });
});
app.get('/api/admin/mode', (req, res) => {
    if (adminEditModeExpiry && Date.now() > adminEditModeExpiry) {
        adminEditMode = false;
        adminEditModeExpiry = null;
    }
    res.json({ adminRole: adminEditMode ? 'editor' : 'viewer', editMode: adminEditMode });
});
app.post('/api/admin/logout', (req, res) => {
    adminEditMode = false;
    adminEditModeExpiry = null;
    res.json({ message: 'Logged out', adminRole: 'viewer' });
});
// ============ PREDEFINED HAZARDS ============
const predefinedHazardsList = [
    { id: 1, title: " Tsunami Warning: 7.2 magnitude earthquake in Pacific", location: "Pacific Ocean", hazard: "Tsunami" },
    { id: 2, title: " Cyclone Fengal intensifies in Bay of Bengal", location: "Bay of Bengal", hazard: "Cyclone" },
    { id: 3, title: " Severe flooding in coastal Tamil Nadu", location: "Tamil Nadu Coast", hazard: "Flood" },
    { id: 4, title: " Wildfire threatens California coastline", location: "California Coast", hazard: "Wildfire" },
    { id: 5, title: " Major landslide blocks coastal highway in Kerala", location: "Kerala Coast", hazard: "Landslide" },
    { id: 6, title: " Hurricane Milton strengthens to Category 3", location: "Florida Coast", hazard: "Hurricane" },
    { id: 7, title: " Earthquake of magnitude 6.8 in Andaman Sea", location: "Andaman Sea", hazard: "Earthquake" },
    { id: 8, title: " High waves of 5 meters along Odisha coast", location: "Odisha Coast", hazard: "High Waves" },
    { id: 9, title: " Typhoon Kong-rey hits Philippines", location: "Philippines Coast", hazard: "Typhoon" },
    { id: 10, title: " Storm surge warning for Mumbai coast", location: "Mumbai Coast", hazard: "Storm" }
];
let insertedHazardIds = new Set();
const insertPredefinedHazardsIntoDB = async () => {
    for (const hazard of predefinedHazardsList) {
        if (insertedHazardIds.has(hazard.id))
            continue;
        const [existing] = await db.promise().query('SELECT id FROM social_alerts WHERE content = ? LIMIT 1', [hazard.title]);
        if (existing.length === 0) {
            const randomDate = getRandomPastDate();
            await db.promise().query('INSERT INTO social_alerts (platform, username, content, location, sentiment, hazard_detected, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', ['Global Monitor', 'Alert System', hazard.title, hazard.location, 'CRITICAL', hazard.hazard, randomDate]);
            insertedHazardIds.add(hazard.id);
            console.log(` Predefined: ${hazard.hazard} | ${randomDate}`);
        }
        else {
            insertedHazardIds.add(hazard.id);
        }
    }
};
// ============ GNEWS API ============
const GNEWS_API_KEY = '2b845ad8f598690a114f73b4a06f7360';
const hazardTypes = [
    { keyword: 'tsunami', display: 'Tsunami' },
    { keyword: 'flood', display: 'Flood' },
    { keyword: 'earthquake', display: 'Earthquake' },
    { keyword: 'cyclone', display: 'Cyclone' },
    { keyword: 'hurricane', display: 'Hurricane' },
    { keyword: 'typhoon', display: 'Typhoon' },
    { keyword: 'landslide', display: 'Landslide' },
    { keyword: 'wildfire', display: 'Wildfire' }
];
const hazardLocationsList = [
    'Bay of Bengal', 'Andaman Sea', 'Indian Ocean', 'Pacific Ocean',
    'Chennai Coast', 'Mumbai Coast', 'Kolkata Delta', 'Visakhapatnam Coast',
    'Kochi Waters', 'Goa Coast', 'Odisha Coast', 'Gujarat Coast'
];
const bannedKeywords = ['sports', 'football', 'cricket', 'movie', 'celebrity', 'music', 'business', 'politics'];
const hazardRequiredKeywords = ['warning', 'alert', 'emergency', 'disaster', 'evacuation', 'coastal'];
let processedArticleHashes = new Set();
const fetchHazardNewsAPI = async () => {
    try {
        let newAlertsAdded = 0;
        for (const hazard of hazardTypes) {
            try {
                const apiUrl = `https://gnews.io/api/v4/search?q=${hazard.keyword}&lang=en&max=3&apikey=${GNEWS_API_KEY}`;
                const response = await axios.get(apiUrl, { timeout: 8000 });
                if (response.data && response.data.articles) {
                    for (const article of response.data.articles) {
                        const title = (article.title || "").toLowerCase();
                        const fullText = title + " " + (article.description || "").toLowerCase();
                        let hasBanned = bannedKeywords.some(word => fullText.includes(word));
                        if (hasBanned)
                            continue;
                        let hasRequired = hazardRequiredKeywords.some(word => fullText.includes(word));
                        if (!hasRequired)
                            continue;
                        const titleHash = title.replace(/[^a-z0-9]/g, '').substring(0, 80);
                        if (processedArticleHashes.has(titleHash))
                            continue;
                        const [existing] = await db.promise().query(`SELECT id FROM social_alerts WHERE LOWER(content) LIKE ? LIMIT 1`, [`%${titleHash.substring(0, 50)}%`]);
                        if (existing.length > 0) {
                            processedArticleHashes.add(titleHash);
                            continue;
                        }
                        processedArticleHashes.add(titleHash);
                        const randomDate = getRandomPastDate();
                        const randomLocation = hazardLocationsList[Math.floor(Math.random() * hazardLocationsList.length)];
                        const cleanTitle = (article.title || `${hazard.display} alert`).substring(0, 500);
                        await db.promise().query('INSERT INTO social_alerts (platform, username, content, location, sentiment, hazard_detected, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', ['GNews', article.source?.name || 'News', cleanTitle, randomLocation, 'CRITICAL', hazard.display, randomDate]);
                        newAlertsAdded++;
                        console.log(` ${hazard.display} | ${randomLocation} | ${randomDate}`);
                    }
                }
            }
            catch (apiError) {
                continue;
            }
        }
        if (newAlertsAdded === 0) {
            await insertPredefinedHazardsIntoDB();
        }
    }
    catch (error) {
        console.log(" API Error:", error.message);
        await insertPredefinedHazardsIntoDB();
    }
};
const autoArchiveResolved = async () => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const [resolvedHazards] = await db.promise().query('SELECT * FROM hazard_reports WHERE status = "Resolved" AND created_at < ?', [sevenDaysAgo]);
        for (const hazard of resolvedHazards) {
            await db.promise().query('INSERT INTO hazard_archive (original_id, reporter_name, reporter_email, hazard_type, location, severity, latitude, longitude, photo_url, impact_radius, risk_count, status, created_at, deletion_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [hazard.id, hazard.reporter_name, hazard.reporter_email, hazard.hazard_type, hazard.location, hazard.severity, hazard.latitude, hazard.longitude, hazard.photo_url, hazard.impact_radius, hazard.risk_count, hazard.status, hazard.created_at, 'Auto-archived']);
            await db.promise().query('DELETE FROM hazard_reports WHERE id = ?', [hazard.id]);
            if (hazard.reporter_email) {
                await sendDeleteEmailToReporter(hazard);
            }
        }
    }
    catch (e) {
        console.log("Auto-archive error:", e.message);
    }
};
// Initial setup
insertPredefinedHazardsIntoDB();
setTimeout(() => fetchHazardNewsAPI(), 3000);
setInterval(fetchHazardNewsAPI, 45 * 60 * 1000);
setInterval(autoArchiveResolved, 60 * 60 * 1000);
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir))
    fs.mkdirSync(uploadDir);
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });
// ============ API ROUTES ============
app.get('/api/reports', (req, res) => {
    db.query('SELECT * FROM hazard_reports ORDER BY created_at DESC', (err, results) => {
        if (err)
            return res.status(500).json(err);
        res.json(results);
    });
});
app.get('/api/user-reports/:userId', (req, res) => {
    const userId = req.params.userId;
    db.query('SELECT * FROM hazard_reports WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, results) => {
        if (err)
            return res.status(500).json(err);
        res.json(results);
    });
});
app.get('/api/social-alerts', (req, res) => {
    db.query('SELECT * FROM social_alerts ORDER BY created_at DESC LIMIT 100', (err, results) => {
        if (err)
            return res.status(500).json([]);
        res.json(results);
    });
});
app.get('/api/archived-reports', (req, res) => {
    db.query('SELECT * FROM hazard_archive ORDER BY archived_at DESC', (err, results) => {
        if (err)
            return res.status(500).json(err);
        res.json(results);
    });
});
app.post('/api/restore-hazard/:id', (req, res) => {
    const archiveId = req.params.id;
    db.query('SELECT * FROM hazard_archive WHERE id = ?', [archiveId], (err, archived) => {
        if (!archived || archived.length === 0) {
            return res.status(404).json({ error: "Not found" });
        }
        const hazard = archived[0];
        db.query('INSERT INTO hazard_reports (reporter_name, reporter_email, hazard_type, location, severity, latitude, longitude, photo_url, impact_radius, risk_count, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [hazard.reporter_name, hazard.reporter_email, hazard.hazard_type, hazard.location, hazard.severity, hazard.latitude, hazard.longitude, hazard.photo_url, hazard.impact_radius, hazard.risk_count, hazard.status, hazard.created_at], (err2) => {
            if (err2)
                return res.status(500).json(err2);
            db.query('DELETE FROM hazard_archive WHERE id = ?', [archiveId], (err3) => {
                if (err3)
                    return res.status(500).json(err3);
                sendPopupNotification('SUCCESS', ' Restored', `${hazard.hazard_type} restored`);
                res.json({ success: true });
            });
        });
    });
});
app.delete('/api/permanent-delete/:id', async (req, res) => {
    const archiveId = req.params.id;
    console.log(`\n PERMANENT DELETE from archive: ID ${archiveId}`);
    // First get the archived hazard details to send email
    db.query('SELECT * FROM hazard_archive WHERE id = ?', [archiveId], async (err, archived) => {
        if (err) {
            console.error(" Error fetching archived hazard:", err);
            return res.status(500).json({ error: err.message });
        }
        if (!archived || archived.length === 0) {
            return res.status(404).json({ error: "Archived hazard not found" });
        }
        const hazard = archived[0];
        console.log(` Archived hazard found:`);
        console.log(` Reporter: ${hazard.reporter_name}`);
        console.log(` Email: ${hazard.reporter_email}`);
        console.log(` Hazard: ${hazard.hazard_type}`);
        console.log(` Location: ${hazard.location}`);
        // SEND DELETION EMAIL TO REPORTER
        let emailSent = false;
        if (hazard.reporter_email && hazard.reporter_email !== 'undefined' && hazard.reporter_email !== 'null') {
            console.log(`\n Sending permanent deletion email to: ${hazard.reporter_email}`);
            try {
                const mailOptions = {
                    from: `"OceanPulse System" <${process.env.EMAIL_USER}>`,
                    to: hazard.reporter_email,
                    subject: ` Your Hazard Report has been Permanently Deleted - OceanPulse`,
                    html: `
                        <div style="font-family: Arial; max-width: 600px; margin: auto; padding: 20px; border: 2px solid #dc3545; border-radius: 10px;">
                            <h2 style="color: #dc3545;"> HAZARD REPORT PERMANENTLY DELETED</h2>
                            <p>Dear ${hazard.reporter_name},</p>
                            <p>Your reported hazard has been <strong>permanently deleted</strong> from the OceanPulse system.</p>
                            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
                                <p><strong> Hazard:</strong> ${hazard.hazard_type}</p>
                                <p><strong> Location:</strong> ${hazard.location}</p>
                                <p><strong> Severity:</strong> ${hazard.severity}</p>
                                <p><strong> Originally Reported:</strong> ${new Date(hazard.created_at).toLocaleString()}</p>
                                <p><strong> Archived Date:</strong> ${new Date(hazard.archived_at).toLocaleString()}</p>
                                <p><strong> Permanently Deleted:</strong> ${new Date().toLocaleString()}</p>
                            </div>
                            <div style="background: #fff3cd; padding: 12px; border-radius: 8px; margin-top: 15px;">
                                <p style="margin: 0;"> If you believe this was a mistake, please contact the administrator.</p>
                            </div>
                            <hr>
                            <p style="font-size: 12px; color: #666;">OceanPulse Hazard Monitoring System</p>
                        </div>
                    `
                };
                const info = await transporter.sendMail(mailOptions);
                console.log(` PERMANENT DELETION EMAIL SENT to: ${hazard.reporter_email}`);
                console.log(`   Message ID: ${info.messageId}`);
                emailSent = true;
                sendPopupNotification('EMAIL_SENT', ' Deletion Email Sent', `Email sent to ${hazard.reporter_name}`);
            }
            catch (emailError) {
                console.error(` Failed to send deletion email:`, emailError.message);
                sendPopupNotification('EMAIL_FAILED', ' Email Failed', `Could not send deletion email to ${hazard.reporter_name}`);
                emailSent = false;
            }
        }
        else {
            console.log(` No valid email address for reporter: ${hazard.reporter_name}`);
        }
        // Now delete from archive
        db.query('DELETE FROM hazard_archive WHERE id = ?', [archiveId], (err2) => {
            if (err2) {
                console.error(" Error deleting from archive:", err2);
                return res.status(500).json({ error: err2.message });
            }
            console.log(` Hazard permanently deleted from archive! Email sent: ${emailSent ? "YES" : "NO"}`);
            sendPopupNotification('SUCCESS', ' Permanently Deleted', `${hazard.hazard_type} at ${hazard.location} deleted. ${emailSent ? 'Email sent to reporter.' : 'No email sent.'}`);
            res.json({ success: true, emailSent: emailSent });
        });
    });
});
app.post('/api/archive-hazard/:id', async (req, res) => {
    if (!adminEditMode) {
        return res.status(403).json({ error: 'Edit mode required' });
    }
    const { reason } = req.body;
    const hazardId = req.params.id;
    db.query('SELECT * FROM hazard_reports WHERE id = ?', [hazardId], async (err, hazards) => {
        if (err || hazards.length === 0)
            return res.status(404).json({ error: "Hazard not found" });
        const hazard = hazards[0];
        if (hazard.reporter_email) {
            await sendArchiveEmailToReporter(hazard, reason);
        }
        db.query('INSERT INTO hazard_archive (original_id, reporter_name, reporter_email, hazard_type, location, severity, latitude, longitude, photo_url, impact_radius, risk_count, status, created_at, deletion_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [hazard.id, hazard.reporter_name, hazard.reporter_email, hazard.hazard_type, hazard.location, hazard.severity, hazard.latitude, hazard.longitude, hazard.photo_url, hazard.impact_radius, hazard.risk_count, hazard.status, hazard.created_at, reason], async (err2) => {
            if (err2)
                return res.status(500).json(err2);
            db.query('DELETE FROM hazard_reports WHERE id = ?', [hazardId], async (err3) => {
                if (err3)
                    return res.status(500).json(err3);
                sendPopupNotification('SUCCESS', ' Archived', `${hazard.hazard_type} archived`);
                res.json({ success: true });
            });
        });
    });
});
app.post('/api/reports', upload.single('photo'), async (req, res) => {
    const { reporter_name, hazard_type, location, severity, impact_radius, risk_count, reporter_email, user_id } = req.body;
    const photo_url = req.file ? req.file.filename : null;
    const validImpactRadius = impact_radius && impact_radius !== '' ? parseInt(impact_radius) : 0;
    const validRiskCount = risk_count && risk_count !== '' ? parseInt(risk_count) : 0;
    const sql = `INSERT INTO hazard_reports (reporter_name, reporter_email, hazard_type, location, severity, latitude, longitude, photo_url, impact_radius, risk_count, status, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)`;
    db.query(sql, [reporter_name, reporter_email, hazard_type, location, severity, 13.0827, 80.2707, photo_url, validImpactRadius, validRiskCount, user_id], async (err, result) => {
        if (err)
            return res.status(500).json({ error: err.message });
        const reportData = {
            id: result.insertId, reporter_name, reporter_email, hazard_type, location,
            severity, impact_radius: validImpactRadius, risk_count: validRiskCount, photo_url
        };
        const fullPhotoUrl = photo_url ? `http://localhost:5000/api/view-image/${photo_url}` : null;
        await sendReportToAdmin(reportData, fullPhotoUrl);
        sendPopupNotification('SUCCESS', ' Report Submitted', `Your ${hazard_type} report sent`);
        res.status(201).json({ message: 'Report submitted successfully', id: result.insertId });
    });
});
app.patch('/api/reports/:id/status', async (req, res) => {
    if (!adminEditMode) {
        return res.status(403).json({ error: 'Edit mode required' });
    }
    const { status } = req.body;
    const reportId = req.params.id;
    db.query('SELECT * FROM hazard_reports WHERE id = ?', [reportId], async (err, reports) => {
        if (err)
            return res.status(500).json({ error: err.message });
        if (!reports || reports.length === 0)
            return res.status(404).json({ error: "Report not found" });
        const report = reports[0];
        const oldStatus = report.status;
        db.query('UPDATE hazard_reports SET status = ? WHERE id = ?', [status, reportId], async (err2) => {
            if (err2)
                return res.status(500).json({ error: err2.message });
            if (report.reporter_email && oldStatus !== status) {
                await sendStatusEmailToReporter(report, status, oldStatus);
            }
            sendPopupNotification('SUCCESS', ' Status Updated', `${report.hazard_type} → ${status}`);
            res.json({ msg: 'ok' });
        });
    });
});
// ============================================
// DELETE REPORT - FULLY WORKING WITH EMAIL
// ============================================
app.delete('/api/reports/:id', async (req, res) => {
    console.log("\n" + "=".repeat(60));
    console.log(" DELETE REQUEST RECEIVED");
    console.log("=".repeat(60));
    const reportId = req.params.id;
    if (!adminEditMode) {
        console.log(" Edit mode not enabled");
        sendPopupNotification('ERROR', ' Edit Mode Required', 'Enable edit mode with passkey first');
        return res.status(403).json({ error: 'Edit mode required' });
    }
    db.query('SELECT * FROM hazard_reports WHERE id = ?', [reportId], async (err, reports) => {
        if (err) {
            console.error(" Database error:", err);
            return res.status(500).json({ error: err.message });
        }
        if (!reports || reports.length === 0) {
            console.log(" Report not found");
            return res.status(404).json({ error: "Report not found" });
        }
        const report = reports[0];
        console.log(`\n Report found:`);
        console.log(`   ID: ${report.id}`);
        console.log(`   Reporter: ${report.reporter_name}`);
        console.log(`   Email: ${report.reporter_email}`);
        console.log(`   Hazard: ${report.hazard_type}`);
        console.log(`   Location: ${report.location}`);
        // SEND DELETION EMAIL
        let emailSent = false;
        if (report.reporter_email && report.reporter_email !== 'undefined' && report.reporter_email !== 'null') {
            console.log(`\n Sending deletion email to: ${report.reporter_email}`);
            emailSent = await sendDeleteEmailToReporter(report);
        }
        else {
            console.log(`\n No valid email address`);
        }
        // DELETE THE REPORT
        console.log(`\n Deleting report...`);
        db.query('DELETE FROM hazard_reports WHERE id = ?', [reportId], (err2) => {
            if (err2) {
                console.error(" Error deleting:", err2);
                return res.status(500).json({ error: err2.message });
            }
            console.log(` Report deleted! Email sent: ${emailSent ? "YES" : "NO"}`);
            console.log("=".repeat(60) + "\n");
            sendPopupNotification('SUCCESS', ' Deleted', `${report.hazard_type} deleted. ${emailSent ? 'Email sent.' : ''}`);
            res.json({ success: true, emailSent: emailSent });
        });
    });
});
app.get('/api/export-csv', (req, res) => {
    db.query('SELECT * FROM hazard_reports', (err, results) => {
        if (err)
            return res.status(500).send(err);
        const header = "ID,Reporter,Email,Hazard,Location,Severity,Radius,RiskCount,Status,Timestamp\n";
        const rows = results.map((r) => `${r.id},${r.reporter_name},${r.reporter_email || ''},${r.hazard_type},${r.location},${r.severity},${r.impact_radius},${r.risk_count},${r.status},${r.created_at}`).join("\n");
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=OceanPulse_Report.csv');
        res.status(200).send(header + rows);
    });
});
app.get('/api/view-image/:filename', (req, res) => res.sendFile(path.resolve(uploadDir, req.params.filename)));
app.post('/api/test-email', async (req, res) => {
    try {
        const mailOptions = {
            from: `"OceanPulse Test" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER,
            subject: 'OceanPulse Test',
            html: `<p>Test email from OceanPulse</p>`
        };
        await transporter.sendMail(mailOptions);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ USER AUTH ============
app.post('/api/signup', (req, res) => {
    const { username, password, role, email } = req.body;
    db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if (err)
            return res.status(500).json({ error: 'Database error' });
        if (results && results.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        db.query('INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)', [username, password, role, email], (err2, result) => {
            if (err2)
                return res.status(500).json({ error: 'Registration failed' });
            res.status(201).json({ message: 'User created successfully', userId: result.insertId });
        });
    });
});
app.post('/api/login', (req, res) => {
    const { username, password, role } = req.body;
    db.query('SELECT * FROM users WHERE username = ? AND password = ? AND role = ?', [username, password, role], (err, results) => {
        if (err)
            return res.status(500).json({ error: err.message });
        if (results && results.length > 0) {
            res.json(results[0]);
        }
        else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    });
});
