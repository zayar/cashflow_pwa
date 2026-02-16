import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearToken } from '../lib/auth';
import { useI18n } from '../i18n';
import LanguageSwitch from '../components/LanguageSwitch';
import { useBusinessProfile } from '../state/businessProfile';
import { resolveStorageAccessUrl } from '../lib/uploadApi';

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

function CompanyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 9h10M7 13h6M7 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 18.2c0-2.8 2.7-4.6 6-4.6s6 1.8 6 4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19 4.2v2M18 5.2h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ActionTile({ title, copy, icon, thumbnailUrl, onClick, variant }) {
  return (
    <button className={`more-action-tile ${variant || ''}`.trim()} type="button" onClick={onClick}>
      <div className="more-action-top">
        <div className="more-action-icon">
          {thumbnailUrl ? <img src={thumbnailUrl} alt="" className="more-action-thumb" loading="lazy" /> : icon}
        </div>
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
  const { profile, entitlement, loadProfile } = useBusinessProfile();

  useEffect(() => {
    loadProfile().catch(() => {
      // Surface-level fallback is enough on this menu page.
    });
  }, [loadProfile]);

  const companyName = profile?.businessName || profile?.name || 'Set up your company profile';
  const companyLogoUrl = resolveStorageAccessUrl(profile?.logoUrl || '');
  const currentPlan = String(entitlement?.plan || 'PRO').toUpperCase();
  const isLitePlan = currentPlan === 'LITE';
  const expiryText = entitlement?.endsAt
    ? new Date(entitlement.endsAt).toLocaleDateString()
    : 'No expiry';

  const handleLogout = () => {
    clearToken();
    navigate('/login', { replace: true });
  };

  return (
    <div className="stack">
      <section className="card subscription-summary-card">
        <p className="kicker">Subscription</p>
        <h3 className="title" style={{ marginBottom: 6 }}>
          Current plan: {currentPlan}
        </h3>
        <p className="subtle">Status: {entitlement?.status || 'ACTIVE'}</p>
        <p className="subtle">Expiry: {expiryText}</p>
        {isLitePlan ? (
          <button
            className="btn btn-upgrade btn-upgrade-strong subscription-summary-btn"
            type="button"
            onClick={() => navigate('/more/subscribe')}
          >
            Upgrade to Pro
          </button>
        ) : null}
      </section>

      <section className="card">
        <div className="more-action-grid">
          <ActionTile
            title="Company Profile"
            copy={companyName}
            thumbnailUrl={companyLogoUrl}
            icon={<CompanyIcon />}
            variant="wide action-company"
            onClick={() => navigate('/more/company-profile')}
          />
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
            title={t('more.accountSettings')}
            copy={t('more.accountSettingsCopy')}
            icon={<AccountIcon />}
            variant="action-account"
            onClick={() => navigate('/more/account-settings')}
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
