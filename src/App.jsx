import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  HashRouter, Routes, Route, Navigate,
  NavLink, Link, useNavigate, useParams, useLocation,
} from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import * as api from './api';
import adImage from './assets/ad-banner.jpeg';

// ── Shared state ──────────────────────────────────────────────────────────────
const STEPS = ['Printer', 'Document', 'Settings', 'Your name', 'Payment', 'PIN'];

const fresh = () => ({
  city: 'Thalassery',
  printer: null,
  file: null,
  duplex: false,
  colour: false,
  copies: 1,
  name: '',
  phone: '',
  job: null,
});

const Ctx = createContext();
const useOrder = () => useContext(Ctx);

// ── Helpers ───────────────────────────────────────────────────────────────────
const kb = (n) =>
  n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

const stepValid = (i, s) =>
  [!!s.printer, !!s.file, true, s.name.trim().length > 0, !!s.job][i];

// ── Panda logo ────────────────────────────────────────────────────────────────
function Panda({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="9"  cy="10" r="6.5" fill="#12122B" />
      <circle cx="39" cy="10" r="6.5" fill="#12122B" />
      <circle cx="24" cy="26" r="19" fill="#fff" stroke="#12122B" strokeWidth="3" />
      <ellipse cx="16" cy="24" rx="5.5" ry="6.5" fill="#12122B" transform="rotate(-18 16 24)" />
      <ellipse cx="32" cy="24" rx="5.5" ry="6.5" fill="#12122B" transform="rotate(18 32 24)" />
      <circle cx="16.5" cy="24" r="1.8" fill="#fff" />
      <circle cx="31.5" cy="24" r="1.8" fill="#fff" />
      <ellipse cx="24" cy="31" rx="2.6" ry="1.8" fill="#12122B" />
      <path d="M18 35c3 3.5 9 3.5 12 0" fill="none" stroke="#12122B" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────────
function Stepper({ step }) {
  return (
    <ol className="stepper" aria-label="Progress">
      {STEPS.map((label, i) => (
        <li key={label} className={i === step ? 'active' : ''} aria-current={i === step ? 'step' : undefined}>
          <span className="step-num">{i + 1}</span>
          <span className="step-lbl">{label}</span>
        </li>
      ))}
    </ol>
  );
}

// ── Sticky bottom action bar ───────────────────────────────────────────────────
function ActionBar({ children }) {
  return <div className="action-bar">{children}</div>;
}

// ── Step 1 · Printer ─────────────────────────────────────────────────────────
function PrinterStep() {
  const { s, set } = useOrder();
  const [list, setList] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    setList(null);
    api.getPrinters(s.city).then((r) => { if (live) setList(r); });
    return () => { live = false; };
  }, [s.city, tick]);

  return (
    <div className="step-body">
      <h1>Where do you want to pick up?</h1>
      <p className="step-sub">Choose your city to see available print locations.</p>

      <label className="field-label" htmlFor="city-select">City</label>
      <select
        id="city-select"
        className="field-input"
        value={s.city}
        onChange={(e) => set({ city: e.target.value, printer: null })}
      >
        {api.CITIES.map((c) => <option key={c}>{c}</option>)}
      </select>

      {list === null && (
        <div className="loading-row">
          <span className="spinner" aria-hidden="true" />
          <span className="muted-text">Finding printers…</span>
        </div>
      )}

      {list !== null && list.length === 0 && (
        <div className="empty-card">
          <div className="empty-icon">🖨️</div>
          <strong>No printers online right now</strong>
          <p>The shops may be closed. Try again in a bit.</p>
          <button className="btn btn-ghost" onClick={() => setTick((t) => t + 1)}>
            Retry
          </button>
        </div>
      )}

      {list !== null && list.length > 0 && (
        <div className="printer-list">
          {list.map((p) => (
            <button
              key={p.id}
              className={'printer-card' + (s.printer?.id === p.id ? ' selected' : '') + (p.virtual ? ' virtual' : '')}
              onClick={() => set({ printer: p })}
              aria-pressed={s.printer?.id === p.id}
            >
              <div className="printer-info">
                <div className="printer-name-row">
                  <strong className="printer-name">{p.name}</strong>
                  {p.virtual && <span className="virtual-badge">Virtual · PDF</span>}
                </div>
                <span className="printer-area muted-text">{p.area}</span>
                <span className="printer-price muted-text">
                  B&W ₹{p.bw}/page · Colour ₹{p.colour}/page
                </span>
              </div>
              {s.printer?.id === p.id && <span className="check-badge" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Step 2 · Document ─────────────────────────────────────────────────────────
function DocumentStep() {
  const { s, set } = useOrder();
  const [pct, setPct] = useState(null);
  const [err, setErr] = useState('');
  const [over, setOver] = useState(false);
  const inputRef = useRef();

  async function handleFile(file) {
    if (!file) return;
    setErr('');
    setPct(0);
    try {
      const result = await api.uploadFile(file, setPct);
      set({ file: result });
    } catch (e) {
      setErr(e.message);
    } finally {
      setPct(null);
    }
  }

  return (
    <div className="step-body">
      <h1>Upload your file</h1>
      <p className="step-sub">PDF, DOC, DOCX, JPG or PNG — max {api.MAX_MB} MB.</p>

      {!s.file && pct === null && (
        <label
          className={'drop-zone' + (over ? ' drag-over' : '')}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); handleFile(e.dataTransfer.files[0]); }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={api.ACCEPT}
            className="sr-only"
            onChange={(e) => {
              handleFile(e.target.files[0]);
              e.target.value = '';
            }}
          />
          <span className="drop-icon" aria-hidden="true">📄</span>
          <strong>Tap to choose a file</strong>
          <span className="muted-text">or drop it here</span>
          <span className="drop-formats muted-text">PDF · DOC · DOCX · JPG · PNG</span>
        </label>
      )}

      {pct !== null && (
        <div className="upload-card card">
          <div className="upload-row">
            <span className="spinner" aria-hidden="true" />
            <strong>Uploading…</strong>
            <span className="muted-text">{pct}%</span>
          </div>
          <div className="progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
            <div className="progress-fill" style={{ width: pct + '%' }} />
          </div>
        </div>
      )}

      {err && <p className="error-msg" role="alert">{err}</p>}

      {s.file && (
        <div className="file-card card row-flex">
          {s.file.previewUrl ? (
            <img src={s.file.previewUrl} alt="Document preview" className="file-preview-thumb" />
          ) : (
            <span className="file-icon" aria-hidden="true">{s.file.isDoc ? '📑' : '📄'}</span>
          )}
          <div className="file-info">
            <strong className="file-name clip-text">{s.file.name}</strong>
            <span className="muted-text">{kb(s.file.size)} · {s.file.pages} {s.file.pages === 1 ? 'page' : 'pages'}</span>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (s.file?.previewUrl) {
                try { URL.revokeObjectURL(s.file.previewUrl); } catch {}
              }
              set({ file: null });
            }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

// ── Step 3 · Settings ─────────────────────────────────────────────────────────
function SegControl({ label, value, options, onChange }) {
  return (
    <div className="seg-group" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button
          key={String(v)}
          className={'seg-btn' + (value === v ? ' seg-active' : '')}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function SettingsStep() {
  const { s, set } = useOrder();
  const isVirtual = s.printer?.virtual;
  const { rate, total } = api.getPrice({ ...s, pages: s.file.pages });

  return (
    <div className="step-body">
      <h1>Choose your print settings</h1>
      <p className="step-sub">Prices update as you change them.</p>

      <p className="setting-label">Sides</p>
      <SegControl
        label="Sides"
        value={s.duplex}
        options={[[false, 'Single sided'], [true, 'Double sided']]}
        onChange={(duplex) => set({ duplex })}
      />

      <p className="setting-label">Colour</p>
      <SegControl
        label="Colour"
        value={s.colour}
        options={[[false, 'Black & white'], [true, 'Colour']]}
        onChange={(colour) => set({ colour })}
      />

      <div className="card row-flex" style={{ marginTop: 16 }}>
        <strong>Copies</strong>
        <div className="stepper-ctrl">
          <button
            className="stepper-btn"
            aria-label="Fewer copies"
            disabled={s.copies <= 1}
            onClick={() => set({ copies: s.copies - 1 })}
          >−</button>
          <output className="stepper-val">{s.copies}</output>
          <button
            className="stepper-btn"
            aria-label="More copies"
            disabled={s.copies >= 99}
            onClick={() => set({ copies: s.copies + 1 })}
          >+</button>
        </div>
      </div>

      <div className="card price-card">
        <p className="price-formula muted-text">
          {s.file.pages} {s.file.pages === 1 ? 'page' : 'pages'} × ₹{rate} × {s.copies} {s.copies === 1 ? 'copy' : 'copies'}
        </p>
        <p className="price-total">₹{total}</p>
      </div>
    </div>
  );
}

// ── Step 4 · Your name ────────────────────────────────────────────────────────
function NameStep() {
  const { s, set } = useOrder();
  return (
    <div className="step-body">
      <h1>What's your name?</h1>
      <p className="step-sub">So the shop can find your printout.</p>

      <label className="field-label" htmlFor="name-input">Name <span className="required-mark">*</span></label>
      <input
        id="name-input"
        className="field-input"
        value={s.name}
        maxLength={60}
        autoComplete="name"
        placeholder="Your name"
        onChange={(e) => set({ name: e.target.value })}
      />

      <label className="field-label" htmlFor="phone-input">
        Phone <span className="optional-mark">(optional)</span>
      </label>
      <input
        id="phone-input"
        className="field-input"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={s.phone}
        placeholder="10-digit number"
        onChange={(e) => set({ phone: e.target.value })}
      />
    </div>
  );
}

// ── Step 5 · Payment ──────────────────────────────────────────────────────────
function PaymentStep() {
  const { s, set } = useOrder();
  const [status, setStatus] = useState(s.job ? 'done' : 'idle');
  const [errMsg, setErrMsg] = useState('');
  const nav = useNavigate();
  const didPay = useRef(false);

  useEffect(() => {
    if (status !== 'done' || !didPay.current) return;
    const id = setTimeout(() => nav('/print/5'), 900);
    return () => clearTimeout(id);
  }, [status, nav]);

  const { total } = api.getPrice({ ...s, pages: s.file.pages });

  const isVirtual = s.printer?.virtual;

  const summaryRows = [
    ['Printer', s.printer.name],
    ['File', s.file.name],
    ['Settings', `${s.duplex ? 'Double' : 'Single'} sided, ${s.colour ? 'colour' : 'black & white'}`],
    ['Copies', String(s.copies)],
    ['Total', `₹${total}`],
  ];

  async function handlePay() {
    setStatus('paying');
    setErrMsg('');
    try {
      await api.pay(total);
      const job = await api.createJob({
        name: s.name.trim(),
        printer: s.printer,
        file: s.file,
        duplex: s.duplex,
        colour: s.colour,
        copies: s.copies,
        total,
      });
      didPay.current = true;
      set({ job });
      setStatus('done');
    } catch (e) {
      setErrMsg(e.message);
      setStatus('failed');
    }
  }

  return (
    <div className="step-body">
      <h1>Review and pay</h1>
      <p className="step-sub">
        Check your order, then pay to get your Print-Out job code.
      </p>

      <dl className="summary-card card">
        {summaryRows.map(([k, v]) => (
          <div key={k} className="summary-row">
            <dt className="summary-key muted-text">{k}</dt>
            <dd className="summary-val clip-text">{v}</dd>
          </div>
        ))}
      </dl>

      {errMsg && <p className="error-msg" role="alert">{errMsg}</p>}

      {status === 'done' ? (
        <div className="success-banner" role="status">
          <span aria-hidden="true">✓</span>
          {' Payment confirmed — getting your Print-Out job code…'}
        </div>
      ) : (
        <button
          className="btn btn-solid btn-wide"
          disabled={status === 'paying'}
          onClick={handlePay}
        >
          {status === 'paying'
            ? <><span className="spinner spinner-light" aria-hidden="true" /> Processing payment…</>
            : status === 'failed'
            ? `Try again · Pay ₹${total}`
            : `Pay ₹${total}`}
        </button>
      )}
    </div>
  );
}

// ── Official Printable Document & Slip (Multi-page Print Engine) ──────────────
function PrintSlip({ job }) {
  if (!job) return null;
  const copies = Math.max(1, Number(job.settings?.copies || job.copies) || 1);
  const totalPages = 1 + copies;
  const formattedTime = new Date(job.at || Date.now()).toLocaleString();

  return (
    <div className="print-sheet" aria-label="Official Print-Out Pages">
      {/* ── Page 1: Cover & Job Details Slip with Ad ── */}
      <section className="print-page print-cover-page">
        <div className="print-slip-card">
          {/* Top Black Header Banner */}
          <div className="print-slip-top-bar">
            <span>Print-Out · Printing made easy</span>
            <span>PRINT PICKUP SLIP</span>
          </div>

          {/* Meta Details Header (Customer Name, Job Meta & Hero PIN) */}
          <div className="print-slip-meta-header">
            <div className="print-slip-meta-left">
              <div className="print-slip-brand-row">
                <span className="print-slip-brand-name">Print-Out</span>
                <span className="meta-dot">·</span>
                <span className="print-slip-time">{formattedTime}</span>
              </div>
              <h1 className="print-slip-customer-name">{job.name || 'Anonymous'}</h1>
              <div className="print-slip-meta-line">
                <span>Pages: {job.filePages || 1}</span>
                <span className="meta-dot">·</span>
                <span>Copies: {copies}</span>
                <span className="meta-dot">·</span>
                <span>Job: {job.code}</span>
                {job.total != null && (
                  <>
                    <span className="meta-dot">·</span>
                    <span>Total: ₹{job.total}</span>
                  </>
                )}
                {job.printer && (
                  <>
                    <span className="meta-dot">·</span>
                    <span>{job.printer}</span>
                  </>
                )}
              </div>
            </div>

            <div className="print-slip-pin-hero">
              <span className="print-slip-pin-label">PICKUP PIN</span>
              <strong className="print-slip-pin-num">{job.code}</strong>
            </div>
          </div>

          {/* Ad Section in the First Page */}
          <div className="print-slip-ad-section">
            <img
              src={adImage}
              alt="Print-Out Advertisement: Print from your phone, pick it up with a PIN"
              className="print-slip-ad-img"
            />
          </div>

          {/* Operator Footer */}
          <div className="print-slip-operator-footer">
            <span>Operator: detach this slip and staple to the printout · Print-Out - Printing made easy</span>
            <span className="print-page-badge">Page 1 of {totalPages}</span>
          </div>
        </div>
      </section>

      {/* ── Page 2 to (1 + copies): Document Print Pages (repeated per copy number) ── */}
      {Array.from({ length: copies }).map((_, idx) => (
        <section key={idx} className="print-page print-doc-page">
          <div className="print-doc-header">
            <div className="print-doc-header-left">
              <strong className="print-doc-brand">Print-Out Document: {job.file}</strong>
              <span className="print-doc-meta-sub">PIN #{job.code} · Customer: {job.name || 'Anonymous'}</span>
            </div>
            <div className="print-doc-header-right">
              <span className="copy-badge">Copy {idx + 1} of {copies}</span>
              <span className="page-badge">Page {idx + 2} of {totalPages}</span>
            </div>
          </div>

          <div className="print-doc-body">
            {job.filePreview ? (
              <img
                src={job.filePreview}
                alt={`${job.file} - Copy ${idx + 1}`}
                className="print-doc-full-img"
              />
            ) : (
              <div className="print-doc-fallback">
                <span className="print-doc-fallback-icon">📄</span>
                <h3 className="print-doc-fallback-title">{job.file}</h3>
                <p className="print-doc-fallback-desc">
                  {job.filePages || 1} {job.filePages === 1 ? 'page' : 'pages'} · {job.settings?.colour ? 'Colour' : 'B&W'} · {job.settings?.duplex ? 'Double sided' : 'Single sided'}
                </p>
                <span className="print-doc-fallback-tag">Document Copy {idx + 1} of {copies}</span>
              </div>
            )}
          </div>

          <div className="print-doc-footer">
            <small>Print-Out Official Printout · Copy {idx + 1} of {copies} · Page {idx + 2} of {totalPages}</small>
          </div>
        </section>
      ))}
    </div>
  );
}

// ── Sponsored Ad Card ────────────────────────────────────────────────────────
function AdBanner({ className = '' }) {
  const nav = useNavigate();
  const { reset } = useOrder();

  return (
    <aside className={`ad-banner-container ${className}`} aria-label="Sponsored advertisement">
      <div className="ad-banner-top">
        <div className="ad-tag-pill">
          <span className="ad-tag-dot" aria-hidden="true" />
          <span>Sponsored Ad</span>
        </div>
        <span className="ad-tag-caption">Print-Out Express</span>
      </div>

      <div className="ad-media-frame">
        <img
          src={adImage}
          alt="Print from your phone, pick it up with a PIN - Print-Out advertisement"
          className="ad-banner-img"
          loading="lazy"
        />
      </div>

      <div className="ad-banner-footer">
        <div className="ad-info-text">
          <strong>Print from your phone</strong>
          <span>Pick it up securely with your PIN</span>
        </div>
        <button
          className="btn btn-solid btn-sm ad-cta-btn"
          onClick={() => { reset(); nav('/print/0'); }}
        >
          Print Now
        </button>
      </div>
    </aside>
  );
}

// ── Ticket card (reused in Home & Step 6) ─────────────────────────────────────
function Ticket({ code, name, printer, copies, pages, total, onPrint, isVirtual, children }) {
  return (
    <div className="ticket">
      <small className="ticket-label">Your Print-Out PIN / Job Ticket</small>
      <p className="ticket-code">{code}</p>
      <dl className="ticket-dl">
        <div className="ticket-dl-row">
          <dt>Name</dt>
          <dd>{name || '—'}</dd>
        </div>
        <div className="ticket-dl-row">
          <dt>Pickup</dt>
          <dd>{printer}</dd>
        </div>
        {copies != null && (
          <div className="ticket-dl-row">
            <dt>Copies</dt>
            <dd>{copies}</dd>
          </div>
        )}
        {pages != null && (
          <div className="ticket-dl-row">
            <dt>Pages</dt>
            <dd>{pages}</dd>
          </div>
        )}
        {total != null && (
          <div className="ticket-dl-row">
            <dt>Total</dt>
            <dd>₹{total}</dd>
          </div>
        )}
      </dl>
      <div className="ticket-actions">
        {children}
        {isVirtual && onPrint && (
          <button className="btn btn-ghost btn-inv btn-sm" onClick={onPrint} style={{ marginTop: 8 }}>
            🖨️ Print / Save to PDF
          </button>
        )}
      </div>
    </div>
  );
}

// ── Step 6 · PIN ──────────────────────────────────────────────────────────────
function PinStep() {
  const { s } = useOrder();
  const [copied, setCopied] = useState(false);
  const code = s.job.code;
  const isVirtual = s.printer?.virtual;
  const autoTriggered = useRef(false);

  useEffect(() => {
    if (isVirtual && !autoTriggered.current) {
      autoTriggered.current = true;
      const t = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(t);
    }
  }, [isVirtual]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="step-body">
      <div className="pin-confetti" aria-hidden="true">{isVirtual ? '📄' : '🎉'}</div>
      <h1>{isVirtual ? 'Your PDF is ready!' : "You're all set!"}</h1>
      <p className="step-sub">
        {isVirtual
          ? 'Use Microsoft Print to PDF to save or print your document.'
          : 'Show this at the shop to collect your printout.'}
      </p>

      <Ticket
        code={code}
        name={s.name.trim()}
        printer={s.printer.name}
        copies={s.job?.settings?.copies || s.copies}
        pages={s.job?.filePages || s.file?.pages}
        total={s.job?.total}
      >
        <button className="btn btn-ghost btn-inv btn-sm" onClick={copyCode}>
          {copied ? '✓ Copied' : 'Copy PIN'}
        </button>
        <div className="qr-wrapper">
          <QRCodeSVG value={`print-out://job/${code}`} size={140} />
        </div>
      </Ticket>

      <PrintSlip job={s.job} />

      <p className="pin-hint muted-text">
        {isVirtual
          ? "In the print dialog, select 'Microsoft Print to PDF' (or Save as PDF) as your destination."
          : 'Show this PIN or QR code at the counter. Your printout will be ready.'}
      </p>

      {/* Sponsored Ad Banner */}
      <AdBanner />
    </div>
  );
}

// ── Print flow shell ──────────────────────────────────────────────────────────
function PrintFlow() {
  const { s, reset } = useOrder();
  const nav = useNavigate();
  const { step: stepStr } = useParams();
  const step = Number(stepStr);

  useEffect(() => {
    if (step === 0 && s.job) {
      reset();
    }
  }, [step, s.job, reset]);

  if (!(step >= 0 && step <= 5)) return <Navigate to="/print/0" replace />;
  for (let i = 0; i < step; i++) {
    if (!stepValid(i, s)) return <Navigate to={`/print/${i}`} replace />;
  }

  const stepComponents = [
    <PrinterStep />,
    <DocumentStep />,
    <SettingsStep />,
    <NameStep />,
    <PaymentStep />,
    <PinStep />,
  ];

  return (
    <div className="flow-layout">
      <Stepper step={step} />
      <main className="flow-main" key={step}>
        {stepComponents[step]}
      </main>
      <ActionBar>
        {step < 5 ? (
          <>
            <button
              className="btn btn-ghost"
              disabled={step === 0}
              onClick={() => nav(`/print/${step - 1}`)}
            >
              Back
            </button>
            <button
              className={'btn btn-solid' + (!stepValid(step, s) ? ' btn-disabled' : '')}
              disabled={!stepValid(step, s)}
              onClick={() => nav(`/print/${step + 1}`)}
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={() => nav('/pins')}>
              Track my job
            </button>
            <button className="btn btn-solid" onClick={() => { reset(); nav('/print/0'); }}>
              Print another
            </button>
          </>
        )}
      </ActionBar>
    </div>
  );
}

// ── Home ──────────────────────────────────────────────────────────────────────
function Home() {
  const nav = useNavigate();
  const { reset } = useOrder();
  const howSteps = [
    [
      'Pick your city and shop',
      'Choose your city and a printer that is online, then select your file from your phone or computer.',
    ],
    [
      'Confirm settings & price',
      'Choose colour, duplex and copies — the exact price shows up front before you pay.',
    ],
    [
      'Flash your PIN at pickup',
      'Walk in, show your 4-digit Print-Out PIN and name at the counter, and collect your printout.',
    ],
  ];

  return (
    <>
      <div className="promo-bar">
        <span className="promo-badge">Limited time</span>
        <p>
          <strong>Use Print-Out with no extra charge</strong> — pay only the shop's print price.
          No platform or service fee while our launch offer lasts.
        </p>
      </div>

      <main className="page home-page">
        <section className="hero-grid">
          <div className="hero-copy">
            <Panda size={72} />
            <h1 className="hero-heading">
              Send your print ahead.{' '}
              <mark className="hero-mark">Skip</mark> the counter line.
            </h1>
            <p className="step-sub">
              Order printouts from home or on the go, pick a local shop, and collect your pages
              with a 4-digit PIN. No flash drives, no emailing files, no waiting in queues.
            </p>
            <button className="btn btn-solid btn-hero" onClick={() => { reset(); nav('/print/0'); }}>
              Start printing
            </button>
          </div>

          <figure className="hero-figure">
            <Ticket code="4827" name="Alex Morgan" printer="Campus Copy Corner" copies={1} pages={2} total={4} />
            <figcaption className="muted-text" style={{ textAlign: 'center', marginTop: 10, fontSize: 14 }}>
              Example Print-Out pickup ticket
            </figcaption>
          </figure>
        </section>

        <section className="how-section">
          <h2 className="how-heading">How it works</h2>
          <ol className="how-list">
            {howSteps.map(([title, desc], i) => (
              <li key={title} className="how-card">
                <span className="how-num">{i + 1}</span>
                <div>
                  <strong className="how-title">{title}</strong>
                  <span className="how-desc muted-text">{desc}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}

// ── My PINs ────────────────────────────────────────────────────────────────────
function Pins() {
  const [jobs, setJobs] = useState(api.getJobs);
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  function handleFind(e) {
    e.preventDefault();
    const found = jobs.find((j) => j.code === q);
    setSel(found || null);
    setMsg(found ? '' : `No Print-Out PIN ${q || '—'} saved on this device. Check the 4 digits and try again.`);
  }

  function handleClearAll() {
    api.clearJobs();
    setJobs([]);
    setSel(null);
    setShowClearConfirm(false);
    setMsg('Print order history cleared successfully.');
    setTimeout(() => setMsg(''), 3000);
  }

  function handleDeleteSingle(e, code) {
    e.stopPropagation();
    const remaining = api.deleteJob(code);
    setJobs(remaining);
    if (sel?.code === code) {
      setSel(null);
    }
  }

  return (
    <main className="page pins-page">
      <div className="pins-header-row">
        <div>
          <h1>My PINs</h1>
          <p className="step-sub">Every Print-Out PIN saved on this phone, with live shop status.</p>
        </div>
        {jobs.length > 0 && (
          <button
            type="button"
            className="clear-history-btn"
            onClick={() => setShowClearConfirm(true)}
            aria-label="Clear all order history"
          >
            <span>🗑️</span>
            <span>Clear History</span>
          </button>
        )}
      </div>

      {showClearConfirm && (
        <div className="clear-confirm-card" role="alertdialog" aria-labelledby="clear-title">
          <div className="clear-confirm-content">
            <strong id="clear-title">Clear print order history?</strong>
            <p>This will remove all {jobs.length} saved pickup tickets and PINs from this device.</p>
          </div>
          <div className="clear-confirm-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowClearConfirm(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleClearAll}
            >
              Yes, clear all
            </button>
          </div>
        </div>
      )}

      <div className="pins-grid">
        <div className="pins-left">
          <form className="card" onSubmit={handleFind}>
            <label className="field-label" htmlFor="pin-search">Find a PIN on this phone</label>
            <div className="pin-find-row">
              <input
                id="pin-search"
                className="field-input pin-field"
                inputMode="numeric"
                maxLength={4}
                placeholder="4-digit PIN"
                value={q}
                onChange={(e) => setQ(e.target.value.replace(/\D/g, ''))}
              />
              <button className="btn btn-ghost" type="submit">Find</button>
            </div>
            {msg && <p className="error-msg" role="alert">{msg}</p>}
          </form>

          {jobs.length === 0 ? (
            <div className="empty-card">
              <div className="empty-icon">📋</div>
              <strong>No PINs yet</strong>
              <p>Print something and your Print-Out pickup PIN will appear here.</p>
            </div>
          ) : (
            jobs.map((j) => (
              <button
                key={j.code + j.at}
                className={'printer-card' + (sel?.code === j.code ? ' selected' : '') + (j.virtual ? ' virtual' : '')}
                aria-pressed={sel?.code === j.code}
                onClick={() => setSel(j)}
              >
                <div className="printer-info">
                  <div className="printer-name-row">
                    <strong className="clip-text">{j.file}</strong>
                    {j.virtual && <span className="virtual-badge">Virtual · PDF</span>}
                    <button
                      type="button"
                      className="pin-delete-single"
                      title="Delete this ticket"
                      aria-label={`Delete ticket for ${j.file}`}
                      onClick={(e) => handleDeleteSingle(e, j.code)}
                    >
                      ✕
                    </button>
                  </div>
                  <span className="muted-text">{j.printer} · ₹{j.total}</span>
                  <span className="pin-badge">PIN {j.code}</span>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="pins-right">
          {sel ? (
            <>
              <Ticket
                code={sel.code}
                name={sel.name}
                printer={sel.printer}
                copies={sel.settings?.copies || sel.copies}
                pages={sel.filePages}
                total={sel.total}
                isVirtual={sel.virtual}
                onPrint={() => window.print()}
              />
              {sel.virtual && <PrintSlip job={sel} />}
              <AdBanner />
            </>
          ) : (
            <div className="empty-card">
              <div className="empty-icon">🎫</div>
              <strong>No ticket selected</strong>
              <p>Tap any Print-Out PIN in the list to see its pickup ticket here.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ── Navigation links ───────────────────────────────────────────────────────────
function AppNav({ className }) {
  const { pathname } = useLocation();
  const { s, reset } = useOrder();
  return (
    <nav className={className} aria-label="Main">
      <NavLink to="/" end>Home</NavLink>
      <NavLink
        to="/print/0"
        className={pathname.startsWith('/print') ? 'active' : ''}
        onClick={() => {
          if (s.job) reset();
        }}
      >
        Print
      </NavLink>
      <NavLink to="/pins">My PINs</NavLink>
    </nav>
  );
}

// ── App shell ─────────────────────────────────────────────────────────────────
function Shell() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { reset } = useOrder();

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <Link to="/" className="brand-link">
            <Panda size={36} />
            <span className="brand-name">Print-Out</span>
          </Link>
          <AppNav className="desktop-nav" />
          <button className="btn btn-solid btn-sm header-cta" onClick={() => { reset(); nav('/print/0'); }}>
            Start printing
          </button>
        </div>
        <div className="header-divider" />
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/print/:step" element={<PrintFlow />} />
        <Route path="/print" element={<Navigate to="/print/0" replace />} />
        <Route path="/pins" element={<Pins />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <AppNav className="bottom-tabs" />
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [s, setS] = useState(fresh);
  const reset = () => {
    setS((prev) => {
      if (prev?.file?.previewUrl) {
        try { URL.revokeObjectURL(prev.file.previewUrl); } catch {}
      }
      return fresh();
    });
  };
  const ctx = {
    s,
    set: (patch) => setS((prev) => ({ ...prev, ...patch })),
    reset,
  };
  return (
    <Ctx.Provider value={ctx}>
      <HashRouter>
        <Shell />
      </HashRouter>
    </Ctx.Provider>
  );
}

