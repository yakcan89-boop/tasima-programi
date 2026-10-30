/* MEBBİS pencereleri: her sayfada "ne yapmalıyım" rehberi + aktarma düğmeleri
   • Öğrenci Planlama Okul İşlemleri  → öğrenci listesi
   • Taşıma Servis İşlemleri          → güzergah, şoför, plaka ve güzergahtaki öğrenciler */
const { ipcRenderer } = require('electron');
// 1.1.7: Rehber yalnız Taşımalı Öğrenci Modülü penceresinde (tasimali.meb.gov.tr) çıkar.
// MEBBİS ana sayfası, giriş ekranı, karekod ve e-Devlet sayfalarına hiç dokunmaz.
const MEBBIS_SAYFASI = /(^|\.)tasimali\.meb\.gov\.tr$/i.test(location.hostname) || /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.protocol === 'file:';
// Türkçe harf ve büyük/küçük farkını yok sayan karşılaştırma
const N = t => String(t || '').replace(/̇/g, '').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/\s+/g, ' ');
function sayfaMetni() {
  const d = document; if (!d.body) return '';
  return N((d.body.innerText || '') + ' ' + [...d.querySelectorAll('input[type=button],input[type=submit],input[type=image],button,a')].map(x => (x.value || '') + ' ' + (x.title || '')).join(' ') + ' ' + location.href);
}
function pencereAcik() {
  const b = document.querySelector('[id$="btnSave"] input, input[value*="Eşleşmesini kaydet" i]');
  return !!b && b.getClientRects().length > 0;
}
function adim() {
  if (pencereAcik()) return 'pencere';
  const t = sayfaMetni();
  if (/ogrenci listesi indir|kaydi bulunan ogrenci sayisi/.test(t)) return 'ogr-hazir';
  if (/nolu guzergah/.test(t) && /arac plakasi/.test(t)) return 'srv-hazir';
  if (/ets07004/.test(t)) return 'ogr-sorgula';
  if (/ets01025/.test(t)) return 'srv-sorgula';
  if (/ilkokul-orta okul tasima islemleri|orta ogretim tasima islemleri|diger tasima islemleri/.test(t)) return 'modul';
  return 'modul';
}
const METIN = {
  oturum: ['MEBBİS\'e kendi kullanıcı adı ve şifrenizle giriş yapın.'],
  giris: ['<b>Taşımalı Öğrenci Modülü</b>\'ne tıklayın.'],
  modul: ['Soldaki menüden işlem seçin. <b>Öğrenci listesi için:</b> Diğer Taşıma İşlemleri → <b>Öğrenci Planlama Okul İşlemleri</b>',
          '<b>Güzergah ve servis öğrencileri için:</b> İlkokul-Orta Okul (lisede: Orta Öğretim) Taşıma İşlemleri → <b>Taşıma Servis İşlemleri</b>'],
  'ogr-sorgula': ['<b>Sorgula</b>\'ya basın ve öğrenci listesinin gelmesini bekleyin.'],
  'ogr-hazir': ['Liste geldi. Aşağıdaki <b>Öğrencileri Programa Aktar</b> düğmesine basın.', 'Program kendiliğinden açılır; yeni ve değişen öğrencileri gösterir, siz onaylayınca kaydeder.'],
  'srv-sorgula': ['<b>Sorgula</b>\'ya basın ve güzergahların gelmesini bekleyin.'],
  'srv-hazir': ['Güzergahlar geldi. Aşağıdaki <b>Güzergahları Programa Aktar</b> düğmesine basın.', 'Her güzergahın penceresi sırayla açılıp kapanır, bitene kadar dokunmayın. MEBBİS\'te hiçbir şey değişmez.'],
  pencere: ['Bir güzergahın öğrenci penceresi açık. <b>Bu güzergahı programla karşılaştır</b> düğmesine basın.', 'Farklar ve çakışmalar programda listelenir. Seçtikleriniz için program buradaki ✔ işaretlerini ayarlar; <b>kaydet\'e siz basarsınız</b>.'],
  genel: ['Taşımalı Öğrenci Modülü\'ne gidin.']
};
const KAPALI = '__tasima_rehber_kapali';
function kur() {
  if (window.top !== window || !document.body) return;   // sadece ana sayfada göster
  const a = adim();
  let p = document.getElementById('__tasima_rehber');
  const kapali = !!window[KAPALI];                     // her yeni sayfada panel açık gelir
  if (p && p.getAttribute('data-adim') === a + (kapali ? '-k' : '')) return;
  const mesgul = p && p.querySelector('button[disabled]');
  if (mesgul) return;                                   // aktarım sürerken yeniden çizme
  if (p) p.remove();
  p = document.createElement('div'); p.id = '__tasima_rehber'; p.setAttribute('data-adim', a + (kapali ? '-k' : ''));
  if (kapali) {                                         // kapalıyken köşede küçük düğme olarak kalır, kaybolmaz
    p.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;background:#0e7490;color:#fff;border:2px solid #fff;border-radius:22px;box-shadow:0 4px 14px rgba(0,0,0,.35);font:bold 14px "Segoe UI",sans-serif;padding:9px 16px;cursor:pointer';
    p.textContent = '🚌 Taşıma ▲'; p.title = 'Taşıma Programı rehberini aç';
    p.onclick = () => { window[KAPALI] = false; kur(); };
    document.body.appendChild(p); return;
  }
  p.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;width:330px;background:#fff;border:2px solid #0e7490;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.3);font:13px "Segoe UI",sans-serif;color:#0f172a;overflow:hidden';
  const hazir = a === 'ogr-hazir' || a === 'srv-hazir';
  const dugme = (id, metin, renk, vurgu) => `<button type="button" id="${id}" data-etiket="${metin}" style="width:100%;margin-top:6px;padding:9px 10px;border:0;border-radius:8px;font:bold 13px 'Segoe UI',sans-serif;cursor:pointer;color:#fff;background:${renk};${vurgu ? 'box-shadow:0 0 0 3px #fde047;' : 'opacity:.75;'}">${metin}</button>`;
  p.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;background:#0e7490;color:#fff;padding:8px 12px;font-weight:700;cursor:pointer" id="__tr_bas">🚌 Taşıma Programı — ne yapmalıyım? <span id="__tr_ok" title="Küçült">▼</span></div>
    <div id="__tr_ic" style="padding:10px 12px">
      ${METIN[a].map((m, i) => `<div style="display:flex;gap:8px;margin-bottom:6px"><span style="flex:0 0 20px;height:20px;border-radius:50%;background:${hazir && i === 0 ? '#16a34a' : '#0e7490'};color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:12px">${i + 1}</span><span>${m}</span></div>`).join('')}
      ${a === 'pencere' ? dugme('__tasima_tek', '⚖️ Bu güzergahı programla karşılaştır', '#b45309', true) : ''}
      ${dugme('__tasima_ogr', '📥 Öğrencileri Programa Aktar', '#0e7490', a === 'ogr-hazir')}
      ${dugme('__tasima_aktar', '🚌 Güzergahları Programa Aktar', '#1d4ed8', a === 'srv-hazir')}
      <div style="margin-top:8px;color:#64748b;font-size:11px">Düğmeler üst menüde de var: MEBBİS → … (Ctrl+Shift+O / Ctrl+Shift+G)</div>
    </div>`;
  document.body.appendChild(p);
  p.querySelector('#__tr_bas').onclick = () => { window[KAPALI] = true; kur(); };
  const ogr = p.querySelector('#__tasima_ogr'), srv = p.querySelector('#__tasima_aktar'), tek = p.querySelector('#__tasima_tek');
  if (tek) tek.onclick = ev => { ev.preventDefault(); tek.disabled = true; tek.textContent = '⏳ Okunuyor…'; ipcRenderer.send('mebbis-tek-karsilastir'); setTimeout(() => { tek.disabled = false; tek.textContent = tek.getAttribute('data-etiket'); }, 5000); };
  ogr.onclick = ev => { ev.preventDefault(); ogr.disabled = true; ogr.textContent = '⏳ Liste alınıyor…'; ipcRenderer.send('mebbis-rehber-ogrenci');
    setTimeout(() => { ogr.disabled = false; ogr.textContent = ogr.getAttribute('data-etiket'); }, 8000); };
  srv.onclick = ev => { ev.preventDefault(); srv.disabled = true; srv.textContent = '⏳ Güzergahlar okunuyor…'; ipcRenderer.send('mebbis-rehber-servis'); };
}
if (MEBBIS_SAYFASI && window.top === window) window.addEventListener('DOMContentLoaded', () => {
  kur();
  let z = null;
  new MutationObserver(() => { clearTimeout(z); z = setTimeout(kur, 500); }).observe(document.documentElement, { childList: true, subtree: true });
});
