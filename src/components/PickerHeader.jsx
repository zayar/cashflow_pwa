import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

function PickerHeader({ title, rightAction, backTo = '/invoices/new' }) {
  const { t } = useI18n();
  return (
    <div className="picker-header">
      <Link to={backTo} className="back-link" aria-label={t('picker.backAria')}>
        <span aria-hidden="true">&larr;</span>
      </Link>
      <h1 className="picker-title">{title}</h1>
      <div className="picker-action">{rightAction}</div>
    </div>
  );
}

export default PickerHeader;
