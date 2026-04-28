import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import io from 'socket.io-client';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { toast, Toaster } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
// Custom marker icons based on hazard severity
const getHazardIcon = (severity, hazardType) => {
  let color = '#00d2ff';
  
  if (severity === 'critical') color = '#ff0000';
  else if (severity === 'high') color = '#ff6600';
  else if (severity === 'medium') color = '#ffcc00';
  else if (severity === 'low') color = '#00ffaa';
  
  return L.divIcon({
    html: `<div style="background-color: ${color}; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 0 15px rgba(0,0,0,0.3);">
            <span style="color: white; font-size: 18px; font-weight: bold;">!</span>
           </div>`,
    className: 'custom-div-icon',
    iconSize: [36, 36],
    popupAnchor: [0, -18]
  });
};

// Strategic Red Icon for Chennai
const redIcon = L.icon({ 
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png", 
    iconSize: [40, 50], 
    iconAnchor: [20, 50],
    popupAnchor: [1, -40]
});

function RecenterMap() {
    const map = useMap();
    useEffect(() => { map.setView([13.0827, 80.2707], 8); }, [map]);
    return null;
}

// Confirmation Popup Component
const ConfirmationPopup = ({ isOpen, onClose, onConfirm, title, message, showReason = false, onReasonChange, reasonOptions = [] }) => {
    if (!isOpen) return null;
    
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 3000, backdropFilter: 'blur(5px)'
        }}>
            <div style={{
                background: '#1e1e2e', padding: '30px', borderRadius: '20px',
                maxWidth: '450px', width: '90%', border: '2px solid #00d2ff',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}>
                <h3 style={{ color: '#00d2ff', marginBottom: '15px', fontSize: '24px' }}>{title}</h3>
                <p style={{ color: '#fff', marginBottom: '20px', lineHeight: '1.6' }}>{message}</p>
                
                {showReason && (
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ color: '#aaa', display: 'block', marginBottom: '8px', fontSize: '14px' }}>Reason for archiving:</label>
                        <select onChange={(e) => onReasonChange(e.target.value)} style={{
                            width: '100%', padding: '12px', background: '#2a2a3a',
                            color: '#fff', border: '1px solid #444', borderRadius: '10px',
                            fontSize: '14px', cursor: 'pointer'
                        }}>
                            <option value="">Select a reason...</option>
                            {reasonOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                )}
                
                <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{
                        padding: '10px 25px', background: 'transparent',
                        border: '1px solid #666', color: '#fff', borderRadius: '10px',
                        cursor: 'pointer', fontSize: '14px', transition: '0.3s'
                    }}>Cancel</button>
                    <button onClick={onConfirm} style={{
                        padding: '10px 25px', background: '#ff4444',
                        border: 'none', color: '#fff', borderRadius: '10px',
                        cursor: 'pointer', fontSize: '14px', fontWeight: 'bold',
                        transition: '0.3s'
                    }}>Confirm</button>
                </div>
            </div>
        </div>
    );
};

