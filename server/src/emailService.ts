// src/emailService.ts
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create transporter using Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Send email to user when hazard report is submitted
export const sendUserReportConfirmation = async (userEmail: string, hazardData: any) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject: '✅ Hazard Report Submitted Successfully',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                    <h2 style="color: #00d2ff;">OceanPulse - Report Confirmation</h2>
                    <p>Dear User,</p>
                    <p>Your hazard report has been successfully submitted to our system.</p>
                    
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <h3 style="margin-top: 0; color: #333;">Report Details:</h3>
                        <p><strong>⚠️ Hazard Type:</strong> ${hazardData.hazard_type}</p>
                        <p><strong>📍 Location:</strong> ${hazardData.location}</p>
                        <p><strong>⚡ Severity:</strong> ${hazardData.severity}</p>
                        <p><strong>📏 Impact Radius:</strong> ${hazardData.impact_radius} KM</p>
                        <p><strong>👥 People Affected:</strong> ${hazardData.risk_count}</p>
                        <p><strong>📅 Reported At:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                    
                    <p>Our team will review your report and take necessary action.</p>
                    <p>You will receive updates when the status changes.</p>
                    
                    <hr style="margin: 20px 0;">
                    <p style="color: #666; font-size: 12px;">This is an automated message from OceanPulse Hazard Monitoring System.</p>
                </div>
            `
        };
        
        await transporter.sendMail(mailOptions);
        console.log(`✅ User confirmation email sent to ${userEmail}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending user email:', error);
        return false;
    }
};

// Send email to admin when new hazard report is submitted
export const sendAdminReportAlert = async (hazardData: any, reporterName: string) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.ADMIN_EMAIL,
            subject: `🚨 NEW HAZARD REPORT: ${hazardData.hazard_type.toUpperCase()} at ${hazardData.location}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ff4444; border-radius: 10px;">
                    <h2 style="color: #ff4444;">🚨 NEW HAZARD REPORTED</h2>
                    
                    <div style="background: ${hazardData.severity === 'High' ? '#ffebee' : '#f5f5f5'}; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <h3 style="margin-top: 0;">Report Details:</h3>
                        <p><strong>⚠️ Hazard Type:</strong> ${hazardData.hazard_type.toUpperCase()}</p>
                        <p><strong>📍 Location:</strong> ${hazardData.location}</p>
                        <p><strong>⚡ Severity:</strong> <span style="color: ${hazardData.severity === 'High' ? '#ff4444' : '#333'}; font-weight: bold;">${hazardData.severity}</span></p>
                        <p><strong>📏 Impact Radius:</strong> ${hazardData.impact_radius} KM</p>
                        <p><strong>👥 People Affected:</strong> ${hazardData.risk_count}</p>
                        <p><strong>👤 Reported By:</strong> ${reporterName}</p>
                        <p><strong>📅 Reported At:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                    
                    <p><strong>Action Required:</strong> Please review this report and update the status.</p>
                    
                    <hr style="margin: 20px 0;">
                    <p style="color: #666; font-size: 12px;">OceanPulse Hazard Monitoring System</p>
                </div>
            `
        };
        
        await transporter.sendMail(mailOptions);
        console.log(`✅ Admin alert email sent for ${hazardData.hazard_type}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending admin email:', error);
        return false;
    }
};

// Send email to user when hazard status is updated
export const sendStatusUpdateEmail = async (userEmail: string, hazardData: any, newStatus: string) => {
    try {
        const statusColor = newStatus === 'Resolved' ? '#00ffaa' : '#ffcc00';
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject: `📋 Hazard Status Updated: ${hazardData.hazard_type}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                    <h2 style="color: #00d2ff;">OceanPulse - Status Update</h2>
                    <p>Dear User,</p>
                    <p>The status of your reported hazard has been updated.</p>
                    
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <h3 style="margin-top: 0;">Update Details:</h3>
                        <p><strong>⚠️ Hazard Type:</strong> ${hazardData.hazard_type}</p>
                        <p><strong>📍 Location:</strong> ${hazardData.location}</p>
                        <p><strong>📊 New Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${newStatus}</span></p>
                        <p><strong>📅 Updated At:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                    
                    ${newStatus === 'Resolved' ? 
                        '<p>✅ This hazard has been resolved. Thank you for your cooperation.</p>' : 
                        '<p>🔄 Our team is actively working on this hazard. We will notify you when it is resolved.</p>'
                    }
                    
                    <hr style="margin: 20px 0;">
                    <p style="color: #666; font-size: 12px;">OceanPulse Hazard Monitoring System</p>
                </div>
            `
        };
        
        await transporter.sendMail(mailOptions);
        console.log(`✅ Status update email sent to ${userEmail}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending status update email:', error);
        return false;
    }
};

// Send high risk alert to admin
export const sendHighRiskAlert = async (hazardData: any) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.ADMIN_EMAIL,
            subject: `⚠️ HIGH RISK HAZARD ALERT - IMMEDIATE ATTENTION REQUIRED ⚠️`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 3px solid #ff0000; border-radius: 10px; background: #fff5f5;">
                    <h2 style="color: #ff0000; text-align: center;">🚨 HIGH RISK HAZARD ALERT 🚨</h2>
                    
                    <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <h3 style="margin-top: 0; color: #ff0000;">Critical Report Details:</h3>
                        <p><strong>⚠️ Hazard Type:</strong> <span style="font-size: 18px;">${hazardData.hazard_type.toUpperCase()}</span></p>
                        <p><strong>📍 Location:</strong> ${hazardData.location}</p>
                        <p><strong>⚡ Severity:</strong> <span style="color: #ff0000; font-weight: bold; font-size: 16px;">HIGH RISK</span></p>
                        <p><strong>📏 Impact Radius:</strong> ${hazardData.impact_radius} KM</p>
                        <p><strong>👥 People Affected:</strong> ${hazardData.risk_count}</p>
                        <p><strong>👤 Reported By:</strong> ${hazardData.reporter_name}</p>
                        <p><strong>📅 Reported At:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                    
                    <p style="color: #ff0000; font-weight: bold;">⚠️ IMMEDIATE ACTION REQUIRED - This is a high priority hazard!</p>
                    
                    <hr style="margin: 20px 0;">
                    <p style="color: #666; font-size: 12px;">OceanPulse Critical Alert System</p>
                </div>
            `
        };
        
        await transporter.sendMail(mailOptions);
        console.log(`✅ High risk alert email sent to admin`);
        return true;
    } catch (error) {
        console.error('❌ Error sending high risk alert:', error);
        return false;
    }
};