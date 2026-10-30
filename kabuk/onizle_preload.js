/* Yazdırma önizleme penceresinin köprüsü */
const { ipcRenderer, contextBridge } = require('electron');
contextBridge.exposeInMainWorld('onizleApi', {
  bilgi: () => ipcRenderer.invoke('onizle-bilgi'),
  olustur: ayar => ipcRenderer.invoke('onizle-olustur', ayar),
  yazdir: ayar => ipcRenderer.invoke('onizle-yazdir', ayar),
  kaydet: ayar => ipcRenderer.invoke('onizle-kaydet', ayar),
  kapat: () => ipcRenderer.send('onizle-kapat'),
  yeniSayfa: fn => ipcRenderer.on('onizle-yeni', () => fn())
});
