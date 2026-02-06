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
          Cashflow Pro
        </h3>
        <p className="subtle">
          Unlock the full accounting suite with advanced reports, automation, smart reminders, and recurring
          invoices.
        </p>
        <button className="btn btn-upgrade" type="button">
          Upgrade to Cashflow Pro
        </button>
      </section>

      <section className="card">
        <p className="kicker">Templates</p>
        <h3 className="title" style={{ marginBottom: 6 }}>
          Invoice Template
        </h3>
        <p className="subtle">
          Add your logo, pick a brand color, and upload a payment QR for invoices.
        </p>
        <button className="btn btn-secondary" type="button" onClick={() => navigate('/templates')}>
          Edit invoice template
        </button>
      </section>

      <section className="card">
        <p className="kicker">Banking</p>
        <h3 className="title" style={{ marginBottom: 6 }}>
          Bank Accounts
        </h3>
        <p className="subtle">Create and manage bank accounts for payments and balances.</p>
        <button className="btn btn-secondary" type="button" onClick={() => navigate('/bank-accounts')}>
          Manage bank accounts
        </button>
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

        <button onClick={handleLogout} className="btn btn-danger btn-full" type="button">
          Log out
        </button>
      </section>
    </div>
  );
}

export default More;
