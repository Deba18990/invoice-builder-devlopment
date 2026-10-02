import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import {
  FileText, Plus, Trash2, Download, Printer, RotateCcw,
  ReceiptText, CheckCircle2, CircleDollarSign, CalendarDays
} from "lucide-react";

const STORAGE_KEY = "invoice-builder-v1";
const today = new Date().toISOString().slice(0, 10);

const makeItem = () => ({
  id: typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  description: "",
  unit: "service",
  quantity: "1",
  rate: "0",
});

const defaultInvoice = () => ({
  invoiceNumber: "INV-001",
  issueDate: today,
  dueDate: today,
  businessName: "Your Business",
  businessEmail: "",
  businessPhone: "",
  businessAddress: "",
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  clientAddress: "",
  currency: "INR",
  taxRate: "18",
  notes: "Thank you for your business!",
  items: [{ ...makeItem(), description: "Web development", quantity: "2", rate: "1000" }],
});

const currencies = [
  { value: "INR", label: "INR (₹)" },
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
];

function readSavedInvoice() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultInvoice();
    const parsed = JSON.parse(saved);
    if (!parsed || !Array.isArray(parsed.items)) return defaultInvoice();
    return { ...defaultInvoice(), ...parsed, items: parsed.items };
  } catch {
    return defaultInvoice();
  }
}

