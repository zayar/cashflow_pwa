import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, Link, useNavigate, Navigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import Fab from '../components/Fab';
import BrandLogo from '../components/BrandLogo';
import { clearToken, getToken, getUsername } from '../lib/auth';
import { useBusinessProfile } from '../state/businessProfile';
import { useOnboardingStatus } from '../state/onboardingStatus';
import { isBasicsComplete } from '../lib/onboardingFlow';
import { useI18n } from '../i18n';

function getPageCopy(pathname) {
  if (pathname.startsWith('/more/company-profile')) {
    return { titleKey: 'pages.more.title', kickerKey: 'pages.more.kicker', backPath: '/more' };
  }
  if (pathname.startsWith('/more/subscribe')) {
    return { titleKey: 'pages.subscribe.title', kickerKey: 'pages.subscribe.kicker', backPath: '/more' };
  }
  if (pathname.startsWith('/invoices/new')) {
    return { titleKey: 'pages.invoiceNew.title', kickerKey: 'pages.invoiceNew.kicker', backPath: '/' };
  }
  const invoiceMatch = pathname.match(/^\/invoices\/([^/]+)/);
  const invoiceId = invoiceMatch?.[1] || '';
  if (invoiceId && pathname.endsWith('/edit')) {
    return { titleKey: 'pages.invoiceEdit.title', kickerKey: 'pages.invoiceEdit.kicker', backPath: `/invoices/${invoiceId}` };
  }
  if (invoiceId) {
    return { titleKey: 'pages.invoiceView.title', kickerKey: 'pages.invoiceView.kicker', backPath: '/' };
  }
  if (pathname.startsWith('/items/new')) {
    return { titleKey: 'pages.itemNew.title', kickerKey: 'pages.itemNew.kicker', backPath: '/items' };
  }
  const itemMatch = pathname.match(/^\/items\/([^/]+)/);
  const itemId = itemMatch?.[1] || '';
  if (itemId && itemId !== 'new' && pathname.endsWith('/edit')) {
    return { titleKey: 'pages.itemEdit.title', kickerKey: 'pages.itemEdit.kicker', backPath: `/items/${itemId}` };
  }
  if (itemId && itemId !== 'new') {
    return { titleKey: 'pages.itemView.title', kickerKey: 'pages.itemView.kicker', backPath: '/items' };
  }
  if (pathname.startsWith('/clients/new')) {
    return { titleKey: 'pages.clientNew.title', kickerKey: 'pages.clientNew.kicker', backPath: '/clients' };
  }
  const clientMatch = pathname.match(/^\/clients\/([^/]+)/);
  const clientId = clientMatch?.[1] || '';
  if (clientId && clientId !== 'new' && pathname.endsWith('/edit')) {
    return { titleKey: 'pages.clientEdit.title', kickerKey: 'pages.clientEdit.kicker', backPath: `/clients/${clientId}` };
  }
  if (clientId && clientId !== 'new') {
    return { titleKey: 'pages.clientView.title', kickerKey: 'pages.clientView.kicker', backPath: '/clients' };
  }
  if (pathname.startsWith('/items')) {
    return { titleKey: 'pages.items.title', kickerKey: 'pages.items.kicker', backPath: '/' };
  }
  if (pathname.startsWith('/clients')) {
    return { titleKey: 'pages.clients.title', kickerKey: 'pages.clients.kicker', backPath: '/' };
  }
  if (pathname.startsWith('/templates')) {
    if (pathname.endsWith('/edit')) {
      return { titleKey: 'pages.templateEdit.title', kickerKey: 'pages.templateEdit.kicker', backPath: '/templates' };
    }
    return { titleKey: 'pages.templates.title', kickerKey: 'pages.templates.kicker', backPath: '/more' };
  }
  if (pathname.startsWith('/bank-accounts')) {
    return { titleKey: 'pages.bankAccounts.title', kickerKey: 'pages.bankAccounts.kicker', backPath: '/more' };
  }
  if (pathname.startsWith('/more/integrations/telegram')) {
    return { titleKey: 'pages.telegramConnect.title', kickerKey: 'pages.telegramConnect.kicker', backPath: '/more' };
  }
  if (pathname.startsWith('/onboarding')) {
    return { titleKey: 'pages.onboarding.title', kickerKey: 'pages.onboarding.kicker', backPath: '/' };
  }
  if (pathname.startsWith('/reports')) {
    return { titleKey: 'pages.reports.title', kickerKey: 'pages.reports.kicker', backPath: '/' };
  }
  if (pathname.startsWith('/expenses/new')) {
    return { titleKey: 'pages.expenseNew.title', kickerKey: 'pages.expenseNew.kicker', backPath: '/expenses' };
  }
  const expenseMatch = pathname.match(/^\/expenses\/([^/]+)/);
  const expenseId = expenseMatch?.[1] || '';
  if (expenseId && pathname.endsWith('/edit')) {
    return { titleKey: 'pages.expenseEdit.title', kickerKey: 'pages.expenseEdit.kicker', backPath: `/expenses/${expenseId}` };
  }
  if (expenseId) {
    return { titleKey: 'pages.expenseView.title', kickerKey: 'pages.expenseView.kicker', backPath: '/expenses' };
  }
  if (pathname.startsWith('/expenses')) {
    return { titleKey: 'pages.expenses.title', kickerKey: 'pages.expenses.kicker', backPath: '/more' };
  }
  if (pathname.startsWith('/more')) {
    return { titleKey: 'pages.more.title', kickerKey: 'pages.more.kicker', backPath: '/' };
  }
  return { titleKey: 'pages.invoices.title', kickerKey: 'pages.invoices.kicker', backPath: '/' };
}

function RootLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, tEn } = useI18n();
  const { profile, loading: profileLoading, loadProfile } = useBusinessProfile();
  const { status: onboardingStatus, loading: onboardingLoading, refreshStatus } = useOnboardingStatus();
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const itemMatch = location.pathname.match(/^\/items\/([^/]+)/);
  const itemId = itemMatch?.[1] || '';
  const clientMatch = location.pathname.match(/^\/clients\/([^/]+)/);
  const clientId = clientMatch?.[1] || '';

  const isItemDetail = Boolean(itemId && itemId !== 'new');
  const isClientDetail = Boolean(clientId && clientId !== 'new');

  const isOnboardingPage = location.pathname.startsWith('/onboarding');

  const isEditorPage =
    location.pathname.startsWith('/invoices/') ||
    location.pathname.startsWith('/items/new') ||
    location.pathname.startsWith('/clients/new') ||
    location.pathname.startsWith('/templates') ||
    location.pathname.startsWith('/bank-accounts') ||
    location.pathname.startsWith('/more/integrations') ||
    location.pathname.startsWith('/more/company-profile') ||
    location.pathname.startsWith('/more/subscribe') ||
    location.pathname.startsWith('/expenses/') ||
    isOnboardingPage ||
    isItemDetail ||
    isClientDetail;
  const hideFab = location.pathname.startsWith('/reports') || location.pathname.startsWith('/expenses');

  const pageCopy = useMemo(() => getPageCopy(location.pathname), [location.pathname]);

  useEffect(() => {
    const currentToken = getToken();
    setToken(currentToken);
    setUsername(getUsername());
    setIsLoading(false);

    if (!currentToken && location.pathname !== '/welcome') {
      navigate('/welcome', { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (!getToken()) return;
    loadProfile().catch(() => {
      // Soft fail; page-level components surface errors.
    });
    refreshStatus().catch(() => {
      // Onboarding page will surface its own errors.
    });
  }, [loadProfile, refreshStatus]);

  useEffect(() => {
    if (!token || profileLoading || onboardingLoading) return;
    const hasServerStatus = onboardingStatus && (onboardingStatus.step !== undefined || onboardingStatus.completed !== undefined);
    const needsOnboarding = hasServerStatus
      ? !onboardingStatus.completed
      : !isBasicsComplete(profile);
    const onOnboardingPage = isOnboardingPage;

    if (needsOnboarding && !onOnboardingPage) {
      navigate('/onboarding', { replace: true });
    }
    if (!needsOnboarding && onOnboardingPage) {
      navigate('/', { replace: true });
    }
  }, [token, profile, profileLoading, onboardingLoading, onboardingStatus, navigate, isOnboardingPage]);

  const handleLogout = () => {
    clearToken();
    setToken('');
    setUsername('');
    navigate('/welcome', { replace: true });
  };

  if (isLoading) {
    return null;
  }

  if (!token) {
    return <Navigate to="/welcome" replace />;
  }

  return (
    <div className="app-shell">
      <div className="topbar-wrap">
        <header className="topbar">
          <div className="brand-cluster">
            <div className="brand-icon" aria-hidden="true">
              <BrandLogo variant="mark" className="brand-mark-svg" />
            </div>
            <div className="brand-copy">
              <p className="brand-kicker">{tEn(pageCopy.kickerKey)}</p>
              <h1 className="heading">{tEn(pageCopy.titleKey)}</h1>
            </div>
          </div>

          <div className="topbar-actions">
            {isEditorPage ? (
              <Link to={pageCopy.backPath} className="btn btn-secondary" aria-label={tEn('common.back')}>
                {tEn('common.back')}
              </Link>
            ) : (
              <>
                <span className="user-chip" title={username || tEn('common.user')}>
                  {tEn('topbar.hiUser', { name: username || tEn('common.user') })}
                </span>
                <button type="button" className="btn btn-danger" onClick={handleLogout}>
                  {tEn('topbar.logout')}
                </button>
              </>
            )}
          </div>
        </header>
      </div>

      <main className={`content ${isEditorPage ? 'content-editor' : ''}`}>
        <Outlet />
      </main>

      {!isEditorPage && !hideFab && <Fab />}
      {!isEditorPage && <BottomNav activePath={location.pathname} />}
    </div>
  );
}

export default RootLayout;
