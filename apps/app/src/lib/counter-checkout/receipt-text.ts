import { formatMinorUnitsToCurrency } from "@/lib/format-money";

import type { CompletedSaleReceipt } from "@/lib/counter-checkout/types";

export function buildReceiptText(r: CompletedSaleReceipt): string {
  const lines = [
    r.businessName ? r.businessName : "Receipt",
    "—",
    `Date: ${new Date(r.completedAtIso).toLocaleString()}`,
    "",
    "Items:",
    ...r.lines.map((l) => {
      const sub = l.priceCents * l.quantity;
      return `  ${l.quantity}× ${l.name} @ ${formatMinorUnitsToCurrency(l.priceCents, r.currency)} = ${formatMinorUnitsToCurrency(sub, r.currency)}`;
    }),
    "",
    `Total: ${formatMinorUnitsToCurrency(r.totalCents, r.currency)}`,
    `Payment: ${r.paymentMethodLabel}`,
  ];

  const c = r.customer;
  const hasCustomer =
    Boolean(c.name.trim()) ||
    Boolean(c.phone.trim()) ||
    Boolean(c.email.trim()) ||
    Boolean(c.address.trim());

  if (hasCustomer) {
    lines.push("", "Customer:");
    if (c.name.trim()) lines.push(`  ${c.name.trim()}`);
    if (c.phone.trim()) {
      const dial = c.dialCode.trim();
      const tel = dial ? `${dial} ${c.phone.trim()}`.trim() : c.phone.trim();
      lines.push(`  Tel: ${tel}`);
    }
    if (c.email.trim()) lines.push(`  Email: ${c.email.trim()}`);
    if (c.address.trim()) lines.push(`  ${c.address.trim()}`);
  }

  if (r.paymentNote.trim()) {
    lines.push("", `Note: ${r.paymentNote.trim()}`);
  }

  lines.push("", "Thank you!");
  return lines.join("\n");
}
