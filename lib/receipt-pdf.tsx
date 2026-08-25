import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer"

import { formatMoney } from "@/lib/money"
import type { ReceiptViewModel } from "@/lib/receipt-types"

const colors = {
  ink: "#171612",
  paper: "#fffef9",
  muted: "#69645c",
  green: "#047857",
  greenPale: "#ecfdf5",
  red: "#7f1d1d",
  orange: "#c2410c",
  orangePale: "#fff7ed",
  brown: "#7c2d12",
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.paper, color: colors.ink, fontFamily: "Courier", fontSize: 8, padding: 18 },
  a4: { fontFamily: "Helvetica", fontSize: 10, padding: 44 },
  row: { display: "flex", flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 5 },
  lineDescription: { flexGrow: 1, maxWidth: "70%" },
  muted: { color: colors.muted, fontSize: 7 },
  empty: { color: "#8a847a", fontSize: 7, textAlign: "center", paddingVertical: 12 },
  rule: { borderBottom: `1px dashed ${colors.ink}`, marginVertical: 9 },
  lineHeader: { borderBottom: `1px solid ${colors.ink}`, fontWeight: 700, paddingBottom: 4, marginBottom: 7 },
  total: { borderTop: `2px solid ${colors.ink}`, borderBottom: `2px solid ${colors.ink}`, fontSize: 11, fontWeight: 700, paddingVertical: 6, marginTop: 6 },
  footer: { borderTop: `1px dashed ${colors.ink}`, textAlign: "center", marginTop: 12, paddingTop: 8 },
  archiveBand: { border: "1px solid #d6d3d1", backgroundColor: "#fafaf9", marginTop: 12, padding: 9 },
  archive: { color: "#514d46", fontSize: 6, letterSpacing: 0.7 },
  notice: { color: "#827c72", fontSize: 6, marginTop: 4 },
  void: { position: "absolute", top: "45%", left: "15%", fontSize: 42, color: "#b42318", opacity: 0.2, transform: "rotate(-25deg)" },
})

function dateLabel(receipt: ReceiptViewModel) {
  return receipt.issuedAt
    ? new Date(receipt.issuedAt).toLocaleString(receipt.locale, { timeZone: receipt.timezone })
    : "Pending review"
}

function PdfFooter({ receipt }: { receipt: ReceiptViewModel }) {
  if (!receipt.footer) return null
  return <View style={styles.footer}><Text>{receipt.footer}</Text></View>
}

function PdfArchiveBand({ receipt }: { receipt: ReceiptViewModel }) {
  const verified = receipt.hasOriginalSource
  return (
    <View style={[styles.archiveBand, !verified ? { borderColor: "#f59e0b", backgroundColor: "#fffbeb" } : {}]} wrap={false}>
      <Text style={[styles.archive, !verified ? { color: "#92400e", fontWeight: 700 } : {}]}>{verified ? "VERIFIED DIGITAL COPY" : "UNVERIFIED DRAFT"} · {receipt.archiveId}</Text>
      <Text style={styles.notice}>{verified ? "Generated from attached source · not a replacement vendor or tax invoice" : "Attach and validate the original source before finalizing or exporting"}</Text>
      {receipt.status === "void" && <Text style={{ color: colors.red, fontWeight: 700, marginTop: 3 }}>VOID - {receipt.voidReason}</Text>}
    </View>
  )
}

function PdfItems({ receipt, empty = "Description pending review" }: { receipt: ReceiptViewModel; empty?: string }) {
  return receipt.lines.length ? receipt.lines.map((line) => (
    <View key={line.id} style={styles.row}>
      <View style={styles.lineDescription}>
        <Text>{line.description}</Text>
        <Text style={styles.muted}>{line.quantity} x {formatMoney(line.unitPriceMinor, receipt.currency, receipt.locale)}</Text>
      </View>
      <Text>{formatMoney(line.totalMinor, receipt.currency, receipt.locale)}</Text>
    </View>
  )) : <Text style={styles.empty}>{empty}</Text>
}