// Recycle Bin Component - WITH DELETE BUTTON HERE
// Recycle Bin Component - WITH DELETE BUTTON HERE
const RecycleBin = ({ isOpen, onClose, archivedHazards, onRestore, onPermanentDelete, finalStyles }) => {
    if (!isOpen) return null;
    
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.95)', zIndex: 2500, overflow: 'auto',
            padding: '20px'
        }}>
            <div style={{
                maxWidth: '1200px', margin: '40px auto', background: finalStyles.surface,
                borderRadius: '20px', padding: '30px', border: `2px solid ${finalStyles.primary}`,
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <h2 style={{ color: finalStyles.primary, fontSize: '28px' }}> Recycle Bin / Archive</h2>
                    <button onClick={onClose} style={{
                        background: 'transparent', border: `1px solid ${finalStyles.border}`,
                        color: finalStyles.text, borderRadius: '50%', width: '40px', height: '40px',
                        cursor: 'pointer', fontSize: '20px', transition: '0.3s'
                    }}>X</button>
                </div>
                
                {archivedHazards.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '80px', color: finalStyles.textSecondary, fontSize: '18px' }}>
                         No archived hazards
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: `2px solid ${finalStyles.border}`, background: `${finalStyles.primary}15` }}>
                                    <th style={{ padding: '15px', fontSize: '14px' }}> HAZARD</th>
                                    <th style={{ padding: '15px', fontSize: '14px' }}> LOCATION</th>
                                    <th style={{ padding: '15px', fontSize: '14px' }}> SEVERITY</th>
                                    <th style={{ padding: '15px', fontSize: '14px' }}> ARCHIVED DATE</th>
                                    <th style={{ padding: '15px', fontSize: '14px' }}> REASON</th>
                                    <th style={{ padding: '15px', fontSize: '14px' }}> ACTIONS</th>
                                  </tr>
                            </thead>
                            <tbody>
                                {archivedHazards.map(h => (
                                    <tr key={h.id} style={{ borderBottom: `1px solid ${finalStyles.border}` }}>
                                        <td style={{ padding: '15px', fontWeight: 'bold' }}>{h.hazard_type?.toUpperCase()}</td>
                                        <td style={{ padding: '15px' }}>{h.location}</td>
                                        <td style={{ padding: '15px' }}>
                                            <span style={{
                                                background: h.severity === 'High' ? '#ff444420' : h.severity === 'Medium' ? '#ffcc0020' : '#00ffaa20',
                                                color: h.severity === 'High' ? '#ff4444' : h.severity === 'Medium' ? '#ffcc00' : '#00ffaa',
                                                padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold'
                                            }}>{h.severity}</span>
                                        </td>
                                        <td style={{ padding: '15px', fontSize: '13px' }}>{new Date(h.archived_at).toLocaleDateString()}</td>
                                        <td style={{ padding: '15px', fontSize: '13px', color: finalStyles.textSecondary }}>{h.deletion_reason}</td>
                                        <td style={{ padding: '15px' }}>
                                            <button onClick={() => onRestore(h.id)} style={{
                                                background: finalStyles.success, border: 'none',
                                                padding: '8px 15px', borderRadius: '8px', cursor: 'pointer',
                                                marginRight: '8px', color: '#000', fontWeight: 'bold'
                                            }}> Restore</button>
                                            <button onClick={() => onPermanentDelete(h.id)} style={{
                                                background: '#dc3545', border: 'none',
                                                padding: '8px 15px', borderRadius: '8px', cursor: 'pointer',
                                                color: '#fff', fontWeight: 'bold'
                                            }}> DELETE PERMANENTLY</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

// Map Filters Component
const MapFilters = ({ filters, onFilterChange, hazardTypes, finalStyles }) => {
    return (
        <div style={{
            position: 'absolute', top: '20px', right: '20px', zIndex: 1000,
            background: finalStyles.surface, borderRadius: '15px', padding: '18px',
            border: `1px solid ${finalStyles.border}`, boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
            minWidth: '230px', backdropFilter: 'blur(10px)'
        }}>
            <h4 style={{ color: finalStyles.primary, margin: '0 0 15px 0' }}>Map Filters</h4>
            
            <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', color: finalStyles.textSecondary }}>Hazard Type:</label>
                <select value={filters.hazardType} onChange={(e) => onFilterChange('hazardType', e.target.value)} style={{
                    width: '100%', padding: '8px 12px', background: finalStyles.surfaceLight,
                    color: finalStyles.text, border: `1px solid ${finalStyles.border}`,
                    borderRadius: '8px', cursor: 'pointer'
                }}>
                    <option value="All">All Hazards</option>
                    {hazardTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
            </div>
            
            <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', color: finalStyles.textSecondary }}>Severity:</label>
                <select value={filters.severity} onChange={(e) => onFilterChange('severity', e.target.value)} style={{
                    width: '100%', padding: '8px 12px', background: finalStyles.surfaceLight,
                    color: finalStyles.text, border: `1px solid ${finalStyles.border}`,
                    borderRadius: '8px', cursor: 'pointer'
                }}>
                    <option value="All">All Severities</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                </select>
            </div>
            
            <div style={{ marginBottom: '15px' }}>
                <label style={{ fontSize: '12px', color: finalStyles.textSecondary }}>Status:</label>
                <select value={filters.status} onChange={(e) => onFilterChange('status', e.target.value)} style={{
                    width: '100%', padding: '8px 12px', background: finalStyles.surfaceLight,
                    color: finalStyles.text, border: `1px solid ${finalStyles.border}`,
                    borderRadius: '8px', cursor: 'pointer'
                }}>
                    <option value="All">All Status</option>
                    <option value="Pending"> Pending</option>
                    <option value="In-Progress"> In-Progress</option>
                    <option value="Resolved"> Resolved</option>
                </select>
            </div>
            
            <button onClick={() => onFilterChange('reset', null)} style={{
                width: '100%', padding: '8px', background: finalStyles.primary,
                border: 'none', borderRadius: '8px', color: '#000', cursor: 'pointer',
                fontWeight: 'bold', transition: '0.3s'
            }}>Reset Filters</button>
            
            <div style={{ marginTop: '15px', paddingTop: '12px', borderTop: `1px solid ${finalStyles.border}` }}>
                <div style={{ fontSize: '11px', color: finalStyles.textSecondary, marginBottom: '8px' }}>Color Legend:</div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff0000' }}></div>
                        <span style={{ fontSize: '11px' }}>Critical</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff6600' }}></div>
                        <span style={{ fontSize: '11px' }}>High</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffcc00' }}></div>
                        <span style={{ fontSize: '11px' }}>Medium</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#00ffaa' }}></div>
                        <span style={{ fontSize: '11px' }}>Low</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Profile Page Component
const ProfilePage = ({ user, stats, finalStyles, onBack }) => {
    return (
        <div style={{ background: finalStyles.background, minHeight: '100vh', color: finalStyles.text, padding: '40px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <button onClick={onBack} style={{
                    background: 'transparent', border: `1px solid ${finalStyles.primary}`,
                    color: finalStyles.primary, padding: '12px 24px', borderRadius: '10px',
                    cursor: 'pointer', marginBottom: '30px', transition: '0.3s'
                }}>Back to Dashboard</button>
                
                <div style={{ background: finalStyles.surface, borderRadius: '25px', padding: '45px', border: `1px solid ${finalStyles.border}`, textAlign: 'center' }}>
                    <div style={{
                        width: '130px', height: '130px', borderRadius: '50%', background: finalStyles.primary,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
                        fontSize: '3.5rem', fontWeight: 'bold', color: '#000'
                    }}>{user?.username?.charAt(0).toUpperCase()}</div>
                    
                    <h2 style={{ color: finalStyles.primary, marginBottom: '8px' }}>{user?.username}</h2>
                    <p style={{ color: finalStyles.textSecondary, marginBottom: '35px' }}>{user?.role?.toUpperCase()} • Verified Account</p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '10px' }}>
                        <div style={{ padding: '25px 15px', background: finalStyles.surfaceLight, borderRadius: '15px', border: `1px solid ${finalStyles.border}` }}>
                            <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: finalStyles.primary }}>{stats?.userCount || 0}</div>
                            <div style={{ fontSize: '12px', color: finalStyles.textSecondary }}>Reports Submitted</div>
                        </div>
                        <div style={{ padding: '25px 15px', background: finalStyles.surfaceLight, borderRadius: '15px', border: `1px solid ${finalStyles.border}` }}>
                            <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: finalStyles.success }}>Active</div>
                            <div style={{ fontSize: '12px', color: finalStyles.textSecondary }}>Account Status</div>
                        </div>
                        <div style={{ padding: '25px 15px', background: finalStyles.surfaceLight, borderRadius: '15px', border: `1px solid ${finalStyles.border}` }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: finalStyles.primary }}>Coastal Defense</div>
                            <div style={{ fontSize: '12px', color: finalStyles.textSecondary }}>Department</div>
                        </div>
                        <div style={{ padding: '25px 15px', background: finalStyles.surfaceLight, borderRadius: '15px', border: `1px solid ${finalStyles.border}` }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: finalStyles.warning }}>{user?.role === 'administrator' ? 'Full Access' : 'Reporting Access'}</div>
                            <div style={{ fontSize: '12px', color: finalStyles.textSecondary }}>Permissions</div>
                        </div>
                    </div>
                    
                    <div style={{ marginTop: '30px', padding: '25px', background: finalStyles.surfaceLight, borderRadius: '15px', textAlign: 'left', border: `1px solid ${finalStyles.border}` }}>
                        <h4 style={{ color: finalStyles.primary, marginBottom: '20px' }}>Account Details</h4>
                        <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${finalStyles.border}`, paddingBottom: '8px' }}>
                            <strong>User ID:</strong> <span>{user?.id || 'N/A'}</span>
                        </div>
                        <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${finalStyles.border}`, paddingBottom: '8px' }}>
                            <strong>Username:</strong> <span>{user?.username}</span>
                        </div>
                        <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${finalStyles.border}`, paddingBottom: '8px' }}>
                            <strong>Email:</strong> <span>{user?.email || 'Not provided'}</span>
                        </div>
                        <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${finalStyles.border}`, paddingBottom: '8px' }}>
                            <strong>Role:</strong> <span>{user?.role?.toUpperCase()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong>Member Since:</strong> <span>{new Date().toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Settings Page Component
const SettingsPage = ({ finalStyles, theme, setTheme, highContrast, setHighContrast, fontSize, setFontSize, notificationsEnabled, setNotificationsEnabled, autoRefresh, setAutoRefresh, user, stats, role, onBack }) => {
    return (
        <div style={{ background: finalStyles.background, minHeight: '100vh', color: finalStyles.text, padding: '40px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <button onClick={onBack} style={{
                    background: 'transparent', border: `1px solid ${finalStyles.primary}`,
                    color: finalStyles.primary, padding: '12px 24px', borderRadius: '10px',
                    cursor: 'pointer', marginBottom: '30px', transition: '0.3s'
                }}>Back to Dashboard</button>
                
                <div style={{ background: finalStyles.surface, borderRadius: '25px', padding: '45px', border: `1px solid ${finalStyles.border}` }}>
                    <h2 style={{ color: finalStyles.primary, marginBottom: '35px' }}> Settings</h2>

                    <div style={{ marginBottom: '35px', padding: '25px', background: finalStyles.surfaceLight, borderRadius: '15px' }}>
                        <h4 style={{ color: finalStyles.primary, marginBottom: '20px' }}> Appearance</h4>
                        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                            <button onClick={() => setTheme('dark')} style={{
                                padding: '12px 30px', background: theme === 'dark' ? finalStyles.primary : 'transparent',
                                color: theme === 'dark' ? '#000' : finalStyles.text, border: `2px solid ${finalStyles.primary}`,
                                borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold'
                            }}> Dark Mode</button>
                            <button onClick={() => setTheme('light')} style={{
                                padding: '12px 30px', background: theme === 'light' ? finalStyles.primary : 'transparent',
                                color: theme === 'light' ? '#000' : finalStyles.text, border: `2px solid ${finalStyles.primary}`,
                                borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold'
                            }}> Light Mode</button>
                        </div>
                    </div>

                    <div style={{ marginBottom: '35px', padding: '25px', background: finalStyles.surfaceLight, borderRadius: '15px' }}>
                        <h4 style={{ color: finalStyles.primary, marginBottom: '20px' }}> Accessibility</h4>
                        <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>High Contrast Mode</span>
                            <input type="checkbox" checked={highContrast} onChange={(e) => setHighContrast(e.target.checked)} style={{ width: '22px', height: '22px', cursor: 'pointer' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Font Size: </span>
                            <select value={fontSize} onChange={(e) => setFontSize(e.target.value)} style={{
                                padding: '8px 15px', background: finalStyles.surface, color: finalStyles.text,
                                border: `1px solid ${finalStyles.border}`, borderRadius: '8px', cursor: 'pointer'
                            }}>
                                <option value="small">Small</option>
                                <option value="normal">Normal</option>
                                <option value="large">Large</option>
                                <option value="xlarge">X-Large</option>
                            </select>
                        </div>
                    </div>

                    {user && user.role !== 'administrator' && (
                        <div style={{ marginBottom: '35px', padding: '25px', background: finalStyles.surfaceLight, borderRadius: '15px' }}>
                            <h4 style={{ color: finalStyles.primary, marginBottom: '20px' }}> Your Email Address</h4>
                            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${finalStyles.border}`, paddingBottom: '8px' }}>
                                <strong>Registered Email:</strong> <span style={{ color: finalStyles.primary, fontWeight: 'bold' }}>{user?.email || 'Not provided'}</span>
                            </div>
                            <p style={{ fontSize: '12px', color: finalStyles.textSecondary }}>This email will receive all hazard report notifications and status updates.</p>
                        </div>
                    )}

                    {role === 'administrator' && (
                        <div style={{ marginBottom: '35px', padding: '25px', background: finalStyles.surfaceLight, borderRadius: '15px' }}>
                            <h4 style={{ color: finalStyles.primary, marginBottom: '20px' }}> Admin Configuration</h4>
                            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${finalStyles.border}`, paddingBottom: '8px' }}>
                                <strong>Admin Username:</strong> <span style={{ color: finalStyles.primary, fontWeight: 'bold' }}>admin</span>
                            </div>
                            <p style={{ fontSize: '12px', color: finalStyles.textSecondary }}>Admin access is granted via username and password only.</p>
                        </div>
                    )}

                    <div style={{ marginBottom: '35px', padding: '25px', background: finalStyles.surfaceLight, borderRadius: '15px' }}>
                        <h4 style={{ color: finalStyles.primary, marginBottom: '20px' }}> Notifications</h4>
                        <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Enable Browser Notifications</span>
                            <input type="checkbox" checked={notificationsEnabled} onChange={(e) => setNotificationsEnabled(e.target.checked)} style={{ width: '22px', height: '22px', cursor: 'pointer' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Auto-refresh Data (15s)</span>
                            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} style={{ width: '22px', height: '22px', cursor: 'pointer' }} />
                        </div>
                    </div>

                    <div style={{ padding: '25px', background: finalStyles.surfaceLight, borderRadius: '15px' }}>
                        <h4 style={{ color: finalStyles.primary, marginBottom: '20px' }}> System Information</h4>
                        <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                            <strong>Version:</strong> <span>OceanPulse v3.0</span>
                        </div>
                        <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                            <strong>Total Hazards Detected:</strong> <span>{stats?.total || 0}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong>Active Users:</strong> <span>{stats?.userCount || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Report Form Component
const ReportForm = ({ user, refresh, finalStyles }) => {
    const [f, setF] = useState({ type: '', radius: '', risk: '', location: '', severity: 'Low', email: '' });
    const [file, setFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    useEffect(() => {
        if (user?.email) setF(prev => ({ ...prev, email: user.email }));
    }, [user]);
    
    const submit = async (e) => { 
        e.preventDefault(); 
        if(!file) {
            toast.error(" Please upload evidence photo");
            return;
        }
        if(!f.email) {
            toast.error(" Please enter your email address for notifications");
            return;
        }
        if(!f.radius) {
            toast.error(" Please enter impact radius");
            return;
        }
        if(!f.risk) {
            toast.error(" Please enter affected population");
            return;
        }
        
        setIsSubmitting(true);
        const fd = new FormData(); 
        fd.append('reporter_name', user.username); 
        fd.append('reporter_email', f.email);
        fd.append('user_id', user.id);
        fd.append('hazard_type', f.type); 
        fd.append('location', f.location); 
        fd.append('severity', f.severity); 
        fd.append('impact_radius', f.radius); 
        fd.append('risk_count', f.risk); 
        fd.append('latitude', 13.0827); 
        fd.append('longitude', 80.2707); 
        fd.append('photo', file);
        
        try {
           await axios.post(`${API_URL}/api/reports`, fd);
            toast.success("Report Submitted Successfully! Admin has been notified.");
            refresh(); 
            setF({ type: '', radius: '', risk: '', location: '', severity: 'Low', email: user?.email || '' }); 
            setFile(null); 
        } catch (error) {
            toast.error(error.response?.data?.error || " Failed to submit report. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <form onSubmit={submit} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
            <input style={{...sInput, background: finalStyles.surfaceLight, color: finalStyles.text, borderColor: finalStyles.border}} 
                placeholder=" Hazard Type (e.g. Flood)" onChange={e => setF({...f, type: e.target.value})} required />
            <input style={{...sInput, background: finalStyles.surfaceLight, color: finalStyles.text, borderColor: finalStyles.border}} 
                placeholder=" Area Name" onChange={e => setF({...f, location: e.target.value})} required />
            <input style={{...sInput, background: finalStyles.surfaceLight, color: finalStyles.text, borderColor: finalStyles.border}} 
                placeholder=" Radius (KM)" type="number" onChange={e => setF({...f, radius: e.target.value})} required />
            <input style={{...sInput, background: finalStyles.surfaceLight, color: finalStyles.text, borderColor: finalStyles.border}} 
                placeholder=" Affected Population" type="number" onChange={e => setF({...f, risk: e.target.value})} required />
            <input style={{...sInput, background: finalStyles.surfaceLight, color: finalStyles.text, borderColor: finalStyles.border}} 
                placeholder=" Your Email (for notifications)" type="email" value={f.email} onChange={e => setF({...f, email: e.target.value})} required />
            <div style={{display:'flex', gap:'20px', justifyContent:'center', padding: '10px 0'}}>
                {['Low', 'Medium', 'High'].map(l => (
                    <label key={l} style={{cursor:'pointer', fontSize:'14px', color: l === 'High' ? finalStyles.danger : finalStyles.text, display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <input type="radio" name="severity" checked={f.severity === l} onChange={() => setF({...f, severity: l})} style={{width: '18px', height: '18px', cursor: 'pointer'}} /> {l}
                    </label>
                ))}
            </div>
            <div style={{ background: finalStyles.surfaceLight, padding: '15px', borderRadius: '10px', border: `1px dashed ${finalStyles.primary}` }}>
                <input type="file" onChange={e => setFile(e.target.files[0])} style={{fontSize: '14px', color: finalStyles.text, width: '100%'}} required />
                <p style={{ fontSize: '11px', color: finalStyles.textSecondary, marginTop: '8px' }}>Upload evidence photo (required)</p>
            </div>
            <button style={{...sBtn, background: finalStyles.primary, color: '#000', padding: '14px', fontSize: '16px', fontWeight: 'bold', marginTop: '10px'}} type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'SUBMITTING...' : ' DISPATCH COMMAND'}
            </button>
        </form>
    );
};

// Admin Login Component (Username + Password only)
const AdminLoginForm = ({ onLogin, finalStyles, isLoading, setIsLoading }) => {
    const [adminData, setAdminData] = useState({ username: '', password: '' });
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        
        if (!adminData.username || !adminData.password) {
            alert(" Username and password are required");
            setIsLoading(false);
            return;
        }
        
        try {
            const response = await axios.post(`${API_URL}/api/admin/login`, adminData);
            if (response.data) {
                toast.success(" Admin login successful! (View Mode)");
                onLogin(response.data);
            }
        } catch (error) {
            const errorMsg = error.response?.data?.error || " Invalid username or password";
            alert(errorMsg);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <input 
                style={{ padding: '15px', background: 'rgba(255,255,255,0.1)', border: '1px solid #444', color: 'white', borderRadius: '12px', outline: 'none', fontSize: '14px', width: '100%' }} 
                type="text" 
                placeholder=" Admin Username" 
                value={adminData.username} 
                onChange={e => setAdminData({...adminData, username: e.target.value})} 
                required 
            />
            <input 
                style={{ padding: '15px', background: 'rgba(255,255,255,0.1)', border: '1px solid #444', color: 'white', borderRadius: '12px', outline: 'none', fontSize: '14px', width: '100%' }} 
                type="password" 
                placeholder=" Password" 
                value={adminData.password} 
                onChange={e => setAdminData({...adminData, password: e.target.value})} 
                required 
            />
            <button style={{ padding: '16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }} type="submit" disabled={isLoading}>
                {isLoading ? 'LOGGING IN...' : 'ADMIN LOGIN'}
            </button>
        </form>
    );
};

// Main Dashboard Component
const Dashboard = ({ user, role, setView, setUser, finalStyles, theme, setTheme, highContrast, setHighContrast, fontSize, setFontSize, notificationsEnabled, setNotificationsEnabled, autoRefresh, setAutoRefresh }) => {
    const [reports, setReports] = useState([]);
    const [archivedHazards, setArchivedHazards] = useState([]);
    const [socialAlerts, setSocialAlerts] = useState([]);
    const [showSocial, setShowSocial] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showRecycleBin, setShowRecycleBin] = useState(false);
    const [newsLimit, setNewsLimit] = useState(5);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [socket, setSocket] = useState(null);
    
    // Admin Role States - ONLY for admin panel, NOT for user panel
    const [adminRole, setAdminRole] = useState('viewer');
    const [passkey, setPasskey] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    
    const [mapFilters, setMapFilters] = useState({ hazardType: 'All', severity: 'All', status: 'All' });
    const [showConfirmPopup, setShowConfirmPopup] = useState(false);
    const [hazardToArchive, setHazardToArchive] = useState(null);
    const [archiveReason, setArchiveReason] = useState('');
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("All");

    const navigate = useNavigate();

    // Check admin mode - ONLY for administrators
    const checkAdminMode = async () => {
        if (role !== 'administrator') return;
        try {
            const res = await axios.get(`${API_URL}/api/admin/mode`);
            setAdminRole(res.data.adminRole);
        } catch (error) {}
    };

    // Verify passkey to enable edit mode - ONLY for admin panel
    const verifyPasskey = async () => {
        if (!passkey) {
            toast.error(' Please enter passkey');
            return;
        }
        setIsVerifying(true);
        try {
            const res = await axios.post(`${API_URL}/api/admin/verify-passkey`, { passkey });
            setAdminRole('editor');
            toast.success(' Edit mode enabled! You can now add, update, and archive hazards.');
            setPasskey('');
        } catch (error) {
            toast.error(error.response?.data?.error || ' Invalid passkey');
        } finally {
            setIsVerifying(false);
        }
    };

    // Logout admin (disable edit mode)
    const logoutAdmin = async () => {
        try {
            await axios.post(`${API_URL}/api/admin/logout`);
            setAdminRole('viewer');
            toast.success(' Edit mode disabled');
        } catch (error) {}
    };

    const hazardTypes = useMemo(() => [...new Set(reports.map(r => r.hazard_type))].filter(t => t), [reports]);

    const filteredMapReports = useMemo(() => {
        return reports.filter(r => {
            if (mapFilters.hazardType !== 'All' && r.hazard_type !== mapFilters.hazardType) return false;
            if (mapFilters.severity !== 'All' && r.severity !== mapFilters.severity) return false;
            if (mapFilters.status !== 'All' && r.status !== mapFilters.status) return false;
            return true;
        });
    }, [reports, mapFilters]);

    const handleMapFilterChange = (filterType, value) => {
        if (filterType === 'reset') setMapFilters({ hazardType: 'All', severity: 'All', status: 'All' });
        else setMapFilters(prev => ({ ...prev, [filterType]: value }));
    };

    // Socket connection and notification handlers
   useEffect(() => {
    const newSocket = io(`${API_URL}`, {
        withCredentials: true,
        transports: ['websocket', 'polling']
    });
    setSocket(newSocket);
    
    newSocket.on('connect', () => {
        console.log(" SOCKET CONNECTED SUCCESSFULLY ");
        console.log("Socket ID:", newSocket.id);
    });
    
    newSocket.on('connect_error', (error) => {
        console.log("SOCKET CONNECTION ERROR:", error.message);
    });

        
        newSocket.on('initial-notifications', (initialNotifications) => {
            console.log("Initial notifications received:", initialNotifications);
            setNotifications(initialNotifications || []);
            setUnreadCount((initialNotifications || []).filter(n => !n.read).length);
        });
        
        newSocket.on('new-notification', (notification) => {
            console.log("NEW NOTIFICATION RECEIVED:", notification);
            console.log("Notification Title:", notification.title);
            console.log("Notification Message:", notification.message);
            
            setNotifications(prev => {
                console.log("Previous notifications count:", prev.length);
                const updated = [notification, ...prev];
                console.log("Updated notifications count:", updated.length);
                return updated;
            });
            setUnreadCount(prev => {
                console.log("Old unread count:", prev);
                const newCount = prev + 1;
                console.log("New unread count:", newCount);
                return newCount;
            });
            
            if (notificationsEnabled && Notification.permission === 'granted') {
                new Notification(notification.title, { body: notification.message });
            }
            toast.success(notification.message);
        });
        
        if (Notification.permission === 'default') Notification.requestPermission();
        return () => newSocket.close();
    }, [notificationsEnabled]);

    // Debug effect to log notifications state changes
    useEffect(() => {
        console.log("NOTIFICATIONS STATE CHANGED");
        console.log("Total notifications:", notifications.length);
        console.log("Notifications list:", notifications);
        console.log("Unread count:", unreadCount);
    }, [notifications, unreadCount]);

    const fetchReports = useCallback(async () => {
        try {
            let url = `${API_URL}/api/reports`;
            if (role === 'reporter' && user?.id) url = `${API_URL}/api/user-reports/${user.id}`;
            const res = await axios.get(url);
            setReports(res.data || []);
            const socialRes = await axios.get(`${API_URL}/api/social-alerts`);
            setSocialAlerts(socialRes.data || []);
            const archiveRes = await axios.get(`${API_URL}/api/archived-reports`);
            setArchivedHazards(archiveRes.data || []);
        } catch (e) { console.error("Sync Error"); }
    }, [role, user]);

    useEffect(() => { 
        fetchReports(); 
        checkAdminMode();
    }, [fetchReports]);

    const markAsRead = (notificationId) => {
        setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
        toast.info("Notification marked as read");
    };
    
    const clearAllNotifications = () => {
        setNotifications([]);
        setUnreadCount(0);
        toast.success("All notifications cleared");
    };

    const handleArchiveClick = (hazard) => {
        if (adminRole !== 'editor') {
            toast.error(' Edit mode required to archive hazards');
            return;
        }
        setHazardToArchive(hazard);
        setArchiveReason('');
        setShowConfirmPopup(true);
    };

    const confirmArchive = async () => {
        if (!archiveReason) { 
            toast.error("Please select a reason for archiving"); 
            return; 
        }
        try {
            await axios.post(`${API_URL}/api/archive-hazard/${hazardToArchive.id}`, { reason: archiveReason });
            fetchReports();
            setShowConfirmPopup(false);
            setHazardToArchive(null);
            toast.success(` Hazard archived successfully`);
        } catch (e) { 
            toast.error("Failed to archive hazard"); 
        }
    };

    const handleRestore = async (archiveId) => {
        try { 
            await axios.post(`${API_URL}/api/restore-hazard/${archiveId}`); 
            fetchReports(); 
            toast.success(" Hazard restored successfully");
        } catch (e) { 
            toast.error("Failed to restore hazard"); 
        }
    };

    // DELETE FROM ARCHIVE - This sends email to user
    const handlePermanentDelete = async (archiveId) => {
        console.log(" Permanent delete from archive for ID:", archiveId);
        
        if (adminRole !== 'editor') {
            toast.error(' Edit mode required to delete hazards');
            return;
        }
        
        // Find the archived hazard details
        const archivedHazard = archivedHazards.find(h => h.id === archiveId);
        
        if (window.confirm(` Are you sure you want to permanently delete this hazard? This action cannot be undone! The user (${archivedHazard?.reporter_name || 'Unknown'}) will receive an email notification.`)) {
            try { 
                const response = await axios.delete(`${API_URL}/api/permanent-delete/${archiveId}`);
                if (response.data.success) {
                    toast.success(` Hazard permanently deleted! Email notification sent to the reporter.`);
                    fetchReports();
                } else {
                    toast.error("Failed to delete hazard");
                }
            } catch (e) { 
                console.error("Delete error:", e);
                toast.error(e.response?.data?.error || "Failed to delete hazard"); 
            }
        }
    };

    const stats = useMemo(() => ({
        total: reports.length,
        pending: reports.filter(r => r.status === 'Pending').length,
        inProgress: reports.filter(r => r.status === 'In-Progress').length,
        resolved: reports.filter(r => r.status === 'Resolved').length,
        socialCount: socialAlerts.length,
        userCount: reports.filter(r => r.reporter_name === user?.username).length,
        archivedCount: archivedHazards.length
    }), [reports, socialAlerts, user, archivedHazards]);

    const chartData = useMemo(() => {
        const groups = reports.reduce((acc, r) => {
            const type = r.hazard_type ? r.hazard_type.trim().toUpperCase() : "UNKNOWN";
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(groups).map(([name, count]) => ({ name, count }));
    }, [reports]);

    const statusData = useMemo(() => [
        { name: 'Pending', value: stats.pending, color: '#ffc107' },
        { name: 'In-Progress', value: stats.inProgress, color: '#17a2b8' },
        { name: 'Resolved', value: stats.resolved, color: '#28a745' }
    ], [stats]);

    const filteredData = useMemo(() => {
        return reports.filter(r => {
            const matchSearch = (r.hazard_type || "").toLowerCase().includes(searchTerm.toLowerCase());
            const matchStatus = filterStatus === "All" || r.status === filterStatus;
            return matchSearch && matchStatus;
        });
    }, [reports, searchTerm, filterStatus]);

    const handleStatusUpdate = async (reportId, newStatus) => {
        if (adminRole !== 'editor') {
            toast.error(' Edit mode required to update status');
            return;
        }
        try {
            await axios.patch(`${API_URL}/api/reports/${reportId}/status`, { status: newStatus });
            fetchReports();
            toast.success(` Status updated to ${newStatus}`);
        } catch (error) { 
            if (error.response?.status === 403) {
                toast.error(" Edit mode required to update status");
            } else {
                toast.error("Failed to update status");
            }
        }
    };

    return (
        <div style={{ background: finalStyles.background, minHeight: '100vh', color: finalStyles.text }}>
            <Toaster position="top-right" toastOptions={{ duration: 4000, icon:false,style: { background: finalStyles.surface, color: finalStyles.text, border: `1px solid ${finalStyles.primary}` } }} />

            {showRecycleBin && <RecycleBin isOpen={showRecycleBin} onClose={() => setShowRecycleBin(false)} archivedHazards={archivedHazards} onRestore={handleRestore} onPermanentDelete={handlePermanentDelete} finalStyles={finalStyles} />}
            {showConfirmPopup && <ConfirmationPopup isOpen={showConfirmPopup} onClose={() => setShowConfirmPopup(false)} onConfirm={confirmArchive} title="Archive Hazard" message={`Are you sure you want to archive the ${hazardToArchive?.hazard_type} hazard at ${hazardToArchive?.location}?`} showReason={true} onReasonChange={setArchiveReason} reasonOptions={["Duplicate Report", "Fake / False Report", "Issue Resolved", "Incorrect Location", "Test Entry"]} />}

            <nav style={{ ...navStyle, background: finalStyles.surface, borderBottomColor: finalStyles.border }}>
                <h3 style={{fontWeight:900, letterSpacing:'3px', color:finalStyles.primary}}> OCEANPULSE</h3>
                <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
                    
                    {role === 'administrator' && (
                        <>
                            <button onClick={() => {setShowSocial(!showSocial); setShowNotifications(false); setShowRecycleBin(false);}} style={{...navBtn, borderColor: finalStyles.success, background: showSocial ? finalStyles.success : 'transparent', color: showSocial ? '#000' : finalStyles.success}}>
                                {showSocial ? ' DASHBOARD' : ' GLOBAL NEWS'}
                            </button>
                            <button onClick={() => {setShowRecycleBin(true); setShowSocial(false); setShowNotifications(false);}} style={{...navBtn, borderColor: finalStyles.warning, color: finalStyles.warning}}>
                                 ARCHIVE ({stats.archivedCount})
                            </button>
                        </>
                    )}
                    
                    <button onClick={() => {setShowNotifications(!showNotifications); setShowSocial(false); setShowRecycleBin(false);}} style={{...navBtn, position: 'relative', borderColor: finalStyles.primary, background: showNotifications ? finalStyles.primary : 'transparent', color: showNotifications ? '#000' : finalStyles.primary}}>
                        Notifications{unreadCount > 0 && <span style={{position:'absolute', top:'-8px', right:'-8px', background:'red', color:'white', borderRadius:'50%', width:'20px', height:'20px', fontSize:'11px', display:'flex', alignItems:'center', justifyContent:'center'}}>{unreadCount}</span>}
                    </button>
                    
                    <button onClick={() => navigate('/profile')} style={{...navBtn, background: 'transparent', color: finalStyles.text, borderColor: finalStyles.border}}> PROFILE</button>
                    <button onClick={() => navigate('/settings')} style={{...navBtn, background: 'transparent', color: finalStyles.primary, borderColor: finalStyles.primary}}> SETTINGS</button>
                    <button onClick={() => {setView('home'); setUser(null);}} style={{...navBtn, color: finalStyles.danger, borderColor: finalStyles.danger}}> LOGOUT</button>
                </div>
            </nav>

            
{showNotifications && (
    <div style={{position:'fixed', top:'80px', right:'20px', width:'380px', maxHeight:'500px', background:finalStyles.surface, border:`1px solid ${finalStyles.border}`, borderRadius:'15px', zIndex:1000, overflow:'auto'}}>
        ...
    </div>
)}

            {showNotifications && (
                <div style={{position:'fixed', top:'80px', right:'20px', width:'380px', maxHeight:'500px', background:finalStyles.surface, border:`1px solid ${finalStyles.border}`, borderRadius:'15px', zIndex:1000, overflow:'auto'}}>
                    <div style={{padding:'15px 20px', borderBottom:`1px solid ${finalStyles.border}`, background: `${finalStyles.primary}10`, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <h4 style={{margin:0, color:finalStyles.primary}}> Notifications</h4>
                        {notifications.length > 0 && (
                            <button 
                                onClick={clearAllNotifications}
                                style={{
                                    background: 'transparent',
                                    border: `1px solid ${finalStyles.danger}`,
                                    color: finalStyles.danger,
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    transition: '0.3s'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.background = finalStyles.danger;
                                    e.target.style.color = '#fff';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.background = 'transparent';
                                    e.target.style.color = finalStyles.danger;
                                }}
                            >
                                 Clear All
                            </button>
                        )}
                    </div>
                    {notifications.length === 0 ? (
                        <div style={{padding:'40px', textAlign:'center', color:finalStyles.textSecondary}}>No notifications</div>
                    ) : (
                        notifications.map(notif => (
                            <div key={notif.id} onClick={() => markAsRead(notif.id)} style={{padding:'15px 20px', borderBottom:`1px solid ${finalStyles.border}`, background: notif.read ? 'transparent' : `${finalStyles.primary}15`, cursor:'pointer'}}>
                                <h5 style={{margin:'0 0 8px 0', color:finalStyles.primary}}>{notif.title}</h5>
                                <p style={{margin:0, fontSize:'12px', color:finalStyles.textSecondary}}>{notif.message}</p>
                                {notif.location && <span style={{fontSize:'11px', color:finalStyles.primary, marginTop:'8px', display:'block'}}>Location: {notif.location}</span>}
                            </div>
                        ))
                    )}
                </div>
            )}

            <div style={container}>
                {/* Admin Mode Indicator & Passkey Input - ONLY for admin panel, NOT for user panel */}
                {role === 'administrator' && !showSocial && (
                    <div style={{ marginBottom: '25px', padding: '20px', background: finalStyles.surfaceLight, borderRadius: '15px', border: `1px solid ${finalStyles.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                            <div>
                                <span style={{ 
                                    background: adminRole === 'editor' ? '#28a745' : '#ffc107', 
                                    padding: '5px 15px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
                                    color: adminRole === 'editor' ? '#fff' : '#000'
                                }}>
                                    {adminRole === 'editor' ? ' EDIT MODE ACTIVE' : ' VIEW MODE'}
                                </span>
                                {adminRole === 'editor' && (
                                    <button onClick={logoutAdmin} style={{ marginLeft: '10px', background: 'transparent', border: `1px solid ${finalStyles.danger}`, color: finalStyles.danger, padding: '5px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                                        Disable Edit Mode
                                    </button>
                                )}
                            </div>
                            
                            {adminRole === 'viewer' && (
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <input 
                                        type="password" 
                                        placeholder=" Enter Passkey to Enable Edit Mode" 
                                        value={passkey}
                                        onChange={(e) => setPasskey(e.target.value)}
                                        style={{ padding: '10px 15px', borderRadius: '10px', border: `1px solid ${finalStyles.border}`, background: finalStyles.surface, color: finalStyles.text, width: '250px' }}
                                    />
                                    <button onClick={verifyPasskey} disabled={isVerifying} style={{ padding: '10px 20px', background: finalStyles.primary, border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                                        {isVerifying ? 'Verifying...' : 'Enable Edit Mode'}
                                    </button>
                                </div>
                            )}
                        </div>
                        {adminRole === 'viewer' && (
                            <p style={{ fontSize: '12px', color: finalStyles.warning, marginTop: '12px' }}>
                                Warning-You are in VIEW MODE. Enter the passkey to enable EDIT MODE (Add/Update/Archive hazards).
                            </p>
                        )}
                        {adminRole === 'editor' && (
                            <p style={{ fontSize: '12px', color: '#28a745', marginTop: '12px' }}>
                                 EDIT MODE ACTIVE - You can now add, update, and archive hazards.
                            </p>
                        )}
                    </div>
                )}

                {role === 'reporter' && !showSocial && (
                    <div style={{marginBottom:'35px', maxWidth:'650px', margin:'0 auto 35px auto'}}>
                        <div style={{ background: finalStyles.surface, borderRadius: '20px', border: `2px solid ${finalStyles.primary}`, overflow: 'hidden' }}>
                            <div style={{ background: `${finalStyles.primary}15`, padding: '20px', borderBottom: `1px solid ${finalStyles.border}` }}>
                                <h4 style={{color: finalStyles.primary, margin:0, textAlign: 'center'}}> DISPATCH FIELD REPORT</h4>
                            </div>
                            <div style={{ padding: '25px' }}>
                                <ReportForm user={user} refresh={fetchReports} finalStyles={finalStyles} />
                            </div>
                        </div>
                    </div>
                )}

                {role === 'administrator' && !showSocial && (
                    <>
                        <div style={statsGrid}>
                            <div style={{...statCard, background: finalStyles.surface, borderColor: finalStyles.border, cursor: 'default'}}><div style={{ fontSize: '32px' }}></div><h4>TOTAL HAZARDS</h4><h2 style={{color: finalStyles.primary}}>{stats.total}</h2><small>All incidents</small></div>
                            <div style={{...statCard, background: finalStyles.surface, borderColor: finalStyles.border, cursor: 'default'}}><div style={{ fontSize: '32px' }}></div><h4 style={{color:'#ffc107'}}>PENDING</h4><h2>{stats.pending}</h2><small>Awaiting action</small></div>
                            <div style={{...statCard, background: finalStyles.surface, borderColor: finalStyles.border, cursor: 'default'}}><div style={{ fontSize: '32px' }}></div><h4 style={{color:'#17a2b8'}}>IN-PROGRESS</h4><h2>{stats.inProgress}</h2><small>Being addressed</small></div>
                            <div style={{...statCard, background: finalStyles.surface, borderColor: finalStyles.border, cursor: 'default'}}><div style={{ fontSize: '32px' }}></div><h4 style={{color:'#28a745'}}>RESOLVED</h4><h2>{stats.resolved}</h2><small>Completed</small></div>
                            <div style={{...statCard, background: finalStyles.surface, borderColor: finalStyles.border, cursor: 'default'}}><div style={{ fontSize: '32px' }}></div><h4 style={{color:'#ffc107'}}>ARCHIVED</h4><h2>{stats.archivedCount}</h2><small>In recycle bin</small></div>
                            <button onClick={() => window.open(`${API_URL}/api/export-csv`)} style={{...statCard, background: finalStyles.primary, border:'none', color:'#000', cursor:'pointer'}}><div style={{ fontSize: '32px' }}></div><h4>EXPORT</h4><small>Download CSV</small></button>
                        </div>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'25px', marginBottom:'40px'}}>
                            <div style={{...glassPanel, background: finalStyles.cardBg || finalStyles.surface, borderColor: finalStyles.border}}>
                                <h4 style={{color:finalStyles.primary, marginBottom:'20px'}}> HAZARD TRENDS</h4>
                                <div style={{height:'280px'}}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData}>
                                            <XAxis dataKey="name" stroke={finalStyles.textSecondary}/>
                                            <YAxis stroke={finalStyles.textSecondary}/>
                                            <Tooltip contentStyle={{background: finalStyles.surface, border: `1px solid ${finalStyles.border}`}}/>
                                            <Bar dataKey="count" fill={finalStyles.primary} radius={[8,8,0,0]}/>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div style={{...glassPanel, background: finalStyles.cardBg || finalStyles.surface, borderColor: finalStyles.border}}>
                                <h4 style={{color:finalStyles.success, marginBottom:'20px'}}> STATUS BREAKDOWN</h4>
                                <div style={{height:'280px'}}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={statusData} innerRadius={70} outerRadius={100} dataKey="value" paddingAngle={5} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                                {statusData.map((e, i) => {
                                                    let color = e.name === 'Pending' ? '#ffc107' : e.name === 'In-Progress' ? '#17a2b8' : '#28a745';
                                                    return <Cell key={i} fill={color}/>;
                                                })}
                                            </Pie>
                                            <Tooltip/>
                                            <Legend/>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {!showSocial && (
                    <div style={{ position: 'relative', marginBottom: '35px' }}>
                        <div style={mapWrapper}>
                            <MapContainer center={[13.0827, 80.2707]} zoom={8} style={{ height: '100%', width:'100%' }}>
                                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                                <RecenterMap />
                                <Marker position={[13.0827, 80.2707]} icon={redIcon}><Popup><div><b> CRITICAL ZONE: CHENNAI</b><br/>Strategic Monitoring Station<br/><span style={{color:'red'}}>HIGH ALERT</span></div></Popup></Marker>
                                <Circle center={[13.0827, 80.2707]} radius={6000} pathOptions={{ color: 'red', fillOpacity: 0.15 }} />
                                {filteredMapReports.map((report) => {
                                    let markerColor = report.severity === 'High' ? '#ff6600' : report.severity === 'Medium' ? '#ffcc00' : report.severity === 'Low' ? '#00ffaa' : '#ffcc00';
                                    if (report.severity === 'Critical') markerColor = '#ff0000';
                                    const customIcon = L.divIcon({ html: `<div style="background-color: ${markerColor}; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 0 15px rgba(0,0,0,0.3);"><span style="color: white;">!</span></div>`, className: 'custom-div-icon', iconSize: [34, 34], popupAnchor: [0, -17] });
                                    return <Marker key={report.id} position={[report.latitude || 13.0827, report.longitude || 80.2707]} icon={customIcon}><Popup><div><b>{report.hazard_type?.toUpperCase()}</b><br/><b> Location:</b> {report.location}<br/><b> Severity:</b> {report.severity}<br/><b> Status:</b> {report.status}<br/><b> Reporter:</b> {report.reporter_name}<br/><b> Email:</b> {report.reporter_email || 'Not provided'}<br/><b> Reported:</b> {new Date(report.created_at).toLocaleString()}<br/>{report.photo_url && <img src={`${API_URL}/api/view-image/${report.photo_url}`} style={{width: '100%', maxWidth: '180px', borderRadius: '8px', marginTop: '8px', cursor: 'pointer'}} onClick={() => window.open(`${API_URL}/api/view-image/${report.photo_url}`)} />}</div></Popup></Marker>;
                                })}
                            </MapContainer>
                        </div>
                        {role === 'administrator' && <MapFilters filters={mapFilters} onFilterChange={handleMapFilterChange} hazardTypes={hazardTypes} finalStyles={finalStyles} />}
                    </div>
                )}

                <div style={{...tableWrapper, background: finalStyles.surface, borderColor: finalStyles.border, overflowX: 'auto', marginTop: '20px'}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'25px', flexWrap:'wrap', gap:'15px'}}>
                        <h3 style={{color:finalStyles.primary, margin:0, fontSize: '20px'}}>{showSocial ? ' GLOBAL INTELLIGENCE' : ' SYSTEM INCIDENT FEED'}</h3>
                        {!showSocial && (
                            <div style={{display:'flex', gap:'12px'}}>
                                <input style={{...searchInp, background: finalStyles.surfaceLight, color: finalStyles.text, borderColor: finalStyles.border, width: '220px'}} placeholder="Search Hazard..." onChange={(e) => setSearchTerm(e.target.value)} />
                                <select style={{...searchInp, background: finalStyles.surfaceLight, color: finalStyles.text, borderColor: finalStyles.border}} onChange={(e) => setFilterStatus(e.target.value)}>
                                    <option value="All">All Status</option><option value="Pending"> Pending</option><option value="In-Progress"> In-Progress</option><option value="Resolved"> Resolved</option>
                                </select>
                            </div>
                        )}
                    </div>
                    {showSocial ? (
                        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(380px, 1fr))', gap:'20px'}}>
                            {socialAlerts.slice(0, newsLimit).map(alert => (
                                <div key={alert.id} style={{...glassPanel, borderLeft:`5px solid ${finalStyles.danger}`, background: finalStyles.surfaceLight, borderColor: finalStyles.border}}>
                                    <p style={{fontSize: '14px', lineHeight: '1.5'}}>{alert.content}</p>
                                    <div style={{marginTop:'15px', fontSize:'12px', display:'flex', justifyContent:'space-between', borderTop: `1px solid ${finalStyles.border}`, paddingTop: '12px'}}>
                                        <span> {alert.location}</span>
                                        <span> {new Date(alert.created_at).toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                            {newsLimit < socialAlerts.length && <button onClick={() => setNewsLimit(newsLimit + 5)} style={{...fetchBtn, background: finalStyles.success, color: '#000'}}> FETCH MORE DATA</button>}
                        </div>
                    ) : (
                        <div style={{overflowX: 'auto'}}>
                            <table style={{width: '100%', borderCollapse: 'collapse', minWidth: '1100px'}}>
                                <thead>
                                    <tr style={{background: `${finalStyles.primary}10`, borderBottom: `2px solid ${finalStyles.primary}`}}>
                                        <th style={{ padding: '16px 12px', fontSize: '13px', color: finalStyles.primary }}> HAZARD</th>
                                        <th style={{ padding: '16px 12px', fontSize: '13px', color: finalStyles.primary }}> LOCATION</th>
                                        <th style={{ padding: '16px 12px', fontSize: '13px', color: finalStyles.primary }}> EMAIL</th>
                                        <th style={{ padding: '16px 12px', fontSize: '13px', color: finalStyles.primary }}> SEVERITY</th>
                                        <th style={{ padding: '16px 12px', fontSize: '13px', color: finalStyles.primary }}> EVIDENCE</th>
                                        <th style={{ padding: '16px 12px', fontSize: '13px', color: finalStyles.primary }}> RADIUS</th>
                                        <th style={{ padding: '16px 12px', fontSize: '13px', color: finalStyles.primary }}> RISK</th>
                                        <th style={{ padding: '16px 12px', fontSize: '13px', color: finalStyles.primary }}> STATUS</th>
                                        {role === 'administrator' && <th style={{ padding: '16px 12px', fontSize: '13px', color: finalStyles.primary }}> CONTROL</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.map(r => {
                                        let severityColor = r.severity === 'High' ? '#ff4444' : r.severity === 'Medium' ? '#ffcc00' : '#00ffaa';
                                        let statusColor = r.status === 'Pending' ? '#ffc107' : r.status === 'In-Progress' ? '#17a2b8' : '#28a745';
                                        let statusIcon = r.status === 'Pending' ? 'Pending' : r.status === 'In-Progress' ? 'In-Progress' : 'Resolved';
                                        const isEditDisabled = (role === 'administrator' && adminRole !== 'editor');
                                        
                                        return (
                                            <tr key={r.id} style={{borderBottom: `1px solid ${finalStyles.border}`, transition: '0.2s'}}>
                                                <td style={{ padding: '16px 12px', fontWeight: 'bold', fontSize: '14px' }}>{r.hazard_type?.toUpperCase()}</td>
                                                <td style={{ padding: '16px 12px', fontSize: '13px' }}>{r.location}</td>
                                                <td style={{ padding: '16px 12px', fontSize: '12px' }}>{r.reporter_email || '-'}</td>
                                                <td style={{ padding: '16px 12px' }}>
                                                    <span style={{ color: severityColor, background: `${severityColor}20`, padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold'}}>{r.severity}</span>
                                                </td>
                                                <td style={{ padding: '16px 12px' }}>
                                                    {r.photo_url ? (
                                                        <button onClick={() => window.open(`${API_URL}/api/view-image/${r.photo_url}`)} style={{ background: finalStyles.primary, border: 'none', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}> VIEW</button>
                                                    ) : <span style={{ color: finalStyles.textSecondary }}>-</span>}
                                                </td>
                                                <td style={{ padding: '16px 12px', fontSize: '13px' }}>{r.impact_radius || 0} KM</td>
                                                <td style={{ padding: '16px 12px', fontSize: '13px' }}>{r.risk_count || 0}</td>
                                                <td style={{ padding: '16px 12px' }}>
                                                    <span style={{ background: `${statusColor}20`, color: statusColor, padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                                         {statusIcon}
                                                        </span>
                                                </td>
                                                {role === 'administrator' && (
                                                    <td style={{ padding: '16px 12px' }}>
                                                        <div style={{display:'flex', flexDirection:'row', gap:'8px', alignItems:'center'}}>
                                                            <select 
                                                                style={{background:finalStyles.surface, color:finalStyles.text, border:`1px solid ${finalStyles.border}`, borderRadius:'8px', padding:'8px 10px', fontSize: '12px', cursor: isEditDisabled ? 'not-allowed' : 'pointer', opacity: isEditDisabled ? 0.6 : 1, minWidth: '100px'}} 
                                                                onChange={(e) => handleStatusUpdate(r.id, e.target.value)} 
                                                                value={r.status}
                                                                disabled={isEditDisabled}
                                                            >
                                                                <option value="Pending"> Pending</option>
                                                                <option value="In-Progress"> In-Progress</option>
                                                                <option value="Resolved"> Resolved</option>
                                                            </select>
                                                            <button 
                                                                onClick={() => handleArchiveClick(r)} 
                                                                style={{ background: '#ffc107', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: isEditDisabled ? 'not-allowed' : 'pointer', opacity: isEditDisabled ? 0.6 : 1, color: '#000', fontWeight: 'bold', fontSize: '12px' }}
                                                                disabled={isEditDisabled}
                                                            > ARCHIVE</button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {!showSocial && filteredData.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '60px', color: finalStyles.textSecondary, fontSize: '16px' }}>
                             No hazards found matching your search
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Main App Component
const App = () => {
    const [view, setView] = useState('home');
    const [isSignup, setIsSignup] = useState(false);
    const [role, setRole] = useState('reporter');
    const [user, setUser] = useState(null);
    const [authData, setAuthData] = useState({ username: '', password: '', email: '' });
    const [theme, setTheme] = useState('dark');
    const [highContrast, setHighContrast] = useState(false);
    const [fontSize, setFontSize] = useState('normal');
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [hoverBtn, setHoverBtn] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const savedTheme = localStorage.getItem('oceanpulse-theme');
        if (savedTheme) setTheme(savedTheme);
        else setTheme(new Date().getHours() >= 18 || new Date().getHours() < 6 ? 'dark' : 'light');
        setHighContrast(localStorage.getItem('oceanpulse-contrast') === 'true');
        setFontSize(localStorage.getItem('oceanpulse-fontsize') || 'normal');
        setNotificationsEnabled(localStorage.getItem('oceanpulse-notifications') !== 'false');
        setAutoRefresh(localStorage.getItem('oceanpulse-autorefresh') !== 'false');
    }, []);

    useEffect(() => {
        localStorage.setItem('oceanpulse-theme', theme);
        localStorage.setItem('oceanpulse-contrast', highContrast);
        localStorage.setItem('oceanpulse-fontsize', fontSize);
        localStorage.setItem('oceanpulse-notifications', notificationsEnabled);
        localStorage.setItem('oceanpulse-autorefresh', autoRefresh);
        document.body.style.fontSize = fontSize === 'small' ? '12px' : fontSize === 'large' ? '18px' : fontSize === 'xlarge' ? '20px' : '14px';
    }, [theme, highContrast, fontSize, notificationsEnabled, autoRefresh]);

    const themeStyles = theme === 'dark' ? {
        background: '#0a0a0f', surface: '#14141f', surfaceLight: '#1a1a2a', text: '#ffffff', textSecondary: '#aaaacc',
        border: '#2a2a3a', primary: '#00d2ff', success: '#00ffaa', warning: '#ffbb33', danger: '#ff4444', cardBg: '#14141f'
    } : {
        background: '#f0f2f5', surface: '#ffffff', surfaceLight: '#f8f9fa', text: '#1a1a2e', textSecondary: '#666666',
        border: '#e0e0e0', primary: '#007bff', success: '#28a745', warning: '#ffc107', danger: '#dc3545', cardBg: '#ffffff'
    };
    const finalStyles = { ...themeStyles, ...(highContrast ? { color: '#ffff00', background: '#000000', borderColor: '#ffffff' } : {}) };

    if (view === 'home') return (
        <div style={heroWrapperFull}><div style={heroOverlayDark}><div style={heroInnerCentered}>
            <h2 style={heroTitleStyle}>OceanPulse</h2>
            <div style={captionStack}><p style={heroCaptionLine}>PROTECTING COASTAL COMMUNITIES</p><p style={heroCaptionLine}>DATA-DRIVEN MARINE SECURITY</p><p style={heroCaptionLine}>GLOBAL HAZARD RESPONSE</p></div>
            <div style={heroButtonGroupCentered}>
                <button style={hoverBtn === 'reporter' ? activeBtnHome : inactiveBtnHome} onMouseEnter={() => setHoverBtn('reporter')} onMouseLeave={() => setHoverBtn(null)} onClick={() => { setRole('reporter'); setView('auth'); setAuthData({ username: '', password: '', email: '' }); }}>REPORTER PORTAL</button>
                <button style={hoverBtn === 'admin' ? activeBtnHome : inactiveBtnHome} onMouseEnter={() => setHoverBtn('admin')} onMouseLeave={() => setHoverBtn(null)} onClick={() => { setRole('administrator'); setView('auth'); setAuthData({ username: '', password: '', email: '' }); }}>ADMIN CONTROL</button>
            </div>
        </div></div></div>
    );

    // AUTH PAGE
    if (view === 'auth') return (
        <div style={heroWrapperFull}><div style={glassCard}>
            <div style={{textAlign:'left'}}><span onClick={() => setView('home')} style={backHyperlink}>Back to Home</span></div>
            
            {role === 'administrator' ? (
                <>
                    <h2 style={{margin:'25px 0'}}>ADMIN LOGIN</h2>
                    <p style={{color: finalStyles.textSecondary, fontSize: '13px', marginBottom: '20px'}}>
                        Enter Username and Password to access Admin Panel (View Mode)
                    </p>
                    <AdminLoginForm 
                        onLogin={(userData) => { setUser(userData); setView('dashboard'); }} 
                        finalStyles={finalStyles}
                        isLoading={isLoading}
                        setIsLoading={setIsLoading}
                    />
                </>
            ) : (
                <>
                    <h2 style={{margin:'25px 0'}}>{isSignup ? 'REGISTER' : 'LOGIN'}</h2>
                    <form onSubmit={async (e) => { 
                        e.preventDefault(); 
                        setIsLoading(true);
                        try { 
                            const url = isSignup ? '/api/signup' : '/api/login'; 
                            const payload = isSignup ? 
                                { username: authData.username, password: authData.password, email: authData.email, role } : 
                                { username: authData.username, password: authData.password, role };
                            const res = await axios.post(`${API_URL}${url}`, payload);
                            
                            if(isSignup) { 
                                toast.success(" Registration successful! Please login."); 
                                setIsSignup(false); 
                                setAuthData({ username: '', password: '', email: '' }); 
                            } else { 
                                setUser(res.data); 
                                setView('dashboard'); 
                                toast.success(` Welcome back, ${res.data.username}!`);
                            } 
                        } catch (error) { 
                            if (error.response?.status === 401) {
                                alert(" Invalid Username or Password!\n\nPlease check your credentials and try again.");
                            } else {
                                const errorMsg = error.response?.data?.error || 
                                    (isSignup ? "Registration failed. Username may already exist." : "Invalid Credentials");
                                alert(`Error: ${errorMsg}`);
                            }
                        } finally {
                            setIsLoading(false);
                        }
                    }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <input style={sInput} placeholder="Username" value={authData.username} 
                            onChange={e => setAuthData({...authData, username: e.target.value})} required />
                        <input style={sInput} type="password" placeholder="Password" value={authData.password} 
                            onChange={e => setAuthData({...authData, password: e.target.value})} required />
                        {isSignup && (
                            <input style={sInput} type="email" placeholder="Your Email (for notifications)" 
                                value={authData.email} onChange={e => setAuthData({...authData, email: e.target.value})} required />
                        )}
                        <button style={sBtn} type="submit" disabled={isLoading}>
                            {isLoading ? 'PROCESSING...' : (isSignup ? 'SIGN UP' : 'LOGIN')}
                        </button>
                    </form>
                    <p onClick={() => { setIsSignup(!isSignup); setAuthData({ username: '', password: '', email: '' }); }} 
                       style={toggleText}>
                        {isSignup ? "Already have an account? Login here" : "Don't have an account? Create Account"}
                    </p>
                </>
            )}
        </div></div>
    );

    if (view === 'dashboard') return (
        <Router><Routes>
            <Route path="/" element={<Dashboard user={user} role={role} setView={setView} setUser={setUser} finalStyles={finalStyles} theme={theme} setTheme={setTheme} highContrast={highContrast} setHighContrast={setHighContrast} fontSize={fontSize} setFontSize={setFontSize} notificationsEnabled={notificationsEnabled} setNotificationsEnabled={setNotificationsEnabled} autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} />} />
            <Route path="/profile" element={<ProfilePage user={user} stats={{ userCount: 0 }} finalStyles={finalStyles} onBack={() => window.history.back()} />} />
            <Route path="/settings" element={<SettingsPage finalStyles={finalStyles} theme={theme} setTheme={setTheme} highContrast={highContrast} setHighContrast={setHighContrast} fontSize={fontSize} setFontSize={setFontSize} notificationsEnabled={notificationsEnabled} setNotificationsEnabled={setNotificationsEnabled} autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} user={user} stats={{ total: 0, userCount: 0 }} role={role} onBack={() => window.history.back()} />} />
        </Routes></Router>
    );
};

// Styles
const heroWrapperFull = { height: '100vh', width: '100vw', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'url("https://images.unsplash.com/photo-1439405326854-014607f694d7?auto=format&fit=crop&w=1920&q=80")', backgroundSize: 'cover', backgroundPosition: 'center', overflow: 'hidden', position: 'fixed', top: 0, left: 0 };
const heroOverlayDark = { height: '100%', width: '100%', background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center' };
const heroInnerCentered = { textAlign: 'center' };
const heroTitleStyle = { fontSize: '9.5rem', fontWeight: 900, color: '#00d2ff', letterSpacing: '10px', margin: 0, textShadow: '0 0 60px rgba(0,210,255,0.7)' };
const captionStack = { marginTop: '20px' };
const heroCaptionLine = { fontSize: '1rem', letterSpacing: '6px', color: '#fff', margin: '10px 0', fontWeight: '500' };
const heroButtonGroupCentered = { display: 'flex', gap: '25px', marginTop: '50px', justifyContent: 'center' };
const inactiveBtnHome = { padding: '15px 40px', borderRadius: '50px', background: 'transparent', border: '2px solid #00d2ff', color: '#00d2ff', cursor: 'pointer', fontWeight: 'bold', letterSpacing: '1px', transition: '0.4s' };
const activeBtnHome = { padding: '15px 40px', borderRadius: '50px', background: '#00d2ff', border: 'none', color: 'black', cursor: 'pointer', fontWeight: 'bold', letterSpacing: '1px', boxShadow: '0 0 30px rgba(0,210,255,0.4)', transition: '0.4s' };
const glassCard = { background: 'rgba(255,255,255,0.05)', padding: '50px', borderRadius: '40px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', backdropFilter: 'blur(20px)', width: '380px' };
const backHyperlink = { color: '#00d2ff', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' };
const sInput = { padding: '15px', background: 'rgba(255,255,255,0.1)', border: '1px solid #444', color: 'white', borderRadius: '12px', outline: 'none', fontSize: '14px' };
const sBtn = { padding: '16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', transition: '0.3s' };
const navStyle = { display: 'flex', justifyContent: 'space-between', padding: '20px 60px', borderBottom: '1px solid #1a1a1a', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(10px)' };
const container = { maxWidth: '1400px', margin: 'auto', padding: '30px' };
const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '20px', marginBottom: '30px' };
const statCard = { padding: '20px 15px', borderRadius: '15px', border: '1px solid #1a1a1a', textAlign: 'center', transition: 'transform 0.2s', cursor: 'default' };
const glassPanel = { padding: '25px', borderRadius: '20px', border: '1px solid #2a2a3a', background: 'rgba(20,20,31,0.8)', backdropFilter: 'blur(10px)' };
const mapWrapper = { height: '520px', borderRadius: '25px', overflow: 'hidden', border: '1px solid #2a2a3a', marginBottom: '0px' };
const tableWrapper = { padding: '25px', borderRadius: '20px', border: '1px solid #2a2a3a', background: 'rgba(20,20,31,0.8)', backdropFilter: 'blur(10px)' };
const navBtn = { background: 'transparent', border: '1px solid #333', padding: '8px 22px', borderRadius: '50px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', transition: '0.3s' };
const searchInp = { padding: '10px 18px', borderRadius: '25px', outline: 'none', fontSize: '0.85rem', width: '200px', transition: '0.3s' };
const fetchBtn = { padding: '12px 35px', border: 'none', borderRadius: '30px', cursor: 'pointer', display: 'block', margin: '20px auto 0', fontWeight: 'bold', fontSize: '14px', transition: '0.3s' };
const toggleText = { fontSize: '0.8rem', color: '#00d2ff', cursor: 'pointer', marginTop: '15px', transition: '0.3s' };

export default App;