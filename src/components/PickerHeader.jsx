import { Link } from 'react-router-dom';

function PickerHeader({ title, rightAction }) {
  return (
    <div className="picker-header">
      <Link to="/invoices/new" className="back-link" aria-label="Back to invoice">
        <span aria-hidden="true">&larr;</span>
      </Link>
      <h1 className="picker-title">{title}</h1>
      <div className="picker-action">{rightAction}</div>
    </div>
  );
}

export default PickerHeader;