function PdfTotals({ receipt, label = "TOTAL", accent }: { receipt: ReceiptViewModel; label?: string; accent?: string }) {
  return (
    <View>
      <View style={styles.rule} />
      <View style={styles.row}><Text>Subtotal</Text><Text>{formatMoney(receipt.subtotalMinor, receipt.currency, receipt.locale)}</Text></View>
      {receipt.discountMinor > 0 && <View style={styles.row}><Text>Discount</Text><Text>-{formatMoney(receipt.discountMinor, receipt.currency, receipt.locale)}</Text></View>}
      {receipt.taxMinor > 0 && <View style={styles.row}><Text>Tax</Text><Text>{formatMoney(receipt.taxMinor, receipt.currency, receipt.locale)}</Text></View>}
      {receipt.feesMinor > 0 && <View style={styles.row}><Text>Fees</Text><Text>{formatMoney(receipt.feesMinor, receipt.currency, receipt.locale)}</Text></View>}
      <View style={[styles.row, styles.total, accent ? { borderTopColor: accent, borderBottomColor: accent, color: accent } : {}]}><Text>{label}</Text><Text>{formatMoney(receipt.totalMinor, receipt.currency, receipt.locale)}</Text></View>
    </View>
  )
}

function ClassicPdf({ receipt }: { receipt: ReceiptViewModel }) {
  return (
    <>
      <View style={{ borderBottom: `2px solid ${colors.ink}`, paddingBottom: 11, marginBottom: 10 }}>
        <View style={[styles.row, { marginBottom: 12 }]}><Text style={{ fontWeight: 700, letterSpacing: 1.3 }}>SALES RECEIPT</Text><Text>{receipt.sourceNumber ?? "NUMBER PENDING"}</Text></View>
        <Text style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{receipt.merchant.name}</Text>
        {receipt.merchant.address && <Text>{receipt.merchant.address}</Text>}
        {receipt.merchant.contacts && <Text>{receipt.merchant.contacts}</Text>}
      </View>
      <View style={{ borderBottom: `1px dashed ${colors.ink}`, paddingBottom: 7, marginBottom: 10 }}><View style={styles.row}><Text>Date</Text><Text>{dateLabel(receipt)}</Text></View>{receipt.paymentMethod && <View style={styles.row}><Text>Payment</Text><Text>{receipt.paymentMethod}</Text></View>}</View>
      <View style={[styles.row, styles.lineHeader]}><Text>DESCRIPTION</Text><Text>AMOUNT</Text></View>
      <PdfItems receipt={receipt} />
      <PdfTotals receipt={receipt} />
      <PdfFooter receipt={receipt} />
    </>
  )
}

function CompactPdf({ receipt }: { receipt: ReceiptViewModel }) {
  return (
    <>
      <View style={{ textAlign: "center", borderBottom: `1px dotted ${colors.ink}`, paddingBottom: 8, marginBottom: 8 }}><Text style={{ fontSize: 12, fontWeight: 700 }}>{receipt.merchant.name.toUpperCase()}</Text>{receipt.merchant.address && <Text>{receipt.merchant.address}</Text>}{receipt.merchant.contacts && <Text>{receipt.merchant.contacts}</Text>}<Text>*** CUSTOMER COPY ***</Text></View>
      <Text>{dateLabel(receipt)}</Text><Text>REF {receipt.sourceNumber ?? "PENDING"}</Text>
      <View style={{ borderTop: `1px dotted ${colors.ink}`, borderBottom: `1px dotted ${colors.ink}`, marginVertical: 8, paddingVertical: 8 }}><PdfItems receipt={receipt} /></View>
      <View style={styles.row}><Text>SUBTOTAL</Text><Text>{formatMoney(receipt.subtotalMinor, receipt.currency, receipt.locale)}</Text></View>
      {receipt.taxMinor > 0 && <View style={styles.row}><Text>TAX</Text><Text>{formatMoney(receipt.taxMinor, receipt.currency, receipt.locale)}</Text></View>}
      <View style={[styles.row, styles.total]}><Text>TOTAL</Text><Text>{formatMoney(receipt.totalMinor, receipt.currency, receipt.locale)}</Text></View>
      <PdfFooter receipt={receipt} />
    </>
  )
}

