import { useState, useEffect } from 'react';
import { gql, useMutation } from '@apollo/client';
import { useNavigate, Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import { setToken, setUsername, getToken } from '../lib/auth';
import { useI18n } from '../i18n';

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
  const { t } = useI18n();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
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
        setMessage(t('login.signedInRedirecting'));
        setTimeout(() => navigate('/', { replace: true }), 450);
      }
    } catch (err) {
      setMessage(err.message || t('login.loginFailed'));
    }
  };

  const passwordToggleLabel = showPassword ? 'Hide' : 'Show';

  return (
    <div className="login-flat-page">
      <div className="login-flat-shell login-flat-fade-in">
        <div className="login-flat-top">
          <div className="login-flat-brand">
            <BrandLogo variant="mark" className="login-flat-brand-logo" title="Cashflow Lite" decorative={false} />
            <p className="login-flat-brand-text">cashflow</p>
          </div>
          <h1 className="login-flat-title">
            {t('login.title')}
          </h1>
          <p className="login-flat-subtitle">{t('login.subtitle')}</p>
        </div>

        <form className="login-flat-form" onSubmit={handleSubmit}>
          <label className="field" htmlFor="username">
            <span className="login-flat-label">{t('login.username')}</span>
            <div className="login-flat-input-wrap">
              <span className="login-flat-input-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8.1" r="3.6" stroke="currentColor" strokeWidth="1.9" />
                  <path d="M5.8 19.1c0-3.1 2.8-5 6.2-5s6.2 1.9 6.2 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                </svg>
              </span>
              <input
                id="username"
                name="username"
                value={form.username}
                onChange={handleChange}
                className="input login-flat-input login-flat-input-with-icon"
                placeholder={t('login.usernamePlaceholder')}
                autoComplete="username"
                autoFocus
                required
              />
            </div>
          </label>

          <label className="field" htmlFor="password">
            <span className="login-flat-label">{t('login.password')}</span>
            <div className="login-flat-input-wrap">
              <span className="login-flat-input-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="5.2" y="10.2" width="13.6" height="9.3" rx="2.1" stroke="currentColor" strokeWidth="1.9" />
                  <path d="M8 10V7.8a4 4 0 1 1 8 0V10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                </svg>
              </span>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange}
                className="input login-flat-input login-flat-input-with-icon login-flat-input-with-toggle"
                placeholder={t('login.passwordPlaceholder')}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="login-flat-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={`${passwordToggleLabel} password`}
                aria-pressed={showPassword}
              >
                {passwordToggleLabel}
              </button>
            </div>
          </label>

          <button className="login-flat-submit" type="submit" disabled={loading}>
            {loading ? t('login.signingIn') : t('login.logIn')}
          </button>

          {(message || error) && (
            <div className={`auth-state ${error ? 'auth-state-error' : 'auth-state-success'} login-flat-state`} role="status" aria-live="polite">
              {error ? error.message : message}
            </div>
          )}
        </form>

        <div className="login-flat-bottom">
          <p className="login-flat-trust">{t('login.trust')}</p>

          <p className="login-flat-foot">
            {t('login.newHere')}{' '}
            <Link to="/welcome" className="login-flat-link">
              {t('login.backToWelcome')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
