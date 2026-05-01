import React, { useState } from 'react';

const NotificationBell = ({ notifications, unreadCount, onMarkRead, onClearAll }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'transparent',
          border: 'none',
          fontSize: '20px',
          cursor: 'pointer',
          position: 'relative',
          color: '#00d2ff'
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            background: '#ff4444',
            color: 'white',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '40px',
          right: '0',
          width: '350px',
          maxHeight: '400px',
          background: '#14141f',
          border: '1px solid #2a2a3a',
          borderRadius: '10px',
          overflow: 'auto',
          zIndex: 1000,
          boxShadow: '0 5px 20px rgba(0,0,0,0.3)'
        }}>
          <div style={{
            padding: '15px',
            borderBottom: '1px solid #2a2a3a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <strong style={{ color: '#00d2ff' }}>Notifications</strong>
            {notifications.length > 0 && (
              <button 
                onClick={onClearAll}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ff4444',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Clear All
              </button>
            )}
          </div>
          <div>
            {notifications.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#aaa' }}>
                No notifications
              </div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif.id} 
                  onClick={() => onMarkRead(notif.id)}
                  style={{
                    padding: '12px 15px',
                    borderBottom: '1px solid #2a2a3a',
                    background: notif.is_read ? 'transparent' : '#00d2ff10',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: notif.is_read ? 'normal' : 'bold', marginBottom: '5px' }}>
                    {notif.message}
                  </div>
                  <div style={{ fontSize: '11px', color: '#aaa' }}>
                    {new Date(notif.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;