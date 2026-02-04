import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, Link, useNavigate, Navigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import Fab from '../components/Fab';
import BrandLogo from '../components/BrandLogo';
import { clearToken, getToken, getUsername } from '../lib/auth';

function getPageCopy(pathname) {
  if (pathname.startsWith('/invoices/new')) {
    return { title: 'Create Invoice', kicker: 'Guided Flow', backPath: '/' };
  }
  const invoiceMatch = pathname.match(/^\/invoices\/([^/]+)/);
  const invoiceId = invoiceMatch?.[1] || '';
  if (invoiceId && pathname.endsWith('/edit')) {
    return { title: 'Edit Invoice', kicker: 'Guided Flow', backPath: `/invoices/${invoiceId}` };
  }
  if (invoiceId) {
    return { title: 'Invoice', kicker: 'Invoice', backPath: '/' };
  }
  if (pathname.startsWith('/items/new')) {
    return { title: 'Create Item', kicker: 'Catalog', backPath: '/items' };
  }
  if (pathname.startsWith('/clients/new')) {
    return { title: 'Create Client', kicker: 'Customers', backPath: '/clients' };
  }
  if (pathname.startsWith('/items')) {
    return { title: 'Items', kicker: 'Catalog', backPath: '/' };
  }
  if (pathname.startsWith('/clients')) {
    return { title: 'Clients', kicker: 'Customers', backPath: '/' };
  }
  if (pathname.startsWith('/more')) {
    return { title: 'More', kicker: 'Settings', backPath: '/' };
  }
  return { title: 'Invoices', kicker: 'Dashboard', backPath: '/' };
}

function RootLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const isEditorPage =
    location.pathname.startsWith('/invoices/') ||
    location.pathname.startsWith('/items/new') ||
    location.pathname.startsWith('/clients/new');

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
              <p className="brand-kicker">{pageCopy.kicker}</p>
              <h1 className="heading">{pageCopy.title}</h1>
            </div>
          </div>

          <div className="topbar-actions">
            {isEditorPage ? (
              <Link to={pageCopy.backPath} className="btn btn-secondary" aria-label="Back">
                Back
              </Link>
            ) : (
              <>
                <span className="user-chip" title={username || 'User'}>
                  Hi, {username || 'User'}
                </span>
                <button type="button" className="btn btn-danger" onClick={handleLogout}>
                  Logout
                </button>
              </>
            )}
          </div>
        </header>
      </div>

      <main className={`content ${isEditorPage ? 'content-editor' : ''}`}>
        <Outlet />
      </main>

      {!isEditorPage && <Fab />}
      {!isEditorPage && <BottomNav activePath={location.pathname} />}
    </div>
  );
}

export default RootLayout;
