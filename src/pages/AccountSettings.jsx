import { useState } from 'react';
import { gql, useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { clearToken, setUsername } from '../lib/auth';
import { useI18n } from '../i18n';

const CHANGE_PASSWORD_MUTATION = gql`
  mutation ChangePassword($oldPassword: String!, $newPassword: String!) {
    changePassword(oldPassword: $oldPassword, newPassword: $newPassword) {
      id
    }
  }
`;

const MIN_PASSWORD_LENGTH = 8;

function AccountSettings() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [changePassword, { loading }] = useMutation(CHANGE_PASSWORD_MUTATION);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');

    const currentPassword = form.currentPassword;
    const newPassword = form.newPassword;
    const confirmPassword = form.confirmPassword;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t('accountSettings.errors.required'));
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(t('accountSettings.errors.minLength', { count: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('accountSettings.errors.mismatch'));
      return;
    }
    if (newPassword === currentPassword) {
      setError(t('accountSettings.errors.sameAsCurrent'));
      return;
    }

    try {
      await changePassword({
        variables: {
          oldPassword: currentPassword,
          newPassword
        }
      });
      setStatus(t('accountSettings.passwordUpdated'));
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });

      setTimeout(() => {
        clearToken();
        setUsername('');
        navigate('/login', { replace: true });
      }, 900);
    } catch (mutationError) {
      setError(mutationError.message || t('accountSettings.errors.failed'));
    }
  };

  return (
    <div className="stack account-settings-page">
      <section className="card">
        <p className="kicker">{t('accountSettings.securityKicker')}</p>
        <h2 className="title" style={{ marginBottom: 6 }}>
          {t('accountSettings.securityTitle')}
        </h2>
        <p className="subtle">{t('accountSettings.securityCopy')}</p>

        <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 12 }}>
          <label className="field" htmlFor="currentPassword">
            <span className="label">{t('accountSettings.currentPassword')}</span>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              className="input"
              value={form.currentPassword}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />
          </label>

          <label className="field" htmlFor="newPassword">
            <span className="label">{t('accountSettings.newPassword')}</span>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              className="input"
              value={form.newPassword}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
          </label>

          <label className="field" htmlFor="confirmPassword">
            <span className="label">{t('accountSettings.confirmPassword')}</span>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              className="input"
              value={form.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
          </label>

          {error ? <div className="inline-error">{error}</div> : null}
          {status ? <div className="toast">{status}</div> : null}

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? t('accountSettings.updatingPassword') : t('accountSettings.updatePassword')}
          </button>
        </form>
      </section>

      <section className="surface-card">
        <p className="kicker">{t('accountSettings.loginEmailKicker')}</p>
        <p className="subtle">{t('accountSettings.loginEmailCopy')}</p>
      </section>
    </div>
  );
}

export default AccountSettings;
