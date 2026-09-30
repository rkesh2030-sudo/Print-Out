// Print-Out · Data Layer
// Every backend call lives here. Swap the bodies for real HTTP requests later;
// the UI never changes.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const JOBS_KEY = 'print-out:jobs';

// ── Constants ─────────────────────────────────────────────────────────────────
export const CITIES = ['Thalassery', 'Kannur', 'Kozhikode', 'Kochi'];
export const ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
export const MAX_MB = 25;

// ── Virtual printer entry — pinned to the top of every city's list ────────────
export const PDF_PRINTER = {
  id: 'virtual-pdf',
  name: 'Microsoft Print to PDF',
  area: 'Virtual printer — saves a PDF to your device',
  bw: 2,
  colour: 8,
  virtual: true, // flag used by UI to adjust copy (no shop pickup)
};

// ── Printer catalogue (swap → GET /api/printers?city=…) ──────────────────────
const PRINTERS = {
  Thalassery: [],
  Kannur: [],
  Kozhikode: [],
  Kochi: [], // intentionally empty — tests the empty / no-printers state
};

/**
 * Returns printers for the given city, always with the PDF virtual printer
 * pinned at the top so it is available even when no shops are online.
 */
export async function getPrinters(city) {
  await wait(480);
  const shops = PRINTERS[city] ?? [];
  return [PDF_PRINTER, ...shops];
}

// ── File upload (swap → POST /api/upload) ────────────────────────────────────
export async function uploadFile(file, onProgress) {
  const ok = /\.(pdf|docx?|jpe?g|png)$/i.test(file.name);
  if (!ok) throw new Error('Please choose a PDF, DOC, DOCX, JPG or PNG file.');
  if (file.size > MAX_MB * 1024 * 1024)
    throw new Error(`That file is over ${MAX_MB} MB. Please choose a smaller one.`);

  for (let p = 0; p <= 100; p += 25) { onProgress(p); await wait(140); }

  const isDoc = /\.(pdf|docx?)$/i.test(file.name);
  const isImage = /\.(jpe?g|png)$/i.test(file.name);
  const pages = isDoc ? Math.max(1, Math.round(file.size / 55000)) : 1;
  const previewUrl = isImage ? URL.createObjectURL(file) : null;

  return {
    name: file.name,
    size: file.size,
    pages,
    isImage,
    isDoc,
    previewUrl,
  };
}

// ── Pricing ───────────────────────────────────────────────────────────────────
export function getPrice({ printer, pages, colour, duplex, copies }) {
  const base = colour ? printer.colour : printer.bw;
  const rate = duplex ? +(base * 0.8).toFixed(2) : base;
  return { rate, total: Math.round(pages * rate * copies) };
}

// ── Payment ───────────────────────────────────────────────────────────────────
// Virtual PDF jobs skip payment entirely (total is ₹0).
export const SIMULATE_FAILURES = false; // set true to test the failure state UI

export async function pay(amount) {
  if (amount === 0) return { paymentId: 'free' }; // virtual printer — no charge
  await wait(1400);
  if (SIMULATE_FAILURES && Math.random() < 0.25)
    throw new Error('Payment did not go through. You were not charged. Please try again.');
  return { paymentId: 'pay_' + Date.now() };
}

// ── Job creation ──────────────────────────────────────────────────────────────
// Stores job locally with reference PIN and settings.
export async function createJob(order) {
  await wait(420);
  const code = String(Math.floor(1000 + Math.random() * 9000));
  const job = {
    code,
    name: order.name,
    printer: order.printer.name,
    file: order.file.name,
    fileSize: order.file.size,
    filePages: order.file.pages,
    filePreview: order.file.previewUrl || null,
    isImage: !!order.file.isImage,
    settings: {
      duplex: !!order.duplex,
      colour: !!order.colour,
      copies: order.copies || 1,
    },
    total: order.total,
    virtual: !!order.printer.virtual,
    at: Date.now(),
  };
  localStorage.setItem(JOBS_KEY, JSON.stringify([job, ...getJobs()]));
  return job;
}

// ── Local job history (swap → GET /api/jobs?device=…) ────────────────────────
export function getJobs() {
  try { return JSON.parse(localStorage.getItem(JOBS_KEY)) || []; } catch { return []; }
}

export function deleteJob(code) {
  try {
    const remaining = getJobs().filter((j) => j.code !== code);
    localStorage.setItem(JOBS_KEY, JSON.stringify(remaining));
    return remaining;
  } catch {
    return getJobs();
  }
}

export function clearJobs() {
  try {
    localStorage.removeItem(JOBS_KEY);
    return true;
  } catch {
    return false;
  }
}


