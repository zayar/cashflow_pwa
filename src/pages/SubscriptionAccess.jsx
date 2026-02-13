import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { clearToken } from '../lib/auth';

const COPY = {
  BUSINESS_SUBSCRIPTION_EXPIRED: {
    title: 'Subscription expired',
    message: 'Your plan expired. Please contact admin or renew.',
  },
  CLIENT_NOT_ALLOWED: {
    title: 'Client app not allowed',
    message: 'This plan does not allow access from this app client.',
  },
  PLAN_UPGRADE_REQUIRED_WEB: {
    title: 'Upgrade required',
    message: 'Web access is available on Pro plan.',
  },
};

function readReason(searchParams) {
  return String(searchParams.get('reason') || '').trim().toUpperCase();
}

function SubscriptionAccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reason = useMemo(() => readReason(searchParams), [searchParams]);
  const content = COPY[reason] || {
    title: 'Access blocked',
    message: 'This account cannot access the app right now.',
  };

  const handleSignOut = () => {
    clearToken();
    navigate('/welcome', { replace: true });
  };

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-head">
          <h1 className="heading" style={{ marginBottom: 6 }}>{content.title}</h1>
          <p className="subtle">{content.message}</p>
          <p className="subtle" style={{ marginTop: 8 }}>Reason: {reason || 'ACCESS_BLOCKED'}</p>
        </div>

        <div className="auth-form">
          <button className="btn btn-primary btn-full" type="button" onClick={handleSignOut}>
            Sign out
          </button>
          <p className="auth-foot">
            <Link to="/welcome" className="auth-link">Back to welcome</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SubscriptionAccess;
