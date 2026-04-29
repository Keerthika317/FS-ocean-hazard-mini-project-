// index.ts
import express from 'express';
import { Resend } from 'resend';
import dotenv from 'dotenv'; 
import mysql from 'mysql2';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import nodemailer from 'nodemailer';
import multer from 'multer';


dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const app = express();
const server = http.createServer(app);

// Production URL for photo links in emails
const BACKEND_URL = "https://ocean-hazard-backend-2of1.onrender.com";

// Use FRONTEND_URL from .env so it works locally AND when deployed
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173", process.env.FRONTEND_URL].filter(Boolean),
        methods: ["GET", "POST"],
        credentials: true
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
    if (err) console.error("Error checking user_id column:", err);
    else if ((results as any).length === 0) {
        db.query(`ALTER TABLE hazard_reports ADD COLUMN user_id INT`);
    }
});

db.query(`SHOW COLUMNS FROM hazard_reports LIKE 'reporter_email'`, (err, results) => {
    if (err) console.error("Error checking reporter_email column:", err);
    else if ((results as any).length === 0) {
        db.query(`ALTER TABLE hazard_reports ADD COLUMN reporter_email VARCHAR(255)`);
    }
});

db.query(`SHOW COLUMNS FROM users LIKE 'email'`, (err, results) => {
    if (err) console.error("Error checking email column:", err);
    else if ((results as any).length === 0) {
        db.query(`ALTER TABLE users ADD COLUMN email VARCHAR(255)`);
    }
});

// Store active notifications for popups
const activeNotifications: any[] = [];

io.on('connection', (socket) => {
    console.log("New client connected to Socket.io");
    socket.emit('initial-notifications', activeNotifications);
    socket.on('disconnect', () => {
        console.log("Client disconnected from Socket.io");
    });
});

const sendPopupNotification = (type: string, title: string, message: string, details = {}) => {
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
    if (activeNotifications.length > 100) activeNotifications.pop();
    io.emit('new-notification', notification);
    console.log(`POPUP: ${title} - ${message}`);
};

// ============ EMAIL CONFIGURATION ============
console.log("Email Configuration Check:");
console.log("RESEND_API_KEY:", process.env.RESEND_API_KEY ? "Set" : "Missing");
console.log("ADMIN_EMAIL:", process.env.ADMIN_EMAIL ? "Set" : "Missing");

