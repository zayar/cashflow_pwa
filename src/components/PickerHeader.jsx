import { Link } from 'react-router-dom';

function PickerHeader({ title, rightAction, backTo = '/invoices/new' }) {
  return (
    <div className="picker-header">
      <Link to={backTo} className="back-link" aria-label="Back">
        <span aria-hidden="true">&larr;</span>
      </Link>
      <h1 className="picker-title">{title}</h1>
      <div className="picker-action">{rightAction}</div>
    </div>
  );
}

export default PickerHeader;
