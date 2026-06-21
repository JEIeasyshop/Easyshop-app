// src/lib/pdf.js
// Matches INV-1004.pdf exactly:
// - Top-left: logo image + "JEI EASYSHOP" + full address block
// - Top-right: large bold "Invoice" title
// - Grid table right side: Invoice No, Invoice Date, Bill To, Ship to
// - Full-width fee table: Description | Amount | In IDR
// - Right-aligned summary: Sales Tax | Discount | Deposit Received | TOTAL
// - Gold "Please remit..." heading + payment details
// - Navy "Thank You for Your Business!" footer center
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency } from './pricing'

const DEFAULT_FX = 15850
const W = 210
const M = 14

const NAVY  = [27,  42,  74 ]
const GOLD  = [201, 168, 76 ]
const BLACK = [30,  35,  50 ]
const GRAY  = [120, 130, 148]
const LGRAY = [210, 213, 220]

export function generateInvoicePDF(order, invoice, feeLines = []) {
  const doc    = new jsPDF({ unit: 'mm', format: 'a4' })
  const fxRate = parseFloat(invoice?.usd_rate) || DEFAULT_FX

  const toIDR = (amount, cur) => cur === 'IDR' ? amount : amount * fxRate

  // ── Left block: logo + company details ──────────────────
  // Try to embed the logo image (it's at /logo.png in public)
  // We'll draw a navy box as logo placeholder
  doc.setFillColor(...NAVY)
  doc.roundedRect(M, 12, 20, 20, 2, 2, 'F')
  doc.setTextColor(...GOLD)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('JEI', M + 10, 24, { align: 'center' })

  // Company name + address (matches INV-1004 left block)
  let lx = M + 24
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text('JEI EASYSHOP', lx, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  const addrLines = [
    'PIC: Merry Toh',
    '17826 19th Ave W',
    'Lynnwood, Washington',
    '98037, USA',
    '425-240-3607',
    'jonexpressintl@gmail.com',
  ]
  addrLines.forEach((line, i) => doc.text(line, lx, 21 + i * 4))

  // ── Right block: large "Invoice" ─────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(32)
  doc.setTextColor(...NAVY)
  doc.text('Invoice', W - M, 26, { align: 'right' })

  // ── Meta grid table (right half) ─────────────────────────
  const invNo   = `INV-JEI/${Math.floor(Math.random() * 9000) + 1000}`
  const invDate = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' })
  const shipTo  = order.delivery_address || '—'

  const metaY = 40
  autoTable(doc, {
    startY:     metaY,
    margin:     { left: W / 2 + 2, right: M },
    tableWidth: W / 2 - M - 2,
    head: [],
    body: [
      ['Invoice No.',  invNo],
      ['Invoice Date', invDate],
      ['Bill To',      { content: order.customer_name || '—', styles: { fontStyle: 'bold', textColor: BLACK } }],
      ['Ship to',      shipTo],
    ],
    styles:        { fontSize: 8.5, cellPadding: 3, lineColor: LGRAY, lineWidth: 0.25, textColor: BLACK },
    columnStyles:  { 0: { textColor: GRAY, cellWidth: 30 }, 1: { textColor: BLACK } },
    theme: 'grid',
  })

  let y = Math.max(doc.lastAutoTable.finalY, metaY + 30) + 6

  // Horizontal rule
  doc.setDrawColor(...LGRAY)
  doc.setLineWidth(0.3)
  doc.line(M, y, W - M, y)
  y += 6

  // ── Fee lines table (full width) ─────────────────────────
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

  const totalIDR = feeLines.reduce((s, l) => s + toIDR(l.amount * (l.qty || 1), l.currency || currency), 0)

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head:   [['Description', 'Amount', 'In IDR']],
    body:   feeRows,
    headStyles: {
      fillColor:  [255, 255, 255],
      textColor:  BLACK,
      fontStyle:  'bold',
      fontSize:   9,
      lineColor:  LGRAY,
      lineWidth:  0.25,
    },
    bodyStyles:  { fontSize: 9, textColor: BLACK, lineColor: LGRAY, lineWidth: 0.25, minCellHeight: 10 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 40, halign: 'right' },
      2: { cellWidth: 44, halign: 'right', fontStyle: 'bold' },
    },
    theme: 'grid',
  })

  y = doc.lastAutoTable.finalY + 4

  // ── Summary table (right-aligned, matches INV-1004) ──────
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

  // ── Payment details (matches INV-1004 exactly) ───────────
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

  // ── Thank you footer ─────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...NAVY)
  doc.text('Thank You for Your Business!', W / 2, 284, { align: 'center' })

  // Save
  const fname = `INV-JEI_${(order.customer_name || 'order').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fname)
}