// Reusable Email Template
const generateEmailHtml = (header: string, reportData: any, photoUrl: string | null, message: string = "") => {
    return `
        <div style="font-family: Arial; max-width: 600px; margin: auto; padding: 20px; border: 2px solid #00d2ff; border-radius: 15px;">
            <h2 style="color: #00d2ff; text-align: center;">${header}</h2>
            ${message ? `<p style="text-align: center; font-weight: bold;">${message}</p>` : ''}
            <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; line-height: 1.6;">
                <p><strong>Hazard Type:</strong> ${reportData.hazard_type}</p>
                <p><strong>Location:</strong> ${reportData.location}</p>
                <p><strong>Severity:</strong> ${reportData.severity}</p>
                <p><strong>Impact Radius:</strong> ${reportData.impact_radius || 0} KM</p>
                <p><strong>People Affected:</strong> ${reportData.risk_count || 0}</p>
                <p><strong>Reporter:</strong> ${reportData.reporter_name}</p>
            </div>
            ${photoUrl ? `<p style="text-align: center; margin-top: 20px;"><a href="${photoUrl}" style="background: #00d2ff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Evidence Photo</a></p>` : ''}
        </div>
    `;
};

// ============ EMAIL FUNCTIONS (NOW ALL USING RESEND) ============

const sendReportToAdmin = async (reportData: any, photoUrl: any) => {
    try {
        await resend.emails.send({
            from: 'OceanPulse <onboarding@resend.dev>',
            to: process.env.ADMIN_EMAIL || '',
            subject: `NEW HAZARD: ${reportData.hazard_type.toUpperCase()} at ${reportData.location}`,
            html: generateEmailHtml("NEW HAZARD REPORTED", reportData, photoUrl)
        });
        console.log("Admin email sent via Resend");
    } catch (error: any) {
        console.error('Admin email error:', error.message);
    }
};

const sendStatusEmailToReporter = async (reportData: any, newStatus: string) => {
    if (!reportData.reporter_email) return;
    try {
        await resend.emails.send({
            from: 'OceanPulse <onboarding@resend.dev>',
            to: reportData.reporter_email,
            subject: `Status Update: ${reportData.hazard_type} - OceanPulse`,
            html: generateEmailHtml("HAZARD STATUS UPDATE", reportData, null, `Your report status has been updated to: ${newStatus}`)
        });
        console.log(`Status email sent to: ${reportData.reporter_email}`);
    } catch (error: any) {
        console.error('Status email error:', error.message);
    }
};

const sendArchiveEmailToReporter = async (reportData: any, reason: string) => {
    if (!reportData.reporter_email) return;
    try {
        await resend.emails.send({
            from: 'OceanPulse <onboarding@resend.dev>',
            to: reportData.reporter_email,
            subject: `Hazard Archived - OceanPulse`,
            html: generateEmailHtml("HAZARD ARCHIVED", reportData, null, `Reason: ${reason}`)
        });
        console.log(`Archive email sent to: ${reportData.reporter_email}`);
    } catch (error: any) {
        console.error('Archive email error:', error.message);
    }
};

const sendDeleteEmailToReporter = async (reportData: any) => {
    if (!reportData.reporter_email) return;
    try {
        await resend.emails.send({
            from: 'OceanPulse <onboarding@resend.dev>',
            to: reportData.reporter_email,
            subject: `Hazard Report Deleted - OceanPulse`,
            html: generateEmailHtml("HAZARD REPORT DELETED", reportData, null, "Your report has been permanently removed from the system.")
        });
        console.log(`Deletion email sent to: ${reportData.reporter_email}`);
    } catch (error: any) {
        console.error(`Deletion email error:`, error.message);
    }
};

// ============ UTILS ============
const getRandomPastDate = () => {
    const now = new Date();
    now.setDate(now.getDate() - Math.floor(Math.random() * 30));
    return now.toISOString().slice(0, 19).replace('T', ' ');
};

// ============ ADMIN ROLE MANAGEMENT ============
let adminEditMode = false;
let adminEditModeExpiry: number | null = null;

app.post('/api/admin/login', (req: any, res: any) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        adminEditMode = false;
        res.json({ id: 1, username: 'admin', role: 'viewer', adminRole: 'viewer' });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.post('/api/admin/verify-passkey', (req: any, res: any) => {
    if (req.body.passkey === process.env.ADMIN_PASSKEY) {
        adminEditMode = true;
        adminEditModeExpiry = Date.now() + 30 * 60 * 1000;
        res.json({ role: 'editor', adminRole: 'editor' });
    } else {
        res.status(401).json({ error: 'Invalid Passkey' });
    }
});

app.get('/api/admin/mode', (req: any, res: any) => {
    if (adminEditModeExpiry && Date.now() > adminEditModeExpiry) adminEditMode = false;
    res.json({ adminRole: adminEditMode ? 'editor' : 'viewer' });
});

app.post('/api/admin/logout', (req: any, res: any) => {
    adminEditMode = false;
    adminEditModeExpiry = null;
    res.json({ message: 'Logged out' });
});

// ============ PREDEFINED HAZARDS ============
const predefinedHazardsList = [
    { id: 1, title: "Tsunami Warning: 7.2 magnitude earthquake in Pacific", location: "Pacific Ocean", hazard: "Tsunami" },
    { id: 2, title: "Cyclone Fengal intensifies in Bay of Bengal", location: "Bay of Bengal", hazard: "Cyclone" },
    { id: 3, title: "Severe flooding in coastal Tamil Nadu", location: "Tamil Nadu Coast", hazard: "Flood" },
    { id: 4, title: "Wildfire threatens California coastline", location: "California Coast", hazard: "Wildfire" },
    { id: 5, title: "Major landslide blocks coastal highway in Kerala", location: "Kerala Coast", hazard: "Landslide" },
    { id: 6, title: "Hurricane Milton strengthens to Category 3", location: "Florida Coast", hazard: "Hurricane" },
    { id: 7, title: "Earthquake of magnitude 6.8 in Andaman Sea", location: "Andaman Sea", hazard: "Earthquake" },
    { id: 8, title: "High waves of 5 meters along Odisha coast", location: "Odisha Coast", hazard: "High Waves" },
    { id: 9, title: "Typhoon Kong-rey hits Philippines", location: "Philippines Coast", hazard: "Typhoon" },
    { id: 10, title: "Storm surge warning for Mumbai coast", location: "Mumbai Coast", hazard: "Storm" }
];

const insertPredefinedHazardsIntoDB = async () => {
    for (const hazard of predefinedHazardsList) {
        const [existing]: any = await db.promise().query('SELECT id FROM social_alerts WHERE content = ? LIMIT 1', [hazard.title]);
        if (existing.length === 0) {
            await db.promise().query(
                'INSERT INTO social_alerts (platform, username, content, location, sentiment, hazard_detected, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['Global Monitor', 'Alert System', hazard.title, hazard.location, 'CRITICAL', hazard.hazard, getRandomPastDate()]
            );
        }
    }
};

// ============ API ROUTES ============

app.get('/api/reports', (req: any, res: any) => {
    db.query('SELECT * FROM hazard_reports ORDER BY created_at DESC', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

app.get('/api/user-reports/:userId', (req: any, res: any) => {
    db.query('SELECT * FROM hazard_reports WHERE user_id = ? ORDER BY created_at DESC', [req.params.userId], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

app.get('/api/social-alerts', (req: any, res: any) => {
    db.query('SELECT * FROM social_alerts ORDER BY created_at DESC LIMIT 100', (err, results) => {
        if (err) return res.status(500).json([]);
        res.json(results);
    });
});

app.get('/api/archived-reports', (req: any, res: any) => {
    db.query('SELECT * FROM hazard_archive ORDER BY archived_at DESC', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

app.post('/api/restore-hazard/:id', (req: any, res: any) => {
    db.query('SELECT * FROM hazard_archive WHERE id = ?', [req.params.id], (err, archived: any) => {
        if (!archived || archived.length === 0) return res.status(404).json({ error: "Not found" });
        const h = archived[0];
        db.query(
            'INSERT INTO hazard_reports (reporter_name, reporter_email, hazard_type, location, severity, latitude, longitude, photo_url, impact_radius, risk_count, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [h.reporter_name, h.reporter_email, h.hazard_type, h.location, h.severity, h.latitude, h.longitude, h.photo_url, h.impact_radius, h.risk_count, h.status, h.created_at],
            () => {
                db.query('DELETE FROM hazard_archive WHERE id = ?', [req.params.id], () => {
                    res.json({ success: true });
                });
            }
        );
    });
});

app.post('/api/reports', multer({ dest: './uploads/' }).single('photo'), (req: any, res: any) => {
    const { reporter_name, hazard_type, location, severity, impact_radius, risk_count, reporter_email, user_id } = req.body;
    const photo_url = req.file ? req.file.filename : null;
    
    const sql = `INSERT INTO hazard_reports (reporter_name, reporter_email, hazard_type, location, severity, latitude, longitude, photo_url, impact_radius, risk_count, status, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)`;
    
    db.query(sql, [reporter_name, reporter_email, hazard_type, location, severity, 13.08, 80.27, photo_url, impact_radius, risk_count, user_id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // 1. Respond immediately for UI speed
        res.status(201).json({ message: 'Report submitted successfully', id: (result as any).insertId });

        // 2. Background tasks
        const reportData = { reporter_name, reporter_email, hazard_type, location, severity, impact_radius, risk_count };
        const fullPhotoUrl = photo_url ? `${BACKEND_URL}/api/view-image/${photo_url}` : null;
        sendPopupNotification('SUCCESS', 'Report Submitted', `New ${hazard_type} report`);
        sendReportToAdmin(reportData, fullPhotoUrl);
    });
});

app.patch('/api/reports/:id/status', (req: any, res: any) => {
    const { status } = req.body;
    db.query('SELECT * FROM hazard_reports WHERE id = ?', [req.params.id], (err, results: any) => {
        if (!results || results.length === 0) return res.status(404).json({ error: "Not found" });
        const report = results[0];
        
        db.query('UPDATE hazard_reports SET status = ? WHERE id = ?', [status, req.params.id], () => {
            res.json({ msg: 'ok' });
            sendStatusEmailToReporter(report, status);
        });
    });
});

app.post('/api/archive-hazard/:id', (req: any, res: any) => {
    db.query('SELECT * FROM hazard_reports WHERE id = ?', [req.params.id], (err, results: any) => {
        if (!results || results.length === 0) return res.status(404).json({ error: "Not found" });
        const report = results[0];
        
        db.query('INSERT INTO hazard_archive (original_id, reporter_name, reporter_email, hazard_type, location, severity, latitude, longitude, photo_url, impact_radius, risk_count, status, deletion_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
            [report.id, report.reporter_name, report.reporter_email, report.hazard_type, report.location, report.severity, report.latitude, report.longitude, report.photo_url, report.impact_radius, report.risk_count, report.status, req.body.reason], () => {
            db.query('DELETE FROM hazard_reports WHERE id = ?', [req.params.id], () => {
                res.json({ success: true });
                sendArchiveEmailToReporter(report, req.body.reason);
            });
        });
    });
});

app.delete('/api/reports/:id', (req: any, res: any) => {
    db.query('SELECT * FROM hazard_reports WHERE id = ?', [req.params.id], (err, results: any) => {
        if (!results || results.length === 0) return res.status(404).json({ error: "Not found" });
        const report = results[0];
        
        db.query('DELETE FROM hazard_reports WHERE id = ?', [req.params.id], () => {
            res.json({ success: true });
            sendDeleteEmailToReporter(report);
        });
    });
});

app.get('/api/view-image/:filename', (req: any, res: any) => res.sendFile(path.resolve('./uploads', req.params.filename)));

app.get('/api/export-csv', (req: any, res: any) => {
    db.query('SELECT * FROM hazard_reports', (err, results: any) => {
        if (err) return res.status(500).send(err);
        const header = "ID,Reporter,Email,Hazard,Location,Severity,Radius,RiskCount,Status,Timestamp\n";
        const rows = results.map((r: any) => `${r.id},${r.reporter_name},${r.reporter_email || ''},${r.hazard_type},${r.location},${r.severity},${r.impact_radius},${r.risk_count},${r.status},${r.created_at}`).join("\n");
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=OceanPulse_Report.csv');
        res.status(200).send(header + rows);
    });
});

// ============ AUTH ============
app.post('/api/signup', (req: any, res: any) => {
    const { username, password, role, email } = req.body;
    db.query('INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)', [username, password, role, email], (err, result: any) => {
        if (err) return res.status(400).json({ error: 'Username already exists' });
        res.status(201).json({ message: 'Success', userId: result.insertId });
    });
});

app.post('/api/login', (req: any, res: any) => {
    const { username, password, role } = req.body;
    db.query('SELECT * FROM users WHERE username=? AND password=? AND role=?', [username, password, role], (err, results: any) => {
        if (results && results.length > 0) res.json(results[0]);
        else res.status(401).json({ error: 'Invalid credentials' });
    });
});