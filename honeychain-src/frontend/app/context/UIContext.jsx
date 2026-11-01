import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../components/ui/Icon';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const UIContext = createContext(null);

/** Toasts + imperative confirm dialog, available anywhere via useUI(). */
export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const id = useRef(0);

  const toast = useCallback((message, type = 'ok') => {
    const n = ++id.current;
    setToasts((t) => [...t, { id: n, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n)), 3800);
  }, []);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    setDialog({ ...opts, resolve });
  }), []);

  const close = (value) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <UIContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              className={`toast ${t.type === 'err' ? 'err' : ''}`}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            >
              <Icon name={t.type === 'err' ? 'alert' : 'cc'} />
              <span>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <ConfirmDialog dialog={dialog} onClose={close} />
    </UIContext.Provider>
  );
}

export const useUI = () => useContext(UIContext);
