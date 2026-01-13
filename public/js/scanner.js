const logBox = document.getElementById('log');
const scanInput = document.getElementById('scanInput');
const qtyInput = document.getElementById('qtyInput');
const clientSelect = document.getElementById('clientSelect');
const scanDate = document.getElementById('scanDate');

/* ----------------- BEEP (Web Audio API) ----------------- */
function beep(freq = 1000, duration = 0.1) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.value = 0.1;

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (err) {
    console.warn('Audio error:', err);
  }
}

/* ----------------- QR CODE ----------------- */
async function generateQR() {
  const res = await fetch('/api/server-info');
  const info = await res.json();

  const url = `http://${info.ip}:${info.port}/components/scanner.html`;

  document.getElementById('qrBox').innerHTML = '';

  new QRCode(document.getElementById('qrBox'), {
    text: url,
    width: 180,
    height: 180,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H,
  });
}

document.getElementById('refreshQR').onclick = generateQR;
generateQR();

/* ----------------- LOG ----------------- */
function log(msg) {
  logBox.innerHTML += msg + '<br>';
  logBox.scrollTop = logBox.scrollHeight;
}

/* ----------------- FLASH SUCCESS ----------------- */
function flashSuccess() {
  scanInput.classList.add('flash-success');
  setTimeout(() => scanInput.classList.remove('flash-success'), 400);
}

/* ----------------- LOAD CLIENTS ----------------- */
document.getElementById('loadOrders').onclick = async () => {
  const date = scanDate.value;
  if (!date) return alert('Виберіть дату');

  const res = await fetch(`/api/orders/${date}`);
  const list = await res.json();

  clientSelect.innerHTML = `<option value="">— виберіть клієнта —</option>`;
  list.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    clientSelect.appendChild(opt);
  });

  log('✔ Завантажено клієнтів: ' + list.length);
};

/* ----------------- SCAN HANDLER ----------------- */
let lastScan = null;

scanInput.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;

  const date = scanDate.value;
  const client = clientSelect.value;
  const container = scanInput.value.trim();
  const qty = Number(qtyInput.value);

  if (!date || !client || !container) {
    log('❌ Заповніть всі поля');
    beep(300);
    return;
  }

  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({date, client, container, qty}),
  });

  const data = await res.json();

  if (data.remaining !== null) {
    log(`${data.message} | Залишилось: ${data.remaining} / ${data.total}`);
  } else {
    log(data.message);
  }

  lastScan = {date, client, container, qty};

  flashSuccess();
  beep(1000);

  scanInput.value = '';
  scanInput.focus();
});

// Undo
undoBtn.onclick = async () => {
  if (!lastScan) {
    log('❌ Немає що відміняти');
    beep(300);
    return;
  }

  const {date, client, container, qty} = lastScan;

  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({date, client, container, qty: -qty}),
  });

  const data = await res.json();
  log(`↩️ Відмінено: ${qty} | Залишилось: ${data.remaining} / ${data.total}`);

  lastScan = null;
};

/* ----------------- FINISH CLIENT ----------------- */
document.getElementById('finishBtn').onclick = async () => {
  const client = clientSelect.value;
  if (!client) return alert('Виберіть клієнта');

  const res = await fetch('/api/finish', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({client}),
  });

  const data = await res.json();
  log('✔ Завершено: ' + client);
  beep(600);
};

/* ----------------- UNDO ----------------- */
document.getElementById('undoBtn').onclick = async () => {
  if (!lastScan) {
    log('❌ Немає що відміняти');
    beep(300);
    return;
  }

  const {date, client, container, qty} = lastScan;

  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      date,
      client,
      container,
      qty: -qty,
      column: 1,
    }),
  });

  const data = await res.json();
  log('↩️ Undo: ' + data.message);

  beep(600); // undo beep

  lastScan = null;
};
