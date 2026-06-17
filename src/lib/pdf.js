// src/lib/pdf.js
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const DIR  = { us_jkt: 'US → JKT', jkt_us: 'JKT → US', other: 'Other' }
const SVC  = { full_service: 'Full Service', shipping_only: 'Shipping Only' }
const NAVY = [27, 42, 74]
const GOLD = [201, 168, 76]
const GRAY = [110, 120, 140]
const W    = 210
const M    = 20

export function generateInvoicePDF(order, invoice) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  // Header bar
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 34, 'F')

  // Logo mark
  doc.setFillColor(...GOLD)
  doc.roundedRect(M, 8, 18, 18, 2, 2, 'F')
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('JE', M + 9, 19, { align: 'center' })

  // Brand name
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(17)
  doc.setFont('helvetica', 'bold')
  doc.text('JE Easyshop', M + 22, 16)
  doc.setFontSize(7.5)
  doc.setTextColor(...GOLD)
  doc.setFont('helvetica', 'normal')
  doc.text('FREIGHT MANAGEMENT', M + 22, 22)

  // Invoice label
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('INVOICE', W - M, 19, { align: 'right' })

  // Gold rule
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.6)
  doc.line(M, 38, W - M, 38)

  // Meta block
  let y = 46
  const invDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const ordDate = order.order_date
    ? new Date(order.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'
  const refId = (order.id || '').substring(0, 8).toUpperCase()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text('BILL TO', M, y)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...NAVY)
  doc.text(order.customer_name || '—', M, y + 7)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY)
  doc.text([
    `Invoice Date: ${invDate}`,
    `Order Date:   ${ordDate}`,
    `Reference:    #${refId}`,
  ], W - M, y, { align: 'right' })

  y += 18
  doc.setDrawColor(220, 225, 235)
  doc.setLineWidth(0.3)
  doc.line(M, y, W - M, y)

  // Order details table
  y += 6
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Field', 'Detail']],
    body: [
      ['Direction',    DIR[order.direction] || order.direction_other_note || '—'],
      ['Service Type', SVC[order.service_type] || '—'],
      ['Goods',        order.goods_description || '—'],
      ['Weight',       order.weight_kg ? `${order.weight_kg} kg` : '—'],
      ['Notes',        order.additional_notes || '—'],
    ],
    headStyles: { fillColor: NAVY, textColor: [255,255,255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 9, textColor: [30,40,60] },
    columnStyles: { 0: { fontStyle: 'bold', textColor: GRAY, cellWidth: 38 } },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    styles: { cellPadding: 5, lineColor: [220, 225, 235], lineWidth: 0.2 },
  })

  y = doc.lastAutoTable.finalY + 10

  // Cost table
  const base   = Number(invoice?.base_price || 0)
  const extras = invoice?.additional_costs || []
  const total  = Number(invoice?.total || base)

  const costRows = [
    ['Base Price', `$${base.toFixed(2)}`],
    ...extras.map(c => [c.description || 'Additional cost', `$${Number(c.amount).toFixed(2)}`]),
  ]

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Description', 'Amount']],
    body: costRows,
    headStyles: { fillColor: NAVY, textColor: [255,255,255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 9, textColor: [30,40,60] },
    columnStyles: { 1: { halign: 'right', cellWidth: 36 } },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    styles: { cellPadding: 5, lineColor: [220, 225, 235], lineWidth: 0.2 },
  })

  y = doc.lastAutoTable.finalY + 4

  // Total bar
  doc.setFillColor(...NAVY)
  doc.roundedRect(M, y, W - M * 2, 14, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text('TOTAL DUE', M + 6, y + 9)
  doc.setFontSize(13)
  doc.setTextColor(...GOLD)
  doc.text(`$${total.toFixed(2)}`, W - M - 6, y + 9, { align: 'right' })

  // Footer
  const footerY = 278
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.5)
  doc.line(M, footerY, W - M, footerY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.text('JE Easyshop · Freight Management', W / 2, footerY + 5, { align: 'center' })
  doc.text('Thank you for your business.', W / 2, footerY + 10, { align: 'center' })

  const fname = `invoice_${(order.customer_name || 'order').replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fname)
}
