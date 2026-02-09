import { useNavigate } from 'react-router-dom';
import { clearToken } from '../lib/auth';
import { useI18n } from '../i18n';
import LanguageSwitch from '../components/LanguageSwitch';

function More() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const handleLogout = () => {
    clearToken();
    navigate('/login', { replace: true });
  };

  return (
    <div className="stack">
      <section className="upgrade-card" aria-label="Upgrade to Cashflow Pro">
        <p className="kicker">{t('more.upgradeKicker')}</p>
        <h3 className="title" style={{ marginBottom: 0 }}>
          {t('more.unlockTitle')}
        </h3>
        <p className="subtle">
          {t('more.upgradeCopy')}
        </p>
        <div className="upgrade-points" aria-label={t('more.proFeaturesAria')}>
          <span className="meta-chip">{t('more.advancedReports')}</span>
          <span className="meta-chip">{t('more.smartReminders')}</span>
          <span className="meta-chip">{t('more.recurringInvoices')}</span>
        </div>
        <button className="btn btn-upgrade" type="button">
          {t('more.upgradeCta')}
        </button>
      </section>

      <section className="card">
        <p className="kicker">{t('more.getPaidFaster')}</p>
        <h3 className="title" style={{ marginBottom: 6 }}>
          {t('more.paymentSetup')}
        </h3>
        <p className="subtle">{t('more.paymentSetupCopy')}</p>

        <div className="task-list" style={{ marginTop: 12 }}>
          <div className="feature-row">
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>{t('more.invoiceTemplate')}</p>
              <p className="subtle" style={{ fontSize: 13 }}>
                {t('more.invoiceTemplateCopy')}
              </p>
            </div>
            <button className="btn btn-secondary" type="button" onClick={() => navigate('/templates')}>
              {t('more.edit')}
            </button>
          </div>

          <div className="feature-row">
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>{t('more.bankAccounts')}</p>
              <p className="subtle" style={{ fontSize: 13 }}>
                {t('more.bankAccountsCopy')}
              </p>
            </div>
            <button className="btn btn-secondary" type="button" onClick={() => navigate('/bank-accounts')}>
              {t('more.manage')}
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <p className="kicker">{t('more.languageKicker')}</p>
        <h3 className="title" style={{ marginBottom: 6 }}>
          {t('more.languageTitle')}
        </h3>
        <p className="subtle">{t('more.languageCopy')}</p>
        <div style={{ marginTop: 12 }}>
          <LanguageSwitch />
        </div>
      </section>

      <section className="more-grid">
        <div className="feature-list">
          <div className="feature-row">
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>{t('more.pdfExport')}</p>
              <p className="subtle" style={{ fontSize: 13 }}>
                {t('more.pdfExportCopy')}
              </p>
            </div>
            <span className="meta-chip">{t('common.ready')}</span>
          </div>

          <div className="feature-row">
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>{t('more.offlineMode')}</p>
              <p className="subtle" style={{ fontSize: 13 }}>
                {t('more.offlineModeCopy')}
              </p>
            </div>
            <span className="meta-chip">PWA</span>
          </div>

          <div className="feature-row">
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>{t('more.telegramConnect')}</p>
              <p className="subtle" style={{ fontSize: 13 }}>
                {t('more.telegramConnectCopy')}
              </p>
            </div>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => navigate('/more/integrations/telegram')}
            >
              {t('more.open')}
            </button>
          </div>
        </div>

        <div className="surface-card">
          <p className="kicker">{t('more.accountKicker')}</p>
          <p className="subtle">{t('more.accountCopy')}</p>
        </div>

        <button onClick={handleLogout} className="btn btn-danger btn-full" type="button">
          {t('more.logout')}
        </button>
      </section>
    </div>
  );
}

export default More;
