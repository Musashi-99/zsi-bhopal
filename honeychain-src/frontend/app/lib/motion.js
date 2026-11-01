/** Shared Framer Motion variants and easings. Keep animation tokens in one place. */
export const ease = [0.22, 1, 0.36, 1];

export const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.18, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.18, ease: 'easeOut' } },
};

export const stagger = (delay = 0.05, start = 0.04) => ({
  hidden: {},
  show: { transition: { staggerChildren: delay, delayChildren: start } },
});

export const fadeUp = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.22, ease } },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.28, ease } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
};

export const slideRight = {
  hidden: { opacity: 0, x: 24 },
  show: { opacity: 1, x: 0, transition: { duration: 0.32, ease } },
  exit: { opacity: 0, x: 24, transition: { duration: 0.18 } },
};

export const spring = { type: 'spring', stiffness: 380, damping: 32 };
export const tap = { scale: 0.97 };
export const hoverLift = { y: -2, transition: { duration: 0.18 } };
