import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const AdminLogin = ({ onBack, onLogin }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await axios.post('http://localhost:5000/api/admin/login', formData);
      if (response.data) {
        onLogin(response.data);
      }
    } catch (error) {
      const message = error.response?.data?.error || 'Invalid admin credentials';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <button onClick={onBack} style={styles.backBtn}>← Back</button>
        <h2 style={styles.title}>Admin Portal</h2>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="email"
            placeholder="Admin Email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            style={styles.input}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            style={styles.input}
            required
          />
          <button type="submit" style={styles.submitBtn} disabled={loading}>
            {loading ? 'Logging in...' : 'Admin Login'}
          </button>
        </form>
        {/* Removed hardcoded admin credentials for security */}
      </div>
    </div>
  );
};

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2a 100%)'
  },
  card: {
    background: '#14141f',
    padding: '40px',
    borderRadius: '20px',
    width: '400px',
    border: '1px solid #2a2a3a'
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    color: '#00d2ff',
    cursor: 'pointer',
    fontSize: '14px',
    marginBottom: '20px'
  },
  title: {
    color: '#00d2ff',
    fontSize: '28px',
    marginBottom: '30px',
    textAlign: 'center'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  input: {
    padding: '12px 15px',
    background: '#1a1a2a',
    border: '1px solid #2a2a3a',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none'
  },
  submitBtn: {
    padding: '12px',
    background: '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '10px'
  },
  note: {
    textAlign: 'center',
    marginTop: '20px',
    color: '#888',
    fontSize: '12px'
  }
};

export default AdminLogin;