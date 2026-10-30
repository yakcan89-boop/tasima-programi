/* Veriler: açılışta veriler.json → localStorage; çalışırken localStorage → veriler.json (3 sn'de bir ve kapanırken) */
const { ipcRenderer, contextBridge } = require('electron');
let son = '';
try {
  const ilk = ipcRenderer.sendSync('veri-oku');
  if (ilk && typeof ilk === 'object') Object.keys(ilk).forEach(k => { try { localStorage.setItem(k, ilk[k]); } catch (e) {} });
} catch (e) {}
function topla() { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return JSON.stringify(o); }
son = topla();
function kaydet(sync) {
  const t = topla(); if (t === son) return; son = t;
  if (sync) ipcRenderer.sendSync('veri-yaz-sync', t); else ipcRenderer.send('veri-yaz', t);
}
setInterval(() => kaydet(false), 3000);
window.addEventListener('beforeunload', () => kaydet(true));
try { contextBridge.exposeInMainWorld('masaustu', { mebbisAc: () => ipcRenderer.send('mebbis-ac'),
  // sıfırlama gibi işlemlerden önce: son hâli dosyaya yaz, sonra ayrı bir yedek al
  oncedenYedek: etiket => { son = ''; kaydet(true); return ipcRenderer.sendSync('veri-onceden-yedek', etiket); },
  // Veri Kaynağı klasöründeki dosyanın okul bilgileri (yoksa null)
  veriKaynagi: () => { try { return ipcRenderer.sendSync('veri-kaynagi-oku'); } catch (e) { return null; } },
  // tek güzergah: MEBBİS penceresinde ✔ işaretlerini ayarla (kaydetmez)
  mebbisIsaretle: plan => ipcRenderer.send('mebbis-isaretle', plan),
  // yazdırma önizleme: sayfanın o anki hali PDF olarak gösterilir
  onizle: (html, baslik) => ipcRenderer.send('yazdir-onizle', html, baslik) }); } catch (e) {}
try { contextBridge.exposeInMainWorld('__masaustuKaydet', () => { son = ''; kaydet(true); return true; }); } catch (e) {}
ipcRenderer.on('dosyadan-yeniden-yukle', () => {
  try {
    const o = ipcRenderer.sendSync('veri-oku') || {};
    Object.keys(o).forEach(k => localStorage.setItem(k, o[k]));
    son = topla();
  } catch (e) {}
  location.reload();
});
