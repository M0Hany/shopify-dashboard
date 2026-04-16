import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export type ShippingSlipOrder = {
  id: number;
  name?: string | null;
  total_price?: string | number | null;
  line_items?: Array<{
    title?: string | null;
    quantity?: number | null;
    variant_title?: string | null;
  }> | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
  } | null;
  shipping_address?: {
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    province?: string | null;
    zip?: string | null;
    country?: string | null;
  } | null;
};

function formatSlipCustomerName(order: ShippingSlipOrder): string {
  return [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(' ').trim() || 'No name';
}

function formatSlipAddress(order: ShippingSlipOrder): string {
  const address = order.shipping_address;
  if (!address) return 'No address';
  return [address.address1, address.address2, address.city, address.province, address.zip, address.country]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
}

function formatSlipPrice(order: ShippingSlipOrder): string {
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(order.total_price || 0));
}

function formatSlipProducts(order: ShippingSlipOrder): string[] {
  const items = Array.isArray(order.line_items) ? order.line_items : [];
  const lines = items
    .map((item) => {
      const quantity = Number(item.quantity || 0);
      const title = String(item.title || '').trim();
      const variant = String(item.variant_title || '').trim();
      if (!title) return '';
      return `${quantity > 0 ? `${quantity}x ` : ''}${title}${variant ? ` (${variant})` : ''}`;
    })
    .filter(Boolean);

  return lines.length > 0 ? lines : ['No products'];
}

function isArabicText(value: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(value);
}

function buildSlipHtml(order: ShippingSlipOrder): string {
  const orderName = order.name || `Order ${order.id}`;
  const name = formatSlipCustomerName(order);
  const phone = String(order.customer?.phone || '').trim() || 'No mobile number';
  const address = formatSlipAddress(order);
  const price = formatSlipPrice(order);
  const productLines = formatSlipProducts(order);
  const rtl = [orderName, name, phone, address, ...productLines].some((value) => isArabicText(value));
  const valueAlign = rtl ? 'right' : 'left';
  const dir = rtl ? 'rtl' : 'ltr';

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const productsHtml = productLines
    .map(
      (line) =>
        `<div style="direction:${dir};text-align:${valueAlign};word-break:break-word;">${escapeHtml(line)}</div>`
    )
    .join('');

  return `
    <div style="width:100%;height:100%;box-sizing:border-box;border:1px solid #b4b4b4;border-radius:12px;padding:16px;background:#fff;font-family:Arial,'Segoe UI',Tahoma,sans-serif;color:#111827;">
      <div style="font-weight:700;font-size:20px;line-height:1.2;margin-bottom:14px;direction:${dir};text-align:${valueAlign};word-break:break-word;">${escapeHtml(orderName)}</div>
      <div style="display:grid;grid-template-columns:72px 1fr;row-gap:8px;column-gap:10px;font-size:15px;line-height:1.3;">
        <div style="font-weight:700;">Name:</div>
        <div style="direction:${dir};text-align:${valueAlign};word-break:break-word;">${escapeHtml(name)}</div>
        <div style="font-weight:700;">Mobile:</div>
        <div style="direction:ltr;text-align:left;word-break:break-word;">${escapeHtml(phone)}</div>
        <div style="font-weight:700;">Address:</div>
        <div style="direction:${dir};text-align:${valueAlign};word-break:break-word;">${escapeHtml(address)}</div>
        <div style="font-weight:700;">Products:</div>
        <div style="display:flex;flex-direction:column;gap:3px;">${productsHtml}</div>
        <div style="font-weight:700;">Price:</div>
        <div style="direction:ltr;text-align:left;word-break:break-word;">${escapeHtml(price)}</div>
      </div>
    </div>
  `;
}

export async function generateShippingSlipsPdf(
  orders: ShippingSlipOrder[],
  filename: string
): Promise<void> {
  if (orders.length === 0) {
    throw new Error('No orders available for shipping slips');
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const pageMargin = 10;
  const gutter = 6;
  const cols = 2;
  const rows = 2;
  const slipWidthMm = (pageWidth - pageMargin * 2 - gutter * (cols - 1)) / cols;
  const slipHeightMm = (pageHeight - pageMargin * 2 - gutter * (rows - 1)) / rows;
  const mmToPx = 3.7795275591;
  const slipWidthPx = Math.round(slipWidthMm * mmToPx);
  const slipHeightPx = Math.round(slipHeightMm * mmToPx);

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-100000px';
  container.style.top = '0';
  container.style.width = `${slipWidthPx}px`;
  container.style.height = `${slipHeightPx}px`;
  container.style.background = '#ffffff';
  container.style.zIndex = '-1';
  document.body.appendChild(container);

  try {
    for (let index = 0; index < orders.length; index += 1) {
      if (index > 0 && index % (cols * rows) === 0) {
        doc.addPage();
      }

      const slot = index % (cols * rows);
      const col = slot % cols;
      const row = Math.floor(slot / cols);
      const x = pageMargin + col * (slipWidthMm + gutter);
      const y = pageMargin + row * (slipHeightMm + gutter);

      container.innerHTML = buildSlipHtml(orders[index]);
      const canvas = await html2canvas(container, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });

      const imageData = canvas.toDataURL('image/png');
      doc.addImage(imageData, 'PNG', x, y, slipWidthMm, slipHeightMm);
    }

    doc.save(filename);
  } finally {
    container.remove();
  }
}
