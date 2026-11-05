/* Taşımalı Eğitim ve Nöbet Yönetim Sistemi — masaüstü kabuğu
   Tasarım ve geliştirme: Yunus AKÇAKAYA — okullar için ücretsiz hazırlanmıştır.
   • Program (program.html) Belgeler\Taşıma Programı\Program klasöründe durur; dosyadan ya da internetten güncellenir.
   • Veriler Belgeler\Taşıma Programı\veriler.json dosyasında saklanır; her gün Yedekler klasörüne kopyalanır (son 60 gün). */
const { app, BrowserWindow, Menu, dialog, ipcMain, shell, net, session } = require('electron');
const fs = require('fs');
const path = require('path');

const KABUK_SURUM = '1.1.14';
const VARSAYILAN_GUNCELLEME_ADRESI = 'https://raw.githubusercontent.com/yakcan89-boop/tasima-programi/main/surum.json';

let anaPencere = null;
/* --deneme: boş programla ayrı klasörde çalışır; gerçek verilere dokunmaz */
const DENEME = process.argv.includes('--deneme');
if (DENEME) app.setPath('userData', path.join(app.getPath('appData'), 'Tasima Programi DENEME'));
const kok = () => path.join(app.getPath('documents'), DENEME ? 'Taşıma Programı DENEME' : 'Taşıma Programı');
const yollar = () => ({
  kok: kok(),
  veri: path.join(kok(), 'veriler.json'),
  yedek: path.join(kok(), 'Yedekler'),
  prog: path.join(kok(), 'Program'),
  progHtml: path.join(kok(), 'Program', 'program.html'),
  progOnceki: path.join(kok(), 'Program', 'program_onceki.html'),
  ayar: path.join(kok(), 'ayarlar.json'),
  kaynak: path.join(kok(), 'Veri Kaynağı'),
  indir: path.join(kok(), 'İndirilenler')
});

function klasorleriHazirla() {
  const y = yollar();
  [y.kok, y.yedek, y.prog, y.kaynak, y.indir].forEach(k => fs.mkdirSync(k, { recursive: true }));
  const oku = path.join(y.kaynak, 'OKU-BENI.txt');
  if (!fs.existsSync(oku)) try { fs.writeFileSync(oku, 'VERİ KAYNAĞI\r\n\r\nBu klasör normalde boş kalır.\r\nİçine okul bilgileri olan bir program dosyası (.html) ya da yedek dosyası (.json) koyarsanız,\r\n"Dosya → Veri kaynağından yükle" ya da "Verileri Sıfırla" dendiğinde okulun bilgileri bu dosyadan alınır.\r\nProgramın kendisi her zaman güncel sürüm olarak kalır.\r\nYüklemeden önce mevcut bilgiler Yedekler klasörüne kaydedilir.\r\n', 'utf8'); } catch (e) {}
  if (!fs.existsSync(y.progHtml)) fs.copyFileSync(path.join(__dirname, DENEME ? 'program_bos.html' : 'program.html'), y.progHtml);
}
function ayarOku() { try { return JSON.parse(fs.readFileSync(yollar().ayar, 'utf8')); } catch (e) { return {}; } }
function ayarYaz(a) { try { fs.writeFileSync(yollar().ayar, JSON.stringify(a, null, 2), 'utf8'); } catch (e) {} }

