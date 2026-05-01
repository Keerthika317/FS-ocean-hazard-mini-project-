// app.jsx - COMPLETE FIXED VERSION WITH OCEAN BACKGROUNDS
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const API_URL = 'https://ocean-hazard-backend-2of1.onrender.com';

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Risk Score Calculation
const calculateRiskScore = (severity, peopleAffected, radius) => {
    let severityScore = severity === 'High' ? 40 : severity === 'Medium' ? 25 : 10;
    let peopleScore = Math.min(parseInt(peopleAffected || 0) / 10, 30);
    let radiusScore = Math.min(parseInt(radius || 0) / 2, 30);
    return Math.min(Math.round(severityScore + peopleScore + radiusScore), 100);
};

const getRiskLevel = (score) => {
    if (score >= 70) return { label: 'Critical', color: '#dc2626', bg: '#fee2e2', icon: '🔴' };
    if (score >= 50) return { label: 'High', color: '#ea580c', bg: '#ffedd5', icon: '🟠' };
    if (score >= 30) return { label: 'Medium', color: '#d97706', bg: '#fef3c7', icon: '🟡' };
    return { label: 'Low', color: '#059669', bg: '#d1fae5', icon: '🟢' };
};

// ACCURATE Location database
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

const getMarkerIcon = (severity) => {
    let color = '#10b981', size = 32;
    if (severity === 'Medium') { color = '#f59e0b'; size = 34; }
    if (severity === 'High') { color = '#ef4444'; size = 38; }
    return L.divIcon({
        html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 15px rgba(0,0,0,0.2);"><span style="color: white; font-size: 16px;">⚠️</span></div>`,
        className: 'custom-div-icon',
        iconSize: [size, size],
        popupAnchor: [0, -size/2]
    });
};

const RecenterMap = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        if (center && map) map.setView(center, 5);
    }, [center, map]);
    return null;
};

const StatBox = ({ title, value, icon, color, subtitle }) => (
    <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        borderBottom: `3px solid ${color}`,
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'pointer'
    }}
    onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-5px)';
        e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.12)';
    }}
    onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
    }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
                <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>{title}</div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: color }}>{value}</div>
                {subtitle && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '5px' }}>{subtitle}</div>}
            </div>
            <div style={{ fontSize: '40px' }}>{icon}</div>
        </div>
    </div>
);

const Leaderboard = ({ topLocations, darkMode }) => (
    <div style={{
        background: darkMode ? '#1e293b' : '#fff',
        borderRadius: '20px',
        padding: '20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
    }}>
        <h3 style={{ marginBottom: '16px', color: darkMode ? '#fff' : '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🏆 Top Risk Areas
        </h3>
        {topLocations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No data available</div>
        ) : (
            <div>
                {topLocations.map((loc, idx) => (
                    <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 0',
                        borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                        transition: 'all 0.2s'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#cd7f32' : darkMode ? '#334155' : '#e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                color: idx < 3 ? '#1e293b' : (darkMode ? '#fff' : '#64748b')
                            }}>
                                {idx + 1}
                            </div>
                            <span style={{ fontWeight: '500', color: darkMode ? '#fff' : '#1e293b' }}>{loc.location}</span>
                        </div>
                        <div style={{
                            background: idx === 0 ? '#fef3c7' : darkMode ? '#334155' : '#f1f5f9',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontWeight: 'bold',
                            color: idx === 0 ? '#d97706' : (darkMode ? '#94a3b8' : '#475569')
                        }}>
                            {loc.total} reports
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
);

const NotificationBell = ({ notifications, unreadCount, onMarkRead, onClearAll, darkMode }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div style={{ position: 'relative' }}>
            <button onClick={() => setIsOpen(!isOpen)} style={{
                background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer',
                padding: '8px', borderRadius: '50%', position: 'relative'
            }}>
                🔔
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute', top: '0', right: '0', background: '#ef4444',
                        color: '#fff', borderRadius: '10px', width: '18px', height: '18px',
                        fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>{unreadCount}</span>
                )}
            </button>
            {isOpen && (
                <div style={{
                    position: 'absolute', top: '45px', right: '0', width: '320px',
                    background: darkMode ? '#1e293b' : '#fff', borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)', zIndex: 1000,
                    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`
                }}>
                    <div style={{
                        padding: '12px 16px',
                        borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                        display: 'flex',
                        justifyContent: 'space-between'
                    }}>
                        <strong style={{ color: darkMode ? '#fff' : '#1e293b' }}>Notifications</strong>
                        <button onClick={onClearAll} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>Clear all</button>
                    </div>
                    {notifications.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No notifications</div>
                    ) : (
                        notifications.slice(0, 5).map((n) => (
                            <div key={n.id} onClick={() => onMarkRead(n.id)} style={{
                                padding: '12px 16px',
                                borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                                cursor: 'pointer',
                                background: n.is_read ? 'transparent' : (darkMode ? '#334155' : '#e0f2fe')
                            }}>
                                <div style={{ fontSize: '13px', color: darkMode ? '#fff' : '#1e293b' }}>{n.message}</div>
                                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>{new Date(n.created_at).toLocaleString()}</div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

const ProfileModal = ({ user, darkMode, onClose }) => (
    <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
    }} onClick={onClose}>
        <div style={{
            background: darkMode ? '#1e293b' : '#fff', borderRadius: '24px',
            padding: '32px', width: '400px', maxWidth: '90%'
        }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h2 style={{ color: darkMode ? '#fff' : '#1e293b' }}>👤 Profile</h2>
                <button onClick={onClose} style={{
                    background: '#ef4444', border: 'none', borderRadius: '50%',
                    width: '32px', height: '32px', color: '#fff', cursor: 'pointer'
                }}>×</button>
            </div>
            <div style={{ textAlign: 'center' }}>
                <div style={{
                    width: '80px', height: '80px', borderRadius: '50%', background: '#4f46e5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '36px', color: '#fff', margin: '0 auto'
                }}>{user?.username?.charAt(0).toUpperCase()}</div>
                <h3 style={{ marginTop: '16px', color: darkMode ? '#fff' : '#1e293b' }}>{user?.username}</h3>
                <p style={{ color: '#64748b' }}>{user?.email}</p>
                <span style={{
                    display: 'inline-block', padding: '4px 12px', borderRadius: '20px',
                    background: user?.role === 'admin' ? '#ef4444' : '#10b981', color: '#fff', fontSize: '12px'
                }}>{user?.role || 'User'}</span>
            </div>
            <div style={{
                display: 'flex', justifyContent: 'space-around', marginTop: '24px',
                padding: '16px', background: 'rgba(79,70,229,0.1)', borderRadius: '16px'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4f46e5' }}>{user?.totalReports || 0}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Reports</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{user?.resolvedReports || 0}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Resolved</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>{user?.highRiskReports || 0}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>High Risk</div>
                </div>
            </div>
            <button onClick={onClose} style={{
                width: '100%', padding: '12px', marginTop: '20px',
                background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer'
            }}>Close</button>
        </div>
    </div>
);

const SettingsModal = ({ darkMode, setDarkMode, fontSize, setFontSize, autoRefresh, setAutoRefresh, notificationsEnabled, setNotificationsEnabled, onClose }) => (
    <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
    }} onClick={onClose}>
        <div style={{
            background: darkMode ? '#1e293b' : '#fff', borderRadius: '24px',
            padding: '32px', width: '500px', maxWidth: '90%'
        }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h2 style={{ color: darkMode ? '#fff' : '#1e293b' }}>⚙️ Settings</h2>
                <button onClick={onClose} style={{
                    background: '#ef4444', border: 'none', borderRadius: '50%',
                    width: '32px', height: '32px', color: '#fff', cursor: 'pointer'
                }}>×</button>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                    <span style={{ color: darkMode ? '#fff' : '#1e293b' }}>🌙 Dark Mode</span>
                    <input type="checkbox" checked={darkMode} onChange={(e) => setDarkMode(e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                </label>
                
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                    <span style={{ color: darkMode ? '#fff' : '#1e293b' }}>🔤 Font Size</span>
                    <select value={fontSize} onChange={(e) => setFontSize(e.target.value)} style={{
                        padding: '6px 12px', borderRadius: '8px', background: darkMode ? '#0f172a' : '#fff',
                        border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, color: darkMode ? '#fff' : '#1e293b'
                    }}>
                        <option value="small">Small</option>
                        <option value="normal">Normal</option>
                        <option value="large">Large</option>
                    </select>
                </label>
                
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                    <span style={{ color: darkMode ? '#fff' : '#1e293b' }}>🔄 Auto Refresh (15s)</span>
                    <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                </label>
                
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                    <span style={{ color: darkMode ? '#fff' : '#1e293b' }}>🔔 Desktop Notifications</span>
                    <input type="checkbox" checked={notificationsEnabled} onChange={(e) => setNotificationsEnabled(e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                </label>
            </div>
            
            <button onClick={onClose} style={{
                width: '100%', padding: '12px', background: '#4f46e5', color: '#fff',
                border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold'
            }}>Save & Close</button>
        </div>
    </div>
);

const ActivityTimeline = ({ activities, darkMode }) => (
    <div style={{ background: darkMode ? '#1e293b' : '#fff', borderRadius: '20px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginBottom: '16px', color: darkMode ? '#fff' : '#1e293b' }}>📋 Recent Activity</h3>
        {activities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No activities yet</div>
        ) : (
            activities.slice(0, 6).map((a, i) => (
                <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 0', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`
                }}>
                    <span style={{ fontSize: '24px' }}>{a.action.includes('Reported') ? '📝' : a.action.includes('Status') ? '🔄' : '🗑️'}</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: darkMode ? '#fff' : '#1e293b' }}>{a.action}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{a.user_name} • {a.location || a.hazard_type}</div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{new Date(a.created_at).toLocaleTimeString()}</div>
                </div>
            ))
        )}
    </div>
);

