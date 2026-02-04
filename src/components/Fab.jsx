import { Link, useLocation } from 'react-router-dom';

function getFabDestination(pathname) {
  if (pathname === '/items') {
    return { to: '/items/new', label: 'Add item' };
  }
  if (pathname === '/clients') {
    return { to: '/clients/new', label: 'Add client' };
  }
  return { to: '/invoices/new', label: 'Add invoice' };
}

function Fab() {
  const location = useLocation();
  const { to, label } = getFabDestination(location.pathname);

  return (
    <Link to={to} className="fab" aria-label={label} title={label}>
      +
    </Link>
  );
}

export default Fab;
