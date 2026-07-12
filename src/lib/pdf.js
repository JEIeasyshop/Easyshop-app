// src/lib/pdf.js
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency } from './pricing'

const DEFAULT_FX = 15850
const W  = 210   // A4 width mm
const H  = 297   // A4 height mm
const M  = 14    // margin

const NAVY  = [27,  42,  74 ]
const GOLD  = [201, 168, 76 ]
const BLACK = [30,  35,  50 ]
const GRAY  = [120, 130, 148]
const LGRAY = [210, 213, 220]

// ── Helpers ───────────────────────────────────────────────
const pageCount = (doc) => doc.internal.getNumberOfPages()

// Draw the static header on a given page number
function drawHeader(doc, order, invoice) {
  const invNo   = invoice?._invNo  || `INV-JEI/${Math.floor(Math.random() * 9000) + 1000}`
  const invDate = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' })
  const shipTo  = order.delivery_address || '—'

  // Navy logo box
  doc.setFillColor(...NAVY)
  doc.roundedRect(M, 12, 20, 20, 2, 2, 'F')
  doc.setTextColor(...GOLD)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('JEI', M + 10, 24, { align: 'center' })

  // Company name
  const lx = M + 24
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text('JEI EASYSHOP', lx, 16)

  // Address block
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  ;['PIC: Merry Toh', '17826 19th Ave W', 'Lynnwood, Washington', '98037, USA', '425-240-3607', 'jonexpressintl@gmail.com']
    .forEach((line, i) => doc.text(line, lx, 21 + i * 4))

  // Large "Invoice" heading
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(32)
  doc.setTextColor(...NAVY)
  doc.text('Invoice', W - M, 26, { align: 'right' })

  // Meta grid (right half)
  autoTable(doc, {
    startY:     40,
    margin:     { left: W / 2 + 2, right: M },
    tableWidth: W / 2 - M - 2,
    head: [],
    body: [
      ['Invoice No.',  invNo],
      ['Invoice Date', invDate],
      ['Bill To',      { content: order.customer_name || '—', styles: { fontStyle: 'bold', textColor: BLACK } }],
      ['Ship to',      shipTo],
    ],
    styles:       { fontSize: 8.5, cellPadding: 3, lineColor: LGRAY, lineWidth: 0.25, textColor: BLACK },
    columnStyles: { 0: { textColor: GRAY, cellWidth: 30 }, 1: { textColor: BLACK } },
    theme: 'grid',
  })

  return Math.max(doc.lastAutoTable.finalY, 70) + 6
}

// Draw the payment block + thank-you footer after the last table row
function drawFooter(doc, startY) {
  const FOOTER_HEIGHT = 95  // approx height of payment block + footer text
  const pageH         = H - 10 // usable page height

  // If payment block won't fit on current page, add a new page
  let y = startY
  if (y + FOOTER_HEIGHT > pageH) {
    doc.addPage()
    y = M + 6
  }

  // Gold heading
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...GOLD)
  doc.text('Please remit payment to account:', M, y)
  y += 7

  const payBlocks = [
    { bold: true,  text: 'Indonesian Account' },
    { bold: false, text: 'BCA' },
    { bold: false, text: 'Account name: Merry' },
    { bold: false, text: 'Account number: 5830208790' },
    { bold: false, text: '' },
    { bold: true,  text: 'BCA Dollar Account' },
    { bold: false, text: 'Account name: Merry' },
    { bold: false, text: 'Account number: 5830503333' },
    { bold: false, text: '' },
    { bold: true,  text: 'USA Account:' },
    { bold: false, text: 'JEI Easyshop' },
    { bold: false, text: 'JPMorgan Chase Bank, N.A' },
    { bold: false, text: 'Account number: 680321962' },
    { bold: false, text: 'Routing Number: 325070760' },
    { bold: false, text: 'Venmo: merrytoh16; Chase: jonexpressintl@gmail.com' },
  ]

  payBlocks.forEach(({ bold, text }) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...BLACK)
    if (text) doc.text(text, M, y)
    y += 4.5
  })

  y += 6

  // Thank you — on same page as payment, not pinned to page bottom
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...NAVY)
  doc.text('Thank You for Your Business!', W / 2, y, { align: 'center' })
}