function SupermarketPdf({ receipt }: { receipt: ReceiptViewModel }) {
  return (
    <>
      <View style={{ backgroundColor: colors.ink, color: colors.paper, padding: 12, marginBottom: 0 }}><Text style={{ fontSize: 15, fontWeight: 700 }}>{receipt.merchant.name.toUpperCase()}</Text>{receipt.merchant.address && <Text style={{ color: "#ffffffaa" }}>{receipt.merchant.address}</Text>}</View>
      <View style={{ border: `1px solid ${colors.ink}`, padding: 8, marginBottom: 10 }}><View style={styles.row}><Text>TRANSACTION</Text><Text>{receipt.sourceNumber ?? "PENDING"}</Text></View><View style={styles.row}><Text>DATE</Text><Text>{dateLabel(receipt)}</Text></View></View>
      <View style={[styles.row, { backgroundColor: "#e5e5e5", fontWeight: 700, padding: 5 }]}><Text>ITEM / QTY</Text><Text>PRICE</Text></View>
      <View style={{ paddingTop: 7 }}><PdfItems receipt={receipt} /></View>
      <PdfTotals receipt={receipt} />
      <PdfFooter receipt={receipt} />
    </>
  )
}

function RestaurantPdf({ receipt }: { receipt: ReceiptViewModel }) {
  return (
    <>
      <View style={{ borderLeft: `5px solid ${colors.brown}`, borderRight: `5px solid ${colors.brown}`, paddingHorizontal: 12 }}>
        <View style={{ textAlign: "center", marginBottom: 14 }}><Text style={{ color: colors.brown, fontSize: 6, letterSpacing: 1.5 }}>GUEST CHECK</Text><Text style={{ fontFamily: "Times-Roman", fontSize: 18, marginTop: 4 }}>{receipt.merchant.name}</Text></View>
        <View style={{ borderTop: `1px solid ${colors.brown}`, borderBottom: `1px solid ${colors.brown}`, paddingVertical: 7, marginBottom: 10 }}><View style={styles.row}><Text>CHECK</Text><Text>{receipt.sourceNumber ?? "PENDING"}</Text></View><View style={styles.row}><Text>SERVED</Text><Text>{dateLabel(receipt)}</Text></View>{receipt.buyer.name && <View style={styles.row}><Text>GUEST</Text><Text>{receipt.buyer.name}</Text></View>}</View>
        <PdfItems receipt={receipt} empty="Order description pending review" />
        <PdfTotals receipt={receipt} label="CHECK TOTAL" accent={colors.brown} />
        <Text style={{ textAlign: "center", fontFamily: "Times-Italic", color: colors.muted, marginTop: 8 }}>Thank you</Text>
        <PdfFooter receipt={receipt} />
      </View>
    </>
  )
}

function FuelPdf({ receipt }: { receipt: ReceiptViewModel }) {
  return (
    <>
      <View style={{ borderTop: `8px solid ${colors.green}`, borderBottom: `2px solid ${colors.green}`, paddingVertical: 10, marginBottom: 10 }}><Text style={{ color: colors.green, fontSize: 6, letterSpacing: 1.4 }}>FUEL SALES RECEIPT</Text><Text style={{ fontSize: 17, fontWeight: 700 }}>{receipt.merchant.name}</Text>{receipt.merchant.address && <Text style={styles.muted}>{receipt.merchant.address}</Text>}</View>
      <View style={{ display: "flex", flexDirection: "row", gap: 2, backgroundColor: "#a7f3d0", marginBottom: 10 }}><View style={{ flexGrow: 1, backgroundColor: colors.paper, padding: 8 }}><Text style={styles.muted}>DATE / TIME</Text><Text>{dateLabel(receipt)}</Text></View><View style={{ flexGrow: 1, backgroundColor: colors.paper, padding: 8 }}><Text style={styles.muted}>DOCKET</Text><Text>{receipt.sourceNumber ?? "PENDING"}</Text></View></View>
      <PdfItems receipt={receipt} empty="Fuel or service description pending review" />
      <View style={{ backgroundColor: colors.green, color: "white", padding: 12, marginTop: 10 }}><Text style={{ color: "#ffffffaa", fontSize: 6, letterSpacing: 1.3 }}>AMOUNT PAID</Text><Text style={{ fontSize: 20, fontWeight: 700 }}>{formatMoney(receipt.totalMinor, receipt.currency, receipt.locale)}</Text></View>
      <PdfFooter receipt={receipt} />
    </>
  )
}

