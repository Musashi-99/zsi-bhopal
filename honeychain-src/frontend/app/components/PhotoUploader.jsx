import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from './ui/Icon';
import { useUI } from '../context/UIContext';
import { compressImage, validImage } from '../lib/image';
import { scaleIn } from '../lib/motion';

/** Controlled photo picker. `photos` = [{ id, name, url }] (url is a compressed data URL). */
export default function PhotoUploader({ photos, onChange, max = 6, compact }) {
  const { toast } = useUI();
  const input = useRef(null);
  const [over, setOver] = useState(false);

  const add = async (files) => {
    const next = [];
    for (const f of [...files]) {
      if (photos.length + next.length >= max) { toast(`You can attach up to ${max} photos.`, 'err'); break; }
      if (!validImage(f)) { toast(`${f.name}: use PNG, JPG or WEBP up to 5 MB.`, 'err'); continue; }
      try { next.push({ id: crypto.randomUUID(), name: f.name, url: await compressImage(f) }); } catch (e) { toast(e.message, 'err'); }
    }
    if (next.length) onChange([...photos, ...next]);
  };

  return (
    <div className="photos">
      <label
        className={`upload ${over ? 'over' : ''}`} style={{ width: compact ? '100%' : 282, height: compact ? 84 : 103 }} tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.current.click())}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
      >
        <Icon name="upload" /><b>Click to upload photos</b><small>PNG, JPG up to 5 MB each</small>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      </label>
      <AnimatePresence>
        {photos.map((p) => (
          <motion.div key={p.id} className="photo" variants={scaleIn} initial="hidden" animate="show" exit="exit" layout>
            <img src={p.url} alt={p.name} />
            <button type="button" aria-label={`Remove ${p.name}`} onClick={() => onChange(photos.filter((x) => x.id !== p.id))}><Icon name="x" /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
