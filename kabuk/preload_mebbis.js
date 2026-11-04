/* MEBBİS pencereleri: her sayfada "ne yapmalıyım" rehberi + aktarma düğmeleri
   • Öğrenci Planlama Okul İşlemleri  → öğrenci listesi
   • Taşıma Servis İşlemleri          → güzergah, şoför, plaka ve güzergahtaki öğrenciler */
const { ipcRenderer } = require('electron');
// 1.1.7: Rehber yalnız Taşımalı Öğrenci Modülü penceresinde (tasimali.meb.gov.tr) çıkar.
// MEBBİS ana sayfası, giriş ekranı, karekod ve e-Devlet sayfalarına hiç dokunmaz.
const PERSONEL_SAYFASI = /(^|\.)mebbis\.meb\.gov\.tr$/i.test(location.hostname) && /\/eozluk\//i.test(location.pathname);
const MEBBIS_SAYFASI = PERSONEL_SAYFASI || /(^|\.)tasimali\.meb\.gov\.tr$/i.test(location.hostname) || /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.protocol === 'file:';
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
  if (PERSONEL_SAYFASI) return document.getElementById('gvPersonelAra') ? 'personel-hazir' : 'personel-ara';
  if (pencereAcik()) return 'pencere';
  const t = sayfaMetni();
  if (/ogrenci listesi indir|kaydi bulunan ogrenci sayisi/.test(t)) return 'ogr-hazir';
  if (/nolu guzergah/.test(t) && /arac plakasi/.test(t)) return 'srv-hazir';
  if (/ets01010/.test(t) && document.querySelector('a[id$="_btnArac"]')) return 'sofor-hazir';
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
  'personel-ara': ['Personel listesi için: <b>e-Personel Modülü → Personel Arama</b>, Durumu: <b>Görevde</b> seçili iken <b>Ara</b>\'ya basın.'],
  'personel-hazir': ['Liste geldi. <b>Öğretmenleri Programa Aktar</b>\'a basın.', 'Yalnız ad soyad ve branş alınır; nöbet öğretmenlerine eklenir. MEBBİS\'te hiçbir şey değişmez.'],
  'sofor-hazir': ['Araçlar geldi. Aşağıdaki <b>Şoför Bilgilerini Programa Aktar</b> düğmesine basın.', 'Telefon, şoför, plaka ve saatler programla karşılaştırılır; siz onaylayınca kaydedilir. MEBBİS\'te hiçbir şey değişmez.'],
  'srv-sorgula': ['<b>Sorgula</b>\'ya basın ve güzergahların gelmesini bekleyin.'],
  'srv-hazir': ['Güzergahlar geldi. <b>📤 Programdan güzergaha yerleştir</b>: güzergahlar sırayla açılır, program her birini karşılaştırır, siz onaylayınca kaydeder.', '<b>🚌 Güzergahları programa al</b>: MEBBİS\'teki hâl programa alınır, MEBBİS\'te hiçbir şey değişmez.'],
  pencere: ['Bir güzergahın öğrenci penceresi açık. <b>📤 Programdan güzergaha yerleştir</b> düğmesine basın.', 'Programda yönü seçin: <b>📤 Programdan MEBBİS\'e yükle</b> (program MEBBİS\'e kaydeder) ya da <b>📥 MEBBİS\'ten programa al</b> (sadece program değişir).'],
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
    p.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:2147483647;background:#0e7490;color:#fff;border:1px solid #fff;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.3);font:bold 12.5px "Segoe UI",sans-serif;padding:6px 12px;cursor:pointer;opacity:.9';
    p.textContent = '🚌 Taşıma ▲'; p.title = 'Taşıma Programı rehberini aç';
    p.onclick = () => { window[KAPALI] = false; kur(); };
    document.body.appendChild(p); return;
  }
  p.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:2147483647;width:290px;background:#fff;border:1px solid #0e7490;border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,.25);font:12.5px/1.4 "Segoe UI",sans-serif;color:#0f172a;overflow:hidden';
  const hazir = a === 'ogr-hazir' || a === 'srv-hazir';
  const dugme = (id, metin, renk, vurgu) => `<button type="button" id="${id}" data-etiket="${metin}" style="width:100%;margin-top:4px;padding:${vurgu ? '7px 9px' : '4px 9px'};border:0;border-radius:7px;font:bold ${vurgu ? '13px' : '12px'} 'Segoe UI',sans-serif;cursor:pointer;color:#fff;background:${renk};${vurgu ? 'box-shadow:0 0 0 2px #fde047;' : 'opacity:.7;'}">${metin}</button>`;
  p.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;background:#0e7490;color:#fff;padding:6px 10px;font-weight:700;font-size:13px;cursor:pointer" id="__tr_bas">🚌 Taşıma Programı <span id="__tr_ok" title="Küçült">▼</span></div>
    <div id="__tr_ic" style="padding:6px 8px">
      ${METIN[a].map((m, i) => `<div style="display:flex;gap:6px;margin-bottom:4px"><span style="flex:0 0 18px;height:18px;border-radius:50%;background:${hazir && i === 0 ? '#16a34a' : '#0e7490'};color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:11px">${i + 1}</span><span>${m}</span></div>`).join('')}
      ${PERSONEL_SAYFASI ? dugme('__tasima_per', '👩‍🏫 Öğretmenleri Programa Aktar', '#15803d', a === 'personel-hazir') : `<div style="display:flex;gap:5px;margin-top:5px">${[
        ['__tasima_ogr', '📥', 'Öğrencileri programa al', '#0e7490', a === 'ogr-hazir'],
        ['__tasima_aktar', '🚌', 'Güzergahları programa al', '#1d4ed8', a === 'srv-hazir'],
        ['__tasima_yer', '📤', 'Programdan güzergaha yerleştir', '#b45309', a === 'srv-hazir' || a === 'pencere']
      ].map(([id, ik, ad, renk, vurgu]) => `<button type="button" id="${id}" data-etiket="${ik} ${ad}" title="${ad}" style="flex:1;min-width:0;padding:6px 4px;border:0;border-radius:7px;font:bold 11px/1.25 'Segoe UI',sans-serif;cursor:pointer;color:#fff;background:${renk};${vurgu ? 'box-shadow:0 0 0 2px #fde047;' : 'opacity:.7;'}"><span style="font-size:15px">${ik}</span><br>${ad}</button>`).join('')}</div>`}
      ${a === 'sofor-hazir' ? dugme('__tasima_sofor', '📞 Şoför Bilgilerini Programa Aktar', '#7c3aed', true) : ''}
      <div style="margin-top:4px;color:#94a3b8;font-size:11px">Üst menüde de var: MEBBİS → …</div>
    </div>`;
  document.body.appendChild(p);
  p.querySelector('#__tr_bas').onclick = () => { window[KAPALI] = true; kur(); };
  const ogr = p.querySelector('#__tasima_ogr'), srv = p.querySelector('#__tasima_aktar'), tek = p.querySelector('#__tasima_tek'), yer = p.querySelector('#__tasima_yer');
  if (yer) yer.onclick = ev => { ev.preventDefault(); yer.disabled = true; yer.innerHTML = '⏳<br>Açılıyor…'; ipcRenderer.send('mebbis-yerlestir'); setTimeout(() => { yer.disabled = false; yer.innerHTML = '<span style="font-size:15px">📤</span><br>Programdan güzergaha yerleştir'; }, 8000); };
  if (tek) tek.onclick = ev => { ev.preventDefault(); tek.disabled = true; tek.textContent = '⏳ Okunuyor…'; ipcRenderer.send('mebbis-tek-karsilastir'); setTimeout(() => { tek.disabled = false; tek.textContent = tek.getAttribute('data-etiket'); }, 5000); };
  const per = p.querySelector('#__tasima_per');
  if (per) per.onclick = ev => { ev.preventDefault(); per.disabled = true; per.textContent = '⏳ Okunuyor…'; ipcRenderer.send('mebbis-personel-aktar'); setTimeout(() => { per.disabled = false; per.textContent = per.getAttribute('data-etiket'); }, 4000); };
  if (ogr) ogr.onclick = ev => { ev.preventDefault(); ogr.disabled = true; ogr.textContent = '⏳ Liste alınıyor…'; ipcRenderer.send('mebbis-rehber-ogrenci');
    setTimeout(() => { ogr.disabled = false; ogr.textContent = ogr.getAttribute('data-etiket'); }, 8000); };
  const sf = p.querySelector('#__tasima_sofor');
  if (sf) sf.onclick = ev => { ev.preventDefault(); sf.disabled = true; sf.textContent = '⏳ Okunuyor…'; ipcRenderer.send('mebbis-sofor-aktar'); setTimeout(() => { sf.disabled = false; sf.textContent = sf.getAttribute('data-etiket'); }, 4000); };
  if (srv) srv.onclick = ev => { ev.preventDefault(); srv.disabled = true; srv.textContent = '⏳ Güzergahlar okunuyor…'; ipcRenderer.send('mebbis-rehber-servis'); };
}
if (MEBBIS_SAYFASI && window.top === window) window.addEventListener('DOMContentLoaded', () => {
  kur();
  let z = null;
  new MutationObserver(() => { clearTimeout(z); z = setTimeout(kur, 500); }).observe(document.documentElement, { childList: true, subtree: true });
});
