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

function BrandIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-6Z" fill="currentColor" opacity="0.95" />
      <path d="M14 2v6h5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 14h6M9 17h6" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [login, { loading, error }] = useMutation(LOGIN_MUTATION);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (getToken()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    try {
      const { data } = await login({ variables: form });
      const info = data?.login;
      if (info?.token) {
        setToken(info.token);
        if (info.name) setUsername(info.name);
        setMessage('Signed in. Redirecting...');
        setTimeout(() => navigate('/', { replace: true }), 450);
      }
    } catch (err) {
      setMessage(err.message || 'Login failed.');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-head">
          <div className="auth-brand">
            <span className="auth-brand-mark" aria-hidden="true">
              <BrandIcon />
            </span>
            Cashflow Lite
          </div>
          <h1 className="heading" style={{ marginBottom: 6 }}>
            Welcome back
          </h1>
          <p className="subtle">Sign in to create and share invoices quickly.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field" htmlFor="username">
            <span className="label">Username</span>
            <input
              id="username"
              name="username"
              value={form.username}
              onChange={handleChange}
              className="input"
              placeholder="Enter your username"
              autoComplete="username"
              required
            />
          </label>

          <label className="field" htmlFor="password">
            <span className="label">Password</span>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              className="input"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </label>

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Log in'}
          </button>

          {(message || error) && (
            <div className={`auth-state ${error ? 'auth-state-error' : 'auth-state-success'}`} role="status" aria-live="polite">
              {error ? error.message : message}
            </div>
          )}

          <p className="auth-foot">
            New here?{' '}
            <Link to="/welcome" className="auth-link">
              Back to welcome
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default Login;
