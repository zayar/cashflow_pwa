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
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-head">
          <div className="auth-brand">
            <BrandLogo variant="full" className="auth-brand-logo" title="Cashflow Lite" decorative={false} />
          </div>
          <h1 className="heading" style={{ marginBottom: 6 }}>
            {t('login.title')}
          </h1>
          <p className="subtle">{t('login.subtitle')}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field" htmlFor="username">
            <span className="label">{t('login.username')}</span>
            <input
              id="username"
              name="username"
              value={form.username}
              onChange={handleChange}
              className="input"
              placeholder={t('login.usernamePlaceholder')}
              autoComplete="username"
              required
            />
          </label>

          <label className="field" htmlFor="password">
            <span className="label">{t('login.password')}</span>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              className="input"
              placeholder={t('login.passwordPlaceholder')}
              autoComplete="current-password"
              required
            />
          </label>

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? t('login.signingIn') : t('login.logIn')}
          </button>

          <p className="auth-trust">{t('login.trust')}</p>

          {(message || error) && (
            <div className={`auth-state ${error ? 'auth-state-error' : 'auth-state-success'}`} role="status" aria-live="polite">
              {error ? error.message : message}
            </div>
          )}

          <p className="auth-foot">
            {t('login.newHere')}{' '}
            <Link to="/welcome" className="auth-link">
              {t('login.backToWelcome')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default Login;