function MobileMoneyPdf({ receipt }: { receipt: ReceiptViewModel }) {
  return (
    <>
      <View style={{ borderBottom: `2px solid ${colors.ink}`, paddingBottom: 10, textAlign: "center" }}>
        <View style={{ width: 34, height: 34, border: `2px solid ${colors.ink}`, marginHorizontal: "auto", marginBottom: 8, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 12, fontWeight: 700 }}>{receipt.merchant.name.slice(0, 2).toUpperCase()}</Text></View>
        <Text style={{ fontSize: 15, fontWeight: 700 }}>{receipt.merchant.name.toUpperCase()}</Text>
        {receipt.merchant.address && <Text style={styles.muted}>{receipt.merchant.address}</Text>}
        {receipt.merchant.contacts && <Text style={styles.muted}>{receipt.merchant.contacts}</Text>}
        <Text style={{ fontSize: 7, fontWeight: 700, letterSpacing: 1.25, marginTop: 9 }}>MOBILE PAYMENT RECEIPT</Text>
        <Text style={{ fontSize: 6, color: colors.muted, marginTop: 3 }}>*** CUSTOMER COPY ***</Text>
      </View>

      <View style={{ borderBottom: `1px dashed ${colors.ink}`, paddingVertical: 9, marginBottom: 10 }}>
        <View style={styles.row}><Text style={styles.muted}>RECEIPT</Text><Text style={{ fontWeight: 700 }}>{receipt.sourceNumber ?? "PENDING"}</Text></View>
        <View style={styles.row}><Text style={styles.muted}>DATE / TIME</Text><Text style={{ fontWeight: 700 }}>{dateLabel(receipt)}</Text></View>
        {receipt.buyer.name && <View style={styles.row}><Text style={styles.muted}>CUSTOMER</Text><Text style={{ fontWeight: 700 }}>{receipt.buyer.name}</Text></View>}
      </View>

      <View style={[styles.row, styles.lineHeader]}><Text>ITEM / QTY</Text><Text>AMOUNT</Text></View>
      <PdfItems receipt={receipt} empty="Purchase description pending review" />
      <PdfTotals receipt={receipt} label="AMOUNT PAID" />

      <View style={{ borderTop: `2px solid ${colors.ink}`, borderBottom: `2px solid ${colors.ink}`, paddingVertical: 8, marginTop: 8 }}>
        <Text style={{ textAlign: "center", fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>PAID BY MOBILE MONEY</Text>
        {receipt.paymentMethod && <View style={styles.row}><Text style={styles.muted}>METHOD</Text><Text>{receipt.paymentMethod}</Text></View>}
        <View style={styles.row}><Text style={styles.muted}>REFERENCE</Text><Text style={{ fontWeight: 700 }}>{receipt.paymentReference ?? "PENDING"}</Text></View>
      </View>

      <Text style={{ textAlign: "center", fontWeight: 700, letterSpacing: 1.2, marginTop: 12 }}>THANK YOU</Text>
      <PdfFooter receipt={receipt} />
    </>
  )
}

function KenyaTaxPdf({ receipt }: { receipt: ReceiptViewModel }) {
  return (
    <>
      <View style={{ borderTop: `8px solid ${colors.red}`, borderBottom: `2px solid ${colors.red}`, paddingVertical: 10 }}><View style={styles.row}><View><Text style={{ color: colors.red, fontSize: 6, letterSpacing: 1.3 }}>TAX INVOICE</Text><Text style={{ fontSize: 17, fontWeight: 700 }}>{receipt.merchant.name}</Text>{receipt.merchant.address && <Text style={styles.muted}>{receipt.merchant.address}</Text>}</View><View><Text>{receipt.sourceNumber ?? "PENDING"}</Text><Text style={styles.muted}>{dateLabel(receipt)}</Text></View></View></View>
      <View style={{ border: `1px solid ${colors.red}`, padding: 8, marginVertical: 10 }}><Text style={{ color: colors.red, fontWeight: 700, marginBottom: 5 }}>FISCAL INFORMATION</Text>{(receipt.fiscal.sellerPin || receipt.merchant.taxIdentifier) && <View style={styles.row}><Text>Seller PIN</Text><Text>{receipt.fiscal.sellerPin ?? receipt.merchant.taxIdentifier}</Text></View>}{receipt.fiscal.buyerPin && <View style={styles.row}><Text>Buyer PIN</Text><Text>{receipt.fiscal.buyerPin}</Text></View>}{receipt.fiscal.etrScuIdentifier && <View style={styles.row}><Text>SCU / Register</Text><Text>{receipt.fiscal.etrScuIdentifier}</Text></View>}{receipt.fiscal.qrPresent !== null && <View style={styles.row}><Text>Verification QR on source</Text><Text>{receipt.fiscal.qrPresent ? "Yes" : "No"}</Text></View>}</View>
      <PdfItems receipt={receipt} />
      <PdfTotals receipt={receipt} accent={colors.red} />
      <PdfFooter receipt={receipt} />
    </>
  )
}

function ProfessionalInvoicePdf({ receipt }: { receipt: ReceiptViewModel }) {
  return (
    <>
      <View style={{ borderTop: `9px solid ${colors.ink}`, paddingTop: 22, display: "flex", flexDirection: "row", justifyContent: "space-between" }}><View><Text style={{ fontSize: 24, fontWeight: 700 }}>{receipt.merchant.name}</Text>{receipt.merchant.address && <Text style={{ color: colors.muted, marginTop: 5 }}>{receipt.merchant.address}</Text>}</View><View style={{ textAlign: "right" }}><Text style={{ fontSize: 31, color: colors.muted }}>INVOICE</Text><Text style={{ marginTop: 7 }}>{receipt.sourceNumber ?? "NUMBER PENDING"}</Text><Text style={{ color: colors.muted }}>{dateLabel(receipt)}</Text></View></View>
      <View style={{ borderTop: `1px solid ${colors.ink}`, borderBottom: `1px solid ${colors.ink}`, paddingVertical: 14, marginVertical: 24, display: "flex", flexDirection: "row", gap: 70 }}><View><Text style={styles.muted}>FROM</Text><Text style={{ fontWeight: 700, marginTop: 5 }}>{receipt.merchant.name}</Text>{receipt.merchant.contacts && <Text>{receipt.merchant.contacts}</Text>}</View><View><Text style={styles.muted}>BILL TO</Text><Text style={{ fontWeight: 700, marginTop: 5 }}>{receipt.buyer.name ?? "Buyer pending review"}</Text></View></View>
      <View style={[styles.row, { backgroundColor: colors.ink, color: "white", padding: 9, fontWeight: 700 }]}><Text>SERVICE / DESCRIPTION</Text><Text>AMOUNT</Text></View><View style={{ paddingTop: 10 }}><PdfItems receipt={receipt} empty="Service description pending review" /></View><PdfTotals receipt={receipt} />{receipt.notes && <Text style={{ borderLeft: `4px solid ${colors.ink}`, paddingLeft: 10, marginTop: 20, color: colors.muted }}>{receipt.notes}</Text>}<PdfFooter receipt={receipt} />
    </>
  )
}

function ConsultingInvoicePdf({ receipt }: { receipt: ReceiptViewModel }) {
  return (
    <>
      <View style={{ borderLeft: `9px solid ${colors.orange}`, paddingLeft: 24 }}><View style={{ display: "flex", flexDirection: "row", gap: 60 }}><View><Text style={{ color: colors.orange, fontSize: 7, letterSpacing: 1.5 }}>SERVICE INVOICE</Text><Text style={{ marginTop: 7 }}>{receipt.sourceNumber ?? "PENDING"}</Text></View><Text style={{ flexGrow: 1, fontSize: 27, fontWeight: 700 }}>{receipt.merchant.name}</Text></View><View style={{ backgroundColor: colors.orangePale, borderRadius: 10, padding: 16, marginVertical: 25, display: "flex", flexDirection: "row", justifyContent: "space-between" }}><View><Text style={{ color: colors.orange, fontSize: 7 }}>PREPARED FOR</Text><Text style={{ fontSize: 14, fontWeight: 700, marginTop: 5 }}>{receipt.buyer.name ?? "Client pending review"}</Text></View><View style={{ textAlign: "right" }}><Text style={{ color: colors.orange, fontSize: 7 }}>ISSUED</Text><Text style={{ marginTop: 5 }}>{dateLabel(receipt)}</Text></View></View><Text style={{ color: colors.orange, borderBottom: `2px solid ${colors.orange}`, paddingBottom: 6, marginBottom: 10, fontSize: 7, letterSpacing: 1.4 }}>SERVICES</Text><PdfItems receipt={receipt} empty="Service scope pending review" /><View style={{ backgroundColor: colors.ink, color: "white", marginLeft: 170, padding: 18, marginTop: 25 }}><Text style={{ color: "#ffffff88", fontSize: 7 }}>AMOUNT DUE</Text><Text style={{ fontSize: 23, fontWeight: 700, marginTop: 5 }}>{formatMoney(receipt.totalMinor, receipt.currency, receipt.locale)}</Text>{receipt.taxMinor > 0 && <Text style={{ color: "#ffffffaa", marginTop: 5 }}>Includes tax {formatMoney(receipt.taxMinor, receipt.currency, receipt.locale)}</Text>}</View><PdfFooter receipt={receipt} /></View>
    </>
  )
}

function LedgerPdf({ receipt }: { receipt: ReceiptViewModel }) {
  return (
    <>
      <View style={{ borderBottom: `1px solid #d6d3d1`, paddingBottom: 12, display: "flex", flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 16, fontWeight: 700 }}>{receipt.merchant.name}</Text>
        <Text style={{ backgroundColor: "#d1fae5", color: colors.green, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, fontWeight: 700 }}>PAID</Text>
      </View>
      <View style={{ textAlign: "center", paddingVertical: 22 }}>
        <Text style={styles.muted}>PAYMENT TOTAL</Text>
        <Text style={{ fontSize: 26, fontWeight: 700, marginTop: 5 }}>{formatMoney(receipt.totalMinor, receipt.currency, receipt.locale)}</Text>
        <Text style={{ color: colors.muted, marginTop: 5 }}>{dateLabel(receipt)}</Text>
      </View>
      <View style={{ borderTop: `1px solid #d6d3d1`, borderBottom: `1px solid #d6d3d1`, paddingVertical: 10 }}><PdfItems receipt={receipt} /></View>
      <View style={{ paddingTop: 12 }}>
        <View style={styles.row}><Text style={styles.muted}>Receipt number</Text><Text>{receipt.sourceNumber ?? "Pending"}</Text></View>
        {receipt.paymentMethod && <View style={styles.row}><Text style={styles.muted}>Payment method</Text><Text>{receipt.paymentMethod}</Text></View>}
        {receipt.paymentReference && <View style={styles.row}><Text style={styles.muted}>Reference</Text><Text>{receipt.paymentReference}</Text></View>}
      </View>
      <PdfFooter receipt={receipt} />
    </>
  )
}

function templateContents(receipt: ReceiptViewModel) {
  switch (receipt.templateId) {
    case "compact-58mm": return <CompactPdf receipt={receipt} />
    case "supermarket-itemized": return <SupermarketPdf receipt={receipt} />
    case "restaurant-hospitality": return <RestaurantPdf receipt={receipt} />
    case "fuel-forecourt": return <FuelPdf receipt={receipt} />
    case "mobile-money-record": return <MobileMoneyPdf receipt={receipt} />
    case "kenya-tax-reference": return <KenyaTaxPdf receipt={receipt} />
    case "professional-a4-invoice": return <ProfessionalInvoicePdf receipt={receipt} />
    case "service-consulting-invoice": return <ConsultingInvoicePdf receipt={receipt} />
    case "minimal-ledger-copy": return <LedgerPdf receipt={receipt} />
    default: return <ClassicPdf receipt={receipt} />
  }
}

export function ReceiptPdfDocument({ receipt, format }: { receipt: ReceiptViewModel; format: "thermal" | "a4" }) {
  const isA4Template = receipt.templateId === "professional-a4-invoice" || receipt.templateId === "service-consulting-invoice"
  const useA4 = format === "a4" || isA4Template
  const width = receipt.templateId === "compact-58mm" ? 164 : receipt.templateId === "minimal-ledger-copy" ? 320 : 247
  const height = Math.max(receipt.templateId === "mobile-money-record" ? 570 : 430, 390 + receipt.lines.length * 42)

  return (
    <Document title={`${receipt.archiveId} · ${receipt.merchant.name}`} author="Receipt archive">
      <Page size={useA4 ? "A4" : [width, height]} style={[styles.page, useA4 ? styles.a4 : {}]}>
        {receipt.status !== "final" && <Text style={styles.void}>{receipt.status.toUpperCase()}</Text>}
        {templateContents(receipt)}
        <PdfArchiveBand receipt={receipt} />
      </Page>
    </Document>
  )
}
