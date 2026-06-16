// lib/pdf.js — client-side invoice PDF using jsPDF
import jsPDF from 'jspdf';

const DIR_LABELS = { us_jkt: 'US → JKT', jkt_us: 'JKT → US', other: 'Other' };
const SVC_LABELS = { full_service: 'Full Service', shipping_only: 'Shipping Only' };

export function generateInvoicePDF(order, invoice) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const navy  = [27, 42, 74];
  const gold  = [201, 168, 76];
  const gray  = [100, 110, 130];
  const black = [26, 32, 44];

  const W = 210; // A4 width mm
  const margin = 20;

  // ── Header bar ──
  doc.setFillColor(...navy);
  doc.rect(0, 0, W, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('JE EASYSHOP', margin, 14);

  doc.setTextColor(...gold);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('FREIGHT MANAGEMENT', margin, 20);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', W - margin, 18, { align: 'right' });

  // ── Invoice meta ──
  let y = 44;
  doc.setTextColor(...black);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const invDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const ordDate = order.order_date
    ? new Date(order.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text(order.customer_name || '—', margin, y + 6);

  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.text(`Invoice Date: ${invDate}`, W - margin, y,      { align: 'right' });
  doc.text(`Order Date:   ${ordDate}`, W - margin, y + 6,  { align: 'right' });
  doc.text(`Order ID: ${order.id?.substring(0,8).toUpperCase() || '—'}`, W - margin, y + 12, { align: 'right' });

  // ── Divider ──
  y += 22;
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.8);
  doc.line(margin, y, W - margin, y);

  // ── Order details ──
  y += 10;
  doc.setTextColor(...black);
  doc.setFontSize(9);

  const details = [
    ['Direction',    DIR_LABELS[order.direction] || order.direction_other_note || '—'],
    ['Service Type', SVC_LABELS[order.service_type] || '—'],
    ['Goods',        order.goods_description || '—'],
    ['Weight',       order.weight_kg ? `${order.weight_kg} kg` : '—'],
  ];
  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...gray);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...black);
    doc.text(value, margin + 36, y);
    y += 7;
  });

  if (order.additional_notes) {
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...gray);
    doc.text('Notes:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...black);
    const noteLines = doc.splitTextToSize(order.additional_notes, W - margin * 2 - 36);
    doc.text(noteLines, margin + 36, y);
    y += noteLines.length * 5 + 2;
  }

  // ── Cost table ──
  y += 8;
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.4);
  doc.line(margin, y, W - margin, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...navy);
  doc.text('Description', margin, y);
  doc.text('Amount', W - margin, y, { align: 'right' });
  y += 5;
  doc.setDrawColor(...gray);
  doc.setLineWidth(0.2);
  doc.line(margin, y, W - margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...black);
  const base = invoice?.base_price || 0;
  doc.text('Base Price', margin, y);
  doc.text(`$${Number(base).toFixed(2)}`, W - margin, y, { align: 'right' });
  y += 6;

  const extras = invoice?.additional_costs || [];
  extras.forEach(c => {
    doc.text(c.description || 'Additional cost', margin, y);
    doc.text(`$${Number(c.amount).toFixed(2)}`, W - margin, y, { align: 'right' });
    y += 6;
  });

  // ── Total ──
  y += 4;
  doc.setFillColor(...navy);
  doc.rect(margin, y - 4, W - margin * 2, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const total = Number(invoice?.total || 0);
  doc.text('TOTAL', margin + 4, y + 4);
  doc.text(`$${total.toFixed(2)}`, W - margin - 4, y + 4, { align: 'right' });

  // ── Footer ──
  y = 270;
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.4);
  doc.line(margin, y, W - margin, y);
  doc.setTextColor(...gray);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('JE Easyshop — Freight Management', W / 2, y + 6, { align: 'center' });
  doc.text('Thank you for your business.', W / 2, y + 11, { align: 'center' });

  doc.save(`invoice_${order.customer_name?.replace(/\s+/g,'_') || 'order'}_${new Date().toISOString().split('T')[0]}.pdf`);
}
