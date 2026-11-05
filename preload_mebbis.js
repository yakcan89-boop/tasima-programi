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
  'srv-hazir': ['Güzergahlar geldi. <b>🚌 Güzergahları al</b> ya da <b>📤 Yerleştir</b>\'e basın, açılan listeden güzergahları seçin.', 'Seçilenler <b>tek tek</b> açılır; her birini ayrı onaylarsınız. Program hangilerinin bittiğini hatırlar, kaldığınız yerden devam edebilirsiniz.'],
  pencere: ['Bir güzergahın öğrenci penceresi açık.', '<b>📥 Bu güzergahı al</b>: yalnız bu güzergah programa alınır (MEBBİS değişmez). <b>📤 Bu güzergaha yerleştir</b>: program MEBBİS\'e kaydeder.'],
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
      ${PERSONEL_SAYFASI ? dugme('__tasima_per', '👩‍🏫 Öğretmenleri Programa Aktar', '#15803d', a === 'personel-hazir') : `<div style="display:flex;gap:5px;margin-top:5px">${(a === 'pencere' ? [
        ['__tasima_bual', '📥', 'Bu güzergahı programa al', '#7c3aed', true],
        ['__tasima_aktar', '🚌', 'Güzergah seç (programa al)', '#1d4ed8', false],
        ['__tasima_yer', '📤', 'Bu güzergaha programdan yerleştir', '#b45309', true]
      ] : [
        ['__tasima_ogr', '📥', 'Öğrencileri programa al', '#0e7490', a === 'ogr-hazir'],
        ['__tasima_aktar', '🚌', 'Güzergahları programa al', '#1d4ed8', a === 'srv-hazir'],
        ['__tasima_yer', '📤', 'Programdan güzergaha yerleştir', '#b45309', a === 'srv-hazir']
      ]).map(([id, ik, ad, renk, vurgu]) => `<button type="button" id="${id}" data-etiket="${ik} ${ad}" data-html="<span style='font-size:15px'>${ik}</span><br>${ad}" title="${ad}" style="flex:1;min-width:0;padding:6px 4px;border:0;border-radius:7px;font:bold 11px/1.25 'Segoe UI',sans-serif;cursor:pointer;color:#fff;background:${renk};${vurgu ? 'box-shadow:0 0 0 2px #fde047;' : 'opacity:.7;'}"><span style="font-size:15px">${ik}</span><br>${ad}</button>`).join('')}</div>`}
      ${a === 'sofor-hazir' ? dugme('__tasima_sofor', '📞 Şoför Bilgilerini Programa Aktar', '#7c3aed', true) : ''}
      <div style="margin-top:4px;color:#94a3b8;font-size:11px">Üst menüde de var: MEBBİS → …</div>
    </div>`;
  document.body.appendChild(p);
  p.querySelector('#__tr_bas').onclick = () => { window[KAPALI] = true; kur(); };
  const ogr = p.querySelector('#__tasima_ogr'), srv = p.querySelector('#__tasima_aktar'), tek = p.querySelector('#__tasima_tek'), yer = p.querySelector('#__tasima_yer');
  const geri = b => { b.disabled = false; b.innerHTML = b.getAttribute('data-html'); };
  if (yer) yer.onclick = ev => { ev.preventDefault();
    if (a !== 'pencere') { secAc('yer'); return; }            // güzergah seçme penceresi
    yer.disabled = true; yer.innerHTML = '⏳<br>Açılıyor…'; ipcRenderer.send('mebbis-yerlestir'); setTimeout(() => geri(yer), 8000); };
  const bual = p.querySelector('#__tasima_bual');
  if (bual) bual.onclick = ev => { ev.preventDefault(); bual.disabled = true; bual.innerHTML = '⏳<br>Okunuyor…'; ipcRenderer.send('mebbis-bu-guzergah-al'); setTimeout(() => geri(bual), 5000); };
  if (tek) tek.onclick = ev => { ev.preventDefault(); tek.disabled = true; tek.textContent = '⏳ Okunuyor…'; ipcRenderer.send('mebbis-tek-karsilastir'); setTimeout(() => { tek.disabled = false; tek.textContent = tek.getAttribute('data-etiket'); }, 5000); };
  const per = p.querySelector('#__tasima_per');
  if (per) per.onclick = ev => { ev.preventDefault(); per.disabled = true; per.textContent = '⏳ Okunuyor…'; ipcRenderer.send('mebbis-personel-aktar'); setTimeout(() => { per.disabled = false; per.textContent = per.getAttribute('data-etiket'); }, 4000); };
  if (ogr) ogr.onclick = ev => { ev.preventDefault(); ogr.disabled = true; ogr.textContent = '⏳ Liste alınıyor…'; ipcRenderer.send('mebbis-rehber-ogrenci');
    setTimeout(() => { ogr.disabled = false; ogr.textContent = ogr.getAttribute('data-etiket'); }, 8000); };
  const sf = p.querySelector('#__tasima_sofor');
  if (sf) sf.onclick = ev => { ev.preventDefault(); sf.disabled = true; sf.textContent = '⏳ Okunuyor…'; ipcRenderer.send('mebbis-sofor-aktar'); setTimeout(() => { sf.disabled = false; sf.textContent = sf.getAttribute('data-etiket'); }, 4000); };
  if (srv) srv.onclick = ev => { ev.preventDefault(); secAc('al'); };
}
/* ---------- GÜZERGAH SEÇME PENCERESİ ----------
   Bütün güzergahlar bir anda okunmaz: seçilenler tek tek açılır, her biri ayrı onaylanır.
   ✔ = bu işlem için daha önce tamamlanmış güzergah (tarihiyle). */
const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// MEBBİS başlığı: "Yaklaşık Maliyet No: 2922090 - 84. NOLU GÜZERGAH (ANA İHALE) ⓘ" → "Maliyet No 2922090 · Ana İhale"
const altYazi = b => { b = String(b || ''); const m = (b.match(/Maliyet\s*No\s*:?\s*(\d+)/i) || [])[1], t = (b.match(/\(([^)]+)\)/) || [])[1];
  const tur = t ? t.toLocaleLowerCase('tr-TR').replace(/(^|\s)(\S)/g, (x, a, c) => a + c.toLocaleUpperCase('tr-TR')) : '';
  return [m ? 'İhale No ' + m : '', tur].filter(Boolean).join(' · ') || b; };
const tarihYaz = iso => { try { const d = new Date(iso); return d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); } catch (x) { return ''; } };
async function secAc(mod) {
  if (!document.body) return;
  let k = document.getElementById('__tasima_sec'); if (k) k.remove();
  k = document.createElement('div'); k.id = '__tasima_sec';
  k.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px;font:13px/1.4 "Segoe UI",sans-serif;color:#0f172a';
  k.innerHTML = '<div style="background:#fff;border-radius:10px;padding:18px 22px;box-shadow:0 10px 30px rgba(0,0,0,.3)">⏳ Güzergah listesi okunuyor…</div>';
  document.body.appendChild(k);
  let v; try { v = await ipcRenderer.invoke('mebbis-guzergah-liste'); } catch (x) { v = { hata: x.message }; }
  if (!v || v.hata || !v.liste || !v.liste.length) {
    k.innerHTML = `<div style="background:#fff;border-radius:10px;padding:16px 20px;max-width:420px;box-shadow:0 10px 30px rgba(0,0,0,.3)"><b>Güzergah listesi bulunamadı.</b><div style="margin-top:6px">Taşıma Servis İşlemleri sayfasında <b>Sorgula</b>'ya basın, güzergahlar görününce tekrar deneyin.</div><div style="text-align:right;margin-top:10px"><button type="button" id="__ts_kapat" style="padding:6px 14px;border:0;border-radius:7px;background:#e2e8f0;font-weight:700;cursor:pointer">Kapat</button></div></div>`;
    k.querySelector('#__ts_kapat').onclick = () => k.remove(); return;
  }
  const secili = new Set();
  const dugmeCss = (renk, yazi) => `padding:7px 12px;border:0;border-radius:7px;font:bold 12.5px 'Segoe UI',sans-serif;cursor:pointer;background:${renk};color:${yazi || '#fff'}`;
  const ciz = () => {
    const il = (v.ilerleme && v.ilerleme[mod]) || null, biten = (il && il.biten) || {};
    const kalan = il && il.kuyruk ? il.kuyruk.filter(a => !biten[a] && v.liste.some(g => g.anahtar === a)) : [];
    const bitenSay = il && il.kuyruk ? il.kuyruk.filter(a => biten[a]).length : 0;
    const satir = g => `<label style="display:flex;gap:8px;align-items:center;padding:5px 6px;border-bottom:1px solid #eef2f7;cursor:pointer;${biten[g.anahtar] ? 'background:#f0fdf4' : ''}">
        <input type="checkbox" data-an="${esc(g.anahtar)}" ${secili.has(g.anahtar) ? 'checked' : ''}>
        <b style="flex:0 0 38px;font-size:14px">${esc(g.guzNo)}</b>
        <span style="flex:1;min-width:0"><span style="color:#0f172a">${esc(g.plaka)}</span> · ${esc(g.sofor)}<br><span style="color:#94a3b8;font-size:11.5px">${esc(altYazi(g.baslik))}</span>
        ${(g.bitenAraclar || []).map(b => `<br><span style="color:#94a3b8;font-size:11px">⏹ ${esc(b.plaka)} · ${esc(b.sofor)}${b.bitT ? ' · ' + esc(String(b.bitT).split(' ')[0]) + "'de bitti" : ' · bitti'}</span>`).join('')}</span>
        ${biten[g.anahtar] ? `<span style="color:#15803d;font-size:11.5px;white-space:nowrap" title="Bu işlem daha önce tamamlandı">✔ ${esc(tarihYaz(biten[g.anahtar]))}</span>` : ''}</label>`;
    k.innerHTML = `<div style="background:#fff;border-radius:12px;width:100%;max-width:600px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 14px 40px rgba(0,0,0,.35);overflow:hidden">
      <div style="display:flex;background:#0e7490">
        <button type="button" data-mod="al" style="flex:1;padding:10px;border:0;font:bold 13.5px 'Segoe UI',sans-serif;cursor:pointer;${mod === 'al' ? 'background:#fff;color:#1d4ed8' : 'background:transparent;color:#e0f2fe'}">🚌 Güzergahları programa al</button>
        <button type="button" data-mod="yer" style="flex:1;padding:10px;border:0;font:bold 13.5px 'Segoe UI',sans-serif;cursor:pointer;${mod === 'yer' ? 'background:#fff;color:#b45309' : 'background:transparent;color:#e0f2fe'}">📤 Programdan güzergaha yerleştir</button>
      </div>
      <div style="padding:10px 14px 6px;color:#475569">${mod === 'al'
        ? "Seçilen güzergahlar <b>tek tek</b> okunur; program her birinde öğrencileri, şoförü, plakayı ve güzergah adını gösterir, <b>siz onaylayınca</b> programa yazar. MEBBİS'te hiçbir şey değişmez."
        : "Seçilen güzergahlar <b>tek tek</b> açılır; program her birini karşılaştırır, <b>siz onaylayınca MEBBİS'e kaydeder</b>."}</div>
      ${kalan.length ? `<div style="margin:4px 14px;padding:8px 10px;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span style="flex:1">Önceki tur (${esc(tarihYaz(il.tarih))}): <b>${bitenSay}/${il.kuyruk.length}</b> güzergah bitti, <b>${kalan.length}</b> kaldı.</span>
          <button type="button" id="__ts_devam" style="${dugmeCss('#b45309')}">▶ Kaldığı yerden devam</button></div>` : ''}
      <div style="padding:6px 14px;display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid #e2e8f0">
        <button type="button" id="__ts_hepsi" style="${dugmeCss('#e2e8f0', '#0f172a')}">Tümünü seç</button>
        <button type="button" id="__ts_hic" style="${dugmeCss('#e2e8f0', '#0f172a')}">Hiçbiri</button>
        <button type="button" id="__ts_bitmeyen" style="${dugmeCss('#e2e8f0', '#0f172a')}" title="✔ işareti olmayanları seç">Bitmeyenleri seç</button>
        <span style="flex:1"></span><span style="align-self:center;color:#64748b">${v.liste.length} güzergah</span>
      </div>
      <div style="overflow:auto;padding:0 8px;flex:1">${v.liste.map(satir).join('')}</div>
      <div style="padding:10px 14px;border-top:1px solid #e2e8f0;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button type="button" id="__ts_basla" style="${dugmeCss(mod === 'al' ? '#1d4ed8' : '#b45309')}" ${secili.size ? '' : 'disabled'}>▶ Başlat: ${secili.size} güzergah, tek tek onaylı</button>
        ${mod === 'al' ? `<button type="button" id="__ts_tek" style="${dugmeCss('#64748b')}" ${secili.size ? '' : 'disabled'} title="Seçilenlerin hepsi okunur, sonuç tek listede gösterilir (az servisli okullar için)">Tek listede karşılaştır</button>` : ''}
        <span style="flex:1"></span>
        ${il ? `<a href="#" id="__ts_sifir" style="color:#94a3b8;font-size:12px" title="✔ işaretlerini siler">İlerlemeyi sıfırla</a>` : ''}
        <button type="button" id="__ts_kapat" style="${dugmeCss('#e2e8f0', '#0f172a')}">Kapat</button>
      </div></div>`;
    k.querySelectorAll('[data-mod]').forEach(b => b.onclick = () => { mod = b.getAttribute('data-mod'); secili.clear(); ciz(); });
    // kutu işaretlenince pencere yeniden çizilmez (uzun listede kaydırma yeri kaybolmasın); yalnız düğmeler güncellenir
    const guncelle = () => {
      k.querySelectorAll('[data-an]').forEach(c => { c.checked = secili.has(c.getAttribute('data-an')); });
      const b = k.querySelector('#__ts_basla'); b.disabled = !secili.size; b.textContent = `▶ Başlat: ${secili.size} güzergah, tek tek onaylı`;
      const t = k.querySelector('#__ts_tek'); if (t) t.disabled = !secili.size;
    };
    k.querySelectorAll('[data-an]').forEach(c => c.onchange = () => { if (c.checked) secili.add(c.getAttribute('data-an')); else secili.delete(c.getAttribute('data-an')); guncelle(); });
    k.querySelector('#__ts_hepsi').onclick = () => { v.liste.forEach(g => secili.add(g.anahtar)); guncelle(); };
    k.querySelector('#__ts_hic').onclick = () => { secili.clear(); guncelle(); };
    k.querySelector('#__ts_bitmeyen').onclick = () => { secili.clear(); v.liste.forEach(g => { if (!biten[g.anahtar]) secili.add(g.anahtar); }); guncelle(); };
    k.querySelector('#__ts_kapat').onclick = () => k.remove();
    const sira = () => v.liste.map(g => g.anahtar).filter(a => secili.has(a));   // sayfadaki sırayla
    const basla = (anahtarlar, tekListe) => { k.remove(); ipcRenderer.send('mebbis-guzergah-basla', { mod, anahtarlar, tekListe: !!tekListe, okul: v.okul || '' }); };
    k.querySelector('#__ts_basla').onclick = () => { if (secili.size) basla(sira()); };
    const tk = k.querySelector('#__ts_tek'); if (tk) tk.onclick = () => { if (secili.size) basla(sira(), true); };
    const dv = k.querySelector('#__ts_devam'); if (dv) dv.onclick = () => basla(kalan);
    const sf = k.querySelector('#__ts_sifir'); if (sf) sf.onclick = ev => { ev.preventDefault(); ipcRenderer.send('mebbis-ilerleme-sifirla', mod); if (v.ilerleme) delete v.ilerleme[mod]; ciz(); };
  };
  ciz();
}
ipcRenderer.on('tasima-guzergah-sec', (e, mod) => { if (MEBBIS_SAYFASI && window.top === window) secAc(mod === 'yer' ? 'yer' : 'al'); });
/* ✏️'ye (ya da satırda herhangi bir yere) basılınca o satırın kimliği sayfaya yazılır.
   Program açık pencerenin hangi güzergaha ait olduğunu plakadan değil buradan anlar
   (aynı araç iki güzergahta olabilir). Kimlik: ihale (maliyet) no + güzergah no + plaka. */
