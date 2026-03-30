import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform, Share } from "react-native";

import {
  buildReceiptPdfHtml,
  estimateReceiptPdfPageHeightPx,
  type ReceiptPdfThemeColors,
} from "@/lib/counter-checkout/receipt-pdf-html";
import { buildReceiptText } from "@/lib/counter-checkout/receipt-text";
import type { CompletedSaleReceipt } from "@/lib/counter-checkout/types";

/** Web: expo-print has no PDF bytes — open thermal HTML in a hidden iframe and use the browser print dialog (Save as PDF). */
function openReceiptPrintOnWeb(receipt: CompletedSaleReceipt, theme?: ReceiptPdfThemeColors): void {
  const doc = globalThis.document;
  if (typeof doc === "undefined") return;

  const html = buildReceiptPdfHtml(receipt, { theme });
  const iframe = doc.createElement("iframe");
  iframe.setAttribute("style", "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0");
  doc.body.appendChild(iframe);

  const idoc = iframe.contentDocument;
  if (!idoc) {
    doc.body.removeChild(iframe);
    return;
  }

  idoc.open();
  idoc.write(html);
  idoc.close();

  const win = iframe.contentWindow;
  if (!win) {
    doc.body.removeChild(iframe);
    return;
  }

  win.focus();
  win.addEventListener(
    "afterprint",
    () => {
      doc.body.removeChild(iframe);
    },
    { once: true },
  );
  win.print();
}

export async function shareReceiptPlain(receipt: CompletedSaleReceipt): Promise<void> {
  const message = buildReceiptText(receipt);
  try {
    await Share.share({ message, title: "Receipt" });
  } catch {
    /* user dismissed share sheet */
  }
}

async function sharePdfUri(uri: string, dialogTitle: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    return;
  }
  try {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle,
    });
  } catch {
    /* dismissed */
  }
}

async function renderReceiptPdfToFile(
  receipt: CompletedSaleReceipt,
  theme?: ReceiptPdfThemeColors,
): Promise<string | null> {
  const html = buildReceiptPdfHtml(receipt, { theme });
  const height = estimateReceiptPdfPageHeightPx(receipt);
  try {
    const { uri } = await Print.printToFileAsync({
      html,
      width: 360,
      height,
    });
    return uri ?? null;
  } catch {
    return null;
  }
}

/**
 * Renders the thermal receipt layout to PDF: native share sheet, or web print dialog (Save as PDF).
 */
export async function shareReceiptPdf(
  receipt: CompletedSaleReceipt,
  theme?: ReceiptPdfThemeColors,
): Promise<void> {
  if (Platform.OS === "web") {
    openReceiptPrintOnWeb(receipt, theme);
    return;
  }

  try {
    const uri = await renderReceiptPdfToFile(receipt, theme);
    if (!uri) {
      await shareReceiptPlain(receipt);
      return;
    }
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      await shareReceiptPlain(receipt);
      return;
    }
    await sharePdfUri(uri, "Share receipt");
  } catch {
    await shareReceiptPlain(receipt);
  }
}

/**
 * Same PDF as share; uses a neutral sheet title oriented toward saving/exporting.
 */
export async function exportReceiptPdfFile(
  receipt: CompletedSaleReceipt,
  theme?: ReceiptPdfThemeColors,
): Promise<void> {
  if (Platform.OS === "web") {
    openReceiptPrintOnWeb(receipt, theme);
    return;
  }

  try {
    const uri = await renderReceiptPdfToFile(receipt, theme);
    if (!uri) {
      await shareReceiptPlain(receipt);
      return;
    }
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      await shareReceiptPlain(receipt);
      return;
    }
    await sharePdfUri(uri, "Save or share receipt");
  } catch {
    await shareReceiptPlain(receipt);
  }
}
