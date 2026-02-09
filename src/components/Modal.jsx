import { useEffect, useId, useRef } from 'react';
import { useI18n } from '../i18n';

function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
}

function Modal({ title, onClose, children }) {
  const { t } = useI18n();
  const dialogTitleId = useId();
  const containerRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousActive = document.activeElement;
    document.body.style.overflow = 'hidden';

    const focusables = getFocusableElements(containerRef.current);
    const firstFocusable = focusables[0] || closeButtonRef.current;
    firstFocusable?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const elements = getFocusableElements(containerRef.current);
      if (elements.length === 0) return;

      const first = elements[0];
      const last = elements[elements.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      if (previousActive && typeof previousActive.focus === 'function') {
        previousActive.focus();
      }
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogTitleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-card" ref={containerRef} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-handle" aria-hidden="true" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 className="title" style={{ margin: 0 }} id={dialogTitleId}>
            {title}
          </h3>
          <button onClick={onClose} aria-label={t('common.close')} className="btn btn-secondary" type="button" ref={closeButtonRef}>
            {t('common.close')}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default Modal;
