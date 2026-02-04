import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, Link, useNavigate, Navigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import Fab from '../components/Fab';
import { clearToken, getToken, getUsername } from '../lib/auth';

function getPageCopy(pathname) {
  if (pathname.startsWith('/invoices/new')) {
    return { title: 'Create Invoice', kicker: 'Guided Flow', backPath: '/' };
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

function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-6Z" fill="currentColor" opacity="0.95" />
      <path d="M14 2v6h5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 14h6M9 17h6" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function RootLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const isEditorPage =
    location.pathname.startsWith('/invoices/new') ||
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
              <BrandMark />
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
