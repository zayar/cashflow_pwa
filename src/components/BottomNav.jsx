import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

function InvoiceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15 3v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9 12h6M9 16h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 8.7 12 4l9 4.7-9 4.8-9-4.8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M3 8.7V16l9 4 9-4V8.7" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12 13.5V20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16 18c0-2.2-1.8-4-4-4s-4 1.8-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="9" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M20 18c0-1.5-1-2.9-2.4-3.5M4 18c0-1.5 1-2.9 2.4-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="12" r="1.7" fill="currentColor" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
      <circle cx="18" cy="12" r="1.7" fill="currentColor" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 19h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7 16v-4M12 16V8M17 16V11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M6.7 7.8 12 5l5.3 2.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const navItems = [
  { to: '/', labelKey: 'nav.invoices', icon: InvoiceIcon },
  { to: '/items', labelKey: 'nav.items', icon: BoxIcon },
  { to: '/clients', labelKey: 'nav.clients', icon: UsersIcon },
  { to: '/reports', labelKey: 'nav.reports', icon: ReportsIcon },
  { to: '/more', labelKey: 'nav.more', icon: MoreIcon }
];

function BottomNav({ activePath }) {
  const { t } = useI18n();
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {navItems.map((item) => {
        const isInvoices = item.to === '/' && activePath.startsWith('/invoices');
        const isRoot = item.to === '/' && activePath === '/';
        const isExact = item.to !== '/' && activePath.startsWith(item.to);
        const isActive = isInvoices || isRoot || isExact;
        const Icon = item.icon;

        return (
          <Link key={item.to} to={item.to} className={isActive ? 'active' : ''} aria-current={isActive ? 'page' : undefined}>
            <span className="nav-pill" aria-hidden="true">
              <Icon />
            </span>
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default BottomNav;
