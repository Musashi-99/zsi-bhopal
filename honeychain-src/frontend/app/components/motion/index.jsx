import { forwardRef, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import gsap from 'gsap';
import { fadeUp, stagger } from '../../lib/motion';

/** GSAP-driven number tween (stat cards). Falls back to the final value for reduced motion. */
export function CountUp({ value = 0, duration = 1.1, className, suffix = '' }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const target = Number(value) || 0;
    if (reduce) { el.textContent = target + suffix; return undefined; }
    const state = { v: 0 };
    const tween = gsap.to(state, {
      v: target, duration, ease: 'power3.out',
      onUpdate: () => { el.textContent = Math.round(state.v) + suffix; },
    });
    return () => tween.kill();
  }, [value, duration, suffix, reduce]);
  return <b ref={ref} className={className}>0{suffix}</b>;
}

/** Staggered container: children should be <Item> (or motion elements using fadeUp). */
export function Stagger({ children, className, delay = 0.05, start = 0.04, as = 'div', ...rest }) {
  const Tag = motion[as];
  return <Tag className={className} variants={stagger(delay, start)} initial={false} animate="show" {...rest}>{children}</Tag>;
}

export const Item = forwardRef(function Item({ children, className, as = 'div', ...rest }, ref) {
  const Tag = motion[as];
  return <Tag ref={ref} className={className} variants={fadeUp} {...rest}>{children}</Tag>;
});

/** Reveal when scrolled into view. */
export function Reveal({ children, className, as = 'div', delay = 0, ...rest }) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1], delay }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Animated width bar (progress / offer bars). */
export function GrowBar({ pct, color, className = 'progress' }) {
  return (
    <div className={className}>
      <motion.i style={{ background: color, display: 'block', height: '100%', borderRadius: 4 }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  );
}
