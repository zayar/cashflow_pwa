import { useState, useEffect } from 'react';
import { gql, useMutation } from '@apollo/client';
import { useNavigate, Link } from 'react-router-dom';
import { setToken, setUsername, getToken } from '../lib/auth';

const LOGIN_MUTATION = gql`
  mutation Login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      token
      name
      role
    }
  }
`;

function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [login, { loading, error }] = useMutation(LOGIN_MUTATION);
  const [message, setMessage] = useState('');

  // If already logged in, redirect to invoices
  useEffect(() => {
    if (getToken()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const { data } = await login({ variables: form });
      const info = data?.login;
      if (info?.token) {
        setToken(info.token);
        if (info.name) setUsername(info.name);
        setMessage('Welcome back!');
        // Short delay to show success message
        setTimeout(() => navigate('/', { replace: true }), 600);
      }
    } catch (err) {
      setMessage(err.message || 'Login failed');
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '-20%',
        width: '80%',
        height: '50%',
        background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.06) 0%, rgba(34, 211, 238, 0.04) 100%)',
        borderRadius: '50%',
        filter: 'blur(60px)'
      }} />

      {/* Logo Header */}
      <div style={{
        padding: '32px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        zIndex: 1
      }}>
        <div style={{
          width: 44,
          height: 44,
          background: 'linear-gradient(135deg, #2563eb, #22d3ee)',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 16px rgba(37, 99, 235, 0.25)'
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="white" fillOpacity="0.9"/>
            <path d="M14 2V8H20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 18V12" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/>
            <path d="M9 15H15" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <span style={{
          fontSize: 22,
          fontWeight: 800,
          color: '#1e293b',
          letterSpacing: '-0.5px'
        }}>
          Cashflow
        </span>
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 32px 32px',
        zIndex: 1
      }}>
        <div style={{ 
          width: '100%', 
          maxWidth: 400, 
          margin: '0 auto'
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h1 className="heading" style={{ 
              fontSize: 28, 
              marginBottom: 8,
              color: '#1e293b',
              fontWeight: 800
            }}>
              Welcome Back!
            </h1>
            <p className="subtle" style={{ fontSize: 15, color: '#64748b' }}>
              Sign in to manage your invoices
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="field">
              <label className="label" htmlFor="username" style={{ 
                marginBottom: 8, 
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                color: '#475569'
              }}>
                Username
              </label>
              <input
                id="username"
                name="username"
                value={form.username}
                onChange={handleChange}
                required
                className="input"
                placeholder="Enter your username"
                style={{ 
                  padding: 16, 
                  background: 'white',
                  fontSize: 16,
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            
            <div className="field">
              <label className="label" htmlFor="password" style={{ 
                marginBottom: 8, 
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                color: '#475569'
              }}>
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required
                className="input"
                placeholder="Enter your password"
                style={{ 
                  padding: 16, 
                  background: 'white',
                  fontSize: 16,
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Forgot password link */}
            <div style={{ textAlign: 'right' }}>
              <a href="#" style={{
                fontSize: 13,
                color: '#64748b',
                textDecoration: 'none'
              }}>
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ 
                marginTop: 8, 
                padding: 18, 
                fontSize: 17,
                fontWeight: 700,
                borderRadius: 16,
                border: 'none',
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 10px 30px rgba(30, 41, 59, 0.3)',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? 'Signing in…' : 'Log In'}
            </button>
          </form>

          {(message || error) && (
            <div style={{ 
              marginTop: 24, 
              padding: 14, 
              borderRadius: 12, 
              background: error ? '#fef2f2' : '#f0fdf4',
              color: error ? '#ef4444' : '#10b981',
              textAlign: 'center',
              fontSize: 14,
              fontWeight: 600
            }}>
              {error ? error.message : message}
            </div>
          )}

          {/* Back to welcome */}
          <div style={{ 
            marginTop: 32, 
            textAlign: 'center',
            fontSize: 14,
            color: '#64748b'
          }}>
            <Link to="/welcome" style={{ 
              color: '#2563eb', 
              textDecoration: 'none',
              fontWeight: 600
            }}>
              ← Back to welcome
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
