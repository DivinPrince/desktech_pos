import { formatMinorUnitsToCurrency } from "@/lib/format-money";

import type { CompletedSaleReceipt } from "@/lib/counter-checkout/types";

export type ReceiptPdfThemeColors = {
  paper: string;
  muted: string;
  ink: string;
  pageBg: string;
};

export type BuildReceiptPdfHtmlOptions = {
  businessCurrency?: string;
  theme?: ReceiptPdfThemeColors;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function customerHasDetails(c: CompletedSaleReceipt["customer"]): boolean {
  return (
    c.name.trim().length > 0 ||
    c.phone.trim().length > 0 ||
    c.email.trim().length > 0 ||
    c.address.trim().length > 0
  );
}

function thermalZigzagPath(viewW: number, depth = 7): string {
  const n = Math.max(16, Math.round(viewW / 11));
  const step = viewW / n;
  let d = `M 0 ${depth}`;
  for (let i = 0; i < n; i++) {
    const peakX = (i + 0.5) * step;
    const valleyX = (i + 1) * step;
    d += ` L ${peakX} 0 L ${valleyX} ${depth}`;
  }
  d += ` L 0 ${depth} Z`;
  return d;
}

function dashedRule(muted: string): string {
  return `<div class="rule" style="border-top-color: ${muted};"></div>`;
}

/**
 * HTML document for thermal-style receipt PDF (expo-print / WKWebView).
 * Pass `theme` from the app so the PDF matches the on-screen receipt (light/dark).
 */
export function buildReceiptPdfHtml(
  receipt: CompletedSaleReceipt,
  options?: BuildReceiptPdfHtmlOptions,
): string {
  const businessCurrency = options?.businessCurrency ?? "USD";
  const paper = options?.theme?.paper ?? "#fffef9";
  const muted = options?.theme?.muted ?? "#737373";
  const ink = options?.theme?.ink ?? "#171717";
  const pageBg = options?.theme?.pageBg ?? "#e8e8e8";

  const currency =
    receipt.currency.trim().length > 0 ? receipt.currency.trim() : businessCurrency;
  const title = receipt.businessName?.trim().length
    ? receipt.businessName.trim()
    : "Receipt";

  const d = new Date(receipt.completedAtIso);
  const completedLabel = Number.isNaN(d.getTime())
    ? escapeHtml(receipt.completedAtIso)
    : escapeHtml(
        d.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }),
      );

  const itemsHtml =
    receipt.lines.length === 0
      ? `<p class="muted">(No line items)</p>`
      : receipt.lines
          .map((line) => {
            const lineTotal = line.priceCents * line.quantity;
            return `
            <div class="line-block">
              <div class="line-name">${escapeHtml(line.name)}</div>
              <div class="line-row">
                <span class="muted line-row-left">${line.quantity} @ ${escapeHtml(formatMinorUnitsToCurrency(line.priceCents, currency))}</span>
                <span class="lineAmt">${escapeHtml(formatMinorUnitsToCurrency(lineTotal, currency))}</span>
              </div>
            </div>`;
          })
          .join("");

  let customerHtml = "";
  if (customerHasDetails(receipt.customer)) {
    const c = receipt.customer;
    const bits: string[] = ["<div class=\"section\">", "<div class=\"label\">CUSTOMER</div>"];
    if (c.name.trim()) bits.push(`<div>${escapeHtml(c.name.trim())}</div>`);
    if (c.phone.trim()) {
      bits.push(
        `<div class="muted">${escapeHtml(`${c.dialCode.trim()}${c.phone.trim()}`)}</div>`,
      );
    }
    if (c.email.trim()) bits.push(`<div class="muted">${escapeHtml(c.email.trim())}</div>`);
    if (c.address.trim()) bits.push(`<div class="muted">${escapeHtml(c.address.trim())}</div>`);
    bits.push("</div>", dashedRule(muted));
    customerHtml = bits.join("");
  }

  let noteHtml = "";
  if (receipt.paymentNote.trim()) {
    noteHtml = `
      <div class="section">
        <div class="label">NOTE</div>
        <div>${escapeHtml(receipt.paymentNote.trim())}</div>
      </div>
      ${dashedRule(muted)}`;
  }

  const zigzag = thermalZigzagPath(300);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    @page { margin: 12px; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: ${pageBg};
      color: ${ink};
      font-family: ui-monospace, "Menlo", "Consolas", "Courier New", monospace;
      font-size: 12px;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .wrap {
      padding: 0 0 16px;
      width: 100%;
      max-width: 100%;
    }
    .sheet {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
      background: ${paper};
      padding: 0 16px 22px;
      box-shadow: none;
    }
    svg.zig { display: block; width: 100%; max-width: 100%; height: 7px; margin: 0; }
    .ribbon {
      text-align: center;
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: ${muted};
      margin-top: 6px;
    }
    .rule {
      border: none;
      border-top: 1px dashed;
      opacity: 0.65;
      margin: 10px 0;
      height: 0;
      width: calc(100% + 32px);
      max-width: calc(100% + 32px);
      margin-left: -16px;
      margin-right: -16px;
      padding: 0;
    }
    .store {
      text-align: center;
      font-size: 17px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin: 4px 0;
      color: ${ink};
      word-wrap: break-word;
    }
    .when {
      text-align: center;
      font-size: 11px;
      color: ${muted};
      margin-top: 6px;
    }
    .pay {
      text-align: center;
      margin-top: 12px;
      font-size: 12px;
      font-weight: 600;
      color: ${ink};
    }
    .label {
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: ${muted};
      margin-top: 8px;
    }
    .line-block {
      margin-top: 10px;
      width: 100%;
      max-width: 100%;
    }
    .line-name {
      font-weight: 700;
      font-size: 12px;
      margin-bottom: 3px;
      color: ${ink};
      word-wrap: break-word;
    }
    .line-row {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      width: 100%;
      max-width: 100%;
    }
    .line-row-left {
      flex: 1 1 auto;
      min-width: 0;
    }
    .lineAmt {
      font-weight: 700;
      text-align: right;
      white-space: nowrap;
      flex-shrink: 0;
      color: ${ink};
    }
    .muted { color: ${muted}; font-size: 11px; }
    .total-row {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
      margin-top: 8px;
      font-weight: 800;
      width: 100%;
      max-width: 100%;
    }
    .total-word { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: ${ink}; }
    .total-amt { font-size: 20px; color: ${ink}; }
    .section { margin-top: 6px; word-wrap: break-word; }
    .thanks {
      text-align: center;
      margin-top: 18px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.35em;
      text-transform: uppercase;
      color: ${muted};
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="sheet">
      <svg class="zig" viewBox="0 0 300 7" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path fill="${paper}" d="${zigzag}" />
      </svg>
      <div class="ribbon">Thank you for your purchase</div>
      ${dashedRule(muted)}
      <div class="store">${escapeHtml(title)}</div>
      <div class="when">${completedLabel}</div>
      <div class="pay">${escapeHtml(receipt.paymentMethodLabel)}</div>
      ${dashedRule(muted)}
      <div class="label">Items</div>
      ${itemsHtml}
      ${dashedRule(muted)}
      <div class="total-row">
        <span class="total-word">Total</span>
        <span class="total-amt">${escapeHtml(formatMinorUnitsToCurrency(receipt.totalCents, currency))}</span>
      </div>
      ${dashedRule(muted)}
      ${customerHtml}
      ${noteHtml}
      <div class="thanks">Thank you ★</div>
    </div>
  </div>
</body>
</html>`;
}

export function estimateReceiptPdfPageHeightPx(receipt: CompletedSaleReceipt): number {
  const base = 520;
  const perLine = 48;
  const customer = customerHasDetails(receipt.customer) ? 140 : 0;
  const note = receipt.paymentNote.trim().length > 0 ? 72 : 0;
  return Math.min(3200, base + receipt.lines.length * perLine + customer + note);
}
