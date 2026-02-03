import { Link } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Invoices', icon: '🧾' },
  { to: '/items', label: 'Items', icon: '📦' },
  { to: '/clients', label: 'Clients', icon: '👥' },
  { to: '/more', label: 'More', icon: '⋯' }
];

function BottomNav({ activePath }) {
  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const isInvoices = item.to === '/' && activePath.startsWith('/invoices');
        const isRoot = item.to === '/' && activePath === '/';
        const isExact = item.to !== '/' && activePath.startsWith(item.to);
        const isActive = isInvoices || isRoot || isExact;
        return (
          <Link key={item.to} to={item.to} className={isActive ? 'active' : ''}>
            <span aria-hidden="true" style={{ fontSize: 18 }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default BottomNav;
