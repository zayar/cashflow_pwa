import { useState, useEffect } from 'react';
import { gql, useMutation } from '@apollo/client';
import { useNavigate, Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
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
            <BrandLogo variant="full" className="auth-brand-logo" title="Cashflow Lite" decorative={false} />
          </div>
          <h1 className="heading" style={{ marginBottom: 6 }}>
            Welcome back
          </h1>
          <p className="subtle">Secure sign in to create, send, and track invoices faster.</p>
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

          <p className="auth-trust">Your data is encrypted and securely transmitted.</p>

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
