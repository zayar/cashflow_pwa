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

  return (
    <div className="login-flat-page">
      <div className="login-flat-shell">
        <div className="login-flat-top">
          <div className="login-flat-brand">
            <BrandLogo variant="full" className="login-flat-brand-logo" title="Cashflow Lite" decorative={false} />
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
            <input
              id="username"
              name="username"
              value={form.username}
              onChange={handleChange}
              className="input login-flat-input"
              placeholder={t('login.usernamePlaceholder')}
              autoComplete="username"
              required
            />
          </label>

          <label className="field" htmlFor="password">
            <span className="login-flat-label">{t('login.password')}</span>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              className="input login-flat-input"
              placeholder={t('login.passwordPlaceholder')}
              autoComplete="current-password"
              required
            />
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
