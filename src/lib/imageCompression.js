/**
 * Compresses and resizes images before upload.
 * Target: max 800KB and 1200px width while maintaining aspect ratio.
 */
export async function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Resize to max 1200px width while maintaining aspect ratio
        if (width > 1200) {
          height = Math.round((height * 1200) / width);
          width = 1200;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Compress: start at 0.8 quality, reduce if still over 800KB
        let quality = 0.8;
        let compressed;
        do {
          compressed = canvas.toDataURL('image/jpeg', quality);
          quality -= 0.1;
        } while (compressed.length > 800 * 1024 && quality > 0.1);

        // Convert data URL to blob
        const bstr = atob(compressed.split(',')[1]);
        const n = bstr.length;
        const u8arr = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          u8arr[i] = bstr.charCodeAt(i);
        }

        const compressedFile = new File(
          [u8arr],
          file.name.replace(/\.[^/.]+$/, '.jpg'),
          { type: 'image/jpeg' }
        );
        resolve(compressedFile);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}