if (MEBBIS_SAYFASI) document.addEventListener('click', ev => {
  try {
    const tr = ev.target && ev.target.closest ? ev.target.closest('tr') : null; if (!tr) return;
    const tx = el => String((el && (el.innerText || el.textContent)) || '').replace(/\s+/g, ' ').trim();
    const tds = [...tr.children].filter(c => c.tagName === 'TD'); const ct = tds.map(tx);
    const pi = ct.findIndex(x => /^\d{2}\s*[A-ZÇĞİÖŞÜ]{1,3}\s*\d{2,5}$/.test(x)); if (pi < 0 || tds.length < pi + 6) return;
    const hepsi = [...document.querySelectorAll('tr')]; let k = hepsi.indexOf(tr) - 1, maliyet = '', no = '', baslik = '';
    for (; k >= 0; k--) { const t = tx(hepsi[k]); const m = t.match(/(\d+)\s*\.?\s*NOLU\s+G[ÜU]ZERGAH/i); const n = [...hepsi[k].children].filter(c => /^T[DH]$/.test(c.tagName)).length;
      if (m && n <= 3) { no = m[1]; baslik = t; maliyet = (t.match(/Maliyet\s*No\s*:?\s*(\d+)/i) || [])[1] || ''; break; } }
    document.documentElement.setAttribute('data-tasima-son', JSON.stringify({ maliyet, no, baslik, plaka: ct[pi], basT: ct[pi + 2] || '', t: Date.now() }));
  } catch (x) {}
}, true);
if (MEBBIS_SAYFASI && window.top === window) window.addEventListener('DOMContentLoaded', () => {
  kur();
  let z = null;
  new MutationObserver(() => { clearTimeout(z); z = setTimeout(kur, 500); }).observe(document.documentElement, { childList: true, subtree: true });
});
