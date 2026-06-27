export type DocumentType = 'quote' | 'invoice';

export interface InvoiceMeta {
  issueDate: string;
  dueDate: string;
  bankingDetails: string;
}

export interface InvoiceScopeLine {
  id: string;
  code: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  conf: string;
  total: number;
  supplier: string;
}

export interface InvoiceLabourLine {
  id: string;
  description: string;
  hours: number;
  rate: number;
  cost: number;
  conf: string;
  derivation: string;
}

export interface InvoiceInputs {
  projectName: string;
  clientName: string;
  _geyser?: unknown;
}

export const DEFAULT_BANKING_DETAILS = 'Bank: [Your Bank] · Account: [Account Number] · Branch: [Branch Code] · Reference: invoice number';

export const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export function addDays(dateIso: string, days: number) {
  const date = new Date(dateIso || isoDate(new Date()));
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function displayDate(dateIso: string) {
  return new Date(dateIso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function fmtN(value: number) {
  return value.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function esc(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function printInvoiceDocument(args: {
  inputs: InvoiceInputs;
  scope: InvoiceScopeLine[];
  labour: InvoiceLabourLine[];
  invoiceRef: string;
  invoiceMeta: InvoiceMeta;
  sellExVat: number;
}) {
  const { inputs, scope, labour, invoiceRef, invoiceMeta, sellExVat } = args;
  const issueDate = invoiceMeta.issueDate || isoDate(new Date());
  const dueDate = invoiceMeta.dueDate || addDays(issueDate, 7);
  const bankingDetails = invoiceMeta.bankingDetails || DEFAULT_BANKING_DETAILS;
  const materialTotal = scope.reduce((sum, line) => sum + line.total, 0);
  const labourTotal = labour.reduce((sum, line) => sum + line.cost, 0);
  const allowance = sellExVat - materialTotal - labourTotal;
  const vat = sellExVat * 0.15;
  const totalDue = sellExVat + vat;
  const narrative = inputs._geyser
    ? `Called out and completed ${inputs.projectName || 'geyser work'}. Supplied and fitted the recorded geyser materials and completed the labour listed below.`
    : `Called out and completed plumbing work at ${inputs.projectName || 'the job address'}. Supplied, fitted and used the recorded pipe, fittings, fixtures and labour listed below.`;

  const materialRows = scope.map((line) => `
    <tr>
      <td><strong>${esc(line.description)}</strong><div class="sub">${esc(line.code)} · ${esc(line.supplier)} · ${esc(line.conf)}</div></td>
      <td>${esc(line.unit)}</td>
      <td class="num">${esc(line.qty)}</td>
      <td class="num">R ${fmtN(line.unitPrice)}</td>
      <td class="num strong">R ${fmtN(line.total)}</td>
    </tr>`).join('');

  const labourRows = labour.map((line) => `
    <tr>
      <td><strong>${esc(line.description)}</strong><div class="sub">${esc(line.conf)} · ${esc(line.derivation)}</div></td>
      <td>hr</td>
      <td class="num">${fmtN(line.hours)}</td>
      <td class="num">R ${fmtN(line.rate)}</td>
      <td class="num strong">R ${fmtN(line.cost)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${esc(invoiceRef)} — Plumbing Invoice</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#1a1a2e;background:#fff}.page{max-width:850px;margin:0 auto;padding:32px 40px}.header{background:#0D1B2A;padding:24px 32px;display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #F5A623}.logo-mark{width:42px;height:42px;background:#F5A623;clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;color:#0D1B2A}.logo-text{color:#F5A623;font-weight:900;font-size:20px}.logo-sub{color:#8FA3B8;font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-top:2px}.doc-label{text-align:right}.doc-label h2{color:#F5A623;font-size:22px;letter-spacing:3px;text-transform:uppercase}.doc-label p{color:#8FA3B8;font-size:11px;margin-top:4px}.doc-label strong{color:#fff}.parties{display:grid;grid-template-columns:1fr 1fr;gap:0;margin:28px 0;border:1px solid #e0e5ec}.party{padding:18px 20px}.party:first-child{border-right:1px solid #e0e5ec}.party-label{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#8FA3B8;margin-bottom:6px}.party h3{font-size:15px;font-weight:800;color:#0D1B2A}.party p{font-size:11px;color:#6B859E;margin-top:3px}.section-bar{background:#0D1B2A;color:#F5A623;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:7px 16px;margin:20px 0 0}.narrative{border:1px solid #e0e5ec;border-top:none;padding:14px 16px;color:#4A6080;line-height:1.6}table{width:100%;border-collapse:collapse;margin-top:0}thead tr{background:#0D1B2A}thead th{color:#8FA3B8;font-size:10px;font-weight:600;text-align:left;padding:8px 12px}tbody tr{border-bottom:1px solid #f0f4f8}tbody tr:nth-child(odd){background:#f7f8fa}td{padding:10px 12px;font-size:11px;color:#0D1B2A}td .sub{font-size:9px;color:#8FA3B8;margin-top:2px}.num{text-align:right}.strong{font-weight:700}.totals{margin-top:0;border:1px solid #e0e5ec;border-top:none}.total-row{display:flex;justify-content:space-between;padding:9px 16px;font-size:12px;border-bottom:1px solid #f0f4f8}.total-final{background:#0D1B2A;color:#fff;display:flex;justify-content:space-between;padding:15px 16px;font-size:17px;font-weight:900}.total-final span:last-child{color:#F5A623}.terms{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:24px}.terms-box{border:1px solid #e0e5ec;padding:14px 16px;font-size:11px;color:#4A6080;line-height:1.6}.terms-box h4{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#0D1B2A;font-weight:700;margin-bottom:6px}.footer{margin-top:32px;text-align:center;font-size:9px;color:#8FA3B8;text-transform:uppercase}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body><div class="page">
<div class="header"><div style="display:flex;align-items:center;gap:14px"><div class="logo-mark">CO</div><div><div class="logo-text">ContractorOS</div><div class="logo-sub">Plumbing · Actuals Invoice</div></div></div><div class="doc-label"><h2>Invoice</h2><p>Ref: <strong>${esc(invoiceRef)}</strong></p><p>Issued: <strong>${displayDate(issueDate)}</strong></p><p>Due: <strong>${displayDate(dueDate)}</strong></p><p>Status: <strong>ISSUED</strong></p></div></div>
<div class="parties"><div class="party"><div class="party-label">Invoice To</div><h3>${esc(inputs.clientName || 'Client')}</h3><p>${esc(inputs.projectName || 'Project / address not specified')}</p></div><div class="party"><div class="party-label">From</div><h3>[Your Plumbing Business]</h3><p>VAT vendor details / contact details</p></div></div>
<div class="section-bar">Work Completed</div><div class="narrative">${esc(narrative)}</div>
<div class="section-bar">Actual Material Lines</div><table><thead><tr><th>Description</th><th>Unit</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Line total</th></tr></thead><tbody>${materialRows}</tbody></table>
<div class="section-bar">Labour</div><table><thead><tr><th>Description</th><th>Unit</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Line total</th></tr></thead><tbody>${labourRows}</tbody></table>
<div class="totals"><div class="total-row"><span>Materials used excl VAT</span><span>R ${fmtN(materialTotal)}</span></div><div class="total-row"><span>Labour excl VAT</span><span>R ${fmtN(labourTotal)}</span></div><div class="total-row"><span>Commercial allowances and margin excl VAT</span><span>R ${fmtN(allowance)}</span></div><div class="total-row"><span>Subtotal excl VAT</span><span>R ${fmtN(sellExVat)}</span></div><div class="total-row"><span>VAT @ 15%</span><span>R ${fmtN(vat)}</span></div></div>
<div class="total-final"><span>Total amount due</span><span>R ${fmtN(totalDue)}</span></div>
<div class="terms"><div class="terms-box"><h4>Banking Details</h4><div>${esc(bankingDetails)}</div></div><div class="terms-box"><h4>Invoice Terms</h4><div>— Due date: ${displayDate(dueDate)}</div><div>— Invoice records actual materials and labour used.</div><div>— Line confidence grades are retained for audit and do not block invoice issue.</div></div></div>
<div class="footer">ContractorOS — Invoice · ${esc(invoiceRef)} · Total amount due includes 15% VAT</div>
</div></body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${invoiceRef}_Invoice.html`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
