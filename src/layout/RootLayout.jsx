import { useEffect, useState } from 'react';
import { Outlet, useLocation, Link, useNavigate, Navigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import Fab from '../components/Fab';
import { clearToken, getToken, getUsername } from '../lib/auth';

function RootLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Hide Fab and BottomNav on editor pages
  const isEditorPage = 
    location.pathname.startsWith('/invoices/new') ||
    location.pathname.startsWith('/items/new') ||
    location.pathname.startsWith('/clients/new');
  
  // Determine page title
  const getPageTitle = () => {
    if (location.pathname.startsWith('/invoices/new')) return 'Invoice';
    if (location.pathname.startsWith('/items/new')) return 'New Item';
    if (location.pathname.startsWith('/clients/new')) return 'New Client';
    return 'Dashboard';
  };

  // Determine back path
  const getBackPath = () => {
    if (location.pathname.startsWith('/items/new')) return '/items';
    if (location.pathname.startsWith('/clients/new')) return '/clients';
    return '/';
  };

  useEffect(() => {
    const currentToken = getToken();
    setToken(currentToken);
    setUsername(getUsername());
    setIsLoading(false);
    
    // Redirect to welcome if not authenticated
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

  // Show nothing while checking auth (prevents flash)
  if (isLoading) {
    return null;
  }

  // If no token, don't render the layout (will redirect)
  if (!token) {
    return <Navigate to="/welcome" replace />;
  }

  return (
    <div className="app-shell">
      <header style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="subtle" style={{ margin: 0 }}>PWA Invoice</p>
          <h1 className="heading" style={{ margin: 0 }}>
            {getPageTitle()}
          </h1>
        </div>
        {isEditorPage ? (
          <Link to={getBackPath()} style={{ color: '#2563eb', fontWeight: 700 }}>Back</Link>
        ) : token ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="subtle" style={{ margin: 0 }}>Hi, {username || 'User'}</span>
            <button
              onClick={handleLogout}
              style={{
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                padding: '8px 12px',
                borderRadius: 999,
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              Logout
            </button>
          </div>
        ) : (
          <Link to="/login" style={{ color: '#2563eb', fontWeight: 700 }}>Login</Link>
        )}
      </header>

      <main className={`content ${isEditorPage ? 'content-editor' : ''}`}>
        <Outlet />
      </main>

      {!isEditorPage && <Fab />}
      {!isEditorPage && <BottomNav activePath={location.pathname} />}
    </div>
  );
}

export default RootLayout;
