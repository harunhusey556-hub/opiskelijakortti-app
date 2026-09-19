// ===== Student Card demo app =====
const LS_KEY = 'studentcard-demo';

const DEFAULTS = {
  // student identity (customizable from Menu)
  studentName: 'Eyüp Eskikurt',
  birthDate: '2006-07-25',      // ISO
  schoolName: 'Aalto-yliopisto',
  schoolUnit: 'AALTO CHEM',
  schoolRole: 'Korkeakouluopiskelija',
  studentId: '104607118',
  // profile photo (data URL, uploaded from Menu -> Profiilikuva)
  photo: '',
  // demo settings
  validUntil: '2027-09-30',     // ISO
  badge: 3
};

let state = load();

function load() {
  try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(LS_KEY)) || {}) }; }
  catch { return { ...DEFAULTS }; }
}
function save() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }

// ----- helpers -----
const $ = s => document.querySelector(s);
const fmtDot = iso => { const [y,m,d] = iso.split('-'); return `${d}.${m}.${y}`; };  // 30.09.2027
const fmtDash = iso => { const [y,m,d] = iso.split('-'); return `${d}-${m}-${y}`; }; // 25-07-2006
const isValid = iso => new Date(iso + 'T23:59:59') >= new Date();

// ----- footer tabs -----
const tabs = document.querySelectorAll('.tab');
const screens = document.querySelectorAll('.screen');
tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(x => x.classList.toggle('active', x === t));
  screens.forEach(s => s.classList.toggle('active', s.id === 'screen-' + t.dataset.tab));
}));

// ----- render state -----
function renderAll() {
  // identity
  $('#studentName').textContent = state.studentName;
  $('#studentBirth').textContent = fmtDash(state.birthDate);
  $('#schoolName').textContent = state.schoolName;
  $('#schoolUnit').textContent = state.schoolUnit;
  $('#schoolRole').textContent = state.schoolRole;
  $('#studentId').textContent = state.studentId;

  // validity
  const dFi = fmtDot(state.validUntil);
  $('#validDate').textContent = dFi;

  // badge
  const badge = $('#viestitBadge');
  const n = parseInt(state.badge, 10);
  badge.hidden = n <= 0;
  badge.textContent = n;

  // QR status (valid / expired)
  const valid = isValid(state.validUntil);
  $('#qrStatus').classList.toggle('expired', !valid);
  $('#qrStatusText').innerHTML = valid
    ? `Voimassa <b>${dFi}</b> asti`
    : `Ei voimassa — päättyi <b>${dFi}</b>`;

  // menu controls reflect state
  $('#setName').value = state.studentName;
  $('#setBirth').value = state.birthDate;
  $('#setSchool').value = state.schoolName;
  $('#setUnit').value = state.schoolUnit;
  $('#setRole').value = state.schoolRole;
  $('#setStudentId').value = state.studentId;
  $('#setBadge').value = String(state.badge);
  $('#setDate').value = state.validUntil;

  renderPhoto();
}

// ----- profile photo -----
function renderPhoto() {
  const has = !!state.photo;
  const big = $('#avatarImg');
  const ph = $('#avatarPh');
  const prevImg = $('#photoPreviewImg');
  const prevIcon = $('#photoPreviewIcon');

  if (has) {
    big.src = state.photo;
    prevImg.src = state.photo;
  } else {
    big.removeAttribute('src');
    prevImg.removeAttribute('src');
  }
  big.style.display = has ? 'block' : 'none';
  prevImg.style.display = has ? 'block' : 'none';
  ph.style.display = has ? 'none' : 'grid';
  prevIcon.style.display = has ? 'none' : 'block';
  $('#clearPhoto').disabled = !has;
  $('#avatar').classList.toggle('has-photo', has);
}

// read a picked file, downscale it and return a compact JPEG data URL
function photoFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error('not an image')); return; }
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('read failed'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        const MAX = 640;
        const k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * k));
        const h = Math.max(1, Math.round(img.naturalHeight * k));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        try { resolve(cv.toDataURL('image/jpeg', 0.86)); }
        catch (e) { reject(e); }
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

