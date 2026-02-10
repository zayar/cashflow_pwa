import { useNavigate } from 'react-router-dom';
import { clearToken } from '../lib/auth';
import { useI18n } from '../i18n';
import LanguageSwitch from '../components/LanguageSwitch';

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3h10a2 2 0 0 1 2 2v16l-2-1-2 1-2-1-2 1-2-1-2 1-2-1-2 1V5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3h7l3 3v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M14 3v4a1 1 0 0 0 1 1h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.5 12h7M8.5 15.5h5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BankIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 10v8M10 10v8M14 10v8M18 10v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M5 10 12 4l7 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 5 3.8 11.6a1 1 0 0 0 .06 1.88l4.8 1.6 1.8 5.1a1 1 0 0 0 1.66.36l2.8-2.9 4.9 3.5a1 1 0 0 0 1.56-.63L21.9 6.1A1 1 0 0 0 21 5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 15.2 19.6 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ActionTile({ title, copy, icon, onClick, variant }) {
  return (
    <button className={`more-action-tile ${variant || ''}`.trim()} type="button" onClick={onClick}>
      <div className="more-action-top">
        <div className="more-action-icon">{icon}</div>
        <span className="more-action-chevron" aria-hidden="true">
          <ChevronIcon />
        </span>
      </div>
      <div className="more-action-text">
        <p className="more-action-title">{title}</p>
        {copy ? <p className="more-action-copy">{copy}</p> : null}
      </div>
    </button>
  );
}

function More() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const handleLogout = () => {
    clearToken();
    navigate('/login', { replace: true });
  };

  return (
    <div className="stack">
      <section className="card">
        <p className="kicker">{t('more.quickKicker')}</p>
        <h3 className="title" style={{ marginBottom: 6 }}>
          {t('more.quickTitle')}
        </h3>
        <p className="subtle">{t('more.quickCopy')}</p>

        <div className="more-action-grid" style={{ marginTop: 12 }}>
          {/* UX: keep bottom nav to 5 items; Expenses lives under More to reduce clutter for beginners. */}
          <ActionTile
            title={t('more.expenses')}
            copy={t('more.expensesCopy')}
            icon={<ReceiptIcon />}
            variant="primary action-expenses"
            onClick={() => navigate('/expenses')}
          />
          <ActionTile
            title={t('more.invoiceTemplate')}
            copy={t('more.invoiceTemplateCopy')}
            icon={<TemplateIcon />}
            variant="action-template"
            onClick={() => navigate('/templates')}
          />
          <ActionTile
            title={t('more.bankAccounts')}
            copy={t('more.bankAccountsCopy')}
            icon={<BankIcon />}
            variant="action-bank"
            onClick={() => navigate('/bank-accounts')}
          />
          <ActionTile
            title={t('more.telegramConnect')}
            copy={t('more.telegramConnectCopy')}
            icon={<TelegramIcon />}
            variant="wide action-telegram"
            onClick={() => navigate('/more/integrations/telegram')}
          />
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

      <section className="upgrade-card" aria-label="Upgrade to Cashflow Pro">
        <p className="kicker">{t('more.upgradeKicker')}</p>
        <h3 className="title" style={{ marginBottom: 0 }}>
          {t('more.unlockTitle')}
        </h3>
        <p className="subtle">{t('more.upgradeCopy')}</p>
        <div className="upgrade-points" aria-label={t('more.proFeaturesAria')}>
          <span className="meta-chip">{t('more.advancedReports')}</span>
          <span className="meta-chip">{t('more.smartReminders')}</span>
          <span className="meta-chip">{t('more.recurringInvoices')}</span>
        </div>
        <button className="btn btn-upgrade" type="button" onClick={() => navigate('/more/subscribe')}>
          {t('more.upgradeCta')}
        </button>
      </section>

      <section className="more-grid">
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
