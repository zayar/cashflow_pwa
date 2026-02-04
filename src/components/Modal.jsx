function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-handle" aria-hidden="true" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 className="title" style={{ margin: 0 }}>
            {title}
          </h3>
          <button onClick={onClose} aria-label="Close" className="btn btn-secondary" type="button">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default Modal;
