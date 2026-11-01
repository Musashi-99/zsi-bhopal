import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import gsap from 'gsap';
import Icon from '../ui/Icon';
import { fadeUp, stagger } from '../../lib/motion';

/** Page banner. Background drifts with the pointer using GSAP (disabled for reduced motion / touch). */
export default function PageHero({ title, sub, icon, children, tall, className = '' }) {
  const hero = useRef(null);
  const bg = useRef(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce || !window.matchMedia('(hover: hover)').matches) return undefined;
    const el = hero.current;
    const x = gsap.quickTo(bg.current, 'x', { duration: 0.8, ease: 'power3.out' });
    const y = gsap.quickTo(bg.current, 'y', { duration: 0.8, ease: 'power3.out' });
    const move = (e) => {
      const r = el.getBoundingClientRect();
      x(((e.clientX - r.left) / r.width - 0.5) * -14);
      y(((e.clientY - r.top) / r.height - 0.5) * -8);
    };
    const leave = () => { x(0); y(0); };
    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', leave);
    return () => { el.removeEventListener('mousemove', move); el.removeEventListener('mouseleave', leave); };
  }, [reduce]);

  return (
    <motion.section ref={hero} className={`hero ${tall ? 'tall' : ''} ${className}`} variants={stagger(0.08)} initial={false} animate="show">
      <div ref={bg} className="hero-bg" aria-hidden="true" />
      <div className={icon ? 'hero-row' : undefined}>
        {icon && <motion.span variants={fadeUp} className="hero-icon"><Icon name={icon} /></motion.span>}
        <div>
          <motion.h1 variants={fadeUp}>{title}</motion.h1>
          {sub && <motion.p variants={fadeUp}>{sub}</motion.p>}
        </div>
      </div>
      {children}
    </motion.section>
  );
}

export function PageHeader({ title, sub, children }) {
  return (
    <div className="pagehead">
      <div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
      {children && <div className="actions">{children}</div>}
    </div>
  );
}
