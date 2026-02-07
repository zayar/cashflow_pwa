import { useNavigate } from 'react-router-dom';
import { clearToken } from '../lib/auth';

function More() {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearToken();
    navigate('/login', { replace: true });
  };

  return (
    <div className="stack">
      <section className="upgrade-card" aria-label="Upgrade to Cashflow Pro">
        <p className="kicker">Upgrade</p>
        <h3 className="title" style={{ marginBottom: 0 }}>
          Unlock Cashflow Pro
        </h3>
        <p className="subtle">
          Move from basic invoicing to the full accounting suite with reports, automation, reminders, and recurring
          billing.
        </p>
        <div className="upgrade-points" aria-label="Pro features">
          <span className="meta-chip">Advanced reports</span>
          <span className="meta-chip">Smart reminders</span>
          <span className="meta-chip">Recurring invoices</span>
        </div>
        <button className="btn btn-upgrade" type="button">
          Upgrade to Cashflow Pro
        </button>
      </section>

      <section className="card">
        <p className="kicker">Get Paid Faster</p>
        <h3 className="title" style={{ marginBottom: 6 }}>
          Payment setup
        </h3>
        <p className="subtle">Set your invoice look and payment accounts once, then reuse them for every invoice.</p>

        <div className="task-list" style={{ marginTop: 12 }}>
          <div className="feature-row">
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>Invoice template</p>
              <p className="subtle" style={{ fontSize: 13 }}>
                Logo, colors, and payment QR in one place.
              </p>
            </div>
            <button className="btn btn-secondary" type="button" onClick={() => navigate('/templates')}>
              Edit
            </button>
          </div>

          <div className="feature-row">
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>Bank accounts</p>
              <p className="subtle" style={{ fontSize: 13 }}>
                Choose where recorded payments are deposited.
              </p>
            </div>
            <button className="btn btn-secondary" type="button" onClick={() => navigate('/bank-accounts')}>
              Manage
            </button>
          </div>
        </div>
      </section>

      <section className="more-grid">
        <div className="feature-list">
          <div className="feature-row">
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>PDF Export</p>
              <p className="subtle" style={{ fontSize: 13 }}>
                Available from invoice actions
              </p>
            </div>
            <span className="meta-chip">Ready</span>
          </div>

          <div className="feature-row">
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>Offline Mode</p>
              <p className="subtle" style={{ fontSize: 13 }}>
                Core pages stay responsive offline
              </p>
            </div>
            <span className="meta-chip">PWA</span>
          </div>
        </div>

        <div className="surface-card">
          <p className="kicker">Account</p>
          <p className="subtle">You can sign back in anytime to continue where you left off.</p>
        </div>

        <button onClick={handleLogout} className="btn btn-danger btn-full" type="button">
          Log out
        </button>
      </section>
    </div>
  );
}

export default More;
