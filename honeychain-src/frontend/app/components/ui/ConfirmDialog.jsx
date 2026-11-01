import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { scaleIn } from '../../lib/motion';

export default function ConfirmDialog({ dialog, onClose }) {
  const okRef = useRef(null);

  useEffect(() => {
    if (!dialog) return undefined;
    okRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, onClose]);

  return (
    <AnimatePresence>
      {dialog && (
        <motion.div className="modal-bg open" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose(false)}>
          <motion.div className="modal" role="dialog" aria-modal="true" aria-label={dialog.title} variants={scaleIn} initial="hidden" animate="show" exit="exit">
            <h3>{dialog.title}</h3>
            <p>{dialog.text}</p>
            <div className="acts">
              <button type="button" className="btn" onClick={() => onClose(false)}>{dialog.cancel || 'Cancel'}</button>
              <button type="button" ref={okRef} className={`btn primary ${dialog.danger ? 'danger' : ''}`} onClick={() => onClose(true)}>{dialog.ok || 'Confirm'}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