// ── Main export ───────────────────────────────────────────
export function generateInvoicePDF(order, invoice, feeLines = []) {
  const doc    = new jsPDF({ unit: 'mm', format: 'a4' })
  const fxRate = parseFloat(invoice?.usd_rate) || DEFAULT_FX
  const toIDR  = (amount, cur) => cur === 'IDR' ? amount : amount * fxRate

  // Stash a stable invoice number so drawHeader can reuse it on continuation pages
  const invNo = `INV-JEI/${Math.floor(Math.random() * 9000) + 1000}`
  if (invoice) invoice._invNo = invNo

  // ── Page 1 header ────────────────────────────────────────
  let y = drawHeader(doc, order, invoice)

  // Horizontal rule
  doc.setDrawColor(...LGRAY)
  doc.setLineWidth(0.3)
  doc.line(M, y, W - M, y)
  y += 6

  // ── Fee lines table — auto page break built in ───────────
  const currency = invoice?.currency || order?.rate_currency || 'USD'

  const feeRows = feeLines.length > 0
    ? feeLines.map(l => {
        const qty      = l.qty || 1
        const subtotal = l.amount * qty
        return [
          qty > 1 ? `${l.label} ×${qty}` : l.label,
          formatCurrency(subtotal, l.currency || currency),
          `Rp ${Math.round(toIDR(subtotal, l.currency || currency)).toLocaleString('id-ID')}`,
        ]
      })
    : [['No fee lines recorded', '', '']]

  const totalIDR = feeLines.reduce(
    (s, l) => s + toIDR(l.amount * (l.qty || 1), l.currency || currency), 0
  )

  autoTable(doc, {
    startY:    y,
    margin:    { left: M, right: M },
    head:      [['Description', 'Amount', 'In IDR']],
    body:      feeRows,
    // ← This is the key fix: allow automatic page breaks inside the table
    pageBreak: 'auto',
    rowPageBreak: 'auto',
    headStyles: {
      fillColor:  [255, 255, 255],
      textColor:  BLACK,
      fontStyle:  'bold',
      fontSize:   9,
      lineColor:  LGRAY,
      lineWidth:  0.25,
    },
    bodyStyles:  { fontSize: 9, textColor: BLACK, lineColor: LGRAY, lineWidth: 0.25, minCellHeight: 9 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 40, halign: 'right' },
      2: { cellWidth: 44, halign: 'right', fontStyle: 'bold' },
    },
    theme: 'grid',
    // Repeat header on each new page
    showHead: 'everyPage',
    // Add a "continued" watermark on pages that aren't the last
    didDrawPage: (data) => {
      const pg    = doc.internal.getCurrentPageInfo().pageNumber
      const total = doc.internal.getNumberOfPages()
      // Page number bottom right
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...GRAY)
      doc.text(`Page ${pg}`, W - M, H - 6, { align: 'right' })
      // "Continued..." watermark on non-last pages — updated after table finishes
      if (pg < total) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(7)
        doc.text('(continued on next page)', M, H - 6)
      }
    },
  })

  y = doc.lastAutoTable.finalY + 6

  // ── Summary table (right-aligned) ────────────────────────
  // If summary won't fit on current page, it flows naturally — autoTable handles it
  autoTable(doc, {
    startY:     y,
    margin:     { left: W / 2 + 2, right: M },
    tableWidth: W / 2 - M - 2,
    head: [],
    body: [
      ['Sales Tax',        ''],
      ['Discount',         ''],
      ['Deposit Received', ''],
      [
        { content: 'TOTAL', styles: { fontStyle: 'bold', fontSize: 10, textColor: BLACK } },
        { content: `Rp ${Math.round(totalIDR).toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', fontSize: 10, textColor: BLACK } },
      ],
    ],
    styles:       { fontSize: 9, cellPadding: 4, lineColor: LGRAY, lineWidth: 0.25, textColor: GRAY },
    columnStyles: { 0: { cellWidth: 40, halign: 'right' }, 1: { halign: 'right' } },
    theme: 'grid',
  })

  y = doc.lastAutoTable.finalY + 10

  // ── Payment + footer ─────────────────────────────────────
  drawFooter(doc, y)

  // ── Save ─────────────────────────────────────────────────
  const fname = `INV-JEI_${(order.customer_name || 'order').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fname)
}
