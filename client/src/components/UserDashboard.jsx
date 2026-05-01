import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import NotificationBell from './NotificationBell';
import ActivityTimeline from './ActivityTimeline';
import AlertBanner from './AlertBanner';

const UserDashboard = ({ user, onLogout, apiUrl }) => {
  const [hazards, setHazards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [formData, setFormData] = useState({
    hazard_type: '',
    location: '',
    severity: 'Low',
    radius: '',
    people_affected: '',
    photo: null
  });
  const [submitting, setSubmitting] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch user's hazards
  const fetchHazards = useCallback(async () => {
    try {
      const res = await axios.get(`${apiUrl}/api/user-hazards/${user.id}`);
      setHazards(res.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching hazards:', error);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, user.id]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await axios.get(`${apiUrl}/api/notifications/${user.id}`);
      setNotifications(res.data);
      setUnreadCount(res.data.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [apiUrl, user.id]);

  useEffect(() => {
    fetchHazards();
    fetchNotifications();
    
    const interval = setInterval(() => {
      fetchHazards();
      fetchNotifications();
    }, 15000);
    
    return () => clearInterval(interval);
  }, [fetchHazards, fetchNotifications]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setFormData({ ...formData, photo: e.target.files[0] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.hazard_type || !formData.location || !formData.radius || !formData.people_affected) {
      toast.error('Please fill all required fields');
      return;
    }
    
    setSubmitting(true);
    
    const data = new FormData();
    data.append('user_id', user.id);
    data.append('hazard_type', formData.hazard_type);
    data.append('location', formData.location);
    data.append('severity', formData.severity);
    data.append('radius', formData.radius);
    data.append('people_affected', formData.people_affected);
    if (formData.photo) data.append('photo', formData.photo);
    
    try {
      await axios.post(`${apiUrl}/api/hazards`, data, {
        headers: { 'x-admin-role': 'viewer' }
      });
      
      toast.success('✅ Hazard reported successfully!');
      
      setFormData({
        hazard_type: '',
        location: '',
        severity: 'Low',
        radius: '',
        people_affected: '',
        photo: null
      });
      
      fetchHazards();
      fetchNotifications();
      
      if (formData.severity === 'High') {
        toast.warning(`⚠️ High severity hazard reported at ${formData.location}!`);
      }
      
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkNotificationRead = async (notificationId) => {
    try {
      await axios.put(`${apiUrl}/api/notifications/${notificationId}/read`);
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleClearNotifications = async () => {
    try {
      await axios.delete(`${apiUrl}/api/notifications/clear/${user.id}`);
      fetchNotifications();
      toast.success('All notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const highSeverityHazards = hazards.filter(h => h.severity === 'High');
  const alertMessage = highSeverityHazards.length > 0 
    ? `High risk: Multiple hazards detected - ${highSeverityHazards.length} high severity hazard(s)`
    : null;

  return (
    <div style={styles.container}>
      <ToastContainer position="top-right" />
      
      {/* Navbar */}
      <nav style={styles.navbar}>
        <h2 style={styles.logo}>🌊 OceanPulse</h2>
        <div style={styles.navRight}>
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={handleMarkNotificationRead}
            onClearAll={handleClearNotifications}
          />
          <span style={styles.userName}>{user?.username}</span>
          <button onClick={onLogout} style={styles.logoutBtn}>Logout</button>
        </div>
      </nav>
      
      {/* Alert Banner */}
      <AlertBanner message={alertMessage} />
      
      <div style={styles.mainContent}>
        {/* Report Form */}
        <div style={styles.formCard}>
          <h3 style={styles.sectionTitle}>📝 Submit Hazard Report</h3>
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formRow}>
              <input
                type="text"
                name="hazard_type"
                placeholder="⚠️ Hazard Type"
                value={formData.hazard_type}
                onChange={handleInputChange}
                style={styles.input}
                required
              />
              <input
                type="text"
                name="location"
                placeholder="📍 Location"
                value={formData.location}
                onChange={handleInputChange}
                style={styles.input}
                required
              />
            </div>
            
            <div style={styles.formRow}>
              <select
                name="severity"
                value={formData.severity}
                onChange={handleInputChange}
                style={styles.select}
              >
                <option value="Low">🟢 Low Severity</option>
                <option value="Medium">🟡 Medium Severity</option>
                <option value="High">🔴 High Severity</option>
              </select>
              <input
                type="number"
                name="radius"
                placeholder="📏 Radius (KM)"
                value={formData.radius}
                onChange={handleInputChange}
                style={styles.input}
                required
              />
            </div>
            
            <div style={styles.formRow}>
              <input
                type="number"
                name="people_affected"
                placeholder="👥 People Affected"
                value={formData.people_affected}
                onChange={handleInputChange}
                style={styles.input}
                required
              />
              <input
                type="file"
                name="photo"
                onChange={handleFileChange}
                accept="image/*"
                style={styles.fileInput}
              />
            </div>
            
            <button type="submit" style={styles.submitBtn} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </form>
        </div>
        
        {/* Stats */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{hazards.length}</div>
            <div style={styles.statLabel}>My Reports</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{hazards.filter(h => h.status === 'Resolved').length}</div>
            <div style={styles.statLabel}>Resolved</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{hazards.filter(h => h.severity === 'High').length}</div>
            <div style={styles.statLabel}>High Severity</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{hazards.filter(h => h.status === 'Pending').length}</div>
            <div style={styles.statLabel}>Pending</div>
          </div>
        </div>
        
        {/* Activity Timeline */}
        <ActivityTimeline apiUrl={apiUrl} />
        
        {/* Live Status */}
        <div style={styles.statusBar}>
          <span style={styles.statusDot}></span>
          <span>System Active</span>
          <span style={styles.statusTime}>Last updated: {lastUpdated.toLocaleTimeString()}</span>
        </div>
        
        {/* My Reports Table */}
        <div style={styles.reportsCard}>
          <h3 style={styles.sectionTitle}>📋 My Reports</h3>
          <div style={styles.tableWrapper}>
            {loading ? (
              <div style={styles.loading}>Loading...</div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th>Hazard</th>
                    <th>Location</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {hazards.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={styles.noData}>No reports yet. Submit your first report!</td>
                    </tr>
                  ) : (
                    hazards.map((hazard) => (
                      <tr key={hazard.id}>
                        <td>{hazard.hazard_type}</td>
                        <td>{hazard.location}</td>
                        <td>
                          <span style={{
                            ...styles.severityBadge,
                            background: hazard.severity === 'High' ? '#ff444420' : hazard.severity === 'Medium' ? '#ffcc0020' : '#00ffaa20',
                            color: hazard.severity === 'High' ? '#ff4444' : hazard.severity === 'Medium' ? '#ffcc00' : '#00ffaa'
                          }}>
                            {hazard.severity}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            ...styles.statusBadge,
                            background: hazard.status === 'Pending' ? '#ffc10720' : hazard.status === 'In-Progress' ? '#17a2b820' : '#28a74520',
                            color: hazard.status === 'Pending' ? '#ffc107' : hazard.status === 'In-Progress' ? '#17a2b8' : '#28a745'
                          }}>
                            {hazard.status}
                          </span>
                        </td>
                        <td>{new Date(hazard.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: '#0a0a0f',
    color: '#fff'
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px 30px',
    background: '#14141f',
    borderBottom: '1px solid #2a2a3a',
    position: 'sticky',
    top: 0,
    zIndex: 100
  },
  logo: {
    color: '#00d2ff',
    margin: 0
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  userName: {
    color: '#00d2ff',
    fontWeight: 'bold'
  },
  logoutBtn: {
    padding: '8px 20px',
    background: 'transparent',
    border: '1px solid #dc3545',
    color: '#dc3545',
    borderRadius: '20px',
    cursor: 'pointer'
  },
  mainContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '30px'
  },
  formCard: {
    background: '#14141f',
    borderRadius: '15px',
    padding: '25px',
    marginBottom: '30px',
    border: '1px solid #2a2a3a'
  },
  sectionTitle: {
    color: '#00d2ff',
    marginBottom: '20px',
    fontSize: '20px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '15px'
  },
  input: {
    padding: '12px',
    background: '#1a1a2a',
    border: '1px solid #2a2a3a',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '14px'
  },
  select: {
    padding: '12px',
    background: '#1a1a2a',
    border: '1px solid #2a2a3a',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '14px'
  },
  fileInput: {
    padding: '10px',
    background: '#1a1a2a',
    border: '1px solid #2a2a3a',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '14px'
  },
  submitBtn: {
    padding: '12px',
    background: '#00d2ff',
    color: '#000',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '20px',
    marginBottom: '30px'
  },
  statCard: {
    background: '#14141f',
    borderRadius: '15px',
    padding: '20px',
    textAlign: 'center',
    border: '1px solid #2a2a3a'
  },
  statValue: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#00d2ff'
  },
  statLabel: {
    fontSize: '14px',
    color: '#aaa',
    marginTop: '5px'
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '15px',
    background: '#14141f',
    borderRadius: '10px',
    marginBottom: '30px',
    border: '1px solid #2a2a3a'
  },
  statusDot: {
    width: '10px',
    height: '10px',
    background: '#28a745',
    borderRadius: '50%',
    animation: 'pulse 2s infinite'
  },
  statusTime: {
    marginLeft: 'auto',
    fontSize: '12px',
    color: '#aaa'
  },
  reportsCard: {
    background: '#14141f',
    borderRadius: '15px',
    padding: '25px',
    border: '1px solid #2a2a3a'
  },
  tableWrapper: {
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  severityBadge: {
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
    display: 'inline-block'
  },
  statusBadge: {
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
    display: 'inline-block'
  },
  noData: {
    textAlign: 'center',
    padding: '40px',
    color: '#aaa'
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#aaa'
  }
};

export default UserDashboard;