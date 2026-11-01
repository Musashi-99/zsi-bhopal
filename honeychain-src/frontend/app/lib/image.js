/** Downscale an image file to a JPEG data URL small enough for the evidence endpoint (< 1.2 MB). */
export function compressImage(file, maxSide = 1280) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a valid image.'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        let q = 0.82;
        let out = c.toDataURL('image/jpeg', q);
        while (out.length > 1_500_000 && q > 0.4) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
        resolve(out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export const dataUrlToBase64 = (url) => url.split(',')[1];

export function validImage(file) {
  return /^image\/(png|jpeg|webp)$/.test(file.type) && file.size <= 5 * 1024 * 1024;
}
