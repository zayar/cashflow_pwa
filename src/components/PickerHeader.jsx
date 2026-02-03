import { Link } from 'react-router-dom';

function PickerHeader({ title, rightAction }) {
  return (
    <div className="picker-header">
      <Link to="/invoices/new" className="back-link" aria-label="Back to invoice">
        ←
      </Link>
      <div className="picker-title">{title}</div>
      <div className="picker-action">{rightAction}</div>
    </div>
  );
}

export default PickerHeader;