function money(amount, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${currency} ${(Number(amount) || 0).toFixed(2)}`;
  }
}

function dateLabel(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(date);
}

function Field({ label, value, onChange, type = "text", placeholder = "", min, step, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <input
        type={type}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        min={min}
        step={step}
        className="field"
      />
    </label>
  );
}

function TextAreaField({ label, value, onChange, placeholder = "", rows = 3 }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <textarea
        rows={rows}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="field resize-y"
      />
    </label>
  );
}

function Section({ title, description, children, icon: Icon }) {
  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600"><Icon size={19} /></div>
        <div>
          <h2 className="font-bold text-slate-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function App() {
  const [invoice, setInvoice] = useState(readSavedInvoice);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(invoice));
      setSavedNotice(true);
      const timeout = window.setTimeout(() => setSavedNotice(false), 1800);
      return () => window.clearTimeout(timeout);
    } catch {
      setSavedNotice(false);
    }
  }, [invoice]);

  const update = (field, value) => setInvoice((current) => ({ ...current, [field]: value }));

  const updateItem = (id, field, value) => {
    setInvoice((current) => ({
      ...current,
      items: current.items.map((item) => item.id === id ? { ...item, [field]: value } : item),
    }));
  };

  const addItem = () => setInvoice((current) => ({
    ...current,
    items: [...current.items, makeItem()],
  }));

  const removeItem = (id) => setInvoice((current) => ({
    ...current,
    items: current.items.filter((item) => item.id !== id),
  }));

  const totals = useMemo(() => {
    const subtotal = invoice.items.reduce((sum, item) => {
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const rate = Math.max(0, Number(item.rate) || 0);
      return sum + quantity * rate;
    }, 0);
    const taxRate = Math.min(100, Math.max(0, Number(invoice.taxRate) || 0));
    const tax = subtotal * taxRate / 100;
    return { subtotal, tax, total: subtotal + tax };
  }, [invoice.items, invoice.taxRate]);

  const exportPDF = () => {
    const pdf = new jsPDF({ format: "a4", unit: "mm" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const right = pageWidth - margin;
    let y = 19;
    const usableWidth = pageWidth - margin * 2;
    const ensureSpace = (height) => {
      if (y + height > pageHeight - margin) {
        pdf.addPage();
        y = 19;
      }
    };
    const lines = (text, width) => pdf.splitTextToSize(String(text || "—"), width);
    const text = (value, x, yy, options) => pdf.text(String(value ?? ""), x, yy, options || {});

    pdf.setFillColor(79, 70, 229);
    pdf.rect(0, 0, pageWidth, 5, "F");
    pdf.setTextColor(79, 70, 229);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(24);
    text("INVOICE", margin, y + 3);
    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(10);
    text(invoice.invoiceNumber || "INV-001", right, y + 2, { align: "right" });
    y += 13;
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, y, right, y);
    y += 10;

    const col1 = margin;
    const col2 = pageWidth / 2 + 3;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    text(invoice.businessName || "Your Business", col1, y);
    text("BILL TO", col2, y);
    y += 6;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    const leftDetails = [invoice.businessEmail, invoice.businessPhone, ...lines(invoice.businessAddress, 75)].filter(Boolean);
    const rightDetails = [invoice.clientName || "Client name", invoice.clientEmail, invoice.clientPhone, ...lines(invoice.clientAddress, 75)].filter(Boolean);
    const detailRows = Math.max(leftDetails.length, rightDetails.length);
    for (let i = 0; i < detailRows; i += 1) {
      ensureSpace(5);
      if (leftDetails[i]) text(leftDetails[i], col1, y);
      if (rightDetails[i]) text(rightDetails[i], col2, y);
      y += 5;
    }

    y += 5;
    ensureSpace(19);
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(margin, y - 4, usableWidth, 16, 2, 2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    text("ISSUE DATE", margin + 4, y + 1);
    text("DUE DATE", margin + 65, y + 1);
    text("CURRENCY", margin + 126, y + 1);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    text(dateLabel(invoice.issueDate), margin + 4, y + 7);
    text(dateLabel(invoice.dueDate), margin + 65, y + 7);
    text(invoice.currency, margin + 126, y + 7);
    y += 22;

    const xDesc = margin + 3;
    const xUnit = right - 77;
    const xQty = right - 56;
    const xRate = right - 32;
    const xAmount = right - 3;
    const drawTableHeader = () => {
      pdf.setFillColor(79, 70, 229);
      pdf.rect(margin, y - 5, usableWidth, 10, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      text("DESCRIPTION", xDesc, y + 1);
      text("UNIT", xUnit, y + 1, { align: "center" });
      text("QTY", xQty, y + 1, { align: "right" });
      text("RATE", xRate, y + 1, { align: "right" });
      text("AMOUNT", xAmount, y + 1, { align: "right" });
      pdf.setTextColor(30, 41, 59);
      pdf.setFont("helvetica", "normal");
      y += 12;
    };
    drawTableHeader();

    if (invoice.items.length === 0) {
      text("No items added", xDesc, y);
      y += 10;
    }
    invoice.items.forEach((item) => {
      const descriptionLines = lines(item.description || "Untitled item", 67);
      const rowHeight = Math.max(9, descriptionLines.length * 4.5 + 3);
      ensureSpace(rowHeight + 2);
      if (y + rowHeight > pageHeight - margin) {
        pdf.addPage();
        y = 19;
        drawTableHeader();
      }
      pdf.setDrawColor(226, 232, 240);
      pdf.line(margin, y + 3, right, y + 3);
      pdf.setFontSize(8.5);
      text(descriptionLines, xDesc, y);
      text(item.unit || "unit", xUnit, y, { align: "center" });
      text(Number(item.quantity) || 0, xQty, y, { align: "right" });
      text(money(Number(item.rate) || 0, invoice.currency), xRate, y, { align: "right" });
      text(money((Number(item.quantity) || 0) * (Number(item.rate) || 0), invoice.currency), xAmount, y, { align: "right" });
      y += rowHeight;
    });

    y += 9;
    ensureSpace(40);
    const summary = [
      ["Subtotal", totals.subtotal],
      [`Tax (${Number(invoice.taxRate) || 0}%)`, totals.tax],
      ["Grand total", totals.total],
    ];
    summary.forEach(([label, amount], index) => {
      if (index === 2) {
        pdf.setDrawColor(79, 70, 229);
        pdf.setLineWidth(0.5);
        pdf.line(right - 65, y - 4, right, y - 4);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
      } else {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
      }
      text(label, right - 65, y);
      text(money(amount, invoice.currency), right, y, { align: "right" });
      y += 8;
    });

    if (invoice.notes) {
      y += 7;
      ensureSpace(15);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      text("NOTES", margin, y);
      y += 5;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      lines(invoice.notes, usableWidth).forEach((line) => {
        ensureSpace(5);
        text(line, margin, y);
        y += 5;
      });
    }

    const safeName = (invoice.invoiceNumber || "invoice").replace(/[^a-z0-9-_]/gi, "_");
    pdf.save(`${safeName}.pdf`);
  };

  const resetInvoice = () => {
    if (window.confirm("Reset all invoice details? This replaces the saved draft in this browser.")) {
      setInvoice(defaultInvoice());
    }
  };

  return (
    <main className="app-shell mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <header className="no-print mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-indigo-600 p-3 text-white shadow-lg shadow-indigo-200">
            <ReceiptText size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Invoice Builder</h1>
            <p className="mt-1 text-sm text-slate-500">Simple, clear invoicing for your work.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 inline-flex items-center gap-1.5 text-xs text-emerald-700">
            <CheckCircle2 size={15} /> {savedNotice ? "Draft saved locally" : "Local draft enabled"}
          </span>
          <button className="button-secondary" onClick={resetInvoice}><RotateCcw size={16} /> Reset</button>
          <button className="button-secondary" onClick={() => window.print()}><Printer size={16} /> Print</button>
          <button className="button-primary" onClick={exportPDF}><Download size={16} /> Export PDF</button>
        </div>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="no-print space-y-5">
          <Section title="Your business" description="The sender details shown on the invoice." icon={FileText}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Business name" value={invoice.businessName} onChange={(v) => update("businessName", v)} />
              <Field label="Business email" type="email" value={invoice.businessEmail} onChange={(v) => update("businessEmail", v)} placeholder="hello@example.com" />
              <Field label="Business phone" value={invoice.businessPhone} onChange={(v) => update("businessPhone", v)} placeholder="+91 ..." />
              <TextAreaField label="Business address" value={invoice.businessAddress} onChange={(v) => update("businessAddress", v)} placeholder="Street, city, state, postal code" rows={2} />
            </div>
          </Section>

          <Section title="Client & invoice details" description="Who the invoice is for and when it is due." icon={CalendarDays}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client name" value={invoice.clientName} onChange={(v) => update("clientName", v)} placeholder="Client or company name" />
              <Field label="Client email" type="email" value={invoice.clientEmail} onChange={(v) => update("clientEmail", v)} placeholder="client@example.com" />
              <Field label="Client phone" value={invoice.clientPhone} onChange={(v) => update("clientPhone", v)} placeholder="+91 ..." />
              <Field label="Invoice number" value={invoice.invoiceNumber} onChange={(v) => update("invoiceNumber", v)} placeholder="INV-001" />
              <Field label="Issue date" type="date" value={invoice.issueDate} onChange={(v) => update("issueDate", v)} />
              <Field label="Due date" type="date" value={invoice.dueDate} onChange={(v) => update("dueDate", v)} />
              <TextAreaField label="Client billing address" value={invoice.clientAddress} onChange={(v) => update("clientAddress", v)} placeholder="Street, city, state, postal code" rows={2} />
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Currency</span>
                <select className="field" value={invoice.currency} onChange={(e) => update("currency", e.target.value)}>
                  {currencies.map((currency) => <option key={currency.value} value={currency.value}>{currency.label}</option>)}
                </select>
              </label>
            </div>
          </Section>

          <Section title="Line items" description="Add products or services. Totals update as you edit." icon={CircleDollarSign}>
            <div className="space-y-4">
              {invoice.items.map((item, index) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700">Item {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      aria-label={`Remove item ${index + 1}`}
                    ><Trash2 size={14} /> Remove</button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px]">
                    <Field label="Description" value={item.description} onChange={(v) => updateItem(item.id, "description", v)} placeholder="e.g. Website design" />
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Unit</span>
                      <select className="field" value={item.unit} onChange={(e) => updateItem(item.id, "unit", e.target.value)}>
                        <option value="service">Service</option>
                        <option value="piece">Piece</option>
                        <option value="hour">Hour</option>
                        <option value="day">Day</option>
                        <option value="item">Item</option>
                        <option value="month">Month</option>
                        <option value="kg">Kg</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Field label="Quantity" type="number" min="0" step="any" value={item.quantity} onChange={(v) => updateItem(item.id, "quantity", v)} />
                    <Field label={`Rate (${invoice.currency})`} type="number" min="0" step="any" value={item.rate} onChange={(v) => updateItem(item.id, "rate", v)} />
                    <div className="col-span-2 rounded-lg bg-white px-3 py-2.5 sm:col-span-1">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Amount</span>
                      <span className="mt-1 block truncate text-sm font-bold text-slate-900">
                        {money((Number(item.quantity) || 0) * (Number(item.rate) || 0), invoice.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/60 px-4 py-3 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50" onClick={addItem}>
              <Plus size={17} /> Add line item
            </button>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Tax rate (%)" type="number" min="0" step="0.1" value={invoice.taxRate} onChange={(v) => update("taxRate", v)} />
              <TextAreaField label="Notes / payment terms" value={invoice.notes} onChange={(v) => update("notes", v)} placeholder="Payment instructions, due terms, or a thank-you note." rows={2} />
            </div>
          </Section>
        </div>

        <section className="min-w-0 xl:sticky xl:top-5">
          <div className="no-print mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-800">Live preview</h2>
              <p className="text-xs text-slate-500">This is the invoice layout for printing.</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Live</span>
          </div>

          <article className="invoice-preview mx-auto max-w-[760px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
            <div className="h-2 bg-indigo-600" />
            <div className="p-5 sm:p-8 lg:p-10">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="min-w-0 flex-1">
                  <div className="mb-4 inline-flex rounded-lg bg-indigo-50 p-2.5 text-indigo-600"><ReceiptText size={22} /></div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Invoice</p>
                  <h2 className="mt-2 break-words text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{invoice.businessName || "Your Business"}</h2>
                  <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-slate-500">{invoice.businessAddress || "Business address"}</p>
                  {invoice.businessEmail && <p className="mt-1 break-all text-sm text-slate-500">{invoice.businessEmail}</p>}
                  {invoice.businessPhone && <p className="mt-1 text-sm text-slate-500">{invoice.businessPhone}</p>}
                </div>
                <div className="min-w-[145px] rounded-xl bg-slate-50 p-4 sm:text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invoice number</p>
                  <p className="mt-1 break-all text-lg font-extrabold text-slate-900">{invoice.invoiceNumber || "—"}</p>
                  <div className="mt-4">
                    <p className="text-xs text-slate-400">Issue date</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{dateLabel(invoice.issueDate)}</p>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs text-slate-400">Due date</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{dateLabel(invoice.dueDate)}</p>
                  </div>
                </div>
              </div>

              <div className="my-8 border-t border-slate-200" />

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Bill to</p>
                  <h3 className="break-words font-bold text-slate-900">{invoice.clientName || "Client name"}</h3>
                  {invoice.clientEmail && <p className="mt-1 break-all text-sm text-slate-500">{invoice.clientEmail}</p>}
                  {invoice.clientPhone && <p className="mt-1 text-sm text-slate-500">{invoice.clientPhone}</p>}
                  <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-slate-500">{invoice.clientAddress || "Client billing address"}</p>
                </div>
                <div className="sm:text-right">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Amount due</p>
                  <p className="break-words text-3xl font-extrabold tracking-tight text-indigo-600">{money(totals.total, invoice.currency)}</p>
                  <p className="mt-2 text-sm text-slate-500">Currency: {invoice.currency}</p>
                </div>
              </div>

              <div className="preview-scroll mt-8 overflow-x-auto">
                <table className="w-full min-w-[460px] border-collapse text-left">
                  <thead>
                    <tr className="border-y border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3 pr-3">Description</th>
                      <th className="px-2 py-3 text-center">Unit</th>
                      <th className="px-2 py-3 text-right">Qty</th>
                      <th className="px-2 py-3 text-right">Rate</th>
                      <th className="py-3 pl-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 align-top">
                        <td className="max-w-[180px] break-words py-4 pr-3 text-sm font-medium text-slate-700">{item.description || "Untitled item"}</td>
                        <td className="px-2 py-4 text-center text-xs text-slate-500">{item.unit || "—"}</td>
                        <td className="px-2 py-4 text-right text-sm text-slate-600">{Number(item.quantity) || 0}</td>
                        <td className="px-2 py-4 text-right text-sm text-slate-600">{money(Number(item.rate) || 0, invoice.currency)}</td>
                        <td className="py-4 pl-2 text-right text-sm font-bold text-slate-900">{money((Number(item.quantity) || 0) * (Number(item.rate) || 0), invoice.currency)}</td>
                      </tr>
                    ))}
                    {invoice.items.length === 0 && <tr><td colSpan="5" className="py-8 text-center text-sm text-slate-400">Add a line item to get started.</td></tr>}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <div className="w-full max-w-[310px] space-y-3">
                  <div className="flex justify-between gap-4 text-sm text-slate-500"><span>Subtotal</span><span className="font-semibold text-slate-800">{money(totals.subtotal, invoice.currency)}</span></div>
                  <div className="flex justify-between gap-4 text-sm text-slate-500"><span>Tax ({Math.min(100, Math.max(0, Number(invoice.taxRate) || 0))}%)</span><span className="font-semibold text-slate-800">{money(totals.tax, invoice.currency)}</span></div>
                  <div className="border-t-2 border-slate-900 pt-4">
                    <div className="flex items-center justify-between gap-4"><span className="font-bold text-slate-900">Grand total</span><span className="break-words text-xl font-extrabold text-indigo-600">{money(totals.total, invoice.currency)}</span></div>
                  </div>
                </div>
              </div>

              {invoice.notes && <div className="mt-9 rounded-xl bg-slate-50 p-4 sm:p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Notes & payment terms</p>
                <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-slate-600">{invoice.notes}</p>
              </div>}

              <div className="mt-10 border-t border-slate-200 pt-5 text-center">
                <p className="text-sm font-semibold text-slate-600">Thank you for your business.</p>
                <p className="mt-1 text-xs text-slate-400">Generated with Invoice Builder</p>
              </div>
            </div>
          </article>
          <div className="no-print mx-auto mt-4 grid max-w-[760px] grid-cols-2 gap-3">
            <button className="button-primary justify-center" onClick={exportPDF}><Download size={16} /> Download PDF</button>
            <button className="button-secondary justify-center" onClick={() => window.print()}><Printer size={16} /> Print invoice</button>
          </div>
          <p className="no-print mx-auto mt-3 max-w-[760px] text-center text-xs leading-5 text-slate-400">Your draft is saved in this browser using localStorage. It stays on this device and browser unless you clear site data.</p>
        </section>
      </div>
    </main>
  );
}

export default App;
