import { Link, useLocation } from 'react-router-dom';

function getFabDestination(pathname) {
  // Items page → add new item
  if (pathname === '/items') {
    return '/items/new';
  }
  // Clients page → add new client
  if (pathname === '/clients') {
    return '/clients/new';
  }
  // Default (home/invoices) → add new invoice
  return '/invoices/new';
}

function Fab() {
  const location = useLocation();
  const to = getFabDestination(location.pathname);
  
  return (
    <Link to={to} className="fab" aria-label="Add new">
      +
    </Link>
  );
}

export default Fab;