/* ---------- veri dosyası ---------- */
function veriOku() {
  try { const t = fs.readFileSync(yollar().veri, 'utf8'); const o = JSON.parse(t); return (o && typeof o === 'object') ? o : null; }
  catch (e) { return null; }
}
function gunEtiketi(d = new Date()) { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
function veriYaz(metin) {
  const y = yollar();
  try {
    JSON.parse(metin);
    gunlukYedek();                       // günün ilk yazımından önce, dosyanın o anki (değişmemiş) hâli
    const gecici = y.veri + '.tmp';
    fs.writeFileSync(gecici, metin, 'utf8');
    fs.renameSync(gecici, y.veri);
  } catch (e) { console.error('Veri yazılamadı', e); }
}
/* ---------- yedek adları: Yedekler\29.10.2026\OKUL ADI - Tür - 29.10.2026 22.04.json ---------- */
const iki = n => String(n).padStart(2, '0');
const trTarih = (d = new Date()) => `${iki(d.getDate())}.${iki(d.getMonth() + 1)}.${d.getFullYear()}`;
const trSaat = (d = new Date()) => `${iki(d.getHours())}.${iki(d.getMinutes())}`;
const dosyaUygun = t => String(t || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
function okulAdiBul() {
  try {
    const v = veriOku() || {}; const t = programAnahtari();
    const aktif = t ? v[t + '_aktif_okul'] : '';               // çoklu okul: seçili okulun verisi
    const k = t && aktif ? t + '__' + aktif : t;
    const o = k && v[k] ? JSON.parse(v[k]) : null;
    const ad = o && String(o.okulAdi || '').trim();
    return dosyaUygun(ad) || 'Okul';
  } catch (e) { return 'Okul'; }
}
function yedekAdi(tur, d = new Date()) { return `${okulAdiBul()} - ${tur} - ${trTarih(d)} ${trSaat(d)}.json`; }
function gunKlasoru(d = new Date()) { const k = path.join(yollar().yedek, trTarih(d)); fs.mkdirSync(k, { recursive: true }); return k; }
function gunlukYedek() {
  const y = yollar();
  try {
    if (!fs.existsSync(y.veri)) return;
    const k = gunKlasoru();
    if (!fs.readdirSync(k).some(f => / - Günlük yedek - /.test(f)))   // o günün yedeği bir kez alınır (günün ilk açılışındaki hâl)
      fs.copyFileSync(y.veri, path.join(k, yedekAdi('Günlük yedek')));
    // Programda birden çok okul varsa her okulun kendi yedeği de ayrı dosya (o okulun adıyla, tek başına geri yüklenebilir)
    if (Date.now() - (global.__okulYedekSon || 0) > 10 * 60e3) try {      // en çok 10 dakikada bir bakılır
      global.__okulYedekSon = Date.now();
      const v = JSON.parse(fs.readFileSync(y.veri, 'utf8')); const t = programAnahtari();
      let L = []; try { L = JSON.parse(v[t + '_okullar'] || '[]'); } catch (x) {}
      const idler = [...new Set(['', ...(Array.isArray(L) ? L.map(o => o && o.id).filter(x => typeof x === 'string') : [])])];
      if (t && idler.length > 1) {
        const mevcut = fs.readdirSync(k);
        idler.forEach(id => {
          const anahtar = id ? t + '__' + id : t; if (!v[anahtar]) return;
          let d; try { d = JSON.parse(v[anahtar]); } catch (x) { return; }
          const lo = (Array.isArray(L) ? L : []).find(o => o && o.id === id) || {};
          const ad = dosyaUygun(String(d.okulAdi || lo.ad || 'Okul').trim()) || 'Okul';
          if (mevcut.some(f => f.startsWith(ad + ' - Okul yedeği - '))) return;
          fs.writeFileSync(path.join(k, `${ad} - Okul yedeği - ${trTarih()} ${trSaat()}.json`), JSON.stringify(d), 'utf8');
        });
      }
    } catch (x) {}
    // 60 günden eski gün klasörlerini temizle
    const sinir = Date.now() - 60 * 864e5;
    fs.readdirSync(y.yedek).forEach(f => {
      const m = f.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); if (!m) return;
      if (new Date(+m[3], +m[2] - 1, +m[1]).getTime() < sinir) fs.rmSync(path.join(y.yedek, f), { recursive: true, force: true });
    });
  } catch (e) {}
}
ipcMain.on('veri-oku', e => { e.returnValue = veriOku(); });
const YEDEK_TURU = { sifirlama_oncesi: 'Sıfırlama öncesi', geri_yukleme_oncesi: 'Geri yükleme öncesi' };
ipcMain.on('veri-onceden-yedek', (e, etiket) => {
  try { const hedef = path.join(gunKlasoru(), yedekAdi(YEDEK_TURU[etiket] || dosyaUygun(etiket) || 'Yedek')); fs.copyFileSync(yollar().veri, hedef); e.returnValue = hedef; }
  catch (x) { e.returnValue = ''; }
});
ipcMain.on('veri-yaz', (e, metin) => veriYaz(metin));
ipcMain.on('veri-yaz-sync', (e, metin) => { veriYaz(metin); e.returnValue = true; });

/* ---------- program bilgisi ---------- */
function programMetni() { try { return fs.readFileSync(yollar().progHtml, 'utf8'); } catch (e) { return ''; } }
function programSurumu(metin) { const m = String(metin || programMetni()).match(/Sürüm:\s*(\d{2}\.\d{2}\.\d{4})/); return m ? m[1] : '?'; }
function programAnahtari(metin) { const m = String(metin || programMetni()).match(/localStorage\.getItem\('([^']+)'\)/); return m ? m[1] : null; }
function surumSayi(s) { const m = String(s || '').match(/(\d{2})\.(\d{2})\.(\d{4})/); return m ? Number(m[3] + m[2] + m[1]) : 0; }

/* ---------- pencere ---------- */
function pencereAc() {
  anaPencere = new BrowserWindow({
    width: 1400, height: 900, show: false, title: DENEME ? 'DENEME (boş) — Taşıma ve Nöbet Programı' : 'Taşıma ve Nöbet Programı', icon: path.join(__dirname, 'ikon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false, spellcheck: false }
  });
  anaPencere.maximize();
  /* Programdan indirilen her şey (yedek, okul nöbeti, Excel, Word…) tek klasöre: Belgeler\Taşıma Programı\İndirilenler */
  anaPencere.webContents.session.on('will-download', (e, item, wc) => {
    if (!wc || wc !== anaPencere.webContents) return;
    const kl = yollar().indir; try { fs.mkdirSync(kl, { recursive: true }); } catch (x) {}
    const ad = (item.getFilename() || 'dosya').replace(/[\\/:*?"<>|]+/g, ' ');
    const uz = path.extname(ad), govde = ad.slice(0, ad.length - uz.length);
    let yol = path.join(kl, ad), n = 2;
    while (fs.existsSync(yol)) yol = path.join(kl, `${govde} (${n++})${uz}`);
    item.setSavePath(yol);
    item.once('done', (ev, durum) => {
      if (durum !== 'completed' || !anaPencere || anaPencere.isDestroyed()) return;
      const metin = JSON.stringify('⬇️ Kaydedildi: Belgeler\\Taşıma Programı\\İndirilenler\\' + path.basename(yol));
      anaPencere.webContents.executeJavaScript(`(() => { let d = document.getElementById('__indir_bildirim'); if (d) d.remove(); d = document.createElement('div'); d.id = '__indir_bildirim';
        d.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483647;background:#0f766e;color:#fff;padding:9px 14px;border-radius:10px;font:13px "Segoe UI",sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.3);cursor:pointer';
        d.textContent = ${metin} + '  (klasörü açmak için tıklayın)'; d.onclick = () => { window.masaustu && window.masaustu.indirilenleriAc && window.masaustu.indirilenleriAc(); d.remove(); };
        document.body.appendChild(d); setTimeout(() => d.remove(), 7000); })()`).catch(() => {});
    });
  });
  anaPencere.loadFile(yollar().progHtml);
  anaPencere.once('ready-to-show', () => anaPencere.show());
  anaPencere.webContents.on('did-finish-load', () => {
    anaPencere.webContents.executeJavaScript(ONIZLE_KUR).catch(() => {});
    const ay = ayarOku();
    if (!ay.ilkAcilisGosterildi) { ay.ilkAcilisGosterildi = true; ayarYaz(ay); setTimeout(ilkAcilis, 800); }
    else setTimeout(() => guncellemeDenetle(false), 3000);
  });
}

/* ---------- ilk açılış: eski programdan verileri çek ---------- */
async function ilkAcilis() {
  const r = await dialog.showMessageBox(anaPencere, {
    type: 'question', title: 'Hoş geldiniz',
    message: 'Taşıma ve Nöbet Programı masaüstü sürümüne hoş geldiniz.',
    detail: 'Bu programı daha önce tarayıcıda (.html dosyası olarak) kullandıysanız verilerinizi şimdi aktarabilirsiniz.\n\nVeriler bundan sonra Belgeler\\Taşıma Programı klasöründe saklanır ve her gün yedeklenir.',
    buttons: ['Verileri çek', 'Şimdi değil'], defaultId: 0, cancelId: 1
  });
  if (r.response === 0) verileriCek();
}

function yedekAdaylari() {
  const yerler = ['downloads', 'desktop', 'documents'].map(k => { try { return app.getPath(k); } catch (e) { return null; } }).filter(Boolean);
  const L = [];
  yerler.forEach(k => {
    try { fs.readdirSync(k).forEach(f => { if (/yedek.*\.json$/i.test(f)) { const p = path.join(k, f); L.push({ p, t: fs.statSync(p).mtimeMs }); } }); } catch (e) {}
  });
  return L.sort((a, b) => b.t - a.t);
}
function yedekOzeti(o) {
  let ogr = 0; Object.values(o.students || {}).forEach(l => ogr += (l || []).length);
  return `Okul: ${o.okulAdi || '-'}\nGüzergah: ${(o.routes || []).length} · Öğrenci: ${ogr} · Şoför: ${(o.driverPool || []).length}`;
}
async function yedekYukle(dosya) {
  let o;
  try { o = JSON.parse(fs.readFileSync(dosya, 'utf8')); } catch (e) { dialog.showErrorBox('Okunamadı', 'Seçilen dosya geçerli bir yedek değil.'); return; }
  if (!o || !Array.isArray(o.routes)) { dialog.showErrorBox('Okunamadı', 'Bu dosya Taşıma Programı yedeği değil.'); return; }
  const anahtar = programAnahtari();
  if (!anahtar) { dialog.showErrorBox('Hata', 'Programın veri anahtarı bulunamadı.'); return; }
  const tarih = new Date(fs.statSync(dosya).mtimeMs).toLocaleString('tr-TR');
  const r = await dialog.showMessageBox(anaPencere, {
    type: 'question', title: 'Verileri aktar',
    message: 'Bu yedek programa aktarılsın mı?',
    detail: `${path.basename(dosya)}\n${tarih}\n\n${yedekOzeti(o)}\n\nŞu an açık olan okulun (${okulAdiBul()}) verilerinin yerine geçer (mevcut hali önce Yedekler klasörüne kaydedilir).${o.okulAdi && dosyaUygun(o.okulAdi).toLocaleUpperCase('tr-TR') !== okulAdiBul().toLocaleUpperCase('tr-TR') ? `\n\nDİKKAT: Yedek "${o.okulAdi}" okuluna ait, açık olan okul farklı!` : ''}`,
    buttons: ['Aktar', 'Vazgeç'], defaultId: 0, cancelId: 1
  });
  if (r.response !== 0) return;
  const y = yollar();
  if (fs.existsSync(y.veri)) try { fs.copyFileSync(y.veri, path.join(gunKlasoru(), yedekAdi('Aktarma öncesi'))); } catch (e) {}
  const mevcut = veriOku() || {};
  const aktif = mevcut[anahtar + '_aktif_okul'] || '';            // programa birden çok okul eklenmişse açık olan okula yüklenir
  mevcut[aktif ? anahtar + '__' + aktif : anahtar] = JSON.stringify(o);
  veriYaz(JSON.stringify(mevcut));
  anaPencere.webContents.send('dosyadan-yeniden-yukle');
}
async function verileriCek() {
  const L = yedekAdaylari();
  if (L.length) {
    const r = await dialog.showMessageBox(anaPencere, {
      type: 'question', title: 'Verileri çek',
      message: 'Eski programdan alınmış yedek bulundu.',
      detail: `${L[0].p}\n${new Date(L[0].t).toLocaleString('tr-TR')}\n\nBu yedeği mi aktaralım?`,
      buttons: ['Bunu aktar', 'Başka dosya seç…', 'Vazgeç'], defaultId: 0, cancelId: 2
    });
    if (r.response === 0) return yedekYukle(L[0].p);
    if (r.response === 2) return;
  } else {
    const r = await dialog.showMessageBox(anaPencere, {
      type: 'info', title: 'Verileri çek',
      message: 'Bilgisayarda yedek dosyası bulunamadı.',
      detail: 'Eski programı (tarayıcıda açılan .html) açın, "Yedek Dosyası İndir" düğmesine basın.\nSonra buraya dönüp yeniden "Verileri çek" deyin ya da dosyayı kendiniz seçin.',
      buttons: ['Dosya seç…', 'Tamam'], defaultId: 1, cancelId: 1
    });
    if (r.response !== 0) return;
  }
  const s = await dialog.showOpenDialog(anaPencere, { title: 'Yedek dosyasını seçin', defaultPath: yollar().indir, filters: [{ name: 'Yedek', extensions: ['json'] }], properties: ['openFile'] });
  if (!s.canceled && s.filePaths[0]) yedekYukle(s.filePaths[0]);
}

/* ---------- program güncelleme ---------- */
async function programDegistir(yeniMetin, kaynak) {
  if (!/<html/i.test(yeniMetin) || !programAnahtari(yeniMetin)) { dialog.showErrorBox('Güncellenemedi', 'Seçilen dosya Taşıma Programı değil.'); return false; }
  const y = yollar();
  if (programAnahtari(yeniMetin) !== programAnahtari()) {
    const r = await dialog.showMessageBox(anaPencere, { type: 'warning', buttons: ['Yine de kur', 'Vazgeç'], defaultId: 1, cancelId: 1,
      message: 'Bu program dosyası başka bir okulun sürümüne ait görünüyor.', detail: 'Kurulursa mevcut veriler bu programda görünmeyebilir (silinmez). Emin değilseniz Vazgeç deyin.' });
    if (r.response !== 0) return false;
  }
  try { fs.copyFileSync(y.progHtml, y.progOnceki); } catch (e) {}
  // açık sayfadaki son hal dosyaya yazılsın
  try { await anaPencere.webContents.executeJavaScript('window.__masaustuKaydet && window.__masaustuKaydet()'); } catch (e) {}
  fs.writeFileSync(y.progHtml, yeniMetin, 'utf8');
  const dosyadakiKullanildi = await gomuluKarar(yeniMetin);
  if (dosyadakiKullanildi) anaPencere.webContents.send('dosyadan-yeniden-yukle');   // veriyi dosyadan alıp yeni programla açar
  else anaPencere.loadFile(y.progHtml);
  dialog.showMessageBox(anaPencere, { type: 'info', message: `Program güncellendi (Sürüm: ${programSurumu(yeniMetin)}).`, detail: `${kaynak}\n\n` + (dosyadakiKullanildi ? 'Dosyanın içindeki okul bilgileri yüklendi. Önceki bilgiler Yedekler klasörüne kaydedildi.' : 'Verileriniz yerinde.') });
  return true;
}
/* ---------- Veri Kaynağı: bilerek konan .html / .json dosyasından okul bilgileri ---------- */
function aktifAnahtar() {
  const t = programAnahtari(); if (!t) return null;
  const v = veriOku() || {}; const aktif = v[t + '_aktif_okul'];
  return aktif ? t + '__' + aktif : t;
}
function kaynakDosyalari() {
  try { return fs.readdirSync(yollar().kaynak).filter(f => /\.(html?|json)$/i.test(f)).map(f => ({ ad: f, p: path.join(yollar().kaynak, f), t: fs.statSync(path.join(yollar().kaynak, f)).mtimeMs })).sort((a, b) => b.t - a.t); }
  catch (e) { return []; }
}
function kaynakVerisi(dosya) {
  const metin = fs.readFileSync(dosya, 'utf8');
  if (/\.html?$/i.test(dosya)) { const g = gomuluOku(metin); return veriDolu(g) ? g : null; }
  let o = JSON.parse(metin);
  if (o && Array.isArray(o.routes)) return o;
  const k = aktifAnahtar(); const aday = [];
  Object.keys(o || {}).forEach(a => { try { const x = typeof o[a] === 'string' ? JSON.parse(o[a]) : o[a]; if (x && Array.isArray(x.routes) && veriDolu(x)) aday.push({ a, x }); } catch (e) {} });
  const sec = aday.find(z => z.a === k) || aday[0];
  return sec ? sec.x : null;
}
ipcMain.on('veri-kaynagi-oku', e => {
  try { const L = kaynakDosyalari(); if (!L.length) { e.returnValue = null; return; } const x = kaynakVerisi(L[0].p); e.returnValue = x ? { ad: L[0].ad, veri: x } : null; }
  catch (x) { e.returnValue = null; }
});
async function veriKaynagindanYukle() {
  const L = kaynakDosyalari();
  if (!L.length) {
    const r = await dialog.showMessageBox(anaPencere, { type: 'info', buttons: ['Klasörü aç', 'Tamam'], defaultId: 0, cancelId: 1, message: 'Veri Kaynağı klasörü boş.', detail: 'İçine okul bilgileri olan bir program dosyası (.html) ya da yedek dosyası (.json) koyup tekrar deneyin.' });
    if (r.response === 0) shell.openPath(yollar().kaynak); return;
  }
  let x = null; try { x = kaynakVerisi(L[0].p); } catch (e) {}
  if (!x) { dialog.showMessageBox(anaPencere, { type: 'warning', message: 'Bu dosyada okul bilgisi bulunamadı.', detail: L[0].ad }); return; }
  try { await anaPencere.webContents.executeJavaScript('window.__masaustuKaydet && window.__masaustuKaydet()'); } catch (e) {}
  const k = aktifAnahtar(); const v = veriOku() || {}; let mev = null; try { mev = v[k] ? JSON.parse(v[k]) : null; } catch (e) {}
  const r = await dialog.showMessageBox(anaPencere, { type: 'question', buttons: ['Yükle', 'Vazgeç'], defaultId: 1, cancelId: 1, title: 'Veri kaynağından yükle',
    message: `"${L[0].ad}" dosyasındaki bilgiler yüklensin mi?`,
    detail: `DOSYADAKİ:\n${veriOzet(x)}\n\nŞU AN PROGRAMDA:\n${mev ? veriOzet(mev) : '(boş)'}\n\nŞu anki bilgiler önce Yedekler klasörüne kaydedilir.` + (L.length > 1 ? `\n\n(Klasörde ${L.length} dosya var; en son konan kullanılıyor.)` : '') });
  if (r.response !== 0) return;
  try { fs.copyFileSync(yollar().veri, path.join(gunKlasoru(), yedekAdi('Veri kaynağı öncesi'))); } catch (e) {}
  v[k] = JSON.stringify(x); veriYaz(JSON.stringify(v));
  anaPencere.webContents.send('dosyadan-yeniden-yukle');
}

/* Program dosyasının içine gömülü okul bilgileri (GOMULU_YEDEK) */
function gomuluOku(metin) {
  const i = metin.indexOf('const GOMULU_YEDEK = '); if (i < 0) return null;
  let j = metin.indexOf('{', i), d = 0, str = false, kac = false;
  for (let n = j; n < metin.length; n++) {
    const c = metin[n];
    if (str) { if (kac) kac = false; else if (c === '\\') kac = true; else if (c === '"') str = false; continue; }
    if (c === '"') str = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { try { return JSON.parse(metin.slice(j, n + 1)); } catch (e) { return null; } } }
  }
  return null;
}
const veriDolu = x => !!x && (((x.routes || []).length > 0) || Object.values(x.students || {}).some(l => (l || []).length) || ((x.candidateStudents || []).length > 0));
function veriOzet(x) {
  const ogr = Object.values(x.students || {}).reduce((t, l) => t + (l || []).length, 0);
  return `${x.okulAdi || 'Okul'}\n${(x.routes || []).length} güzergah · güzergahta ${ogr} öğrenci · adayda ${(x.candidateStudents || []).length} öğrenci`;
}
// Dosyada okul bilgisi var ve bilgisayardaki kayıttan farklıysa hangisinin kullanılacağını sorar
async function gomuluKarar(yeniMetin) {
  const k = programAnahtari(yeniMetin); const g = gomuluOku(yeniMetin);
  if (!k || !veriDolu(g)) return false;                       // boş program (GitHub güncellemesi vb.) → soru yok
  const v = veriOku() || {}; let mev = null; try { mev = v[k] ? JSON.parse(v[k]) : null; } catch (e) {}
  if (!veriDolu(mev)) return false;                           // kayıt yok → program dosyadakini zaten kullanır
  const ayni = JSON.stringify([mev.routes, mev.students, mev.candidateStudents]) === JSON.stringify([g.routes, g.students, g.candidateStudents]);
  if (ayni) return false;
  const r = await dialog.showMessageBox(anaPencere, { type: 'question', buttons: ['Dosyadaki bilgileri kullan', 'Bilgisayardaki bilgileri koru'], defaultId: 0, cancelId: 1,
    title: 'Hangi bilgiler kullanılsın?', message: 'Bu program dosyasının içinde okul bilgileri var ve bilgisayardaki kayıtlı bilgilerden farklı.',
    detail: `DOSYADAKİ:\n${veriOzet(g)}\n\nBİLGİSAYARDAKİ (kayıtlı):\n${veriOzet(mev)}\n\nDosyadakini seçerseniz bilgisayardaki bilgiler önce Yedekler klasörüne kaydedilir.` });
  if (r.response !== 0) return false;
  try { fs.copyFileSync(yollar().veri, path.join(gunKlasoru(), yedekAdi('Dosya yükleme öncesi'))); } catch (e) {}
  v[k] = JSON.stringify(g);
  veriYaz(JSON.stringify(v));
  return true;
}
async function dosyadanGuncelle() {
  const s = await dialog.showOpenDialog(anaPencere, { title: 'Yeni program dosyasını (.html) seçin', filters: [{ name: 'Program', extensions: ['html', 'htm'] }], properties: ['openFile'] });
  if (s.canceled || !s.filePaths[0]) return;
  programDegistir(fs.readFileSync(s.filePaths[0], 'utf8'), path.basename(s.filePaths[0]));
}
async function oncekiSurumeDon() {
  const y = yollar();
  if (!fs.existsSync(y.progOnceki)) { dialog.showMessageBox(anaPencere, { type: 'info', message: 'Kayıtlı önceki sürüm yok.' }); return; }
  const r = await dialog.showMessageBox(anaPencere, { type: 'question', buttons: ['Geri dön', 'Vazgeç'], defaultId: 1, cancelId: 1,
    message: `Önceki sürüme (${programSurumu(fs.readFileSync(y.progOnceki, 'utf8'))}) dönülsün mü?`, detail: 'Verileriniz değişmez.' });
  if (r.response !== 0) return;
  const simdiki = programMetni();
  fs.copyFileSync(y.progOnceki, y.progHtml);
  fs.writeFileSync(y.progOnceki, simdiki, 'utf8');
  anaPencere.loadFile(y.progHtml);
}
async function guncellemeDenetle(elle) {
  const adres = ayarOku().guncellemeAdresi || VARSAYILAN_GUNCELLEME_ADRESI;
  if (!adres) { if (elle) dialog.showMessageBox(anaPencere, { type: 'info', message: 'Güncelleme adresi henüz tanımlanmadı.', detail: 'Yeni sürümü "Programı dosyadan güncelle" ile yükleyebilirsiniz.' }); return; }
  try {
    const b = await (await net.fetch(adres + (adres.includes('?') ? '&' : '?') + 't=' + Date.now())).json();
    if (await kabukGuncelle(b)) return;          // masaüstü programı güncellendiyse yeniden açılıyor
    const anahtar = programAnahtari();
    const kayit = (b.programlar && anahtar && b.programlar[anahtar]) || b;
    if (!kayit || !kayit.surum || surumSayi(kayit.surum) <= surumSayi(programSurumu())) { if (elle) dialog.showMessageBox(anaPencere, { type: 'info', message: 'Program güncel.', detail: `Program sürümü: ${programSurumu()}\nMasaüstü sürümü: ${KABUK_SURUM}` }); return; }
    const r = await dialog.showMessageBox(anaPencere, { type: 'question', buttons: ['Güncelle', 'Sonra'], defaultId: 0, cancelId: 1,
      message: `Yeni sürüm var (${kayit.surum}). Güncellensin mi?`, detail: (kayit.notlar || '') + '\n\nVerileriniz yerinde kalır.' });
    if (r.response !== 0) return;
    const metin = await (await net.fetch(kayit.html)).text();
    programDegistir(metin, 'İnternetten indirildi');
  } catch (e) { if (elle) dialog.showErrorBox('Denetlenemedi', 'İnternet bağlantısını kontrol edin.\n' + e.message); }
}

/* ---------- MEBBİS penceresi (veri çekmek için) ---------- */
const MEBBIS_ADRESI = process.env.TASIMA_MEBBIS_TEST || 'https://mebbis.meb.gov.tr/';
const mebbisAyar = () => ({ partition: 'persist:mebbis', contextIsolation: true, sandbox: true, nodeIntegrationInSubFrames: true, preload: path.join(__dirname, 'preload_mebbis.js') });
let mebbisPencere = null, aktarimBekleyen = null;
function mebbisAc() {
  if (mebbisPencere && !mebbisPencere.isDestroyed()) { if (mebbisPencere.isMinimized()) mebbisPencere.restore(); mebbisPencere.focus(); return; }
  mebbisPencere = new BrowserWindow({ width: 1300, height: 860, title: 'MEBBİS — Taşıma ve Nöbet Programı', icon: path.join(__dirname, 'ikon.png'), webPreferences: mebbisAyar() });
  mebbisPencere.loadURL(MEBBIS_ADRESI);
  mebbisPencere.on('closed', () => { mebbisPencere = null; });
}
ipcMain.on('mebbis-ac', () => mebbisAc());
app.on('web-contents-created', (e, wc) => {
  // MEBBİS sayfalarındaki "sayfadan ayrılmak istiyor musunuz" engeli pencerenin/programın kapanmasını durdurmasın
  wc.on('will-prevent-unload', ev => ev.preventDefault());
  // MEBBİS'ten açılan yeni pencereler de aynı oturum ve aynı düğmeyle açılsın
  wc.setWindowOpenHandler(({ url }) => {
    if (wc.session === session.fromPartition('persist:mebbis')) return { action: 'allow', overrideBrowserWindowOptions: { icon: path.join(__dirname, 'ikon.png'), webPreferences: mebbisAyar() } };
    if (/^https?:/i.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
});
/* MEBBİS / e-Devlet penceresi kendini her yönden normal Google Chrome olarak tanıtsın (1.1.6).
   e-Devlet güvenlik duvarı ve karekod girişi, "Electron" ya da program adı geçen tarayıcıları engelliyor.
   1) İstek başlıkları (User-Agent, sec-ch-ua…)  2) Sayfanın JavaScript'ten okuduğu bilgi (navigator.userAgentData) */
const CHROME_TAM = String(process.versions.chrome || '130.0.0.0');
const CHROME_SURUM = CHROME_TAM.split('.')[0];
const CHROME_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_SURUM}.0.0.0 Safari/537.36`;
const CHROME_CH = `"Google Chrome";v="${CHROME_SURUM}", "Chromium";v="${CHROME_SURUM}", "Not?A_Brand";v="99"`;
const CHROME_CH_TAM = `"Google Chrome";v="${CHROME_TAM}", "Chromium";v="${CHROME_TAM}", "Not?A_Brand";v="99.0.0.0"`;
const CHROME_META = {
  brands: [{ brand: 'Google Chrome', version: CHROME_SURUM }, { brand: 'Chromium', version: CHROME_SURUM }, { brand: 'Not?A_Brand', version: '99' }],
  fullVersionList: [{ brand: 'Google Chrome', version: CHROME_TAM }, { brand: 'Chromium', version: CHROME_TAM }, { brand: 'Not?A_Brand', version: '99.0.0.0' }],
  fullVersion: CHROME_TAM, platform: 'Windows', platformVersion: '10.0.0', architecture: 'x86', model: '', mobile: false, bitness: '64', wow64: false
};
const mebbisOturumu = () => session.fromPartition('persist:mebbis');
function mebbisTarayiciAyarla() {
  const ses = mebbisOturumu();
  ses.setUserAgent(CHROME_UA, 'tr-TR,tr,en-US,en');
  ses.webRequest.onBeforeSendHeaders((ayr, geri) => {
    const h = ayr.requestHeaders || {};
    Object.keys(h).forEach(k => {
      const lk = k.toLowerCase();
      if (lk === 'user-agent') h[k] = CHROME_UA;
      else if (lk === 'sec-ch-ua' && !/Google Chrome/.test(h[k])) h[k] = CHROME_CH;
      else if (lk === 'sec-ch-ua-full-version-list' && !/Google Chrome/.test(h[k])) h[k] = CHROME_CH_TAM;
    });
    geri({ requestHeaders: h });
  });
  mebbisKayitKur(ses);
}
/* Sayfa içindeki tarayıcı bilgisi: Chrome'un kendi "tarayıcı kimliği" ayarıyla (DevTools Emulation) */
function mebbisKimlikUygula(wc) {
  try { wc.setUserAgent(CHROME_UA); } catch (x) {}
  const uygula = () => {
    try {
      if (!wc.debugger.isAttached()) wc.debugger.attach('1.3');
      wc.debugger.sendCommand('Emulation.setUserAgentOverride', { userAgent: CHROME_UA, acceptLanguage: 'tr-TR,tr', platform: 'Win32', userAgentMetadata: CHROME_META })
        .catch(x => mebbisKayit('kimlik', 'uygulanamadı: ' + x.message));
    } catch (x) { mebbisKayit('kimlik', 'bağlanamadı: ' + x.message); }
  };
  uygula();
  // geliştirici araçları açılıp kapanınca bağlantı kopabilir: yeniden uygula
  wc.debugger.on('detach', () => setTimeout(() => { if (!wc.isDestroyed()) uygula(); }, 300));
}
app.on('web-contents-created', (e, wc) => {
  if (wc.session !== mebbisOturumu()) return;
  mebbisKimlikUygula(wc);
  mebbisPencereKaydi(wc);
});

/* ---------- MEBBİS giriş sorun kaydı (yalnız adres + hata; şifre, form ve çerez YAZILMAZ) ---------- */
const MEBBIS_KAYIT = [];
const kisaAdres = u => { try { const x = new URL(u); return x.origin + x.pathname; } catch (e) { return String(u || '').split(/[?#]/)[0]; } };
function mebbisKayit(tur, metin) {
  const z = new Date(); const s = n => String(n).padStart(2, '0');
  MEBBIS_KAYIT.push(`${s(z.getHours())}:${s(z.getMinutes())}:${s(z.getSeconds())}  [${tur}]  ${metin}`);
  if (MEBBIS_KAYIT.length > 800) MEBBIS_KAYIT.splice(0, MEBBIS_KAYIT.length - 800);
}
function mebbisKayitKur(ses) {
  ses.webRequest.onCompleted(d => {
    if (d.statusCode >= 400 || d.resourceType === 'mainFrame' || d.resourceType === 'subFrame')
      mebbisKayit(d.statusCode >= 400 ? 'HATA ' + d.statusCode : 'sayfa ' + d.statusCode, `${d.method} ${d.resourceType} ${kisaAdres(d.url)}`);
  });
  ses.webRequest.onErrorOccurred(d => { if (d.error !== 'net::ERR_ABORTED') mebbisKayit('AĞ HATASI', `${d.error} ${d.resourceType} ${kisaAdres(d.url)}`); });
}
function mebbisPencereKaydi(wc) {
  wc.on('did-fail-load', (e, kod, acik, url, ana) => { if (kod !== -3) mebbisKayit('yüklenemedi', `${kod} ${acik} ${ana ? 'ana' : 'çerçeve'} ${kisaAdres(url)}`); });
  wc.on('console-message', (e, duzey, mesaj, satir, kaynak) => { if (duzey >= 2) mebbisKayit(duzey === 3 ? 'konsol HATA' : 'konsol uyarı', `${String(mesaj).slice(0, 300)} (${kisaAdres(kaynak)}:${satir})`); });
  wc.on('render-process-gone', (e, d) => mebbisKayit('ÇÖKTÜ', d.reason));
  wc.on('did-create-window', w => mebbisKayit('yeni pencere', kisaAdres(w.webContents.getURL())));
}
async function mebbisKaydiKaydet() {
  const bilgi = ['Taşıma Programı — MEBBİS giriş sorun kaydı', `Kabuk: ${KABUK_SURUM}   Electron: ${process.versions.electron}   Chrome: ${CHROME_TAM}`, `Tanıtılan tarayıcı: ${CHROME_UA}`, ''];
  for (const w of mebbisPencereleri()) {
    try {
      const t = await w.webContents.executeJavaScript(`(async()=>{const u=navigator.userAgentData;let tam=null;try{tam=u&&await u.getHighEntropyValues(['fullVersionList','platform'])}catch(e){}return JSON.stringify({ua:navigator.userAgent,markalar:u&&u.brands,tam:tam&&tam.fullVersionList,platform:tam&&tam.platform,webdriver:navigator.webdriver,resim:[...document.images].filter(i=>i.offsetWidth>40).map(i=>({adres:String(i.currentSrc||i.src).slice(0,80),genislik:i.naturalWidth,yuklendi:i.complete})),canvas:document.querySelectorAll('canvas').length})})()`);
      bilgi.push(`Pencere: ${w.getTitle()} — ${kisaAdres(w.webContents.getURL())}`, '  ' + t);
    } catch (x) { bilgi.push(`Pencere okunamadı: ${x.message}`); }
  }
  const yol = path.join(yollar().kok, 'mebbis_giris_kaydi.txt');
  try {
    fs.writeFileSync(yol, [...bilgi, '', '--- Olaylar (en eski → en yeni) ---', ...MEBBIS_KAYIT].join('\r\n'), 'utf8');
    const r = await dialog.showMessageBox({ type: 'info', buttons: ['Klasörü aç', 'Tamam'], defaultId: 0, message: 'Giriş sorun kaydı oluşturuldu.', detail: yol + '\n\nBu dosyada yalnız adresler ve hata kodları var; şifre, öğrenci ve form bilgisi yok.' });
    if (r.response === 0) shell.showItemInFolder(yol);
  } catch (x) { dialog.showErrorBox('Kaydedilemedi', x.message); }
}
async function mebbisOturumuTemizle() {
  const r = await dialog.showMessageBox({ type: 'question', buttons: ['Temizle', 'Vazgeç'], defaultId: 0, cancelId: 1,
    message: 'MEBBİS oturumu temizlensin mi?', detail: "MEBBİS ve e-Devlet için saklanan çerezler ve önbellek silinir, MEBBİS penceresi kapanıp yeniden açılır. Programdaki öğrenci ve taşıma verilerinize DOKUNULMAZ.\n\nSonra yeniden giriş yapmanız gerekir." });
  if (r.response !== 0) return;
  mebbisPencereleri().forEach(w => { try { w.destroy(); } catch (x) {} });
  const ses = mebbisOturumu();
  try { await ses.clearStorageData(); await ses.clearCache(); await ses.clearAuthCache(); } catch (x) {}
  MEBBIS_KAYIT.length = 0; mebbisKayit('bilgi', 'oturum temizlendi');
  setTimeout(mebbisAc, 400);
}
function mebbisIndirmeYakala() {
  session.fromPartition('persist:mebbis').on('will-download', (e, item) => {
    global.__dbg && global.__dbg.push('will-download ' + item.getFilename() + ' bekleyen=' + !!aktarimBekleyen);
    if (!aktarimBekleyen || Date.now() - aktarimBekleyen.t > 60000) return;   // elle indirmelere karışma
    const bekleyen = aktarimBekleyen; aktarimBekleyen = null;
    console.log('MEBBİS indirmesi yakalandı:', item.getFilename());
    const hedef = path.join(app.getPath('temp'), `mebbis_${Date.now()}_${item.getFilename()}`);
    item.setSavePath(hedef);
    item.once('done', async (ev, durum) => {
      if (durum !== 'completed') { dialog.showErrorBox('Aktarılamadı', 'MEBBİS listesi indirilemedi.'); return; }
      try {
        const b64 = fs.readFileSync(hedef).toString('base64');
        try { fs.unlinkSync(hedef); } catch (x) {}
        anaPencere.show(); anaPencere.focus();
        await anaPencere.webContents.executeJavaScript(`(async () => {
          const b = Uint8Array.from(atob(${JSON.stringify(b64)}), c => c.charCodeAt(0));
          const f = new File([b], ${JSON.stringify(item.getFilename())});
          showPage('ogrenci-ara');
          const p = document.getElementById('ara-panel-toplu');
          if (p && p.style.display === 'none') araPanelAc('toplu');
          await ilceExcelOku(f);
          if (typeof mebbisOkulAdi === 'function') mebbisOkulAdi(${JSON.stringify(bekleyen.okul || '')});
          const bilgi = document.getElementById('ara-toplu-bilgi');
          if (bilgi) bilgi.innerHTML = ${JSON.stringify('🌐 <b>MEBBİS\'ten alındı</b>' + (bekleyen.sayi ? ' (MEBBİS\'te ' + bekleyen.sayi + ' öğrenci)' : '') + ' · ')} + bilgi.innerHTML;
          return true; })()`);
      } catch (x) { dialog.showErrorBox('Aktarılamadı', 'Liste programa okunamadı.\n' + x.message); }
    });
  });
}
global.__dbg = [];
async function mebbisOgrenciAktar(e) {
  const wc = (e.senderFrame && e.senderFrame.parent) ? e.senderFrame : e.sender;
  aktarimBekleyen = { t: Date.now(), sayi: '' };
  try {
    const sonuc = await wc.executeJavaScript(`(() => {
      const N = t => String(t || '').replace(/\\u0307/g, '').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/\\s+/g, ' ');
      const say = (N(document.body.innerText).match(/kaydi bulunan ogrenci sayisi\\s*:?\\s*(\\d+)/) || [])[1] || '';
      const okul = (((document.body.innerText || '').match(/Sn\\.\\s*([^\\n(]+?)\\s*\\(\\s*(\\d{5,8})\\s*\\)/) || [])[1] || '').trim();
      const uyar = el => el.id !== '__tasima_aktar' && !el.closest('#__tasima_aktar') && /ogrenci listesi indir/.test(N(el.innerText || el.value || el.textContent).trim()) && el.getClientRects().length > 0;
      let d = [...document.querySelectorAll('a,button,input[type=button],input[type=submit],[onclick],[role=button]')].filter(uyar)
        .sort((x, y) => (x.innerText || x.value || '').length - (y.innerText || y.value || '').length)[0];
      if (!d) { const ic = [...document.querySelectorAll('span,div,i,b')].filter(uyar).sort((x, y) => (x.innerText || '').length - (y.innerText || '').length)[0]; d = ic && (ic.closest('a,button,[onclick],[role=button]') || ic); }
      if (!d) return { ok: false, say, okul };
      d.click();
      return { ok: true, say, okul };
    })()`);
    global.__dbg.push('sonuc ' + JSON.stringify(sonuc));
    if (!sonuc || !sonuc.ok) { aktarimBekleyen = null; dialog.showMessageBox({ type: 'warning', message: '"Öğrenci Listesi İndir" düğmesi bulunamadı.', detail: 'Öğrenci Planlama Okul İşlemleri sayfasında Sorgula dedikten sonra tekrar deneyin.' }); return; }
    if (aktarimBekleyen) { aktarimBekleyen.sayi = sonuc.say; aktarimBekleyen.okul = sonuc.okul || ''; }
    const benim = aktarimBekleyen;
    setTimeout(() => { if (aktarimBekleyen && aktarimBekleyen === benim) { aktarimBekleyen = null; dialog.showMessageBox({ type: 'warning', message: 'MEBBİS listeyi göndermedi.', detail: 'Sayfada Sorgula deyip tekrar "Taşıma Programına Aktar" düğmesine basın.' }); } }, 25000);
  } catch (x) { dialog.showErrorBox('Aktarılamadı', x.message); }
}


/* ---------- MEBBİS Taşıma Servis İşlemleri → güzergah/şoför/öğrenci okuma ----------
   Her güzergahın ✏️ penceresini sırayla açar, okur, X ile kapatır.
   "Servis Öğrenci Eşleşmesini kaydet" ya da başka hiçbir kaydet düğmesine dokunmaz. */
const SERVIS_YARDIMCI = `(() => { if (window.__tsr) return true;
  const gor = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const tx = el => String((el && (el.innerText || el.textContent)) || '').replace(/\\s+/g, ' ').trim();
  const PLAKA = /^\\d{2}\\s*[A-ZÇĞİÖŞÜ]{1,3}\\s*\\d{2,5}$/;
  const plk = s => String(s || '').toLocaleUpperCase('tr-TR').replace(/\\s+/g, '');
  function liste() {
    const out = []; let bas = null;
    document.querySelectorAll('tr').forEach(tr => {
      if (tr.closest('#__tasima_aktar')) return;
      const t = tx(tr); const m = t.match(/(\\d+)\\s*\\.?\\s*NOLU\\s+G[ÜU]ZERGAH/i);
      const tds = [...tr.children].filter(c => /^T[DH]$/.test(c.tagName));
      if (m && tds.length <= 3) { bas = { guzNo: m[1], baslik: t.replace(/\\s*ⓘ\\s*$/, ''), maliyet: ((t.match(/Maliyet\\s*No\\s*:?\\s*(\\d+)/i) || [])[1] || '') }; return; }
      const ct = tds.map(tx); const pi = ct.findIndex(x => PLAKA.test(x));
      if (pi < 0 || tds.length < pi + 6) return;
      const son = tds[tds.length - 1];
      let d = son.querySelector('a,button,input[type=image],input[type=button],input[type=submit],[onclick],[role=button]') || son.querySelector('img,i,span');
      if (d && !/^(A|BUTTON|INPUT)$/.test(d.tagName)) d = d.closest('a,button,[onclick],[role=button]') || d;
      const i = out.length; if (d) d.setAttribute('data-tasima-duz', String(i));
      out.push({ i, guzNo: bas ? bas.guzNo : '', baslik: bas ? bas.baslik : '', maliyet: bas ? bas.maliyet : '', plaka: ct[pi], sofor: ct[pi + 1] || '', basT: ct[pi + 2] || '', bitT: ct[pi + 3] || '',
        alma: ct[pi + 4] || '', birak: ct[pi + 5] || '', kapasite: ct[pi + 6] || '', okulYerl: ct[pi + 7] || '', duzVar: !!d });
    });
    return out;
  }
  function modalKok() {
    const grid = [...document.querySelectorAll('[id$="rdOgrenciListe"], .ets01025-popup')].find(gor);
    if (grid) return grid.closest('.RadWindow') || grid.closest('.ets01025-popup') || grid;
    const baslik = [...document.querySelectorAll('em,h1,h2,h3,h4,h5,h6,span,div,label,b,strong,p,td')]
      .filter(e => gor(e) && /^.{0,3}Öğrenci Taşıma Bilgileri$/i.test(tx(e)) && e.children.length <= 2)[0];
    if (!baslik) return null;
    let k = baslik.closest('.RadWindow,.modal-content,.modal,[role=dialog],.ui-dialog,.k-window,.swal2-popup') || baslik;
    while (k.parentElement && !/\b\d{11}\b/.test(k.innerText || '') ) k = k.parentElement;
    return k;
  }
  function renk(el) {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor.match(/\\d+(\\.\\d+)?/g);
      if (c && (c.length < 4 || +c[3] > 0.1)) { const [r, g, b] = c.map(Number); if (g > r + 15 && g > b) return 'yesil'; if (r > g + 15 && r > b) return 'kirmizi'; if (r < 250 || g < 250 || b < 250) return 'gri'; }
      if (e.tagName === 'TR') break;
    }
    return 'gri';
  }
  function etiketDeger(k, ad) {
    const w = [...k.querySelectorAll('.etsFieldWrap')].find(x => tx(x.querySelector('.etsFieldLabel')).toLocaleLowerCase('tr-TR') === ad.toLocaleLowerCase('tr-TR'));
    if (w) { const i = w.querySelector('input:not([type=hidden])'); const v = i ? String(i.value || '').trim() : tx(w).replace(tx(w.querySelector('.etsFieldLabel')), '').trim(); if (v) return v; }
    const s = (k.innerText || '').split(/\\n+/).map(x => x.trim()).filter(Boolean);
    const i = s.findIndex(x => x.replace(/:$/, '').toLocaleLowerCase('tr-TR') === ad.toLocaleLowerCase('tr-TR'));
    return i >= 0 ? (s[i + 1] || '') : '';
  }
  function satirlarTopla(k, harita) {
    k.querySelectorAll('tr').forEach(tr => {
      const tds = [...tr.children].filter(c => c.tagName === 'TD'); if (tds.length < 3) return;
      const ct = tds.map(tx); const ti = ct.findIndex(x => /^\\d{11}$/.test(x)); if (ti < 0) return;
      harita.set(ct[ti], { tc: ct[ti], ad: ct[ti + 1] || '', sinif: ct[ti + 2] || '', sube: ct[ti + 3] || '', durum: /etsRowSelected/.test(tr.className) ? 'yesil' : /etsRowBlocked|etsRowCakis/.test(tr.className) ? 'kirmizi' : /\\bets/.test(tr.className) ? 'gri' : renk(tds[ti]) });
    });
  }
  async function modalOku() {
    const k = modalKok(); if (!k) return null;
    const harita = new Map(); satirlarTopla(k, harita);
    const kaydir = [...k.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY) && e.querySelector('tr'));
    for (const sc of kaydir) {
      const eski = sc.scrollTop;
      for (let y = 0; y <= sc.scrollHeight; y += Math.max(80, sc.clientHeight - 40)) { sc.scrollTop = y; await new Promise(r => setTimeout(r, 120)); satirlarTopla(k, harita); }
      sc.scrollTop = eski;
    }
    const sayi = ad => { const m = (k.innerText || '').match(new RegExp(ad + '[^\\\\n]*\\\\n\\\\s*(\\\\d+)', 'i')); return m ? +m[1] : null; };
    return { sofor: etiketDeger(k, 'Şoför Adı'), plaka: etiketDeger(k, 'Plaka'), basT: etiketDeger(k, 'Araç Başlangıç Tarihi'), bitT: etiketDeger(k, 'Araç Bitiş Tarihi'),
      seciliSayi: sayi('Seçili'), ogrenciler: [...harita.values()] };
  }
  function modalKapat() {
    const k = modalKok(); if (!k) return 'yok';
    const aday = [...k.querySelectorAll('button,a,span,i,[role=button],.close,.btn-close')].filter(e => gor(e) && !/kaydet/i.test(tx(e)) &&
      (/^(×|✕|x|X|Kapat)$/.test(tx(e)) || /close|kapat/i.test((e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className) + ' ' + (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('title') || '')) || e.hasAttribute('data-dismiss') || e.hasAttribute('data-bs-dismiss')));
    const b = aday[0]; if (!b) return 'dugmeyok';
    (b.closest('button,a,[role=button]') || b).click(); return 'tik';
  }
  // ⓘ "Taşıma Merkezi Okullar ve Bölgeler": sayfanın kendi kullandığı salt-okunur sorgu (hiçbir şey kaydetmez)
  async function bolgeler(tih) {
    const v = id => { const e = document.getElementById(id); return e ? parseInt(e.value, 10) || 0 : 0; };
    const govde = JSON.stringify({ pTasinmaKodu: 0, pIhaleID: parseInt(tih, 10) || 0, pIhaleRaw: '', pDonemID: v('hfIhaleInfoDonem'), pIlKodu: v('hfIhaleInfoIlKodu'), pIlceKodu: v('hfIhaleInfoIlceKodu'), pModulNo: v('hfIhaleInfoModul') });
    try {
      const r = await fetch('/ETS/ETS01025.aspx/ETS01025_GetIhaleMerkezBolgeHtml', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: govde, credentials: 'same-origin' });
      const t = await r.text(); let h = t; try { const j = JSON.parse(t); if (j && typeof j.d === 'string') h = j.d; } catch (x) {}
      const d = document.createElement('div'); d.innerHTML = h;
      const satirlar = [...d.querySelectorAll('tr')].map(tr => [...tr.children].map(c => tx(c)));
      return { durum: r.status, html: h.slice(0, 20000), metin: tx(d).slice(0, 4000), satirlar: satirlar.slice(0, 60) };
    } catch (x) { return { hata: String(x && x.message || x) }; }
  }
  function okul() { const m = (document.body.innerText || '').match(/Sn\\.\\s*([^\\n(]+?)\\s*\\(\\s*(\\d{5,8})\\s*\\)/); return m ? m[1].trim() : ''; }
  window.__tsr = { liste, modalKok: () => !!modalKok(), modalOku, modalKapat, plk, bolgeler, okul };
  return true; })()`;
const bekle = ms => new Promise(r => setTimeout(r, ms));
let servisCalisiyor = false;
async function sayfaHataKaydet(wc, neden) {
  try {
    const html = await wc.executeJavaScript('document.documentElement.outerHTML');
    const yol = path.join(yollar().kok, 'mebbis_sayfa.html');
    fs.writeFileSync(yol, '<!-- ' + neden + ' -->\n' + html, 'utf8');
    return yol;
  } catch (e) { return ''; }
}
/* Bir güzergahın ✏️ penceresini açar, öğrencileri okur, kapatır (MEBBİS'te hiçbir şey değişmez) */
async function pencereKapat(js, wcAna) {
  await js('__tsr.modalKapat()').catch(() => {});
  for (let t = 0; t < 10; t++) { await bekle(400); if (!(await js('__tsr.modalKok()').catch(() => false))) break;
    if (t === 5) { wcAna.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); wcAna.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' }); } }
}
async function guzergahAcOku(js, wcAna, g) { const m = await guzergahAc(js, wcAna, g); await pencereKapat(js, wcAna); return m; }
async function guzergahAc(js, wcAna, g) {
  if (await js('__tsr.modalKok()')) await pencereKapat(js, wcAna);
  await js(`document.documentElement.setAttribute('data-tasima-son', ${JSON.stringify(JSON.stringify({ maliyet: g.maliyet || '', no: g.guzNo || '', baslik: g.baslik || '', plaka: g.plaka || '', basT: g.basT || '', t: Date.now() }))})`).catch(() => {});
  let tik = await js(`(() => { const d = document.querySelector('[data-tasima-duz="${g.i}"]'); if (!d) return false; d.click(); return true; })()`);
  if (!tik) { await js('__tsr.liste()'); tik = await js(`(() => { const d = document.querySelector('[data-tasima-duz="${g.i}"]'); if (!d) return false; d.click(); return true; })()`); }
  let m = null, oncekiSay = -1;
  for (let t = 0; t < 60; t++) {           // en çok ~30 sn
    await bekle(500);
    let o = null; try { o = await js('__tsr.modalOku()'); } catch (x) {}
    if (!o || !o.ogrenciler.length) continue;
    if (o.plaka && __plk(o.plaka) !== __plk(g.plaka)) continue;   // önceki aracın penceresi
    if (o.ogrenciler.length === oncekiSay) { m = o; break; }
    oncekiSay = o.ogrenciler.length;
  }
  return m;
}
function guzergahBirlestir(g, m, uyarilar) {
  if (!m) return Object.assign({}, g, { okunamadi: true });
  const yesil = m.ogrenciler.filter(o => o.durum === 'yesil');
  if (m.seciliSayi != null && m.seciliSayi !== yesil.length) uyarilar.push(`${g.guzNo}: MEBBİS "Seçili ${m.seciliSayi}" diyor, ${yesil.length} öğrenci okunabildi`);
  return Object.assign({}, g, { sofor: m.sofor || g.sofor, plaka: m.plaka || g.plaka, basT: m.basT || g.basT, bitT: m.bitT || g.bitT, ogrenciler: m.ogrenciler });
}
// secim: güzergah anahtarları (Set) — verilirse yalnız onlar okunur
async function mebbisServisOku(e, secim) {
  const wc = e.senderFrame || e.sender, wcAna = e.sender;
  if (servisCalisiyor) return; servisCalisiyor = true;
  const hedef = () => (wc && wc.parent) ? wc : wcAna;     // ana sayfaysa her seferinde güncel sayfaya (geri gönderim sonrası yenilenir)
  const js = async kod => { let son; for (let d = 0; d < 6; d++) { try { const h = hedef(); await h.executeJavaScript(SERVIS_YARDIMCI); return await h.executeJavaScript(kod); } catch (x) { son = x; await bekle(800); } } throw son; };
  const durum = t => hedef().executeJavaScript(`(() => { const b = document.getElementById('__tasima_aktar'); if (b) { b.textContent = ${JSON.stringify(t)}; b.disabled = true; } })()`).catch(() => {});
  try {
    let liste = await js('__tsr.liste()');
    if (!liste || !liste.length) {
      const yol = await sayfaHataKaydet(hedef(), 'güzergah satırı bulunamadı');
      dialog.showMessageBox({ type: 'warning', message: 'Güzergah satırları bulunamadı.', detail: 'Taşıma Servis İşlemleri sayfasında Sorgula dedikten sonra tekrar deneyin.' + (yol ? '\n\nSayfa kaydedildi: ' + yol : '') });
      return;
    }
    liste = aktifSatirlar(liste);
    if (secim) liste = liste.filter(g => secim.has(guzAnahtar(g)));
    const sonuc = [], uyarilar = [];
    // önce her güzergahın ⓘ bölge bilgisini al (pencere açmadan)
    const bolge = {};
    for (const g of liste) { if (g.maliyet && !bolge[g.maliyet]) { try { bolge[g.maliyet] = await js(`__tsr.bolgeler(${JSON.stringify(g.maliyet)})`); } catch (x) { bolge[g.maliyet] = { hata: x.message }; } } }
    for (let n = 0; n < liste.length; n++) {
      const g = liste[n]; g.bolge = bolge[g.maliyet] || null;
      await durum(`⏳ ${n + 1}/${liste.length}: ${g.guzNo} nolu güzergah okunuyor…`);
      if (!g.duzVar) { uyarilar.push(`${g.guzNo}: düzenle (✏️) düğmesi bulunamadı`); sonuc.push(Object.assign({}, g, { okunamadi: true })); continue; }
      const m = await guzergahAcOku(js, wcAna, g);
      if (!m) {
        const yol = await sayfaHataKaydet(hedef(), g.guzNo + ' penceresi okunamadı');
        uyarilar.push(`${g.guzNo}: öğrenci penceresi okunamadı` + (yol ? ` (sayfa kaydedildi: ${yol})` : ''));
      }
      sonuc.push(guzergahBirlestir(g, m, uyarilar));
    }
    let okulAdi = ''; try { okulAdi = await js('__tsr.okul()'); } catch (x) {}
    const veri = { kaynak: 'MEBBİS Taşıma Servis İşlemleri', tarih: new Date().toISOString(), okul: okulAdi, guzergahlar: sonuc, uyarilar, kismi: !!secim };
    try { fs.writeFileSync(path.join(yollar().kok, 'mebbis_son_servis.json'), JSON.stringify(veri, null, 1), 'utf8'); } catch (x) {}
    anaPencere.show(); anaPencere.focus();
    const var_ = await anaPencere.webContents.executeJavaScript(`typeof mebbisServisAktar === 'function'`);
    if (!var_) { dialog.showMessageBox(anaPencere, { type: 'warning', message: 'Bu program sürümü güzergah aktarmayı bilmiyor.', detail: 'Programı güncelleyin (Program → Programı dosyadan güncelle).' }); return; }
    await anaPencere.webContents.executeJavaScript(`mebbisServisAktar(${JSON.stringify(veri)})`);
  } catch (x) { dialog.showErrorBox('Aktarılamadı', x.message); }
  finally {
    servisCalisiyor = false;
    hedef().executeJavaScript(`(() => { const b = document.getElementById('__tasima_aktar'); if (b) { b.disabled = false; b.textContent = b.getAttribute('data-etiket') || b.textContent; } })()`).catch(() => {});
  }
}

const __plk = s => String(s || '').toLocaleUpperCase('tr-TR').replace(/\s+/g, '');

/* ---------- GÜZERGAH SEÇİMİ VE İLERLEME ----------
   Kalabalık okullarda bütün güzergahları bir anda okumak yerine seçilen güzergahlar
   tek tek açılır, her biri ayrı onaylanır. Hangi güzergahın bittiği dosyada tutulur;
   kapatıp açınca kaldığı yerden devam edilebilir. */
const guzAnahtar = g => (g.maliyet ? 'm' + g.maliyet : 'g' + g.guzNo) + '|' + __plk(g.plaka);
const isArtisiMi = g => /İŞ\s*ARTI|IS\s*ARTI/i.test(String((g && g.baslik) || ''));
/* Aynı ihalede araç değişince MEBBİS iki satır gösterir: biten aracın ✏️'si yoktur.
   Kullanımdaki (✏️ olan) satır esas alınır, biten araç yalnız bilgi olarak eklenir. */
function aktifSatirlar(L) {
  const out = [];
  (L || []).forEach(g => {
    const kardes = L.filter(x => x !== g && x.maliyet && x.maliyet === g.maliyet && x.guzNo === g.guzNo);
    if (!g.duzVar && kardes.some(x => x.duzVar)) return;            // biten araç: aktif satıra bilgi olarak eklenir
    const biten = g.duzVar ? kardes.filter(x => !x.duzVar).map(x => ({ plaka: x.plaka, sofor: x.sofor, bitT: x.bitT })) : [];
    out.push(Object.assign({}, g, { bitenAraclar: biten }));
  });
  return out;
}
/* Açık ✏️ penceresinin hangi satıra ait olduğu: önce kullanıcının/programın bastığı satır
   (sayfaya yazılan data-tasima-son), yoksa plaka yalnız bir satırda geçiyorsa o satır. */
async function acikGuzergahBul(js, L, m) {
  if (!m) return null;
  let son = null; try { son = JSON.parse(await js("document.documentElement.getAttribute('data-tasima-son') || 'null'")); } catch (x) {}
  const ayni = (L || []).filter(g => __plk(g.plaka) === __plk(m.plaka));
  if (son && son.plaka && __plk(son.plaka) === __plk(m.plaka)) {
    const g = ayni.find(g => (!son.maliyet || g.maliyet === son.maliyet) && (!son.no || String(g.guzNo) === String(son.no)));
    if (g) return g;
  }
  return ayni.length === 1 ? ayni[0] : null;
}
const BELIRSIZ = plaka => ({ type: 'warning', message: 'Açık pencerenin hangi güzergaha ait olduğu anlaşılamadı.', detail: `Bu araç (${plaka || '—'}) MEBBİS'te birden çok güzergahta görünüyor. Pencereyi kapatıp istediğiniz güzergahın ✏️ düğmesine yeniden basın, sonra tekrar deneyin.` });
const ilerlemeYol = () => path.join(yollar().kok, 'mebbis_ilerleme.json');
function ilerlemeOku() { try { const v = JSON.parse(fs.readFileSync(ilerlemeYol(), 'utf8')); return v && typeof v === 'object' ? v : {}; } catch (x) { return {}; } }
function ilerlemeYaz(v) { try { fs.mkdirSync(path.dirname(ilerlemeYol()), { recursive: true }); fs.writeFileSync(ilerlemeYol(), JSON.stringify(v, null, 1), 'utf8'); } catch (x) {} }
function ilerlemeIsaretle(mod, anahtar) {
  if (!anahtar) return; const v = ilerlemeOku(); const k = v[mod]; if (!k) return;
  k.biten = k.biten || {}; k.biten[anahtar] = new Date().toISOString(); ilerlemeYaz(v);
}
function jsYap(hedef, bekleme) {
  return async kod => { let son; for (let d = 0; d < 6; d++) { try { const h = hedef(); await h.executeJavaScript(SERVIS_YARDIMCI); return await h.executeJavaScript(kod); } catch (x) { son = x; await bekle(bekleme || 700); } } throw son; };
}
let secimCerceve = null;    // güzergah listesinin bulunduğu çerçeve (seçim penceresi açılınca bulunur)
ipcMain.handle('mebbis-guzergah-liste', async e => {
  const w = BrowserWindow.fromWebContents(e.sender);
  const bul = await mebbisCerceveBul(w, /nolu guzergah/);
  if (!bul) return { hata: 'sayfa' };
  secimCerceve = bul;
  const hedef = () => (bul.senderFrame && bul.senderFrame.parent) ? bul.senderFrame : bul.sender;
  try {
    const js = jsYap(hedef);
    const L = await js('__tsr.liste()');
    let okul = ''; try { okul = await js('__tsr.okul()'); } catch (x) {}
    const ilerleme = ilerlemeOku();
    Object.keys(ilerleme).forEach(k => { if (ilerleme[k] && ilerleme[k].okul && okul && ilerleme[k].okul !== okul) delete ilerleme[k]; });   // başka okulun turu
    return { liste: aktifSatirlar(L).map(g => ({ anahtar: guzAnahtar(g), guzNo: g.guzNo, baslik: g.baslik, plaka: g.plaka, sofor: g.sofor, kapasite: g.kapasite, bitenAraclar: g.bitenAraclar })), okul, ilerleme };
  } catch (x) { return { hata: x.message }; }
});
ipcMain.on('mebbis-ilerleme-sifirla', (e, mod) => { const v = ilerlemeOku(); delete v[mod]; ilerlemeYaz(v); });
// o: { mod: 'al' | 'yer', anahtarlar: [...], tekListe: bool, okul }
ipcMain.on('mebbis-guzergah-basla', async (e, o) => {
  const bul = secimCerceve; if (!bul || !o || !Array.isArray(o.anahtarlar) || !o.anahtarlar.length) return;
  if (o.mod === 'al' && o.tekListe) { mebbisServisOku(bul, new Set(o.anahtarlar)); return; }
  const v = ilerlemeOku(); const eski = (v[o.mod] && v[o.mod].biten) || {};
  const biten = {}; Object.keys(eski).forEach(k => { if (!o.anahtarlar.includes(k)) biten[k] = eski[k]; });   // yeniden seçilenlerin ✔'i silinir
  v[o.mod] = { okul: o.okul || '', tarih: new Date().toISOString(), kuyruk: o.anahtarlar.slice(), biten }; ilerlemeYaz(v);
  const wc = (bul.senderFrame && bul.senderFrame.parent) ? bul.senderFrame : bul.sender;
  const ctx = { wc, ana: bul.sender, kuyruk: o.anahtarlar.slice(), pos: 0, sonuclar: [] };
  if (o.mod === 'al') { servisTurCtx = ctx; servisTurGoster(ctx, 'ac'); }
  else { yerlestirCtx = ctx; yerlestirGoster(ctx, 'kuyruk'); }
});

/* ---------- 📥 GÜZERGAH GÜZERGAH PROGRAMA AL: seçilen güzergahlar tek tek okunur, her biri programda ayrı onaylanır ---------- */
let servisTurCtx = null;
async function servisTurGoster(ctx, mod) {
  const hedef = () => (ctx.wc && ctx.wc.parent) ? ctx.wc : ctx.ana;
  const js = jsYap(hedef, 800);
  if (servisCalisiyor) return; servisCalisiyor = true;
  try {
    if (mod === 'siradaki') ctx.pos++;
    const L = await js('__tsr.liste()');
    if (!L || !L.length) { dialog.showMessageBox({ type: 'info', message: 'Güzergah listesi bulunamadı.', detail: "MEBBİS'te Taşıma Servis İşlemleri sayfasında Sorgula deyin, güzergahlar görününce tekrar deneyin." }); return; }
    let g = null; const atlanan = [];
    while (ctx.pos < ctx.kuyruk.length) { g = L.find(x => guzAnahtar(x) === ctx.kuyruk[ctx.pos]); if (g && g.duzVar) break; atlanan.push(ctx.kuyruk[ctx.pos]); g = null; ctx.pos++; }
    if (atlanan.length) ctx.sonuclar.push(`MEBBİS sayfasında bulunamayan/açılamayan ${atlanan.length} güzergah atlandı`);
    if (!g) {
      servisTurCtx = null;
      anaPencere.show(); anaPencere.focus();
      const ok = await anaPencere.webContents.executeJavaScript(`typeof mebbisTurBitti === 'function'`).catch(() => false);
      if (ok) await anaPencere.webContents.executeJavaScript(`mebbisTurBitti(${JSON.stringify({ toplam: ctx.kuyruk.length, notlar: ctx.sonuclar })})`);
      else dialog.showMessageBox(anaPencere, { type: 'info', message: 'Seçilen güzergahların hepsi bitti.' });
      return;
    }
    hedef().executeJavaScript(`(() => { const b = document.getElementById('__tasima_aktar'); if (b) { b.disabled = true; b.innerHTML = ${JSON.stringify('⏳<br>')} + ${JSON.stringify(String(ctx.pos + 1) + '/' + ctx.kuyruk.length + ' okunuyor')}; } })()`).catch(() => {});
    let bolge = null; if (g.maliyet) { try { bolge = await js(`__tsr.bolgeler(${JSON.stringify(g.maliyet)})`); } catch (x) { bolge = { hata: x.message }; } }
    g.bolge = bolge;
    const m = await guzergahAcOku(js, ctx.ana, g);
    const uyarilar = [];
    if (!m) { const yol = await sayfaHataKaydet(hedef(), g.guzNo + ' penceresi okunamadı'); uyarilar.push(`${g.guzNo}: öğrenci penceresi okunamadı` + (yol ? ` (sayfa kaydedildi: ${yol})` : '')); }
    let okul = ''; try { okul = await js('__tsr.okul()'); } catch (x) {}
    ctx.sonAnahtar = guzAnahtar(g);
    const veri = { kaynak: 'MEBBİS Taşıma Servis İşlemleri', tarih: new Date().toISOString(), okul, guzergahlar: [guzergahBirlestir(g, m, uyarilar)], uyarilar, kismi: true,
      sira: ctx.pos + 1, toplam: ctx.kuyruk.length, siradakiVar: true };
    anaPencere.show(); anaPencere.focus();
    await anaPencere.webContents.executeJavaScript(`mebbisServisAktar(${JSON.stringify(veri)})`);
  } catch (x) { dialog.showErrorBox('Güzergah okunamadı', x.message); }
  finally {
    servisCalisiyor = false;
    hedef().executeJavaScript(`(() => { const b = document.getElementById('__tasima_aktar'); if (b) { b.disabled = false; b.innerHTML = b.getAttribute('data-html') || b.innerHTML; } })()`).catch(() => {});
  }
}
// program: { bitti: bu güzergah tamamlandı mı, dur: turu bırak }
ipcMain.on('mebbis-servis-siradaki', (e, o) => {
  const ctx = servisTurCtx; if (!ctx) return;
  o = o || {};
  if (o.bitti) ilerlemeIsaretle('al', ctx.sonAnahtar);
  if (o.not) ctx.sonuclar.push(String(o.not));
  if (o.dur) { servisTurCtx = null; return; }
  servisTurGoster(ctx, 'siradaki');
});

/* ---------- 📥 AÇIK GÜZERGAHI PROGRAMA AL (✏️ penceresi açıkken) ---------- */
ipcMain.on('mebbis-bu-guzergah-al', async e => {
  const wc = (e.senderFrame && e.senderFrame.parent) ? e.senderFrame : e.sender;
  const ana = e.sender;
  let hedefWc = wc;
  try {
    const js = jsYap(() => hedefWc);
    let m = null; try { m = await js('__tsr.modalOku()'); } catch (x) {}
    if (!m || !m.ogrenciler || !m.ogrenciler.length) {      // pencere başka çerçevede olabilir
      const bul = await mebbisCerceveBul(BrowserWindow.fromWebContents(ana), /ogrenci tasima bilgileri|nolu guzergah/);
      if (bul) { hedefWc = (bul.senderFrame && bul.senderFrame.parent) ? bul.senderFrame : bul.sender; try { m = await js('__tsr.modalOku()'); } catch (x) {} }
    }
    if (!m || !m.ogrenciler || !m.ogrenciler.length) { dialog.showMessageBox({ type: 'info', message: 'Açık bir güzergah penceresi bulunamadı.', detail: "MEBBİS'te Taşıma Servis İşlemleri'nde bir güzergahın ✏️ penceresini açın, sonra tekrar deneyin." }); return; }
    const L = await js('__tsr.liste()');
    const g = await acikGuzergahBul(js, L, m);
    if (!g) { dialog.showMessageBox(BELIRSIZ(m.plaka)); return; }
    if (g.maliyet) { try { g.bolge = await js(`__tsr.bolgeler(${JSON.stringify(g.maliyet)})`); } catch (x) {} }
    let okul = ''; try { okul = await js('__tsr.okul()'); } catch (x) {}
    const uyarilar = [];
    const veri = { kaynak: 'MEBBİS Taşıma Servis İşlemleri', tarih: new Date().toISOString(), okul, guzergahlar: [guzergahBirlestir(g, m, uyarilar)], uyarilar, kismi: true };
    anaPencere.show(); anaPencere.focus();
    await anaPencere.webContents.executeJavaScript(`mebbisServisAktar(${JSON.stringify(veri)})`);
  } catch (x) { dialog.showErrorBox('Okunamadı', x.message); }
});

/* ---------- PROGRAMDAN GÜZERGAHA YERLEŞTİR: güzergahlar sırayla açılır, her biri programla karşılaştırılır ----------
   ctx.kuyruk varsa yalnız seçilen güzergahlar (seçim penceresinden), yoksa sayfadaki bütün güzergahlar. */
let yerlestirCtx = null;
async function yerlestirGoster(ctx, mod) {
  const hedef = () => (ctx.wc && ctx.wc.parent) ? ctx.wc : ctx.ana;
  const js = jsYap(hedef);
  try {
    let L = await js('__tsr.liste()');
    if (!L || !L.length) { dialog.showMessageBox({ type: 'info', message: 'Güzergah listesi bulunamadı.', detail: "MEBBİS'te Taşıma Servis İşlemleri sayfasında Sorgula deyin, güzergahlar görününce tekrar deneyin." }); return; }
    L = aktifSatirlar(L);
    let m = (await js('__tsr.modalKok()')) ? await js('__tsr.modalOku()') : null;
    let gSec = null, ac = null;
    const sonGeldi = async detay => {
      const r = await dialog.showMessageBox(anaPencere, { type: 'info', message: ctx.kuyruk ? 'Seçilen güzergahların sonuna gelindi.' : 'Son güzergaha gelindi.', detail: detay + ' Başka araçtan çıkarıldığı için eklenemeyen öğrenci kaldıysa baştan bir tur daha yapın (ikinci turda eklenir).', buttons: ['Baştan bir tur daha', 'Bitir'], defaultId: 1, cancelId: 1 });
      if (r.response === 0) return yerlestirGoster(ctx, 'bastan');
      yerlestirCtx = null;
    };
    const aciktaki = m ? await acikGuzergahBul(js, L, m) : null;
    if (ctx.kuyruk) {
      if (mod === 'siradaki') ctx.pos++;
      if (mod === 'bastan') ctx.pos = 0;
      let t = null;
      while (ctx.pos < ctx.kuyruk.length && (!(t = L.find(g => guzAnahtar(g) === ctx.kuyruk[ctx.pos])) || !t.duzVar)) ctx.pos++;
      if (ctx.pos >= ctx.kuyruk.length) return sonGeldi(`Seçilen ${ctx.kuyruk.length} güzergah sırayla açıldı.`);
      if (aciktaki && guzAnahtar(aciktaki) === guzAnahtar(t)) gSec = t; else ac = t;
    } else {
      if (m && mod !== 'siradaki' && mod !== 'bastan') {
        if (!aciktaki) { dialog.showMessageBox(BELIRSIZ(m.plaka)); return; }
        gSec = aciktaki;
      } else {
        const i = mod === 'bastan' ? -1 : (ctx.sonAnahtar ? L.findIndex(g => guzAnahtar(g) === ctx.sonAnahtar) : -1);
        const k = mod === 'bastan' ? 0 : (mod === 'siradaki' ? i + 1 : Math.max(0, i));
        if (k >= L.length) return sonGeldi('Bütün güzergahlar sırayla açıldı.');
        ac = L[k];
      }
    }
    if (!gSec) {
      const g = ac; if (!g || !g.duzVar) { dialog.showMessageBox({ type: 'warning', message: `${g ? g.guzNo : ''} nolu güzergahın düzenle (✏️) düğmesi bulunamadı.` }); return; }
      m = await guzergahAc(js, ctx.ana, g);
      if (!m) { dialog.showMessageBox({ type: 'warning', message: `${g.guzNo} nolu güzergahın öğrenci penceresi okunamadı.`, detail: 'Pencereyi kendiniz açıp tekrar 📤 düğmesine basın.' }); return; }
      gSec = g;
    }
    const g = gSec;
    const sira = ctx.kuyruk ? ctx.pos : L.indexOf(g);
    ctx.sonPlaka = m.plaka; ctx.sonAnahtar = guzAnahtar(g); ctx.aktif = true; yerlestirCtx = ctx;
    sonMebbis = { wc: hedef(), ana: ctx.ana };
    const veri = { guzNo: g.guzNo || '', plaka: m.plaka, sofor: m.sofor, ogrenciler: m.ogrenciler, kapasite: g.kapasite || '', maliyet: g.maliyet || '', isArtisi: isArtisiMi(g), baslik: g.baslik || '', yon: 'm', sira: sira + 1, toplam: ctx.kuyruk ? ctx.kuyruk.length : L.length, siradakiVar: true };
    anaPencere.show(); anaPencere.focus();
    await anaPencere.webContents.executeJavaScript(`mebbisTekKarsilastir(${JSON.stringify(veri)})`);
  } catch (x) { dialog.showErrorBox('Yerleştirme', x.message); }
}
ipcMain.on('mebbis-yerlestir', e => {
  const wc = (e.senderFrame && e.senderFrame.parent) ? e.senderFrame : e.sender;
  yerlestirGoster({ wc, ana: e.sender }, 'ac');
});
// program: o = { bitti } — bu güzergah tamamlandıysa ilerlemeye işlenir
ipcMain.on('mebbis-siradaki', (e, o) => {
  if (!yerlestirCtx) { dialog.showMessageBox(anaPencere, { type: 'info', message: "MEBBİS'te Taşıma Servis İşlemleri sayfasında 📤 Programdan güzergaha yerleştir düğmesine basın." }); return; }
  if (o && o.bitti && yerlestirCtx.kuyruk) ilerlemeIsaretle('yer', yerlestirCtx.sonAnahtar);
  yerlestirGoster(yerlestirCtx, 'siradaki');
});

ipcMain.on('mebbis-aktar', e => mebbisOgrenciAktar(e));
/* prompt() masaüstünde çalışmaz: aynı işi gören küçük pencere. Sayfa cevap gelene kadar bekler. */
ipcMain.on('istem', (e, mesaj, varsayilan) => {
  const ust = BrowserWindow.fromWebContents(e.sender) || anaPencere;
  const satir = String(mesaj || '').split('\n').length;
  const w = new BrowserWindow({ parent: ust, modal: true, width: 480, height: Math.min(640, 175 + satir * 19), resizable: false, minimizable: false, maximizable: false, show: false, title: 'Taşıma Programı', autoHideMenuBar: true, icon: path.join(__dirname, 'ikon.png'), webPreferences: { contextIsolation: true, sandbox: true } });
  w.setMenuBarVisibility(false);
  let bitti = false;
  const bitir = v => { if (bitti) return; bitti = true; e.returnValue = v; if (!w.isDestroyed()) w.destroy(); };
  w.on('page-title-updated', (ev, t) => { ev.preventDefault(); if (t.startsWith('TAMAM:')) bitir(decodeURIComponent(t.slice(6))); else if (t === 'IPTAL') bitir(null); });
  w.on('closed', () => bitir(null));
  const kac = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>istem</title><style>body{font:14px "Segoe UI",sans-serif;margin:0;padding:14px 16px;background:#fff;color:#0f172a}#m{white-space:pre-wrap;margin-bottom:10px;max-height:440px;overflow:auto}input{width:100%;box-sizing:border-box;padding:8px;font-size:15px;border:1px solid #94a3b8;border-radius:6px}.b{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}button{padding:8px 16px;border:0;border-radius:6px;font-weight:700;cursor:pointer;font-size:14px}#t{background:#0e7490;color:#fff}#v{background:#e2e8f0}</style></head><body>
    <div id="m">${kac(mesaj)}</div><input id="g" value="${kac(varsayilan)}"><div class="b"><button id="v">Vazgeç</button><button id="t">Tamam</button></div>
    <script>const g=document.getElementById('g');g.focus();g.select();const ok=()=>{document.title='TAMAM:'+encodeURIComponent(g.value)};const no=()=>{document.title='IPTAL'};document.getElementById('t').onclick=ok;document.getElementById('v').onclick=no;g.addEventListener('keydown',x=>{if(x.key==='Enter')ok();if(x.key==='Escape')no()});document.addEventListener('keydown',x=>{if(x.key==='Escape')no()});</script></body></html>`;
  w.once('ready-to-show', () => w.show());
  w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
});
/* Programdaki "Yükle / Dosya seç": pencere İndirilenler klasöründe açılır, seçilen dosyalar sayfaya verilir */
ipcMain.on('dosya-sec', (e, o) => {
  try {
    const kabul = String((o && o.accept) || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    let uz = [];
    kabul.forEach(k => { if (k.startsWith('.')) uz.push(k.slice(1)); else if (k === 'image/*') uz.push('png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'); else if (k.includes('json')) uz.push('json'); else if (k.includes('sheet') || k.includes('excel')) uz.push('xlsx', 'xls'); else if (k.includes('pdf')) uz.push('pdf'); else if (k.includes('html')) uz.push('html', 'htm'); });
    uz = [...new Set(uz)];
    const filtre = uz.length ? [{ name: 'Uygun dosyalar', extensions: uz }, { name: 'Tüm dosyalar', extensions: ['*'] }] : [{ name: 'Tüm dosyalar', extensions: ['*'] }];
    const kl = yollar().indir; try { fs.mkdirSync(kl, { recursive: true }); } catch (x) {}
    const w = BrowserWindow.fromWebContents(e.sender) || anaPencere;
    const L = dialog.showOpenDialogSync(w, { title: 'Dosya seçin', defaultPath: kl, filters: filtre, properties: (o && o.multiple) ? ['openFile', 'multiSelections'] : ['openFile'] }) || [];
    e.returnValue = L.map(p => ({ ad: path.basename(p), veri: fs.readFileSync(p), tur: '', zaman: fs.statSync(p).mtimeMs }));
  } catch (x) { e.returnValue = null; }
});
ipcMain.on('indirilenleri-ac', () => { try { fs.mkdirSync(yollar().indir, { recursive: true }); shell.openPath(yollar().indir); } catch (x) {} });
/* Taşıma Araç Şoför Puantaj İşlemleri (ETS01010): her araç satırı "plaka / şoför / telefon / alma - okuldan alma" ve title = maliyet no */
const SOFOR_OKU_JS = `(() => [...document.querySelectorAll('a[id$="_btnArac"]')].map(a => {
  const p = (a.innerHTML || '').split(/<br\\s*\\/?>/i).map(x => x.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
  const s = (p[3] || '').match(/(\\d{1,2}:\\d{2})\\s*-\\s*(\\d{1,2}:\\d{2})/) || [];
  return { maliyet: a.title || '', plaka: p[0] || '', sofor: p[1] || '', telefon: p[2] || '', alma: s[1] || '', birak: s[2] || '' };
}).filter(x => x.plaka || x.sofor))()`;
async function mebbisSoforOku(odak) {
  let liste = null;
  for (const w of mebbisPencereleri(odak)) {
    let cerceveler = []; try { cerceveler = w.webContents.mainFrame.framesInSubtree; } catch (x) { cerceveler = [w.webContents.mainFrame]; }
    for (const f of cerceveler) { try { const l = await f.executeJavaScript(SOFOR_OKU_JS); if (l && l.length) { liste = l; break; } } catch (x) {} }
    if (liste) break;
  }
  if (!liste) { dialog.showMessageBox({ type: 'info', message: 'Şoför puantaj sayfası bulunamadı.', detail: "MEBBİS'te Taşımalı Öğrenci Modülü → İlkokul-Orta Okul Taşıma İşlemleri → Taşıma Araç Şoför Puantaj İşlemleri sayfasını açın, araçlar görününce tekrar deneyin." }); return; }
  anaPencere.show(); anaPencere.focus();
  const var_ = await anaPencere.webContents.executeJavaScript(`typeof mebbisSoforAktar === 'function'`);
  if (!var_) { dialog.showMessageBox(anaPencere, { type: 'warning', message: 'Bu program sürümü şoför aktarmasını bilmiyor.', detail: 'Program → Güncellemeleri denetle ile programı güncelleyin.' }); return; }
  await anaPencere.webContents.executeJavaScript(`mebbisSoforAktar(${JSON.stringify({ soforler: liste })})`);
}
/* e-Personel Modülü → Personel Arama (PER00001): yalnız ad, soyad, görev, alan (branş) alınır */
const PERSONEL_OKU_JS = `(() => {
  const tb = document.getElementById('gvPersonelAra'); if (!tb) return null;
  const tx = el => String((el && (el.innerText || el.textContent)) || '').replace(/\\s+/g, ' ').trim();
  const satirlar = [...tb.querySelectorAll('tr')];
  const bas = satirlar.find(r => r.querySelector('th')) || satirlar[0]; if (!bas) return [];
  const B = [...bas.children].map(tx);
  const i = ad => B.findIndex(h => h.toLocaleLowerCase('tr-TR') === ad);
  const ia = i('adı'), is = i('soyadı'), ig = i('görevi'), ial = i('alanı'), id = i('durumu'), ik = i('kadro ünvanı'), iy = i('görev yeri'), ic = i('cinsiyeti');
  if (ia < 0 || is < 0) return [];
  return satirlar.filter(r => r !== bas && r.querySelectorAll('td').length >= B.length - 1).map(r => {
    const c = [...r.children].map(tx);
    return { ad: c[ia] || '', soyad: c[is] || '', gorev: ig >= 0 ? c[ig] : '', brans: ial >= 0 ? c[ial] : '', durum: id >= 0 ? c[id] : '', unvan: ik >= 0 ? c[ik] : '', gorevYeri: iy >= 0 ? c[iy] : '', cinsiyet: ic >= 0 ? c[ic] : '' };
  }).filter(x => x.ad || x.soyad);
})()`;
async function mebbisPersonelOku(odak) {
  let liste = null;
  for (const w of mebbisPencereleri(odak)) {
    let cerceveler = []; try { cerceveler = w.webContents.mainFrame.framesInSubtree; } catch (x) { cerceveler = [w.webContents.mainFrame]; }
    for (const f of cerceveler) { try { const l = await f.executeJavaScript(PERSONEL_OKU_JS); if (l && l.length) { liste = l; break; } } catch (x) {} }
    if (liste) break;
  }
  if (!liste) { dialog.showMessageBox({ type: 'info', message: 'Personel listesi bulunamadı.', detail: "MEBBİS'te e-Personel Modülü → Personel Arama sayfasında Durumu: Görevde seçili iken Ara'ya basın, liste görününce tekrar deneyin." }); return; }
  anaPencere.show(); anaPencere.focus();
  const var_ = await anaPencere.webContents.executeJavaScript(`typeof mebbisPersonelAktar === 'function'`);
  if (!var_) { dialog.showMessageBox(anaPencere, { type: 'warning', message: 'Bu program sürümü personel aktarmasını bilmiyor.', detail: 'Program → Güncellemeleri denetle ile programı güncelleyin.' }); return; }
  await anaPencere.webContents.executeJavaScript(`mebbisPersonelAktar(${JSON.stringify({ personel: liste })})`);
}
ipcMain.on('mebbis-personel-aktar', e => mebbisPersonelOku(BrowserWindow.fromWebContents(e.sender)));
ipcMain.on('mebbis-sofor-aktar', e => mebbisSoforOku(BrowserWindow.fromWebContents(e.sender)));
ipcMain.on('mebbis-servis-aktar', e => mebbisServisOku(e));
ipcMain.on('mebbis-rehber-ogrenci', e => menudenOgrenci(null, BrowserWindow.fromWebContents(e.sender)));
ipcMain.on('mebbis-rehber-servis', async e => {
  const w = BrowserWindow.fromWebContents(e.sender);
  const sifirla = () => e.sender.executeJavaScript(`(() => { const b = document.getElementById('__tasima_aktar'); if (b) { b.disabled = false; b.textContent = b.getAttribute('data-etiket'); } })()`).catch(() => {});
  if (servisCalisiyor) return;
  const bulundu = await mebbisCerceveBul(w, /nolu guzergah/);
  if (!bulundu) { sifirla(); dialog.showMessageBox({ type: 'info', message: 'Taşıma Servis İşlemleri sayfası bulunamadı.', detail: "MEBBİS'te Taşıma Servis İşlemleri sayfasını açıp Sorgula deyin, güzergahlar gelince tekrar deneyin." }); return; }
  mebbisServisOku(bulundu);
});
/* Menüden: düğme çıkmasa da çalışsın — açık MEBBİS penceresinde, içindeki çerçeveler dahil sayfayı bulur */
const __N = t => String(t || '').replace(/\u0307/g, '').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/\s+/g, ' ');
function mebbisPencereleri(odak) {
  const m = session.fromPartition('persist:mebbis');
  const L = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed() && w.webContents.session === m);
  if (odak && L.includes(odak)) return [odak, ...L.filter(w => w !== odak)];
  return L;
}
async function mebbisCerceveBul(odak, desen) {
  for (const w of mebbisPencereleri(odak)) {
    let cerceveler = []; try { cerceveler = w.webContents.mainFrame.framesInSubtree; } catch (x) { cerceveler = [w.webContents.mainFrame]; }
    for (const f of cerceveler) {
      try { const t = await f.executeJavaScript('document.body ? (document.body.innerText || "") + " " + (document.body.textContent || "") + " " + [...document.querySelectorAll("input[type=button],input[type=submit],button")].map(x => x.value || x.title || "").join(" ") : ""'); if (desen.test(__N(t))) return { senderFrame: f, sender: w.webContents }; } catch (x) {}
    }
  }
  return null;
}
async function menudenOgrenci(item, odak) {
  const e = await mebbisCerceveBul(odak, /ogrenci listesi indir/);
  if (!e) { dialog.showMessageBox({ type: 'info', message: 'Öğrenci listesi sayfası bulunamadı.', detail: "MEBBİS'te Diğer Taşıma İşlemleri → Öğrenci Planlama Okul İşlemleri sayfasını açıp Sorgula deyin, liste gelince tekrar deneyin." }); return; }
  mebbisOgrenciAktar(e);
}
async function menudenServis(item, odak) {
  const e = await mebbisCerceveBul(odak, /nolu guzergah/);
  if (!e) { dialog.showMessageBox({ type: 'info', message: 'Taşıma Servis İşlemleri sayfası bulunamadı.', detail: "MEBBİS'te Taşıma Servis İşlemleri sayfasını açıp Sorgula deyin, güzergahlar gelince tekrar deneyin." }); return; }
  try { const w = BrowserWindow.fromWebContents(e.sender); if (w) { w.show(); w.focus(); } e.sender.send('tasima-guzergah-sec', 'al'); }   // güzergah seçme penceresi
  catch (x) { mebbisServisOku(e); }
}
async function mebbisSayfaKaydet(item, odak) {
  const parca = [];
  for (const w of mebbisPencereleri(odak)) {
    let cerceveler = []; try { cerceveler = w.webContents.mainFrame.framesInSubtree; } catch (x) { cerceveler = [w.webContents.mainFrame]; }
    for (const f of cerceveler) { try { parca.push(`<!-- ===== PENCERE: ${w.getTitle()} | ÇERÇEVE: ${f.url} ===== -->\n` + await f.executeJavaScript('document.documentElement.outerHTML')); } catch (x) { parca.push(`<!-- okunamadı ${f.url}: ${x.message} -->`); } }
  }
  const yol = path.join(yollar().kok, 'mebbis_sayfa.html');
  try { fs.writeFileSync(yol, parca.join('\n\n'), 'utf8'); dialog.showMessageBox({ type: 'info', message: 'MEBBİS sayfası kaydedildi.', detail: yol }); }
  catch (x) { dialog.showErrorBox('Kaydedilemedi', x.message); }
}

/* ---------- TEK GÜZERGAH: karşılaştır ve MEBBİS'te ✔ işaretlerini ayarla (KAYDETMEZ) ---------- */
let sonMebbis = null;
ipcMain.on('mebbis-tek-karsilastir', async e => {
  const wc = (e.senderFrame && e.senderFrame.parent) ? e.senderFrame : e.sender;
  sonMebbis = { wc, ana: e.sender };
  try {
    await wc.executeJavaScript(SERVIS_YARDIMCI);
    const m = await wc.executeJavaScript('__tsr.modalOku()');
    if (!m || !m.ogrenciler.length) { dialog.showMessageBox({ type: 'info', message: 'Açık bir güzergah penceresi bulunamadı.', detail: "MEBBİS'te Taşıma Servis İşlemleri'nde bir güzergahın ✏️ (Servis Bilgisi Düzenle) penceresini açın, sonra tekrar deneyin." }); return; }
    const L = await wc.executeJavaScript('__tsr.liste()');
    const g = await acikGuzergahBul(c => wc.executeJavaScript(c), L, m);
    if (!g) { dialog.showMessageBox(BELIRSIZ(m.plaka)); return; }
    const veri = { guzNo: g.guzNo, plaka: m.plaka, sofor: m.sofor, ogrenciler: m.ogrenciler, kapasite: g.kapasite, maliyet: g.maliyet, isArtisi: isArtisiMi(g), baslik: g.baslik };
    anaPencere.show(); anaPencere.focus();
    const var_ = await anaPencere.webContents.executeJavaScript(`typeof mebbisTekKarsilastir === 'function'`);
    if (!var_) { dialog.showMessageBox(anaPencere, { type: 'warning', message: 'Bu program sürümü tek güzergah karşılaştırmasını bilmiyor.', detail: 'Programı güncelleyin.' }); return; }
    await anaPencere.webContents.executeJavaScript(`mebbisTekKarsilastir(${JSON.stringify(veri)})`);
  } catch (x) { dialog.showErrorBox('Okunamadı', x.message); }
});
const ISARETLE_JS = plan => `(async () => {
  const plan = ${JSON.stringify(plan)};
  const gor = el => !!el && el.getClientRects().length > 0;
  const tx = el => String((el && (el.innerText || el.textContent)) || '').replace(/\\s+/g, ' ').trim();
  const kok = [...document.querySelectorAll('[id$="rdOgrenciListe"]')].find(gor);
  if (!kok) return { hata: 'pencere' };
  const plakaEl = document.querySelector('[id$="txtPlaka"]');
  const plk = s => String(s || '').toLocaleUpperCase('tr-TR').replace(/\\s+/g, '');
  if (plakaEl && plan.plaka && plk(plakaEl.value) !== plk(plan.plaka)) return { hata: 'plaka', acik: plakaEl.value };
  let son = null; try { son = JSON.parse(document.documentElement.getAttribute('data-tasima-son') || 'null'); } catch (e) {}
  if (plan.maliyet && son && son.maliyet && son.maliyet !== plan.maliyet) return { hata: 'ihale', acik: (son.no || '') + ' (ihale no ' + son.maliyet + ')' };
  const satir = tc => [...kok.querySelectorAll('tr')].find(tr => { const td = tr.querySelector('td'); return td && tx(td) === tc; });
  const durum = b => { try { return JSON.parse(b.querySelector('input[id$="_ClientState"]').value).checked === true; } catch (e) { return null; } };
  const sonuc = { tamam: [], olmadi: [] };
  const isle = async (k, ister) => {
    const tr = satir(k.tc); if (!tr) { sonuc.olmadi.push(k.ad + ' (listede yok)'); return; }
    const b = tr.querySelector('[id$="btnSelect"]'); if (!b) { sonuc.olmadi.push(k.ad + ' (düğme yok)'); return; }
    if (b.classList.contains('rbDisabled') || b.getAttribute('disabled')) { sonuc.olmadi.push(k.ad + ' (başka araçta, seçilemez)'); return; }
    if (durum(b) !== ister) { b.click(); await new Promise(r => setTimeout(r, 150)); }
    if (durum(b) === ister) { sonuc.tamam.push(k.ad); tr.style.outline = '3px solid ' + (ister ? '#16a34a' : '#dc2626'); tr.style.outlineOffset = '-3px'; }
    else sonuc.olmadi.push(k.ad + ' (işaret değişmedi)');
  };
  for (const k of plan.cikar) await isle(k, false);             // önce çıkar: araçta yer açılsın
  const seciliSay = () => [...kok.querySelectorAll('[id$="btnSelect"]')].filter(b => durum(b) === true).length;
  sonuc.kapasiteDisi = [];
  for (const k of plan.ekle) {
    if (plan.kapasite > 0 && seciliSay() >= plan.kapasite) { sonuc.kapasiteDisi.push(k.ad); continue; }   // ihale kapasitesi aşılmaz
    await isle(k, true);
  }
  if (plan.kaydet) {
    const btn = document.querySelector('[id$="wndOgrenci_C_btnSave"]') || [...document.querySelectorAll('[id$="btnSave"]')].find(gor);
    if (!btn) { sonuc.kayit = 'düğme yok'; return sonuc; }
    sonuc.beklenen = seciliSay();
    setTimeout(() => btn.click(), 50);                          // MEBBİS'in uyarı penceresi işlemi kilitlemesin
    sonuc.kayit = 'basıldı';
    return sonuc;
  }
  const kay = document.querySelector('[id$="btnSave"]');
  if (kay) { kay.style.boxShadow = '0 0 0 4px #fde047, 0 0 18px #f59e0b'; kay.scrollIntoView({ block: 'center' }); }
  let not = document.getElementById('__tasima_isaret_not'); if (not) not.remove();
  not = document.createElement('div'); not.id = '__tasima_isaret_not';
  not.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483647;background:#fef3c7;border:2px solid #f59e0b;border-radius:10px;padding:10px 16px;font:bold 14px Segoe UI,sans-serif;color:#7c2d12;box-shadow:0 6px 18px rgba(0,0,0,.25)';
  not.textContent = '✔ İşaretler ayarlandı. Kontrol edip "Servis Öğrenci Eşleşmesini kaydet"e SİZ basın. (Program kaydetmez)';
  document.body.appendChild(not); setTimeout(() => not.remove(), 20000);
  return sonuc;
})()`;
ipcMain.on('mebbis-isaretle', async (e, plan) => {
  if (!sonMebbis) { dialog.showMessageBox(anaPencere, { type: 'warning', message: 'MEBBİS penceresi bulunamadı.' }); return; }
  let r;
  try { r = await sonMebbis.wc.executeJavaScript(ISARETLE_JS(plan)); } catch (x) { r = { hata: x.message }; }
  const w = BrowserWindow.fromWebContents(sonMebbis.ana);
  if (r && !r.hata && plan.kaydet) {                             // kaydettikten sonra MEBBİS'ten tekrar oku ve doğrula
    let dogru = null, mebbisMesaj = '';
    // MEBBİS kaydederken pencereyi yeniler; cevapsız kalan okuma beklenmez (en çok 4 sn)
    const sure = (p, ms) => Promise.race([p, new Promise(z => setTimeout(() => z('__zaman'), ms))]);
    const cerceveler = () => { const L = []; for (const pw of mebbisPencereleri(w)) { try { L.push(...pw.webContents.mainFrame.framesInSubtree); } catch (x) {} } return L; };
    for (let i = 0; i < 15 && r.kayit === 'basıldı'; i++) {
      await new Promise(z => setTimeout(z, 1000));
      try {
        if (!mebbisMesaj) for (const f of cerceveler()) {           // MEBBİS'in "İşlem Başarılı — Eklenen / Çıkarılan" mesajı
          const t = await sure(f.executeJavaScript(`(() => { const t = (document.body && document.body.innerText) || ''; const e = t.match(/Eklenen[^:\\n]*:\\s*(\\d+)/i), c = t.match(/Çıkarılan[^:\\n]*:\\s*(\\d+)/i); return e || c ? 'Eklenen öğrenci: ' + (e ? e[1] : '0') + ', çıkarılan öğrenci: ' + (c ? c[1] : '0') : ''; })()`).catch(() => ''), 2000);
          if (t && t !== '__zaman') { mebbisMesaj = t; break; }
        }
        let wc = sonMebbis.wc, ok = await sure(wc.executeJavaScript(SERVIS_YARDIMCI).then(() => true).catch(() => false), 3000);
        if (ok !== true) {                                           // eski çerçeve gitti: pencereyi içeren yeni çerçeveyi bul
          wc = null;
          for (const f of cerceveler()) { const v = await sure(f.executeJavaScript('!!document.querySelector(' + JSON.stringify('[id$="rdOgrenciListe"]') + ')').catch(() => false), 2000); if (v === true) { wc = f; break; } }
          if (!wc) continue;
          if (await sure(wc.executeJavaScript(SERVIS_YARDIMCI).then(() => true).catch(() => false), 3000) !== true) continue;
          sonMebbis.wc = wc;
        }
        const m = await sure(wc.executeJavaScript('__tsr.modalOku()').catch(() => null), 4000);
        if (m === '__zaman') continue;
        if (m && m.ogrenciler && m.ogrenciler.length) {
          const yesil = new Set(m.ogrenciler.filter(o => o.durum === 'yesil').map(o => o.tc));
          const eklenmedi = plan.ekle.filter(k => !r.kapasiteDisi.includes(k.ad) && !yesil.has(k.tc)).map(k => k.ad);
          const cikmadi = plan.cikar.filter(k => yesil.has(k.tc)).map(k => k.ad);
          dogru = { eklenmedi, cikmadi, secili: yesil.size };
          if (!eklenmedi.length && !cikmadi.length) break;
        }
      } catch (x) {}
    }
    const parca = [];
    if ((plan.programSonuc || []).length) parca.push('PROGRAMDA:\n' + plan.programSonuc.map(x => '• ' + x).join('\n'));
    parca.push(`MEBBİS'TE DEĞİŞTİ (${r.tamam.length}):\n` + (r.tamam.map(x => '• ' + x).join('\n') || '—'));
    if (r.olmadi.length) parca.push('YAPILAMADI:\n' + r.olmadi.map(x => '• ' + x).join('\n'));
    if (r.kapasiteDisi.length) parca.push(`ARAÇ KAPASİTESİ (${plan.kapasite}) DOLU — YERLEŞTİRİLMEDİ:\n` + r.kapasiteDisi.map(x => '• ' + x).join('\n') + '\n(Başka güzergaha alın ya da ilçeden kapasite artışı isteyin.)');
    const sorun = (!dogru && !mebbisMesaj) || (dogru && (dogru.eklenmedi.length || dogru.cikmadi.length)) || r.kayit !== 'basıldı';
    if (mebbisMesaj) parca.push('MEBBİS CEVABI: İşlem başarılı. ' + mebbisMesaj);
    if (dogru) parca.push(sorun ? `KONTROL: MEBBİS'te eksik kalanlar var!\n` + [...dogru.eklenmedi.map(x => '• eklenmedi: ' + x), ...dogru.cikmadi.map(x => '• çıkarılmadı: ' + x)].join('\n') : `KONTROL: MEBBİS'ten tekrar okundu, kayıt doğru. Araçta ${dogru.secili} öğrenci.`);
    else parca.push(r.kayit === 'düğme yok' ? 'KAYDET düğmesi bulunamadı — MEBBİS\'te kaydet\'e siz basın.' : 'KONTROL: Kayıttan sonra pencere okunamadı. MEBBİS\'te sonucu gözle kontrol edin.');
    if (w && !w.isDestroyed()) { w.show(); w.focus(); }
    const sira = !!(yerlestirCtx && yerlestirCtx.aktif);
    dialog.showMessageBox(w || anaPencere, { type: sorun ? 'warning' : 'info', message: `${plan.guzNo} NOLU GÜZERGAH: ${sorun ? 'kayıtta sorun var, kontrol edin' : 'MEBBİS\'e kaydedildi'}`, detail: parca.join('\n\n'), buttons: sira ? ['Sıradaki güzergah ▶', 'Tamam'] : ['Tamam'], defaultId: 0, cancelId: sira ? 1 : 0 })
      .then(c => {
        if (!sorun && yerlestirCtx && yerlestirCtx.kuyruk) ilerlemeIsaretle('yer', yerlestirCtx.sonAnahtar);
        if (sira && c.response === 0) yerlestirGoster(yerlestirCtx, 'siradaki');
      });
    return;
  }
  if (r && r.hata) {
    dialog.showMessageBox(anaPencere, { type: 'warning', message: 'MEBBİS\'te işaretler ayarlanamadı.', detail: r.hata === 'pencere' ? "Güzergahın ✏️ penceresi kapanmış. Açıp tekrar karşılaştırın." : r.hata === 'plaka' ? `Şu an açık olan pencere başka bir araç (${r.acik}). Doğru güzergahın penceresini açıp tekrar karşılaştırın.` : r.hata === 'ihale' ? `Şu an açık olan pencere başka bir güzergaha ait: ${r.acik}. Aynı araç birden çok güzergahta olabilir; doğru güzergahın ✏️ penceresini açıp tekrar karşılaştırın.` : r.hata });
    return;
  }
  if (w && !w.isDestroyed()) { w.show(); w.focus(); }
  const parca = [];
  if ((plan.programSonuc || []).length) parca.push('PROGRAMDA:\n' + plan.programSonuc.map(x => '• ' + x).join('\n'));
  parca.push(`MEBBİS'TE İŞARETLENDİ (${r.tamam.length}):\n` + (r.tamam.map(x => '• ' + x).join('\n') || '—'));
  if (r.olmadi.length) parca.push('YAPILAMADI:\n' + r.olmadi.map(x => '• ' + x).join('\n'));
  dialog.showMessageBox(w || anaPencere, { type: r.olmadi.length ? 'warning' : 'info', message: `${plan.guzNo} NOLU GÜZERGAH: işaretler hazır. Şimdi MEBBİS'te "Servis Öğrenci Eşleşmesini kaydet"e siz basın.`, detail: parca.join('\n\n') + '\n\nİşaretlenen satırlar MEBBİS penceresinde renkli çerçeveyle gösterildi. Kaydetmezseniz MEBBİS\'te hiçbir şey değişmez.' });
});

/* ---------- YAZDIRMA ÖNİZLEME (Chrome'daki gibi) ----------
   window.print() çağrıldığı andaki sayfa kopyalanır, PDF'e çevrilir ve
   önizleme penceresinde açılır; oradan yazdırılır / kaydedilir. */
const ONIZLE_KUR = `(() => { if (window.__onizleKurulu || !window.masaustu || !window.masaustu.onizle) return; window.__onizleKurulu = true;
  window.print = function () {
    try { window.dispatchEvent(new Event('beforeprint')); } catch (e) {}
    document.querySelectorAll('input').forEach(i => { if (i.type === 'checkbox' || i.type === 'radio') { if (i.checked) i.setAttribute('checked', ''); else i.removeAttribute('checked'); } else if (i.type !== 'file') i.setAttribute('value', i.value); });
    document.querySelectorAll('textarea').forEach(t => { t.textContent = t.value; });
    document.querySelectorAll('select').forEach(sl => [...sl.options].forEach(o => { if (o.selected) o.setAttribute('selected', ''); else o.removeAttribute('selected'); }));
    const html = '<!DOCTYPE html>' + document.documentElement.outerHTML;
    try { window.dispatchEvent(new Event('afterprint')); } catch (e) {}
    window.masaustu.onizle(html, document.title);
  };
})()`;
let onizlePencere = null;
const onz = { html: '', baslik: '', gizli: null, yatay: false, kagit: 'A4', son: '', kenarInc: null };
const KAGIT_MM = { A4: [210, 297], A3: [297, 420], A5: [148, 210] };
const KENAR_INC = { normal: 0.4, dar: 0.25, yok: 0 };
function onzGecici() { const g = path.join(app.getPath('temp'), 'tasima_onizle'); try { fs.mkdirSync(g, { recursive: true }); } catch (x) {} return g; }
function onzGizliKapat() { try { if (onz.gizli && !onz.gizli.isDestroyed()) onz.gizli.destroy(); } catch (x) {} onz.gizli = null; }
function onzTemizle(haric) {
  const g = onzGecici();
  try { fs.readdirSync(g).filter(f => /^onizleme_\d+\.pdf$/.test(f) && f !== haric).forEach(f => { try { fs.unlinkSync(path.join(g, f)); } catch (x) {} }); } catch (x) {}
}
function onzAyar(a) {
  a = a || {};
  const kagit = KAGIT_MM[a.kagit] ? a.kagit : 'A4';
  const kenar = (KENAR_INC[a.kenar] !== undefined || a.kenar === 'varsayilan') ? a.kenar : 'normal';
  let olcek = parseInt(a.olcek, 10); if (!(olcek >= 10 && olcek <= 200)) olcek = 100;
  const inc = kenar === 'varsayilan' ? (onz.kenarInc !== null ? Math.min(1, Math.max(0, onz.kenarInc)) : KENAR_INC.normal) : KENAR_INC[kenar];
  return { yatay: !!a.yatay, kagit, kenar, inc, olcekTur: a.olcekTur || 'varsayilan', olcek, arka: a.arka !== false };
}
// "Sayfa genişliğine sığdır": sayfa, kâğıdın yazılabilir genişliğinde açılıp taşan genişlik ölçülür
async function onzSigdir(a) {
  const mm = KAGIT_MM[a.kagit], gen = a.yatay ? mm[1] : mm[0];
  const px = Math.max(200, Math.round((gen / 25.4 - 2 * a.inc) * 96));
  onz.gizli.setContentSize(px, 1000);
  const sw = await onz.gizli.webContents.executeJavaScript(
    'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0)))))');
  const oran = sw > px ? px / sw : 1;
  return Math.max(10, Math.floor(oran * 100));
}
async function onzPdf(ayar) {
  if (!onz.gizli || onz.gizli.isDestroyed()) throw new Error('Sayfa kapandı, lütfen programdan yeniden Yazdır deyin.');
  const a = onzAyar(ayar);
  let yuzde = a.olcekTur === 'ozel' ? a.olcek : a.olcekTur === 'sigdir' ? await onzSigdir(a) : 100;
  const pdf = await onz.gizli.webContents.printToPDF({
    landscape: a.yatay, pageSize: a.kagit, scale: Math.min(2, Math.max(0.1, yuzde / 100)),
    margins: { top: a.inc, bottom: a.inc, left: a.inc, right: a.inc },
    printBackground: a.arka, preferCSSPageSize: false
  });
  return { a, yuzde, pdf };
}
ipcMain.on('yazdir-onizle', async (e, html, baslik) => {
  const g = onzGecici();
  // sayfanın betikleri çalışmasın (veri bozulmasın); yalnızca görünüm kopyalanır
  html = String(html || '').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
  // sayfanın kendi @page ayarı (birden çok varsa en sonuncusu geçerli)
  const sayfaKurallari = [...html.matchAll(/@page[^{]*\{([^}]*)\}/gi)].map(m => m[1]).filter(k => /\bsize\s*:/i.test(k) && !/\bsize\s*:\s*auto/i.test(k));
  const sonKural = sayfaKurallari[sayfaKurallari.length - 1] || '';
  const css = (sonKural.match(/\bsize\s*:\s*([^;}]+)/i) || [])[1] || '';
  const km = sonKural.match(/\bmargin\s*:\s*([\d.]+)\s*(mm|cm|in|px)?/i);
  onz.kenarInc = km ? parseFloat(km[1]) / ({ mm: 25.4, cm: 2.54, in: 1, px: 96 }[(km[2] || 'px').toLowerCase()]) : null;
  onz.html = html; onz.baslik = String(baslik || '');
  onz.yatay = /landscape/i.test(css);
  onz.kagit = /\bA3\b/i.test(css) ? 'A3' : /\bA5\b/i.test(css) ? 'A5' : 'A4';
  const htmlYol = path.join(g, 'sayfa.html');
  try {
    fs.writeFileSync(htmlYol, html, 'utf8');
    onzGizliKapat();
    onz.gizli = new BrowserWindow({ show: false, width: 1200, height: 1000, webPreferences: { javascript: true, contextIsolation: true, sandbox: true, nodeIntegration: false } });
    onz.gizli.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    onz.gizli.webContents.on('will-navigate', ev => ev.preventDefault());
    await onz.gizli.loadFile(htmlYol);
  } catch (x) { dialog.showErrorBox('Önizleme hazırlanamadı', x.message); return; }
  finally { try { fs.unlinkSync(htmlYol); } catch (x) {} }
  if (!onizlePencere || onizlePencere.isDestroyed()) {
    onizlePencere = new BrowserWindow({ width: 1250, height: 880, title: 'Yazdırma Önizleme', icon: path.join(__dirname, 'ikon.png'), autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, preload: path.join(__dirname, 'onizle_preload.js') } });
    onizlePencere.on('closed', () => { onizlePencere = null; onzGizliKapat(); onzTemizle(''); });
    onizlePencere.loadFile(path.join(__dirname, 'onizle.html'));
  } else {
    onizlePencere.webContents.send('onizle-yeni');
  }
  onizlePencere.setTitle('Yazdırma Önizleme — ' + onz.baslik.slice(0, 80));
  onizlePencere.show(); onizlePencere.focus();
});
ipcMain.handle('onizle-bilgi', () => ({ yatay: onz.yatay, kagit: onz.kagit, baslik: onz.baslik, kenarVar: onz.kenarInc !== null }));
ipcMain.handle('onizle-olustur', async (e, ayar) => {
  try {
    const { yuzde, pdf } = await onzPdf(ayar);
    const ad = `onizleme_${Date.now()}.pdf`, yol = path.join(onzGecici(), ad);
    fs.writeFileSync(yol, pdf); onz.son = yol; onzTemizle(ad);
    const sayfa = (pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length || 1;
    return { veri: new Uint8Array(pdf), sayfa, olcek: yuzde };
  } catch (x) { return { hata: x.message }; }
});
ipcMain.handle('onizle-yazdir', async (e, ayar) => {
  try {
    if (!onz.gizli || onz.gizli.isDestroyed()) throw new Error('Sayfa kapandı, lütfen programdan yeniden Yazdır deyin.');
    const a = onzAyar(ayar);
    const yuzde = a.olcekTur === 'ozel' ? a.olcek : a.olcekTur === 'sigdir' ? await onzSigdir(a) : 100;
    const p = Math.round(a.inc * 96);
    return await new Promise(r => onz.gizli.webContents.print({
      silent: false, printBackground: a.arka, landscape: a.yatay, pageSize: a.kagit, scaleFactor: yuzde,
      margins: a.inc ? { marginType: 'custom', top: p, bottom: p, left: p, right: p } : { marginType: 'none' }
    }, (ok, neden) => r(ok || /cancel/i.test(String(neden || '')) ? {} : { hata: 'Yazdırılamadı: ' + (neden || 'bilinmeyen hata') })));
  } catch (x) { return { hata: x.message }; }
});
ipcMain.handle('onizle-kaydet', async (e, ayar) => {
  try {
    const { pdf } = await onzPdf(ayar);
    const temiz = (onz.baslik || 'Yazdirma').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'Yazdirma';
    const s = await dialog.showSaveDialog(onizlePencere, { title: 'PDF olarak kaydet', defaultPath: path.join(app.getPath('documents'), temiz + '.pdf'), filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (s.canceled || !s.filePath) return {};
    fs.writeFileSync(s.filePath, pdf);
    shell.showItemInFolder(s.filePath);
    return {};
  } catch (x) { return { hata: x.message }; }
});
ipcMain.on('onizle-kapat', () => { try { if (onizlePencere) onizlePencere.close(); } catch (x) {} });

/* ---------- elle yedek ---------- */
function disYedekHatirlat() {
  const ay = ayarOku(); const bugun = Date.now();
  if (!ay.sonDisYedek) { ay.sonDisYedek = bugun; ayarYaz(ay); return; }
  if (bugun - ay.sonDisYedek < 30 * 864e5) return;
  setTimeout(async () => {
    const r = await dialog.showMessageBox(anaPencere, { type: 'info', buttons: ['Şimdi yedek al', 'Sonra hatırlat'], defaultId: 0, cancelId: 1,
      message: 'Aylık yedek zamanı', detail: 'Bilgisayar bozulursa bilgiler kaybolmasın diye ayda bir yedek alıp USB belleğe ya da başka bir yere kaydedin.\n\n(Program her gün kendi klasörüne de yedek alıyor; bu ayrıca dışarıya alınacak yedektir.)' });
    if (r.response === 0) yedekAl();
    else { const a = ayarOku(); a.sonDisYedek = Date.now() - 23 * 864e5; ayarYaz(a); }   // 1 hafta sonra yeniden sor
  }, 4000);
}
async function yedekAl() {
  try { await anaPencere.webContents.executeJavaScript('window.__masaustuKaydet && window.__masaustuKaydet()'); } catch (e) {}
  const s = await dialog.showSaveDialog(anaPencere, { title: 'Yedeği kaydet', defaultPath: path.join(yollar().indir, yedekAdi('Tüm veriler')), filters: [{ name: 'Yedek', extensions: ['json'] }] });
  if (s.canceled || !s.filePath) return;
  fs.copyFileSync(yollar().veri, s.filePath);
  const ay = ayarOku(); ay.sonDisYedek = Date.now(); ayarYaz(ay);
  dialog.showMessageBox(anaPencere, { type: 'info', message: 'Yedek kaydedildi.', detail: s.filePath + '\n\nBu dosyayı USB belleğe kopyalayın. Başka bilgisayarda Dosya → Yedekten geri yükle ile açılır.' });
}
async function tumYedektenDon() {
  const s = await dialog.showOpenDialog(anaPencere, { title: 'Günlük yedek ya da tüm veriler yedeği seçin', defaultPath: yollar().yedek, filters: [{ name: 'Yedek', extensions: ['json'] }], properties: ['openFile'] });
  if (s.canceled || !s.filePaths[0]) return;
  let o; try { o = JSON.parse(fs.readFileSync(s.filePaths[0], 'utf8')); } catch (e) { dialog.showErrorBox('Okunamadı', 'Geçersiz dosya.'); return; }
  if (Array.isArray(o.routes)) return yedekYukle(s.filePaths[0]);   // programın kendi yedeği
  const r = await dialog.showMessageBox(anaPencere, { type: 'warning', buttons: ['Geri yükle', 'Vazgeç'], defaultId: 1, cancelId: 1,
    message: 'Bütün veriler bu yedekteki hâline döndürülsün mü?', detail: path.basename(s.filePaths[0]) });
  if (r.response !== 0) return;
  try { fs.copyFileSync(yollar().veri, path.join(gunKlasoru(), yedekAdi('Geri yükleme öncesi'))); } catch (e) {}
  veriYaz(JSON.stringify(o));
  anaPencere.webContents.send('dosyadan-yeniden-yukle');
}

/* ---------- Masaüstü programının kendisini (kabuk) GitHub'dan güncelleme (1.1.6) ----------
   surum.json → "kabuk": { "surum": "1.1.7", "notlar": "…", "dosyalar": { "main.js": { "adres": "https://…", "sha256": "…" }, … } }
   Her dosya indirilir, sha256 ile doğrulanır, .js ise söz dizimi denetlenir; eski dosyalar onceki_kabuk\<sürüm>\ içine yedeklenir. */
const KABUK_DOSYA_DESEN = /^[A-Za-z0-9_]+\.(js|html)$/;
const kabukSayi = s => String(s || '').split('.').slice(0, 3).reduce((t, n, i) => t + (parseInt(n, 10) || 0) * Math.pow(1000, 2 - i), 0);
async function kabukGuncelle(b) {
  const k = b && b.kabuk;
  if (!k || !k.surum || !k.dosyalar || kabukSayi(k.surum) <= kabukSayi(KABUK_SURUM)) return false;
  const r = await dialog.showMessageBox(anaPencere, { type: 'question', buttons: ['Güncelle', 'Sonra'], defaultId: 0, cancelId: 1,
    message: `Masaüstü programının yeni sürümü var (${KABUK_SURUM} → ${k.surum}). Güncellensin mi?`,
    detail: (k.notlar || '') + '\n\nVerileriniz yerinde kalır. Güncellemeden sonra program kendiliğinden kapanıp yeniden açılır.' });
  if (r.response !== 0) return false;
  const crypto = require('crypto'), vm = require('vm');
  const inen = {};
  try {
    for (const [ad, d] of Object.entries(k.dosyalar)) {
      if (!KABUK_DOSYA_DESEN.test(ad) || !d || !d.adres || !d.sha256) throw new Error('Güncelleme bilgisi hatalı: ' + ad);
      const y = await net.fetch(d.adres + (d.adres.includes('?') ? '&' : '?') + 't=' + Date.now());
      if (!y.ok) throw new Error(`${ad} indirilemedi (${y.status}).`);
      const veri = Buffer.from(await y.arrayBuffer());
      if (crypto.createHash('sha256').update(veri).digest('hex') !== String(d.sha256).toLowerCase()) throw new Error(`${ad} eksik ya da bozuk indi (doğrulama tutmadı).`);
      if (/\.js$/.test(ad)) new vm.Script(veri.toString('utf8'), { filename: ad });   // söz dizimi denetimi (çalıştırmaz)
      inen[ad] = veri;
    }
  } catch (x) { dialog.showErrorBox('Masaüstü programı güncellenemedi', x.message + '\n\nProgram eski sürümle çalışmaya devam ediyor. İnternet bağlantısını kontrol edip sonra yeniden deneyin.'); return false; }
  const yedek = path.join(__dirname, 'onceki_kabuk', KABUK_SURUM);
  const yazilan = [];
  try {
    fs.mkdirSync(yedek, { recursive: true });
    for (const ad of Object.keys(inen)) { const h = path.join(__dirname, ad); if (fs.existsSync(h)) fs.copyFileSync(h, path.join(yedek, ad)); }
    for (const [ad, veri] of Object.entries(inen)) fs.writeFileSync(path.join(__dirname, ad + '.yeni'), veri);
    for (const ad of Object.keys(inen)) { fs.renameSync(path.join(__dirname, ad + '.yeni'), path.join(__dirname, ad)); yazilan.push(ad); }
  } catch (x) {
    for (const ad of yazilan) { try { fs.copyFileSync(path.join(yedek, ad), path.join(__dirname, ad)); } catch (e) {} }   // yarım kaldıysa geri al
    for (const ad of Object.keys(inen)) { try { fs.unlinkSync(path.join(__dirname, ad + '.yeni')); } catch (e) {} }
    dialog.showErrorBox('Masaüstü programı güncellenemedi', 'Program klasörüne yazılamadı:\n' + __dirname + '\n\n' + x.message +
      '\n\nProgram eski sürümle çalışmaya devam ediyor. Program "Program Files" gibi korumalı bir klasördeyse, klasörü Masaüstü ya da D:\\ gibi bir yere taşıyın.');
    return false;
  }
  await dialog.showMessageBox(anaPencere, { type: 'info', message: `Masaüstü programı güncellendi (${k.surum}).`, detail: 'Program şimdi kapanıp yeniden açılacak.' });
  try { await anaPencere.webContents.executeJavaScript('window.__masaustuKaydet && window.__masaustuKaydet()'); } catch (e) {}
  app.relaunch({ args: process.argv.slice(1).filter(a => a !== '--yeniden-basla').concat('--yeniden-basla') });
  app.quit();
  return true;
}

function hakkinda() {
  dialog.showMessageBox(anaPencere, { type: 'info', title: 'Hakkında',
    message: 'Taşımalı Eğitim ve Nöbet Yönetim Sistemi',
    detail: `Program sürümü: ${programSurumu()}\nMasaüstü sürümü: ${KABUK_SURUM}\nVeri kaynağı: ${(kaynakDosyalari()[0] || {}).ad || '(boş — program kendi verisini kullanıyor)'}\n\nTasarım ve geliştirme: Yunus AKÇAKAYA\nBu program okullar için ücretsiz hazırlanmıştır.\n\nVeri klasörü: ${yollar().kok}` });
}

/* Windows: ZIP içinden çalıştırılırsa uyar; ilk açılışta masaüstüne kısayol koy */
function kisayolKur() {
  if (process.platform !== 'win32' || DENEME) return;
  const exe = process.execPath;
  if (/\\(Temp|Tmp)\\/i.test(exe) || /\.zip/i.test(exe)) {
    dialog.showMessageBox({ type: 'warning', title: 'Önce klasöre çıkartın',
      message: 'Program ZIP dosyasının içinden çalıştırılıyor.',
      detail: 'ZIP dosyasına sağ tıklayıp "Tümünü ayıkla" deyin, örneğin C:\\TasimaProgrami klasörüne çıkartın. Sonra o klasördeki "Tasima Programi.exe" dosyasını çalıştırın.' });
    return;
  }
  const ay = ayarOku();
  const lnk = path.join(app.getPath('desktop'), 'Taşıma ve Nöbet Programı.lnk');
  if (ay.kisayolYolu === exe && fs.existsSync(lnk)) return;
  try {
    const ikon = path.join(__dirname, 'ikon.ico');
    shell.writeShortcutLink(lnk, { target: exe, cwd: path.dirname(exe), description: 'Taşımalı Eğitim ve Nöbet Yönetim Sistemi', icon: fs.existsSync(ikon) ? ikon : exe, iconIndex: 0 });
    const bas = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Taşıma ve Nöbet Programı.lnk');
    try { shell.writeShortcutLink(bas, { target: exe, cwd: path.dirname(exe), icon: fs.existsSync(ikon) ? ikon : exe, iconIndex: 0 }); } catch (e) {}
    ay.kisayolYolu = exe; ayarYaz(ay);
  } catch (e) {}
}

function denemeAc() {
  try {
    const args = app.isPackaged ? ['--deneme'] : [app.getAppPath(), '--deneme'];
    require('child_process').spawn(process.execPath, args, { detached: true, stdio: 'ignore' }).unref();
    if (process.platform === 'win32') {
      const ikon = path.join(__dirname, 'ikon.ico');
      try { shell.writeShortcutLink(path.join(app.getPath('desktop'), 'Taşıma Programı DENEME (boş).lnk'), { target: process.execPath, args: args.join(' '), cwd: path.dirname(process.execPath), icon: fs.existsSync(ikon) ? ikon : process.execPath, iconIndex: 0 }); } catch (e) {}
    }
  } catch (e) { dialog.showErrorBox('Açılamadı', e.message); }
}

function menuKur() {
  const sablon = [
    { label: 'Dosya', submenu: [
      { label: 'Verileri çek (eski programdan)…', click: verileriCek },
      { type: 'separator' },
      { label: 'Tüm verilerin yedeğini al…', click: yedekAl },
      { label: 'Yedekten geri yükle…', click: tumYedektenDon },
      { label: 'Veri kaynağından yükle…', click: veriKaynagindanYukle },
      { label: 'Veri klasörünü aç', click: () => shell.openPath(yollar().kok) },
      { label: 'İndirilenler klasörünü aç (yedek, nöbet, Excel…)', click: () => { fs.mkdirSync(yollar().indir, { recursive: true }); shell.openPath(yollar().indir); } },
      { label: 'Veri Kaynağı klasörünü aç', click: () => { fs.mkdirSync(yollar().kaynak, { recursive: true }); shell.openPath(yollar().kaynak); } },
      { type: 'separator' },
      { label: 'Yazdır', accelerator: 'CmdOrCtrl+P', click: () => anaPencere.webContents.executeJavaScript('window.print()') },
      { role: 'quit', label: 'Çıkış' }
    ] },
    { label: 'Düzen', submenu: [
      { role: 'undo', label: 'Geri al' }, { role: 'redo', label: 'Yinele' }, { type: 'separator' },
      { role: 'cut', label: 'Kes' }, { role: 'copy', label: 'Kopyala' }, { role: 'paste', label: 'Yapıştır' }, { role: 'selectAll', label: 'Tümünü seç' }
    ] },
    { label: 'Görünüm', submenu: [
      { role: 'reload', label: 'Yenile' }, { type: 'separator' },
      { role: 'zoomIn', label: 'Büyüt' }, { role: 'zoomOut', label: 'Küçült' }, { role: 'resetZoom', label: 'Normal boyut' },
      { type: 'separator' }, { role: 'togglefullscreen', label: 'Tam ekran' }, { role: 'toggleDevTools', label: 'Geliştirici araçları' }
    ] },
    { label: 'MEBBİS', submenu: [
      { label: "MEBBİS'ten veri çek (MEBBİS'i aç)", accelerator: 'CmdOrCtrl+M', click: mebbisAc },
      { type: 'separator' },
      { label: "Öğrenci listesini programa aktar (Öğrenci Planlama sayfası)", accelerator: 'CmdOrCtrl+Shift+O', click: menudenOgrenci },
      { label: "Güzergahları programa aktar (Taşıma Servis İşlemleri sayfası)", accelerator: 'CmdOrCtrl+Shift+G', click: menudenServis },
      { label: "Şoför bilgilerini programa aktar (Taşıma Araç Şoför Puantaj sayfası)", accelerator: 'CmdOrCtrl+Shift+F', click: (i, w) => mebbisSoforOku(w) },
      { label: "Öğretmenleri programa aktar (e-Personel → Personel Arama sayfası)", accelerator: 'CmdOrCtrl+Shift+P', click: (i, w) => mebbisPersonelOku(w) },
      { type: 'separator' },
      { label: 'MEBBİS sayfasını kaydet (sorun bildirmek için)', click: mebbisSayfaKaydet },
      { type: 'separator' },
      { label: 'Giriş sorunu: MEBBİS oturumunu temizle', click: mebbisOturumuTemizle },
      { label: 'Giriş sorun kaydını oluştur (e-Devlet / karekod)', click: mebbisKaydiKaydet }
    ] },
    { label: 'Program', submenu: [
      ...(DENEME ? [] : [{ label: 'Boş deneme programını aç (gerçek verilere dokunmaz)', click: denemeAc }, { type: 'separator' }]),
      { label: 'Güncellemeleri denetle', click: () => guncellemeDenetle(true) },
      { label: 'Programı dosyadan güncelle…', click: dosyadanGuncelle },
      { type: 'separator' },
      { label: 'Hakkında', click: hakkinda }
    ] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(sablon));
}

/* Güncelleme sonrası yeniden açılırken eski kopya birkaç saniye açık kalabilir: kilidi alana kadar bekle */
const YENIDEN_BASLA = process.argv.includes('--yeniden-basla');
function tekKopyaBasla(deneme) {
  if (app.requestSingleInstanceLock()) return calistir();
  if (YENIDEN_BASLA && deneme < 40) return setTimeout(() => tekKopyaBasla(deneme + 1), 250);
  app.quit();
}
tekKopyaBasla(0);
function calistir() {
  app.on('second-instance', () => { if (anaPencere) { if (anaPencere.isMinimized()) anaPencere.restore(); anaPencere.focus(); } });
  app.whenReady().then(() => { klasorleriHazirla(); menuKur(); try { mebbisTarayiciAyarla(); } catch (e) {} mebbisIndirmeYakala(); pencereAc(); kisayolKur(); if (!DENEME) disYedekHatirlat(); });
  app.on('window-all-closed', () => app.quit());
  // Çıkış: ana pencere kapanınca MEBBİS pencereleri de kapansın; bir şey takılırsa 3 sn sonra zorla kapat
  let cikiyor = false;
  const tamCikis = () => {
    if (cikiyor) return; cikiyor = true;
    BrowserWindow.getAllWindows().forEach(w => { if (w !== anaPencere && !w.isDestroyed()) w.destroy(); });
    setTimeout(() => app.exit(0), 3000);
  };
  app.on('before-quit', tamCikis);
  app.on('browser-window-created', (e, w) => setImmediate(() => { if (w === anaPencere) w.once('closed', () => { tamCikis(); app.quit(); }); }));
}
