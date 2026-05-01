import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ActivityTimeline = ({ apiUrl }) => {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchActivities = async () => {
    try {
      const res = await axios.get(`${apiUrl}/api/activity-logs`);
      setActivities(res.data.slice(0, 10));
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const getActivityIcon = (action) => {
    if (action.includes('Hazard Reported')) return '🚨';
    if (action.includes('Status Updated')) return '📋';
    if (action.includes('Hazard Deleted')) return '🗑️';
    if (action.includes('Hazard Updated')) return '✏️';
    return '📌';
  };

  return (
    <div style={{
      background: '#14141f',
      borderRadius: '15px',
      padding: '20px',
      marginBottom: '30px',
      border: '1px solid #2a2a3a'
    }}>
      <h3 style={{ color: '#00d2ff', marginBottom: '20px' }}>📋 Activity Timeline</h3>
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {activities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>
            No activities yet
          </div>
        ) : (
          activities.map((activity, index) => (
            <div 
              key={index}
              style={{
                padding: '12px',
                borderBottom: '1px solid #2a2a3a',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <span style={{ fontSize: '20px' }}>{getActivityIcon(activity.action)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{activity.action}</div>
                <div style={{ fontSize: '12px', color: '#aaa' }}>
                  {activity.user_name} • {activity.location || activity.hazard_type || ''}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#666' }}>
                {new Date(activity.created_at).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActivityTimeline;