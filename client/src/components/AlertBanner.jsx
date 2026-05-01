import React from 'react';

const AlertBanner = ({ message }) => {
  if (!message) return null;

  return (
    <div style={{
      background: '#ff4444',
      color: 'white',
      padding: '12px 20px',
      textAlign: 'center',
      fontWeight: 'bold',
      animation: 'pulse 1s infinite',
      position: 'sticky',
      top: '70px',
      zIndex: 99
    }}>
      {message}
    </div>
  );
};

export default AlertBanner;