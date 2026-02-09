import { Link, useLocation } from 'react-router-dom';
import { useInvoiceDraft } from '../state/invoiceDraft';
import { useI18n } from '../i18n';

function getFabDestination(pathname) {
  if (pathname === '/items') {
    return { to: '/items/new', labelKey: 'fab.addItem' };
  }
  if (pathname === '/clients') {
    return { to: '/clients/new', labelKey: 'fab.addClient' };
  }
  return { to: '/invoices/new', labelKey: 'fab.addInvoice' };
}

function Fab() {
  const location = useLocation();
  const { t } = useI18n();
  const { to, labelKey } = getFabDestination(location.pathname);
  const label = t(labelKey);
  const { dispatch } = useInvoiceDraft();

  return (
    <Link
      to={to}
      className="fab"
      aria-label={label}
      title={label}
      onClick={() => {
        if (to === '/invoices/new') {
          dispatch({ type: 'reset' });
        }
      }}
    >
      +
    </Link>
  );
}

export default Fab;
