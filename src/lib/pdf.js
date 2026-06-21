// src/lib/pdf.js
// Invoice PDF exactly matching JEI format (INV-1004.pdf):
// - Logo top-left, "Invoice" title top-right
// - Header table: Invoice No, Invoice Date, Bill To, Ship To
// - Fee lines table: Description | Amount | In IDR
// - Summary table: Sales Tax | Discount | Deposit Received | TOTAL
// - Payment details footer
// Brand: "JEI Easyshop" (replacing "Jon Express International LLC")
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency } from './pricing'

const DEFAULT_FX    = 15850
const BRAND_NAME    = 'JEI EASYSHOP'
const BRAND_ADDRESS = ['Freight Forwarding · US → SG → ID', 'jonexpressintl@gmail.com']

export function generateInvoicePDF(order, invoice, feeLines = []) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W   = 210
  const M   = 14

  // ── Fonts / colors ──────────────────────────────────────
  const NAVY   = [27, 42, 74]
  const GOLD   = [201, 168, 76]
  const BLACK  = [30, 35, 50]
  const GRAY   = [100, 110, 130]
  const LGRAY  = [200, 205, 215]

  // ── Top section: logo left, INVOICE right ───────────────
  // Logo box
  doc.setFillColor(...NAVY)
  doc.roundedRect(M, 10, 22, 22, 2, 2, 'F')
  doc.setTextColor(...GOLD)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('JEI', M + 11, 23, { align: 'center' })

  // Brand name below logo
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...NAVY)
  doc.text(BRAND_NAME, M + 26, 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  BRAND_ADDRESS.forEach((line, i) => doc.text(line, M + 26, 21 + i * 4))

  // "Invoice" title — right aligned, large
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.setTextColor(...NAVY)
  doc.text('Invoice', W - M, 22, { align: 'right' })

  // ── Invoice meta table (right side) ─────────────────────
  const invNo   = `INV-JEI/${Math.floor(Math.random() * 9000) + 1000}`
  const invDate = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' })
  const shipTo  = order.delivery_address || '—'

  let y = 36
  autoTable(doc, {
    startY: y,
    margin: { left: W / 2, right: M },
    tableWidth: W / 2 - M,
    head: [],
    body: [
      ['Invoice No.',   invNo],
      ['Invoice Date',  invDate],
      ['Bill To',       { content: order.customer_name || '—', styles: { fontStyle: 'bold' } }],
      ['Ship to',       shipTo],
    ],
    styles: { fontSize: 9, cellPadding: 3, lineColor: LGRAY, lineWidth: 0.2 },
    columnStyles: {
      0: { textColor: GRAY, cellWidth: 28 },
      1: { textColor: BLACK },
    },
    theme: 'grid',
  })

  y = doc.lastAutoTable.finalY + 8

  // ── Fee lines table ──────────────────────────────────────
  const currency  = invoice?.currency || order?.rate_currency || 'USD'
  const fxRate    = parseFloat(invoice?.usd_rate) || DEFAULT_FX

  const toIDR = (amount, cur) => {
    if (cur === 'IDR') return amount
    return amount * fxRate
  }

  const feeRows = feeLines.length > 0
    ? feeLines.map(l => [
        l.label,
        formatCurrency(l.amount, l.currency || currency),
        `Rp ${Math.round(toIDR(l.amount, l.currency || currency)).toLocaleString('id-ID')}`,
      ])
    : [['No fee lines recorded', '', '']]

  const totalIDR = feeLines.reduce((s, l) => s + toIDR(l.amount, l.currency || currency), 0)
  const totalAmt = feeLines.reduce((s, l) => s + l.amount, 0)

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Description', 'Amount', 'In IDR']],
    body: feeRows,
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: BLACK,
      fontStyle: 'bold',
      fontSize: 9,
      lineColor: LGRAY,
      lineWidth: 0.2,
    },
    bodyStyles: { fontSize: 9, textColor: BLACK, lineColor: LGRAY, lineWidth: 0.2, minCellHeight: 12 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 36, halign: 'right' },
      2: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
    },
    theme: 'grid',
  })

  y = doc.lastAutoTable.finalY + 4

  // ── Summary table (right-aligned) ───────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: W / 2, right: M },
    tableWidth: W / 2 - M,
    head: [],
    body: [
      ['Sales Tax',         ''],
      ['Discount',          ''],
      ['Deposit Received',  ''],
      [{ content: 'TOTAL', styles: { fontStyle: 'bold', fontSize: 10 } },
       { content: `Rp ${Math.round(totalIDR).toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', fontSize: 10 } }],
    ],
    styles: { fontSize: 9, cellPadding: 4, lineColor: LGRAY, lineWidth: 0.2, textColor: BLACK },
    columnStyles: {
      0: { cellWidth: 36, halign: 'right', textColor: GRAY },
      1: { cellWidth: 'auto', halign: 'right' },
    },
    theme: 'grid',
  })

  y = doc.lastAutoTable.finalY + 10

  // ── Payment details footer ───────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...GOLD)
  doc.text('Please remit payment to account:', M, y)

  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...BLACK)
  const payLines = [
    '',
    'Indonesian Account',
    'BCA',
    'Account name: Merry',
    'Account number: 5830208790',
    '',
    'BCA Dollar Account',
    'Account name: Merry',
    'Account number: 5830503333',
    '',
    'USA Account:',
    'JEI Easyshop',
    'JPMorgan Chase Bank, N.A',
    'Account number: 680321962',
    'Routing Number: 325070760',
    'Venmo: merrytoh16; Chase: jonexpressintl@gmail.com',
  ]

  payLines.forEach((line, i) => {
    const isBold = ['Indonesian Account','BCA Dollar Account','USA Account:'].includes(line)
    doc.setFont('helvetica', isBold ? 'bold' : 'normal')
    doc.setFontSize(8.5)
    doc.text(line, M, y + i * 4.5)
  })

  // ── Thank you footer ─────────────────────────────────────
  const footerY = 282
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text('Thank You for Your Business!', W / 2, footerY, { align: 'center' })

  // Save
  const fname = `INV-JEI_${(order.customer_name || 'order').replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fname)
}