const TodaySummary = ({ hazards }) => {
    const today = new Date().toDateString();
    const newHazards = hazards.filter((h) => new Date(h.created_at).toDateString() === today).length;
    const resolvedToday = hazards.filter((h) => h.status === 'Resolved' && new Date(h.updated_at || h.created_at).toDateString() === today).length;
    const highRisk = hazards.filter((h) => h.severity === 'High').length;
    
    return (
        <div style={{ display: 'flex', gap: '16px', background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', padding: '8px 20px', borderRadius: '40px' }}>
            <div><span style={{ fontWeight: 'bold', color: '#fff' }}>{newHazards}</span> <span style={{ color: '#e0e7ff' }}>New</span></div>
            <div><span style={{ fontWeight: 'bold', color: '#fff' }}>{resolvedToday}</span> <span style={{ color: '#e0e7ff' }}>Resolved</span></div>
            <div><span style={{ fontWeight: 'bold', color: '#fff' }}>{highRisk}</span> <span style={{ color: '#e0e7ff' }}>High Risk</span></div>
        </div>
    );
};

const MapFilters = ({ filters, onFilterChange, hazardTypes, locations, darkMode }) => (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
        <select value={filters.severity} onChange={(e) => onFilterChange('severity', e.target.value)} style={{
            padding: '10px 16px', borderRadius: '12px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
            background: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#fff' : '#1e293b', cursor: 'pointer'
        }}>
            <option value="All">All Severities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
        </select>
        
        <select value={filters.hazardType} onChange={(e) => onFilterChange('hazardType', e.target.value)} style={{
            padding: '10px 16px', borderRadius: '12px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
            background: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#fff' : '#1e293b', cursor: 'pointer'
        }}>
            <option value="All">All Hazards</option>
            {hazardTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        
        <select value={filters.location} onChange={(e) => onFilterChange('location', e.target.value)} style={{
            padding: '10px 16px', borderRadius: '12px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
            background: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#fff' : '#1e293b', cursor: 'pointer'
        }}>
            <option value="All">All Locations</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        
        <button onClick={() => onFilterChange('reset')} style={{
            padding: '10px 20px', borderRadius: '12px', border: 'none',
            background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 'bold'
        }}>Reset</button>
    </div>
);

const AdminFilters = ({ filters, onFilterChange, darkMode }) => (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', padding: '16px', background: darkMode ? '#1e293b' : '#f8fafc', borderRadius: '16px', flexWrap: 'wrap' }}>
        <select value={filters.status} onChange={(e) => onFilterChange('status', e.target.value)} style={{
            padding: '10px 16px', borderRadius: '12px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
            background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#fff' : '#1e293b', cursor: 'pointer', flex: 1
        }}>
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="In-Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
        </select>
        
        <select value={filters.severity} onChange={(e) => onFilterChange('severity', e.target.value)} style={{
            padding: '10px 16px', borderRadius: '12px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
            background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#fff' : '#1e293b', cursor: 'pointer', flex: 1
        }}>
            <option value="All">All Severities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
        </select>
        
        <button onClick={() => onFilterChange('reset')} style={{
            padding: '10px 20px', borderRadius: '12px', border: 'none',
            background: '#4f46e5', color: '#fff', cursor: 'pointer', fontWeight: 'bold'
        }}>Reset Filters</button>
    </div>
);

function App() {
    const [currentScreen, setCurrentScreen] = useState('home');
    const [user, setUser] = useState(null);
    const [adminRole, setAdminRole] = useState('viewer');
    const [darkMode, setDarkMode] = useState(false);
    const [fontSize, setFontSize] = useState('normal');
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    
    const [hazards, setHazards] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [activities, setActivities] = useState([]);
    const [topLocations, setTopLocations] = useState([]);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [mapFilters, setMapFilters] = useState({ severity: 'All', hazardType: 'All', location: 'All' });
    const [adminFilters, setAdminFilters] = useState({ status: 'All', severity: 'All' });
    const [hazardStats, setHazardStats] = useState([]);
    const [statusStats, setStatusStats] = useState([]);
    const [formData, setFormData] = useState({ hazard_type: '', location: '', severity: 'Low', radius: '', people_affected: '', photo: null });
    const [submitting, setSubmitting] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [passkey, setPasskey] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
    const [recentlyUpdatedId, setRecentlyUpdatedId] = useState(null);
    
    const [loginData, setLoginData] = useState({ username: '', password: '' });
    const [signupData, setSignupData] = useState({ username: '', password: '', email: '' });
    const [adminLoginData, setAdminLoginData] = useState({ email: '', password: '' });

    useEffect(() => {
        const savedDarkMode = localStorage.getItem('darkMode');
        const savedFontSize = localStorage.getItem('fontSize');
        if (savedDarkMode) setDarkMode(savedDarkMode === 'true');
        if (savedFontSize) setFontSize(savedFontSize);
    }, []);

    useEffect(() => {
        localStorage.setItem('darkMode', darkMode);
        localStorage.setItem('fontSize', fontSize);
        document.body.style.fontSize = fontSize === 'small' ? '12px' : fontSize === 'large' ? '18px' : '14px';
        document.body.style.background = darkMode ? '#0f172a' : '#f0f4f8';
    }, [darkMode, fontSize]);

    const fetchUserData = useCallback(async () => {
        if (!user) return;
        try {
            const [hazardsRes, notifsRes, activitiesRes, topLocationsRes] = await Promise.all([
                axios.get(`${API_URL}/api/user-hazards/${user.id}`),
                axios.get(`${API_URL}/api/notifications/${user.id}`),
                axios.get(`${API_URL}/api/activity-logs`),
                axios.get(`${API_URL}/api/top-locations`)
            ]);
            setHazards(hazardsRes.data);
            setNotifications(notifsRes.data);
            setActivities(activitiesRes.data);
            setTopLocations(topLocationsRes.data);
            setUser((prev) => ({
                ...prev,
                totalReports: hazardsRes.data.length,
                resolvedReports: hazardsRes.data.filter((h) => h.status === 'Resolved').length,
                highRiskReports: hazardsRes.data.filter((h) => h.severity === 'High').length
            }));
            setLastUpdated(new Date());
            
            if (notificationsEnabled && Notification.permission === 'granted') {
                const newNotifs = notifsRes.data.filter((n) => !n.is_read && new Date(n.created_at) > new Date(Date.now() - 5000));
                newNotifs.forEach((n) => new Notification('OceanPulse Alert', { body: n.message, icon: 'https://cdn-icons-png.flaticon.com/512/190/190411.png' }));
            }
        } catch (error) {
            console.error(error);
        }
    }, [user, notificationsEnabled]);

    const fetchAdminData = useCallback(async () => {
        try {
            const [hazardsRes, notifsRes, activitiesRes, hazardStatsRes, statusStatsRes, topLocationsRes] = await Promise.all([
                axios.get(`${API_URL}/api/hazards`),
                axios.get(`${API_URL}/api/admin/notifications`),
                axios.get(`${API_URL}/api/activity-logs`),
                axios.get(`${API_URL}/api/hazard-stats`),
                axios.get(`${API_URL}/api/status-stats`),
                axios.get(`${API_URL}/api/top-locations`)
            ]);
            setHazards(hazardsRes.data);
            setNotifications(notifsRes.data);
            setActivities(activitiesRes.data);
            setHazardStats(hazardStatsRes.data || []);
            setStatusStats(statusStatsRes.data || []);
            setTopLocations(topLocationsRes.data);
            setLastUpdated(new Date());
        } catch (error) {
            console.error(error);
        }
    }, []);

    useEffect(() => {
        if (currentScreen === 'userDashboard' && user && autoRefresh) {
            fetchUserData();
            const interval = setInterval(fetchUserData, 15000);
            return () => clearInterval(interval);
        }
        if (currentScreen === 'adminDashboard' && autoRefresh) {
            fetchAdminData();
            const interval = setInterval(fetchAdminData, 15000);
            return () => clearInterval(interval);
        }
    }, [currentScreen, user, autoRefresh, fetchUserData, fetchAdminData]);

    useEffect(() => {
        if (notificationsEnabled && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, [notificationsEnabled]);

    const handleUserLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${API_URL}/api/login`, loginData);
            setUser({ ...res.data, role: 'user' });
            setCurrentScreen('userDashboard');
            toast.success(`Welcome ${res.data.username}!`);
            fetchUserData();
            setLoginData({ username: '', password: '' });
        } catch (error) {
            toast.error('Invalid username or password');
        }
    };

    const handleUserSignup = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${API_URL}/api/signup`, signupData);
            if (res.status === 201) {
                toast.success('Account created! Please login.');
                setCurrentScreen('userLogin');
                setSignupData({ username: '', password: '', email: '' });
            }
        } catch (error) {
            console.error('Signup error:', error);
            toast.error(error.response?.data?.error || 'Signup failed. Please try again.');
        }
    };

    const handleAdminLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${API_URL}/api/admin/login`, adminLoginData);
            setUser({ ...res.data, role: 'admin' });
            setCurrentScreen('adminDashboard');
            toast.success('Admin login successful');
            fetchAdminData();
            setAdminLoginData({ email: '', password: '' });
        } catch (error) {
            toast.error('Invalid admin credentials');
        }
    };

    const handleLogout = () => {
        setUser(null);
        setCurrentScreen('home');
        setLoginData({ username: '', password: '' });
        setAdminLoginData({ email: '', password: '' });
        setSignupData({ username: '', password: '', email: '' });
        toast.info('Logged out');
    };

    const handleSubmitHazard = async (e) => {
        e.preventDefault();
        if (!formData.hazard_type || !formData.location || !formData.radius || !formData.people_affected) {
            toast.error('Please fill all fields');
            return;
        }
        setSubmitting(true);
        const data = new FormData();
        if (user && user.id) {
    data.append('user_id', user?.id || localStorage.getItem('userId'));
} else {
    toast.error("User session expired. Please login again.");
    return;
}
        data.append('user_id', user?.id || localStorage.getItem('userId'));
        data.append('hazard_type', formData.hazard_type);
        data.append('location', formData.location);
        data.append('severity', formData.severity);
        data.append('radius', formData.radius);
        data.append('people_affected', formData.people_affected);
        if (formData.photo) data.append('photo', formData.photo);
        
        try {
            const response = await axios.post(`${API_URL}/api/hazards`, data);
            toast.success('Hazard reported successfully!');
            const riskScore = calculateRiskScore(formData.severity, formData.people_affected, formData.radius);
            toast.info(`Risk Score: ${riskScore}/100`);
            setFormData({ hazard_type: '', location: '', severity: 'Low', radius: '', people_affected: '', photo: null });
            document.getElementById('photoInput').value = '';
            fetchUserData();
            setRecentlyUpdatedId(response.data.id);
            setTimeout(() => setRecentlyUpdatedId(null), 5000);
        } catch (error) {
            toast.error('Submission failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateStatus = async (id, status) => {
        if (adminRole !== 'editor') {
            toast.error('Edit mode required');
            return;
        }
        try {
            await axios.put(`${API_URL}/api/hazards/${id}/status`, { status }, { headers: { 'x-admin-role': adminRole } });
            toast.success(`Status updated to ${status}`);
            fetchAdminData();
            setRecentlyUpdatedId(id);
            setTimeout(() => setRecentlyUpdatedId(null), 5000);
        } catch (error) {
            toast.error('Failed to update');
        }
    };

    const handleDeleteHazard = async (id) => {
        if (adminRole !== 'editor') {
            toast.error('Edit mode required');
            return;
        }
        if (window.confirm('Delete this hazard?')) {
            try {
                await axios.delete(`${API_URL}/api/hazards/${id}`, { headers: { 'x-admin-role': adminRole } });
                toast.success('Deleted');
                fetchAdminData();
            } catch (error) {
                toast.error('Failed to delete');
            }
        }
    };

    const handleMarkRead = async (id) => {
        try {
            await axios.put(`${API_URL}/api/notifications/${id}/read`);
            if (currentScreen === 'userDashboard') fetchUserData();
            else fetchAdminData();
        } catch (error) {
            console.error(error);
        }
    };

    const handleClearAll = async () => {
        const userId = currentScreen === 'userDashboard' ? user.id : 'admin';
        try {
            await axios.delete(`${API_URL}/api/notifications/clear/${userId}`);
            if (currentScreen === 'userDashboard') fetchUserData();
            else fetchAdminData();
            toast.success('Cleared');
        } catch (error) {
            console.error(error);
        }
    };

    const handleVerifyPasskey = async () => {
        setIsVerifying(true);
        try {
            await axios.post(`${API_URL}/api/admin/verify-passkey`, { passkey });
            setAdminRole('editor');
            toast.success('Edit mode enabled');
            setPasskey('');
        } catch (error) {
            toast.error('Invalid passkey');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleExportCSV = () => {
        const headers = ['ID', 'Type', 'Location', 'Severity', 'Risk Score', 'Status', 'People', 'Radius', 'Reporter', 'Date'];
        const rows = hazards.map((h) => [
            h.id, h.hazard_type, h.location, h.severity,
            calculateRiskScore(h.severity, h.people_affected, h.radius),
            h.status, h.people_affected, h.radius,
            h.reporter_name, new Date(h.created_at).toLocaleString()
        ]);
        const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'oceanpulse_report.csv';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV exported');
    };

    const getSeverityColor = (s) => s === 'High' ? '#ef4444' : s === 'Medium' ? '#f59e0b' : '#10b981';
    const getStatusColor = (s) => s === 'Pending' ? '#f59e0b' : s === 'In-Progress' ? '#3b82f6' : '#10b981';

    const unreadCount = notifications.filter((n) => !n.is_read).length;
    const highSeverityCount = hazards.filter((h) => h.severity === 'High').length;
    const hazardTypes = [...new Set(hazards.map((h) => h.hazard_type))];
    const locations = [...new Set(hazards.map((h) => h.location))];
    
    let filteredHazards = hazards.filter((h) => {
        if (mapFilters.severity !== 'All' && h.severity !== mapFilters.severity) return false;
        if (mapFilters.hazardType !== 'All' && h.hazard_type !== mapFilters.hazardType) return false;
        if (mapFilters.location !== 'All' && h.location !== mapFilters.location) return false;
        return true;
    });
    
    if (activeTab === 'high') filteredHazards = filteredHazards.filter((h) => h.severity === 'High');
    else if (activeTab === 'resolved') filteredHazards = filteredHazards.filter((h) => h.status === 'Resolved');
    
    let adminFilteredHazards = hazards;
    if (adminFilters.status !== 'All') adminFilteredHazards = adminFilteredHazards.filter((h) => h.status === adminFilters.status);
    if (adminFilters.severity !== 'All') adminFilteredHazards = adminFilteredHazards.filter((h) => h.severity === adminFilters.severity);

    const tabCounts = {
        all: hazards.length,
        high: hazards.filter((h) => h.severity === 'High').length,
        resolved: hazards.filter((h) => h.status === 'Resolved').length
    };

    const handleMapFilterChange = (key, value) => {
        if (key === 'reset') setMapFilters({ severity: 'All', hazardType: 'All', location: 'All' });
        else setMapFilters((prev) => ({ ...prev, [key]: value }));
    };

    const handleAdminFilterChange = (key, value) => {
        if (key === 'reset') setAdminFilters({ status: 'All', severity: 'All' });
        else setAdminFilters((prev) => ({ ...prev, [key]: value }));
    };

    // ============== HOME SCREEN ==============
    if (currentScreen === 'home') {
        return (
            <div style={{ 
                minHeight: '100vh', 
                background: 'linear-gradient(135deg, #0a2e5c 0%, #1a4a7a 50%, #0f2b4d 100%)',
                position: 'relative', 
                overflow: 'hidden' 
            }}>
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: 'url(https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: 0.4,
                    zIndex: 0
                }}></div>
                
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '120px',
                    background: 'repeating-linear-gradient(transparent 0px, transparent 29px, rgba(255,255,255,0.15) 30px)',
                    animation: 'waveMove 3s linear infinite',
                    zIndex: 1
                }}></div>
                
                {[...Array(8)].map((_, i) => (
                    <div key={i} style={{
                        position: 'absolute',
                        bottom: `${Math.random() * 100}%`,
                        left: `${Math.random() * 100}%`,
                        width: `${10 + Math.random() * 20}px`,
                        height: `${10 + Math.random() * 20}px`,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.3)',
                        animation: `floatUp ${5 + Math.random() * 5}s linear infinite`,
                        animationDelay: `${Math.random() * 5}s`,
                        zIndex: 1
                    }}></div>
                ))}
                
                <div style={{ position: 'relative', zIndex: 2, minHeight: '100vh' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
                        <div style={{ textAlign: 'center', maxWidth: '900px' }}>
                           <div style={{ position: 'relative' }}>
                                <div style={{
                                    position: 'absolute',
                                    bottom: '-15px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    width: '200px',
                                    height: '3px',
                                    background: 'linear-gradient(90deg, transparent, #fff, #bae6fd, #fff, transparent)',
                                    borderRadius: '3px',
                                    animation: 'waveLine 2s ease-in-out infinite'
                                }}></div>
                                
                                <h1 style={{ 
                                    fontSize: '5.8rem', 
                                    color: '#0f172a', 
                                    margin: 0, 
                                    textShadow: '2px 2px 10px rgba(255,255,255,0.3)', 
                                    letterSpacing: '6px', 
                                    fontWeight: '800',
                                    position: 'relative',
                                    display: 'inline-block'
                                }}>
                                    OceanPulse
                                </h1>
                            </div>
                            
                            <p style={{ fontSize: '1.3rem', color: '#e0f2fe', marginTop: '16px', textShadow: '1px 1px 5px rgba(0,0,0,0.3)' }}>Protecting Coastal Communities Worldwide</p>
                            
                            <div style={{
                                background: 'rgba(255,255,255,0.12)',
                                backdropFilter: 'blur(12px)',
                                borderRadius: '24px',
                                padding: '28px',
                                margin: '35px auto',
                                maxWidth: '650px',
                                border: '1px solid rgba(255,255,255,0.25)',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
                            }}>
                                <p style={{ color: '#fff', lineHeight: '1.7', margin: 0, fontSize: '1.05rem' }}>
                                     Our mission is to provide real-time hazard reporting and risk assessment 
                                    for coastal communities. Join us in creating safer shores through collective action 
                                    and advanced monitoring systems.
                                </p>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '30px', flexWrap: 'wrap' }}>
                                <button onClick={() => {
                                    setCurrentScreen('userLogin');
                                    setLoginData({ username: '', password: '' });
                                }} style={{
                                    padding: '16px 48px',
                                    background: 'transparent',
                                    color: '#fff',
                                    border: '2px solid #fff',
                                    borderRadius: '50px',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease-in-out'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-3px)';
                                    e.currentTarget.style.background = '#fff';
                                    e.currentTarget.style.color = '#0a2e5c';
                                    e.currentTarget.style.border = '2px solid #fff';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#fff';
                                    e.currentTarget.style.border = '2px solid #fff';
                                }}>
                                     User Portal
                                </button>
                                <button onClick={() => {
                                    setCurrentScreen('adminLogin');
                                    setAdminLoginData({ email: '', password: '' });
                                }} style={{
                                    padding: '16px 48px',
                                    background: 'transparent',
                                    color: '#fff',
                                    border: '2px solid #fff',
                                    borderRadius: '50px',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease-in-out'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-3px)';
                                    e.currentTarget.style.background = '#fff';
                                    e.currentTarget.style.color = '#0a2e5c';
                                    e.currentTarget.style.border = '2px solid #fff';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#fff';
                                    e.currentTarget.style.border = '2px solid #fff';
                                }}>
                                     Admin Portal
                                </button>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '50px', justifyContent: 'center', marginTop: '60px', flexWrap: 'wrap' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fbbf24' }}>24/7</div>
                                    <div style={{ color: '#e0f2fe', marginTop: '8px', fontSize: '14px' }}>Real-time Monitoring</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fbbf24' }}>100+</div>
                                    <div style={{ color: '#e0f2fe', marginTop: '8px', fontSize: '14px' }}>Coastal Areas</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fbbf24' }}>1000+</div>
                                    <div style={{ color: '#e0f2fe', marginTop: '8px', fontSize: '14px' }}>Hazards Reported</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fbbf24' }}>500+</div>
                                    <div style={{ color: '#e0f2fe', marginTop: '8px', fontSize: '14px' }}>Communities</div>
                                </div>
                            </div>
                            
                            <div style={{
                                display: 'flex',
                                gap: '20px',
                                justifyContent: 'center',
                                marginTop: '50px',
                                flexWrap: 'wrap'
                            }}>
                                <div style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    backdropFilter: 'blur(5px)',
                                    borderRadius: '15px',
                                    padding: '15px 25px',
                                    textAlign: 'center',
                                    minWidth: '140px',
                                    transition: 'transform 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                                    <div style={{ fontSize: '30px' }}>📍</div>
                                    <div style={{ color: '#fff', fontSize: '14px', marginTop: '8px' }}>Interactive Map</div>
                                </div>
                                <div style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    backdropFilter: 'blur(5px)',
                                    borderRadius: '15px',
                                    padding: '15px 25px',
                                    textAlign: 'center',
                                    minWidth: '140px',
                                    transition: 'transform 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                                    <div style={{ fontSize: '30px' }}>📊</div>
                                    <div style={{ color: '#fff', fontSize: '14px', marginTop: '8px' }}>Risk Analytics</div>
                                </div>
                                <div style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    backdropFilter: 'blur(5px)',
                                    borderRadius: '15px',
                                    padding: '15px 25px',
                                    textAlign: 'center',
                                    minWidth: '140px',
                                    transition: 'transform 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                                    <div style={{ fontSize: '30px' }}>🔔</div>
                                    <div style={{ color: '#fff', fontSize: '14px', marginTop: '8px' }}>Live Alerts</div>
                                </div>
                                <div style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    backdropFilter: 'blur(5px)',
                                    borderRadius: '15px',
                                    padding: '15px 25px',
                                    textAlign: 'center',
                                    minWidth: '140px',
                                    transition: 'transform 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                                    <div style={{ fontSize: '30px' }}>📸</div>
                                    <div style={{ color: '#fff', fontSize: '14px', marginTop: '8px' }}>Photo Evidence</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <style>{`
                    @keyframes float {
                        0%, 100% { transform: translateY(0px); }
                        50% { transform: translateY(-15px); }
                    }
                    @keyframes waveMove {
                        0% { background-position: 0 0; }
                        100% { background-position: 100px 0; }
                    }
                    @keyframes waveLine {
                        0%, 100% { width: 150px; opacity: 0.7; }
                        50% { width: 250px; opacity: 1; }
                    }
                    @keyframes floatUp {
                        0% {
                            transform: translateY(0) scale(1);
                            opacity: 0;
                        }
                        10% {
                            opacity: 0.6;
                        }
                        90% {
                            opacity: 0.6;
                        }
                        100% {
                            transform: translateY(-100vh) scale(0.5);
                            opacity: 0;
                        }
                    }
                `}</style>
                <ToastContainer position="top-right" />
            </div>
        );
    }

    // ============== USER LOGIN PAGE WITH OCEAN BACKGROUND ==============
    if (currentScreen === 'userLogin') {
        return (
            <div style={{ 
                minHeight: '100vh', 
                background: 'linear-gradient(135deg, #0a2e5c 0%, #1a4a7a 100%)', 
                position: 'relative',
                overflow: 'hidden',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '20px' 
            }}>
                {/* Ocean Background Image for User Login */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: 'url(https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1600)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: 0.35,
                    zIndex: 0
                }}></div>
                
                {/* Animated Waves */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '80px',
                    background: 'repeating-linear-gradient(transparent 0px, transparent 29px, rgba(255,255,255,0.1) 30px)',
                    animation: 'waveMove 3s linear infinite',
                    zIndex: 1
                }}></div>
                
                <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: '24px', padding: '40px', width: '420px', maxWidth: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', backdropFilter: 'blur(10px)', position: 'relative', zIndex: 2 }}>
                    <button onClick={() => setCurrentScreen('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginBottom: '24px', color: '#1e3a8a', fontWeight: 'bold' }}>← Back to Home</button>
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <span style={{ fontSize: '48px' }}></span>
                        <h2 style={{ marginTop: '8px', color: '#1e293b' }}>Welcome Back</h2>
                        <p style={{ color: '#64748b', fontSize: '14px' }}>Login to your OceanPulse account</p>
                    </div>
                    <form onSubmit={handleUserLogin}>
                        <input 
                            type="text" 
                            placeholder="Username" 
                            value={loginData.username} 
                            onChange={(e) => setLoginData({ ...loginData, username: e.target.value })} 
                            style={{ width: '100%', padding: '14px', marginBottom: '16px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '14px' }} 
                            required 
                        />
                        <input 
                            type="password" 
                            placeholder="Password" 
                            value={loginData.password} 
                            onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} 
                            style={{ width: '100%', padding: '14px', marginBottom: '24px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '14px' }} 
                            required 
                        />
                        <button type="submit" style={{ width: '100%', padding: '14px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>Login</button>
                    </form>
                    <p style={{ textAlign: 'center', marginTop: '20px', color: '#1e3a8a', cursor: 'pointer' }} onClick={() => setCurrentScreen('userSignup')}>Don't have an account? Create one</p>
                </div>
                <ToastContainer />
            </div>
        );
    }

    // ============== USER SIGNUP PAGE WITH OCEAN BACKGROUND ==============
    if (currentScreen === 'userSignup') {
        return (
            <div style={{ 
                minHeight: '100vh', 
                background: 'linear-gradient(135deg, #0a2e5c 0%, #1a4a7a 100%)', 
                position: 'relative',
                overflow: 'hidden',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '20px' 
            }}>
                {/* Ocean Background Image for Signup */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: 'url(https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: 0.35,
                    zIndex: 0
                }}></div>
                
                {/* Animated Waves */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '80px',
                    background: 'repeating-linear-gradient(transparent 0px, transparent 29px, rgba(255,255,255,0.1) 30px)',
                    animation: 'waveMove 3s linear infinite',
                    zIndex: 1
                }}></div>
                
                <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: '24px', padding: '40px', width: '420px', maxWidth: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', position: 'relative', zIndex: 2 }}>
                    <button onClick={() => setCurrentScreen('userLogin')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginBottom: '24px', color: '#1e3a8a', fontWeight: 'bold' }}>← Back to Login</button>
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <span style={{ fontSize: '48px' }}>📝</span>
                        <h2 style={{ marginTop: '8px', color: '#1e293b' }}>Create Account</h2>
                        <p style={{ color: '#64748b', fontSize: '14px' }}>Join OceanPulse today</p>
                    </div>
                    <form onSubmit={handleUserSignup}>
                        <input type="text" placeholder="Username" value={signupData.username} onChange={(e) => setSignupData({ ...signupData, username: e.target.value })} style={{ width: '100%', padding: '14px', marginBottom: '16px', border: '1px solid #e2e8f0', borderRadius: '12px' }} required />
                        <input type="email" placeholder="Email Address" value={signupData.email} onChange={(e) => setSignupData({ ...signupData, email: e.target.value })} style={{ width: '100%', padding: '14px', marginBottom: '16px', border: '1px solid #e2e8f0', borderRadius: '12px' }} required />
                        <input type="password" placeholder="Password" value={signupData.password} onChange={(e) => setSignupData({ ...signupData, password: e.target.value })} style={{ width: '100%', padding: '14px', marginBottom: '24px', border: '1px solid #e2e8f0', borderRadius: '12px' }} required />
                        <button type="submit" style={{ width: '100%', padding: '14px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>Sign Up</button>
                    </form>
                </div>
                <ToastContainer />
            </div>
        );
    }

    // ============== ADMIN LOGIN PAGE WITH OCEAN BACKGROUND ==============
    if (currentScreen === 'adminLogin') {
        return (
            <div style={{ 
                minHeight: '100vh', 
                background: 'linear-gradient(135deg, #0a2e5c 0%, #1a4a7a 100%)', 
                position: 'relative',
                overflow: 'hidden',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '20px' 
            }}>
                {/* Ocean Background Image for Admin Login */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: 'url(https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1600)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: 0.35,
                    zIndex: 0
                }}></div>
                
                {/* Animated Waves */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '80px',
                    background: 'repeating-linear-gradient(transparent 0px, transparent 29px, rgba(255,255,255,0.1) 30px)',
                    animation: 'waveMove 3s linear infinite',
                    zIndex: 1
                }}></div>
                
                <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: '24px', padding: '40px', width: '420px', maxWidth: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', position: 'relative', zIndex: 2 }}>
                    <button onClick={() => setCurrentScreen('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginBottom: '24px', color: '#1e3a8a', fontWeight: 'bold' }}>← Back to Home</button>
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <span style={{ fontSize: '48px' }}></span>
                        <h2 style={{ marginTop: '8px', color: '#1e293b' }}>Admin Portal</h2>
                        <p style={{ color: '#64748b', fontSize: '14px' }}>Secure administrator access</p>
                    </div>
                    <form onSubmit={handleAdminLogin}>
                        <input 
                            type="email" 
                            placeholder="Admin Email" 
                            value={adminLoginData.email} 
                            onChange={(e) => setAdminLoginData({ ...adminLoginData, email: e.target.value })} 
                            style={{ width: '100%', padding: '14px', marginBottom: '16px', border: '1px solid #e2e8f0', borderRadius: '12px' }} 
                            required 
                        />
                        <input 
                            type="password" 
                            placeholder="Password" 
                            value={adminLoginData.password} 
                            onChange={(e) => setAdminLoginData({ ...adminLoginData, password: e.target.value })} 
                            style={{ width: '100%', padding: '14px', marginBottom: '24px', border: '1px solid #e2e8f0', borderRadius: '12px' }} 
                            required 
                        />
                        <button type="submit" style={{ width: '100%', padding: '14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>Admin Login</button>
                    </form>
                </div>
                <ToastContainer />
            </div>
        );
    }

    // ============== USER DASHBOARD ==============
    if (currentScreen === 'userDashboard') {
        return (
            <div style={{ minHeight: '100vh', background: darkMode ? '#0f172a' : '#f0f4f8' }}>
                <ToastContainer />
                {showProfile && <ProfileModal user={user} darkMode={darkMode} onClose={() => setShowProfile(false)} />}
                {showSettings && <SettingsModal darkMode={darkMode} setDarkMode={setDarkMode} fontSize={fontSize} setFontSize={setFontSize} autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} notificationsEnabled={notificationsEnabled} setNotificationsEnabled={setNotificationsEnabled} onClose={() => setShowSettings(false)} />}
                {selectedPhoto && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setSelectedPhoto(null)}>
                        <div style={{ background: darkMode ? '#1e293b' : '#fff', borderRadius: '16px', padding: '20px' }} onClick={(e) => e.stopPropagation()}>
                            <img src={`${API_URL}/api/view-image/${selectedPhoto}`} alt="Evidence" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '8px' }} />
                            <button onClick={() => setSelectedPhoto(null)} style={{ position: 'absolute', top: '10px', right: '10px', background: '#ef4444', border: 'none', borderRadius: '50%', width: '30px', height: '30px', color: '#fff', cursor: 'pointer' }}>×</button>
                        </div>
                    </div>
                )}
                
                <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', background: darkMode ? '#1e293b' : '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 100 }}>
                    <h2 style={{ color: '#1e3a8a', fontSize: '1.5rem', margin: 0 }}>🌊 OceanPulse</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <TodaySummary hazards={hazards} />
                        <NotificationBell notifications={notifications} unreadCount={unreadCount} onMarkRead={handleMarkRead} onClearAll={handleClearAll} darkMode={darkMode} />
                        <button onClick={() => setShowProfile(true)} style={{ background: '#1e3a8a', border: 'none', borderRadius: '50%', width: '40px', height: '40px', color: '#fff', fontSize: '18px', cursor: 'pointer' }}>👤</button>
                        <button onClick={() => setShowSettings(true)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer' }}>⚙️</button>
                        <span style={{ fontWeight: '500', color: darkMode ? '#fff' : '#1e293b' }}>{user?.username}</span>
                        <button onClick={handleLogout} style={{ padding: '8px 20px', border: '1px solid #ef4444', background: 'none', borderRadius: '20px', color: '#ef4444', cursor: 'pointer' }}>Logout</button>
                    </div>
                </nav>
                
                {hazards.filter((h) => h.severity === 'High' && h.status !== 'Resolved').length > 0 && (
                    <div style={{ margin: '20px', padding: '12px 20px', background: '#fef3c7', borderLeft: '4px solid #ef4444', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>📌</span>
                        <span style={{ fontWeight: 'bold' }}>Pinned Alert: {hazards.filter((h) => h.severity === 'High')[0]?.hazard_type} risk in {hazards.filter((h) => h.severity === 'High')[0]?.location}</span>
                    </div>
                )}
                
                {highSeverityCount >= 2 && (
                    <div style={{ margin: '0 20px 20px 20px', padding: '12px', background: darkMode ? '#7f1d1d' : '#fee2e2', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold', color: darkMode ? '#fca5a5' : '#dc2626' }}>
                        ⚠️ {highSeverityCount} high severity hazards detected
                    </div>
                )}
                
                <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '32px' }}>
                        <StatBox title="Total Reports" value={hazards.length} icon="📊" color="#1e3a8a" />
                        <StatBox title="Active Hazards" value={hazards.filter((h) => h.status !== 'Resolved').length} icon="⚠️" color="#f59e0b" />
                        <StatBox title="Resolved" value={hazards.filter((h) => h.status === 'Resolved').length} icon="✅" color="#10b981" />
                        <StatBox title="High Risk" value={highSeverityCount} icon="🔴" color="#ef4444" />
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px' }}>
                        <div style={{ background: darkMode ? '#1e293b' : '#fff', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                            <h3 style={{ marginBottom: '20px', color: darkMode ? '#fff' : '#1e293b' }}>📝 Report Hazard</h3>
                            <form onSubmit={handleSubmitHazard} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <input type="text" placeholder="Hazard Type (Cyclone, Flood, Earthquake)" value={formData.hazard_type} onChange={(e) => setFormData({ ...formData, hazard_type: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#fff' : '#1e293b' }} required />
                                <input type="text" placeholder="Location (Chennai, Mumbai, Delhi)" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#fff' : '#1e293b' }} required />
                                <select value={formData.severity} onChange={(e) => setFormData({ ...formData, severity: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#fff' : '#1e293b' }}>
                                    <option value="Low">🟢 Low Severity</option>
                                    <option value="Medium">🟡 Medium Severity</option>
                                    <option value="High">🔴 High Severity</option>
                                </select>
                                <input type="number" placeholder="Radius (KM)" value={formData.radius} onChange={(e) => setFormData({ ...formData, radius: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#fff' : '#1e293b' }} required />
                                <input type="number" placeholder="People Affected" value={formData.people_affected} onChange={(e) => setFormData({ ...formData, people_affected: e.target.value })} style={{ padding: '12px', borderRadius: '12px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#fff' : '#1e293b' }} required />
                                <input id="photoInput" type="file" accept="image/*" onChange={(e) => setFormData({ ...formData, photo: e.target.files[0] })} style={{ padding: '8px', borderRadius: '12px', background: darkMode ? '#0f172a' : '#fff' }} />
                                <button type="submit" disabled={submitting} style={{ padding: '14px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>{submitting ? 'Submitting...' : 'Submit Report'}</button>
                            </form>
                        </div>
                        
                        <Leaderboard topLocations={topLocations} darkMode={darkMode} />
                    </div>
                    
                    <div style={{ background: darkMode ? '#1e293b' : '#fff', borderRadius: '24px', padding: '24px', marginBottom: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                        <h3 style={{ color: darkMode ? '#fff' : '#1e293b' }}>🗺️ Hazard Map</h3>
                        <MapFilters filters={mapFilters} onFilterChange={handleMapFilterChange} hazardTypes={hazardTypes} locations={locations} darkMode={darkMode} />
                        <div style={{ height: '450px', marginTop: '20px', borderRadius: '16px', overflow: 'hidden' }}>
                            <MapContainer key={JSON.stringify(mapFilters)} center={[28.6139, 77.2090]} zoom={5} style={{ height: '100%', width: '100%' }}>
                                <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                                {filteredHazards.map((h) => {
                                    const coords = getCoordinatesForLocation(h.location);
                                    return (
                                        <Marker key={h.id} position={coords} icon={getMarkerIcon(h.severity)}>
                                            <Popup>
                                                <div style={{ minWidth: '200px' }}>
                                                    <strong>{h.hazard_type}</strong><br />
                                                     {h.location}<br />
                                                     Severity: <span style={{ color: getSeverityColor(h.severity), fontWeight: 'bold' }}>{h.severity}</span><br />
                                                     Risk Score: {calculateRiskScore(h.severity, h.people_affected, h.radius)}/100<br />
                                                     Affected: {h.people_affected}<br />
                                                     {new Date(h.created_at).toLocaleDateString()}
                                                </div>
                                            </Popup>
                                        </Marker>
                                    );
                                })}
                            </MapContainer>
                        </div>
                    </div>
                    
                    <ActivityTimeline activities={activities} darkMode={darkMode} />
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', background: darkMode ? '#1e293b' : '#fff', borderRadius: '40px', margin: '24px 0' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }}></span>
                        <span style={{ color: darkMode ? '#fff' : '#1e293b' }}>System Active</span>
                        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#64748b' }}>Updated: {lastUpdated.toLocaleTimeString()}</span>
                    </div>
                    
                    <div style={{ background: darkMode ? '#1e293b' : '#fff', borderRadius: '24px', padding: '24px', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: `2px solid ${darkMode ? '#334155' : '#e2e8f0'}`, paddingBottom: '12px' }}>
                            <button onClick={() => setActiveTab('all')} style={{ padding: '8px 24px', cursor: 'pointer', fontWeight: 'bold', border: 'none', borderRadius: '20px', background: activeTab === 'all' ? '#1e3a8a' : 'transparent', color: activeTab === 'all' ? '#fff' : (darkMode ? '#94a3b8' : '#64748b') }}>All ({tabCounts.all})</button>
                            <button onClick={() => setActiveTab('high')} style={{ padding: '8px 24px', cursor: 'pointer', fontWeight: 'bold', border: 'none', borderRadius: '20px', background: activeTab === 'high' ? '#ef4444' : 'transparent', color: activeTab === 'high' ? '#fff' : (darkMode ? '#94a3b8' : '#64748b') }}>High Risk ({tabCounts.high})</button>
                            <button onClick={() => setActiveTab('resolved')} style={{ padding: '8px 24px', cursor: 'pointer', fontWeight: 'bold', border: 'none', borderRadius: '20px', background: activeTab === 'resolved' ? '#10b981' : 'transparent', color: activeTab === 'resolved' ? '#fff' : (darkMode ? '#94a3b8' : '#64748b') }}>Resolved ({tabCounts.resolved})</button>
                        </div>
                        
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: `2px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                                        <th style={{ padding: '14px', textAlign: 'left' }}>Hazard</th>
                                        <th style={{ padding: '14px', textAlign: 'left' }}>Location</th>
                                        <th style={{ padding: '14px', textAlign: 'left' }}>Severity</th>
                                        <th style={{ padding: '14px', textAlign: 'left' }}>Risk Score</th>
                                        <th style={{ padding: '14px', textAlign: 'left' }}>People</th>
                                        <th style={{ padding: '14px', textAlign: 'left' }}>Photo</th>
                                        <th style={{ padding: '14px', textAlign: 'left' }}>Status</th>
                                        <th style={{ padding: '14px', textAlign: 'left' }}>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredHazards.length === 0 ? (
                                        <tr><td colSpan="8" style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>No reports found</td></tr>
                                    ) : (
                                        filteredHazards.map((h) => {
                                            const riskScore = calculateRiskScore(h.severity, h.people_affected, h.radius);
                                            const riskLevel = getRiskLevel(riskScore);
                                            return (
                                                <tr key={h.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, ...(recentlyUpdatedId === h.id ? { background: 'rgba(79,70,229,0.1)', boxShadow: '0 0 0 2px #4f46e5' } : {}) }}>
                                                    <td style={{ padding: '14px' }}>{h.hazard_type}</td>
                                                    <td style={{ padding: '14px' }}>{h.location}</td>
                                                    <td style={{ padding: '14px' }}><span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', background: `${getSeverityColor(h.severity)}20`, color: getSeverityColor(h.severity) }}>{h.severity}</span></td>
                                                    <td style={{ padding: '14px' }}><span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', background: riskLevel.bg, color: riskLevel.color }}>{riskLevel.icon} {riskScore}/100</span></td>
                                                    <td style={{ padding: '14px' }}>{h.people_affected}</td>
                                                    <td style={{ padding: '14px' }}>{h.photo_url ? <button onClick={() => setSelectedPhoto(h.photo_url)} style={{ padding: '4px 12px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>View</button> : '—'}</td>
                                                    <td style={{ padding: '14px' }}><span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', background: `${getStatusColor(h.status)}20`, color: getStatusColor(h.status) }}>{h.status}</span></td>
                                                    <td style={{ padding: '14px', fontSize: '12px', color: '#64748b' }}>{new Date(h.created_at).toLocaleDateString()}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <style>{`
                    @keyframes pulse {
                        0%, 100% { opacity: 1; transform: scale(1); }
                        50% { opacity: 0.5; transform: scale(1.2); }
                    }
                `}</style>
            </div>
        );
    }

    // ============== ADMIN DASHBOARD ==============
    if (currentScreen === 'adminDashboard') {
       const pendingCount = hazards.filter((h) => h.status?.toLowerCase() === 'pending').length;
       const inProgressCount = hazards.filter((h) => h.status?.toLowerCase() === 'in-progress').length;
       const resolvedCount = hazards.filter((h) => h.status?.toLowerCase() === 'resolved').length;
        const completionRate = hazards.length ? Math.round((resolvedCount / hazards.length) * 100) : 0;
        
        return (
            <div style={{ minHeight: '100vh', background: darkMode ? '#0f172a' : '#f0f4f8' }}>
                <ToastContainer />
                {showProfile && <ProfileModal user={user} darkMode={darkMode} onClose={() => setShowProfile(false)} />}
                {showSettings && <SettingsModal darkMode={darkMode} setDarkMode={setDarkMode} fontSize={fontSize} setFontSize={setFontSize} autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} notificationsEnabled={notificationsEnabled} setNotificationsEnabled={setNotificationsEnabled} onClose={() => setShowSettings(false)} />}
                {selectedPhoto && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setSelectedPhoto(null)}>
                        <div style={{ background: darkMode ? '#1e293b' : '#fff', borderRadius: '16px', padding: '20px' }} onClick={(e) => e.stopPropagation()}>
                            <img src={`${API_URL}/api/view-image/${selectedPhoto}`} alt="Evidence" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '8px' }} />
                            <button onClick={() => setSelectedPhoto(null)} style={{ position: 'absolute', top: '10px', right: '10px', background: '#ef4444', border: 'none', borderRadius: '50%', width: '30px', height: '30px', color: '#fff', cursor: 'pointer' }}>×</button>
                        </div>
                    </div>
                )}
                
                <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', background: darkMode ? '#1e293b' : '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 100 }}>
                    <h2 style={{ color: '#1e3a8a', fontSize: '1.5rem', margin: 0 }}>🌊 OceanPulse Admin</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <TodaySummary hazards={hazards} />
                        <NotificationBell notifications={notifications} unreadCount={unreadCount} onMarkRead={handleMarkRead} onClearAll={handleClearAll} darkMode={darkMode} />
                        <button onClick={() => setShowProfile(true)} style={{ background: '#1e3a8a', border: 'none', borderRadius: '50%', width: '40px', height: '40px', color: '#fff', fontSize: '18px', cursor: 'pointer' }}>👤</button>
                        <button onClick={() => setShowSettings(true)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer' }}>⚙️</button>
                        <span style={{ fontWeight: '500', color: darkMode ? '#fff' : '#1e293b' }}>Admin</span>
                        <button onClick={handleLogout} style={{ padding: '8px 20px', border: '1px solid #ef4444', background: 'none', borderRadius: '20px', color: '#ef4444', cursor: 'pointer' }}>Logout</button>
                    </div>
                </nav>
                
                <div style={{ margin: '20px', padding: '16px 24px', background: darkMode ? '#1e293b' : '#fff', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <span style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', background: adminRole === 'editor' ? '#10b981' : '#f59e0b', color: '#fff' }}>{adminRole === 'editor' ? '✏️ EDIT MODE ACTIVE' : '👁️ VIEW MODE'}</span>
                        {adminRole === 'viewer' ? (
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <input type="password" placeholder="Enter passkey" value={passkey} onChange={(e) => setPasskey(e.target.value)} style={{ padding: '10px 16px', borderRadius: '12px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#fff' : '#1e293b', width: '220px' }} />
                                <button onClick={handleVerifyPasskey} disabled={isVerifying} style={{ padding: '10px 24px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>{isVerifying ? 'Verifying...' : 'Enable Edit Mode'}</button>
                            </div>
                        ) : (
                            <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 'bold' }}>✅ Edit mode active - You can change status and delete hazards</div>
                        )}
                    </div>
                </div>
                
                {hazards.filter((h) => h.severity === 'High' && h.status !== 'Resolved').length > 0 && (
                    <div style={{ margin: '0 20px 20px 20px', padding: '12px 20px', background: '#fef3c7', borderLeft: '4px solid #ef4444', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>📌</span>
                        <span style={{ fontWeight: 'bold' }}>Pinned Alert: {hazards.filter((h) => h.severity === 'High')[0]?.hazard_type} risk in {hazards.filter((h) => h.severity === 'High')[0]?.location}</span>
                    </div>
                )}
                
                {highSeverityCount >= 2 && (
                    <div style={{ margin: '0 20px 20px 20px', padding: '12px', background: darkMode ? '#7f1d1d' : '#fee2e2', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold', color: darkMode ? '#fca5a5' : '#dc2626' }}>
                        ⚠️ {highSeverityCount} high severity hazards detected
                    </div>
                )}
                
                <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '20px', marginBottom: '32px' }}>
                        <StatBox title="Total Hazards" value={hazards.length} icon="📊" color="#1e3a8a" />
                        <StatBox title="Pending" value={pendingCount} icon="⏳" color="#f59e0b" />
                        <StatBox title="In Progress" value={inProgressCount} icon="🔄" color="#3b82f6" />
                        <StatBox title="Resolved" value={resolvedCount} icon="✅" color="#10b981" />
                        <StatBox title="High Risk" value={highSeverityCount} icon="🔴" color="#ef4444" />
                        <StatBox title="Completion" value={completionRate} icon="📈" color="#8b5cf6" subtitle="%" />
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                        <div style={{ background: darkMode ? '#1e293b' : '#fff', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                            <h3 style={{ marginBottom: '20px', color: darkMode ? '#fff' : '#1e293b' }}>Hazards by Type</h3>
                            <div style={{ height: '300px' }}>
                                {hazardStats.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>No data available</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={hazardStats}>
                                            <XAxis dataKey="hazard_type" stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={12} />
                                            <YAxis stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={12} />
                                            <Tooltip contentStyle={{ background: darkMode ? '#1e293b' : '#fff', border: 'none', borderRadius: '8px' }} />
                                            <Bar dataKey="count" fill="#1e3a8a" radius={[8, 8, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                        
                        <Leaderboard topLocations={topLocations} darkMode={darkMode} />
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                        <div style={{ background: darkMode ? '#1e293b' : '#fff', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                            <h3 style={{ marginBottom: '20px', color: darkMode ? '#fff' : '#1e293b' }}>Status Distribution</h3>
                            <div style={{ height: '300px' }}>
                                {statusStats.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>No data available</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie data={statusStats} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                                {statusStats.map((entry, index) => (
                                                    <Cell key={index} fill={entry.status === 'Pending' ? '#f59e0b' : entry.status === 'In-Progress' ? '#3b82f6' : '#10b981'} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ background: darkMode ? '#1e293b' : '#fff', border: 'none', borderRadius: '8px' }} />
                                            <Legend wrapperStyle={{ color: darkMode ? '#fff' : '#1e293b' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                        
                        <ActivityTimeline activities={activities} darkMode={darkMode} />
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
                        <button onClick={handleExportCSV} style={{ padding: '12px 24px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>📊 Export All Reports as CSV</button>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', background: darkMode ? '#1e293b' : '#fff', borderRadius: '40px', margin: '24px 0' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }}></span>
                        <span style={{ color: darkMode ? '#fff' : '#1e293b' }}>System Active</span>
                        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#64748b' }}>Updated: {lastUpdated.toLocaleTimeString()}</span>
                    </div>
                    
                    <div style={{ background: darkMode ? '#1e293b' : '#fff', borderRadius: '24px', padding: '24px', overflow: 'hidden' }}>
                        <h3 style={{ marginBottom: '20px', color: darkMode ? '#fff' : '#1e293b' }}>📋 All Hazard Reports</h3>
                        <AdminFilters filters={adminFilters} onFilterChange={handleAdminFilterChange} darkMode={darkMode} />
                        
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: `2px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                                        <th style={{ padding: '14px', textAlign: 'left' }}>ID</th>
                                        <th style={{ padding: '14px', textAlign: 'left' }}>Reporter</th>
                                        <th style={{ padding: '14px', textAlign: 'left' }}>Hazard</th>
                                        <th style={{ padding: '14px', textAlign: 'left' }}>Location</th>
                                        <th style={{ padding: '14px', textAlign: 'left' }}>Severity</th>
                                        <th style={{ padding: '14px', textAlign: 'left' }}>Risk Score</th>
                                        <th style={{ padding: '14px', textAlign: 'left' }}>People</th>
                                        <th style={{ padding: '14px', textAlign: 'left' }}>Photo</th>
                                        <th style={{ padding: '14px', textAlign: 'left' }}>Status</th>
                                        <th style={{ padding: '14px', textAlign: 'left' }}>Action</th>
                                        <th style={{ padding: '14px', textAlign: 'left' }}>Delete</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {adminFilteredHazards.length === 0 ? (
                                        <tr><td colSpan="11" style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>No reports found</td></tr>
                                    ) : (
                                        adminFilteredHazards.map((h) => {
                                            const riskScore = calculateRiskScore(h.severity, h.people_affected, h.radius);
                                            const riskLevel = getRiskLevel(riskScore);
                                            return (
                                                <tr key={h.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, ...(recentlyUpdatedId === h.id ? { background: 'rgba(79,70,229,0.1)', boxShadow: '0 0 0 2px #4f46e5' } : {}) }}>
                                                    <td style={{ padding: '14px' }}>{h.id}</td>
                                                    <td style={{ padding: '14px' }}>{h.reporter_name || 'Unknown'}</td>
                                                    <td style={{ padding: '14px' }}>{h.hazard_type}</td>
                                                    <td style={{ padding: '14px' }}>{h.location}</td>
                                                    <td style={{ padding: '14px' }}><span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', background: `${getSeverityColor(h.severity)}20`, color: getSeverityColor(h.severity) }}>{h.severity}</span></td>
                                                    <td style={{ padding: '14px' }}><span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', background: riskLevel.bg, color: riskLevel.color }}>{riskLevel.icon} {riskScore}/100</span></td>
                                                    <td style={{ padding: '14px' }}>{h.people_affected}</td>
                                                    <td style={{ padding: '14px' }}>{h.photo_url ? <button onClick={() => setSelectedPhoto(h.photo_url)} style={{ padding: '4px 12px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>View</button> : '—'}</td>
                                                    <td style={{ padding: '14px' }}><span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', background: `${getStatusColor(h.status)}20`, color: getStatusColor(h.status) }}>{h.status}</span></td>
                                                    <td style={{ padding: '14px' }}>
                                                        <select value={h.status} onChange={(e) => handleUpdateStatus(h.id, e.target.value)} disabled={adminRole !== 'editor'} style={{ padding: '8px', borderRadius: '8px', fontSize: '12px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, background: darkMode ? '#0f172a' : '#fff', cursor: adminRole === 'editor' ? 'pointer' : 'not-allowed' }}>
                                                            <option value="Pending">Pending</option>
                                                            <option value="In-Progress">In Progress</option>
                                                            <option value="Resolved">Resolved</option>
                                                        </select>
                                                    </td>
                                                    <td style={{ padding: '14px' }}>
                                                        <button onClick={() => handleDeleteHazard(h.id)} disabled={adminRole !== 'editor'} style={{ padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: adminRole === 'editor' ? 'pointer' : 'not-allowed', opacity: adminRole === 'editor' ? 1 : 0.5 }}>Delete</button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <style>{`
                    @keyframes pulse {
                        0%, 100% { opacity: 1; transform: scale(1); }
                        50% { opacity: 0.5; transform: scale(1.2); }
                    }
                `}</style>
            </div>
        );
    }

    return null;
}

export default App;