async function handlePhotoFile(file) {
  const status = $('#photoStatus');
  try {
    status.textContent = 'Käsitellään…';
    const data = await photoFromFile(file);
    state.photo = data;
    try { save(); } catch (e) { status.textContent = 'Kuva on liian suuri tallennettavaksi.'; return; }
    renderPhoto();
    status.textContent = 'Kuva päivitetty.';
    setTimeout(() => { if (status.textContent === 'Kuva päivitetty.') status.textContent = ''; }, 2500);
  } catch (e) {
    status.textContent = 'Kuvan lataus ei onnistunut.';
  }
}

const photoInput = $('#photoInput');
$('#pickPhoto').addEventListener('click', () => photoInput.click());
$('#avatar').addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  if (f) handlePhotoFile(f);
  e.target.value = '';           // allow picking the same file again
});
$('#clearPhoto').addEventListener('click', () => {
  state.photo = '';
  save();
  renderPhoto();
  $('#photoStatus').textContent = '';
});

// ----- QR overlay -----
let qrObj = null;
let clockTimer = null;

function qrPayload() {
  return [
    'OPISKELIJAKORTTI',
    'NRO:' + (state.studentId || ''),
    'NIMI:' + state.studentName,
    'SYNT:' + state.birthDate,
    'KOULU:' + state.schoolName + ' ' + state.schoolUnit,
    'VALID:' + state.validUntil,
    'TS:' + Math.floor(Date.now() / 1000)
  ].join('|');
}

function renderQr() {
  const el = $('#qrCode');
  el.innerHTML = '';
  // qrcode-generator: typeNumber 0 = auto version (handles UTF-8 correctly)
  const qr = qrcode(0, 'M');
  qr.addData(qrPayload());
  qr.make();
  const modules = qr.getModuleCount();
  const cell = Math.max(2, Math.round(236 / modules));
  el.innerHTML = qr.createSvgTag({ cellSize: cell, margin: 0, scalable: true });
  const svg = el.querySelector('svg');
  if (svg) { svg.setAttribute('width', 236); svg.setAttribute('height', 236); }
}

function tickClock() {
  const now = new Date();
  const p = x => String(x).padStart(2, '0');
  $('#qrClock').textContent = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
}

$('#openQr').addEventListener('click', () => {
  renderAll();          // reflect latest demo state (validity, dates)
  renderQr();
  tickClock();
  clockTimer = setInterval(() => { tickClock(); renderQr(); }, 5000); // payload rotates (real verification feel)
  $('#qrOverlay').hidden = false;
});

$('#closeQr').addEventListener('click', () => {
  $('#qrOverlay').hidden = true;
  clearInterval(clockTimer);
});

// ----- menu: student identity fields -----
const bindText = (sel, key) => {
  $(sel).addEventListener('input', e => {
    state[key] = e.target.value;
    save(); renderAll();
  });
};
bindText('#setName', 'studentName');
bindText('#setBirth', 'birthDate');
bindText('#setSchool', 'schoolName');
bindText('#setUnit', 'schoolUnit');
bindText('#setRole', 'schoolRole');
bindText('#setStudentId', 'studentId');

// ----- menu: demo settings -----
const PRESETS = {
  valid: '2027-09-30',
  soon: '2026-09-30',
  expired: '2025-09-30'
};

$('#setPreset').addEventListener('change', e => {
  const v = e.target.value;
  $('#customRow').hidden = v !== 'custom';
  if (v !== 'custom') {
    state.validUntil = PRESETS[v];
    save(); renderAll();
  }
});

$('#setDate').addEventListener('change', e => {
  if (!e.target.value) return;
  state.validUntil = e.target.value;
  save(); renderAll();
});

$('#setBadge').addEventListener('change', e => {
  state.badge = parseInt(e.target.value, 10);
  save(); renderAll();
});

$('#resetDemo').addEventListener('click', () => {
  const keepPhoto = state.photo;          // the uploaded photo is the user's, not demo data
  state = { ...DEFAULTS, photo: keepPhoto };
  save();
  $('#setPreset').value = 'valid';
  $('#customRow').hidden = true;
  renderAll();
});

// init
renderAll();
// ----- service worker (offline) -----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
