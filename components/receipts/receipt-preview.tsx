import {
  AlertTriangle,
  Check,
  FileText,
  Fuel,
  ReceiptText,
  ShoppingBasket,
  UtensilsCrossed,
} from "lucide-react"

import { formatMoney } from "@/lib/money"
import { TEMPLATE_LABELS, type ReceiptViewModel } from "@/lib/receipt-types"
import { cn } from "@/lib/utils"

type PreviewProps = { receipt: ReceiptViewModel }

function issuedAt(receipt: ReceiptViewModel) {
  return receipt.issuedAt
    ? new Intl.DateTimeFormat(receipt.locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: receipt.timezone,
      }).format(new Date(receipt.issuedAt))
    : "Date pending review"
}

function merchantInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "M"
}

function StatusWatermark({ receipt }: PreviewProps) {
  if (receipt.status === "final") return null
  return (
    <div className={cn(
      "pointer-events-none absolute inset-0 z-10 grid place-items-center -rotate-12 text-5xl font-black uppercase tracking-[.18em] opacity-[.055]",
      receipt.status === "void" && "text-red-700 opacity-[.16]"
    )}>
      {receipt.status}
    </div>
  )
}

function ArchiveDisclosure({ receipt, className }: PreviewProps & { className?: string }) {
  const verified = receipt.hasOriginalSource
  return (
    <aside aria-label="Digital-copy status" className={cn("mx-auto mt-3 border border-border/80 bg-background/90 px-4 py-3 text-left shadow-sm", !verified && "border-amber-500/35 bg-amber-50/95", className)}>
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full", verified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>
          {verified ? <Check className="size-3.5" strokeWidth={3} /> : <AlertTriangle className="size-3.5" strokeWidth={2.5} />}
        </span>
        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-[.14em] text-foreground/75">{verified ? "Verified digital copy" : "Unverified draft"} · {receipt.archiveId}</p>
          <p className="mt-1 text-[9px] leading-4 text-muted-foreground">{verified ? "Generated from the attached source · not a replacement vendor or tax invoice" : "Attach and validate the original source before finalizing or exporting"}</p>
          {receipt.status === "void" && <p className="mt-1 text-[9px] font-bold uppercase text-red-800">Void · {receipt.voidReason}</p>}
        </div>
      </div>
    </aside>
  )
}

function MerchantMark({ receipt, className }: PreviewProps & { className?: string }) {
  if (receipt.merchant.logoUrl) {
    return (
      // Merchant-profile images are explicitly supplied by an administrator.
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={`${receipt.merchant.name} logo`} className={cn("size-12 object-contain", className)} src={receipt.merchant.logoUrl} />
    )
  }
  return <span className={cn("grid size-11 shrink-0 place-items-center border-2 border-current text-sm font-black", className)}>{merchantInitials(receipt.merchant.name)}</span>
}

function MerchantIdentity({ receipt, centered = false }: PreviewProps & { centered?: boolean }) {
  return (
    <div className={centered ? "text-center" : undefined}>
      <p className="text-xl font-black tracking-tight">{receipt.merchant.name}</p>
      {receipt.merchant.address && <p className="mt-1 opacity-70">{receipt.merchant.address}</p>}
      {receipt.merchant.contacts && <p className="opacity-70">{receipt.merchant.contacts}</p>}
      {receipt.merchant.taxIdentifier && <p className="mt-1">PIN / Tax ID: {receipt.merchant.taxIdentifier}</p>}
    </div>
  )
}

function VendorFooter({ receipt, className }: PreviewProps & { className?: string }) {
  if (!receipt.footer) return null
  return <p className={cn("mt-5 border-t border-dashed border-current pt-4 text-center", className)}>{receipt.footer}</p>
}

function ItemRows({ receipt, empty = "Description pending review", dense = false }: PreviewProps & { empty?: string; dense?: boolean }) {
  if (!receipt.lines.length) return <p className={cn("text-center opacity-45", dense ? "py-3" : "py-5")}>{empty}</p>
  return (
    <div className={cn(dense ? "space-y-1.5" : "space-y-2.5")}>
      {receipt.lines.map((line) => (
        <div key={line.id} className="grid grid-cols-[1fr_auto] gap-3">
          <div><p>{line.description}</p><p className="opacity-55">{line.quantity} × {formatMoney(line.unitPriceMinor, receipt.currency, receipt.locale)}</p></div>
          <span className="font-semibold tabular-nums">{formatMoney(line.totalMinor, receipt.currency, receipt.locale)}</span>
        </div>
      ))}
    </div>
  )
}

function Totals({ receipt, label = "Total", boxed = false }: PreviewProps & { label?: string; boxed?: boolean }) {
  return (
    <section className={cn("ml-auto w-full py-4", boxed ? "border-2 border-current p-3" : "border-t border-dashed border-current", "sm:max-w-[280px]")}>
      <div><span>Subtotal</span><span className="float-right tabular-nums">{formatMoney(receipt.subtotalMinor, receipt.currency, receipt.locale)}</span></div>
      {receipt.discountMinor > 0 && <div><span>Discount</span><span className="float-right tabular-nums">-{formatMoney(receipt.discountMinor, receipt.currency, receipt.locale)}</span></div>}
      {receipt.taxMinor > 0 && <div><span>Tax</span><span className="float-right tabular-nums">{formatMoney(receipt.taxMinor, receipt.currency, receipt.locale)}</span></div>}
      {receipt.feesMinor > 0 && <div><span>Fees</span><span className="float-right tabular-nums">{formatMoney(receipt.feesMinor, receipt.currency, receipt.locale)}</span></div>}
      <div className={cn("mt-2 py-2 text-[1.2em] font-black", boxed ? "border-t border-current" : "border-y-2 border-current")}><span>{label}</span><span className="float-right tabular-nums">{formatMoney(receipt.totalMinor, receipt.currency, receipt.locale)}</span></div>
    </section>
  )
}

function PaymentDetails({ receipt }: PreviewProps) {
  if (!receipt.paymentMethod && !receipt.paymentReference) return null
  return (
    <div className="mt-3 border-t border-dotted pt-3">
      {receipt.paymentMethod && <p><span className="opacity-55">PAYMENT</span><span className="float-right font-semibold">{receipt.paymentMethod}</span></p>}
      {receipt.paymentReference && <p><span className="opacity-55">REFERENCE</span><span className="float-right font-mono">{receipt.paymentReference}</span></p>}
    </div>
  )
}

function ClassicThermal({ receipt }: PreviewProps) {
  return (
    <div className="p-7 font-mono text-[11px]">
      <header className="border-b-2 border-current pb-5 text-center"><MerchantMark receipt={receipt} className="mx-auto mb-3" /><MerchantIdentity receipt={receipt} centered /><p className="mt-4 font-bold uppercase tracking-[.22em]">Sales receipt</p></header>
      <section className="grid gap-1 border-b border-dashed py-4"><div><span className="opacity-60">Receipt</span><span className="float-right font-semibold">{receipt.sourceNumber ?? "NUMBER PENDING"}</span></div><div><span className="opacity-60">Date</span><span className="float-right font-semibold">{issuedAt(receipt)}</span></div></section>
      <section className="py-4"><div className="mb-2 grid grid-cols-[1fr_auto] border-b pb-2 font-bold uppercase"><span>Description</span><span>Amount</span></div><ItemRows receipt={receipt} /></section>
      <Totals receipt={receipt} /><PaymentDetails receipt={receipt} /><VendorFooter receipt={receipt} />
    </div>
  )
}

function CompactTill({ receipt }: PreviewProps) {
  return (
    <div className="p-5 font-mono text-[9px]">
      <header className="border-b border-dotted pb-3 text-center"><p className="text-base font-black uppercase">{receipt.merchant.name}</p>{receipt.merchant.address && <p className="opacity-65">{receipt.merchant.address}</p>}{receipt.merchant.contacts && <p className="opacity-65">{receipt.merchant.contacts}</p>}<p className="mt-2 tracking-[.18em]">*** CUSTOMER COPY ***</p></header>
      <div className="border-b border-dotted py-3"><p>{issuedAt(receipt)}</p><p>RECEIPT {receipt.sourceNumber ?? "PENDING"}</p></div>
      <section className="border-b border-dotted py-3"><ItemRows receipt={receipt} dense /></section>
      <div className="py-3"><p>SUBTOTAL <span className="float-right">{formatMoney(receipt.subtotalMinor, receipt.currency, receipt.locale)}</span></p>{receipt.discountMinor > 0 && <p>DISCOUNT <span className="float-right">-{formatMoney(receipt.discountMinor, receipt.currency, receipt.locale)}</span></p>}{receipt.taxMinor > 0 && <p>TAX <span className="float-right">{formatMoney(receipt.taxMinor, receipt.currency, receipt.locale)}</span></p>}<p className="mt-2 border-y border-current py-2 text-sm font-black">TOTAL <span className="float-right">{formatMoney(receipt.totalMinor, receipt.currency, receipt.locale)}</span></p></div>
      <PaymentDetails receipt={receipt} /><VendorFooter receipt={receipt} />
    </div>
  )
}

function SupermarketTill({ receipt }: PreviewProps) {
  return (
    <div className="p-6 font-mono text-[10px]">
      <header className="bg-[#171612] p-4 text-[#fffef9]"><div className="flex items-center gap-3"><ShoppingBasket className="size-7" /><div><p className="text-lg font-black uppercase">{receipt.merchant.name}</p>{receipt.merchant.address && <p className="opacity-70">{receipt.merchant.address}</p>}</div></div></header>
      <div className="grid grid-cols-2 gap-3 border-x border-b p-3"><div><p className="opacity-55">RECEIPT</p><p className="font-bold">{receipt.sourceNumber ?? "PENDING"}</p></div><div className="text-right"><p className="opacity-55">DATE / TIME</p><p className="font-bold">{issuedAt(receipt)}</p></div></div>
      <section className="py-4"><div className="mb-3 grid grid-cols-[1fr_auto] bg-neutral-200 px-2 py-1.5 font-bold"><span>ITEM / QTY</span><span>PRICE</span></div><ItemRows receipt={receipt} dense /></section>
      <Totals receipt={receipt} boxed /><PaymentDetails receipt={receipt} /><VendorFooter receipt={receipt} className="uppercase" />
    </div>
  )
}

function RestaurantCheck({ receipt }: PreviewProps) {
  return (
    <div className="border-x-8 border-x-[#7c2d12] p-8 font-serif text-[11px]">
      <header className="text-center"><UtensilsCrossed className="mx-auto size-6 text-[#7c2d12]" /><p className="mt-3 text-2xl font-semibold italic">{receipt.merchant.name}</p>{receipt.merchant.address && <p className="mt-1 opacity-65">{receipt.merchant.address}</p>}<p className="mt-3 text-[9px] font-bold uppercase tracking-[.22em] text-[#7c2d12]">Guest check</p></header>
      <div className="my-5 grid grid-cols-2 border-y border-[#7c2d12]/40 py-3"><div><p className="text-[9px] uppercase tracking-wider opacity-55">Check</p><p>{receipt.sourceNumber ?? "Pending"}</p></div><div className="text-right"><p className="text-[9px] uppercase tracking-wider opacity-55">Served</p><p>{issuedAt(receipt)}</p></div>{receipt.buyer.name && <div className="col-span-2 mt-2"><span className="opacity-55">Guest</span><span className="float-right">{receipt.buyer.name}</span></div>}</div>
      <ItemRows receipt={receipt} empty="Order description pending review" /><Totals receipt={receipt} label="Check total" /><PaymentDetails receipt={receipt} /><p className="mt-5 text-center italic opacity-65">Thank you for dining with us</p><VendorFooter receipt={receipt} />
    </div>
  )
}

function FuelDocket({ receipt }: PreviewProps) {
  return (
    <div className="border-t-[12px] border-emerald-800 p-6 font-mono text-[10px]">
      <header className="flex items-center justify-between border-b-2 border-emerald-800 pb-4"><div><p className="text-[9px] font-bold uppercase tracking-[.18em] text-emerald-800">Fuel sales receipt</p><p className="mt-1 text-xl font-black">{receipt.merchant.name}</p>{receipt.merchant.address && <p className="mt-1 opacity-60">{receipt.merchant.address}</p>}</div><span className="grid size-11 place-items-center rounded-full bg-emerald-800 text-white"><Fuel className="size-5" /></span></header>
      <div className="my-4 grid grid-cols-2 gap-px border border-emerald-800/25 bg-emerald-800/25"><div className="bg-[#fffef9] p-3"><p className="opacity-55">DATE / TIME</p><p className="mt-1 font-bold">{issuedAt(receipt)}</p></div><div className="bg-[#fffef9] p-3"><p className="opacity-55">RECEIPT</p><p className="mt-1 font-bold">{receipt.sourceNumber ?? "PENDING"}</p></div></div>
      <section className="border-y-2 border-emerald-800 py-4"><ItemRows receipt={receipt} empty="Fuel or service description pending review" /></section>
      <div className="my-4 bg-emerald-800 p-4 text-white"><p className="text-[9px] uppercase tracking-widest opacity-70">Amount paid</p><p className="mt-1 text-2xl font-black">{formatMoney(receipt.totalMinor, receipt.currency, receipt.locale)}</p></div>
      <PaymentDetails receipt={receipt} /><VendorFooter receipt={receipt} />
    </div>
  )
}

function MobileMoneyRecord({ receipt }: PreviewProps) {
  return (
    <div className="p-6 font-mono text-[10px]">
      <header className="border-b-2 border-current pb-4 text-center">
        <MerchantMark receipt={receipt} className="mx-auto mb-3" />
        <MerchantIdentity receipt={receipt} centered />
        <p className="mt-4 font-black uppercase tracking-[.2em]">Mobile payment receipt</p>
        <p className="mt-1 opacity-55">*** CUSTOMER COPY ***</p>
      </header>

      <section className="grid gap-1 border-b border-dashed py-4">
        <p><span className="opacity-55">RECEIPT</span><span className="float-right font-bold">{receipt.sourceNumber ?? "PENDING"}</span></p>
        <p><span className="opacity-55">DATE / TIME</span><span className="float-right max-w-[66%] text-right font-bold">{issuedAt(receipt)}</span></p>
        {receipt.buyer.name && <p><span className="opacity-55">CUSTOMER</span><span className="float-right font-semibold">{receipt.buyer.name}</span></p>}
      </section>

      <section className="py-4">
        <div className="mb-3 grid grid-cols-[1fr_auto] border-b border-current pb-2 font-bold uppercase"><span>Item / Qty</span><span>Amount</span></div>
        <ItemRows receipt={receipt} empty="Purchase description pending review" dense />
      </section>

      <Totals receipt={receipt} label="Amount paid" />

      <section className="mt-4 border-y-2 border-current py-3">
        <p className="mb-2 flex items-center justify-center gap-2 text-center font-black uppercase tracking-[.16em]"><Check className="size-3.5" strokeWidth={3} /> Paid by mobile money</p>
        {receipt.paymentMethod && <p><span className="opacity-55">METHOD</span><span className="float-right font-semibold">{receipt.paymentMethod}</span></p>}
        <p><span className="opacity-55">REFERENCE</span><span className="float-right font-bold">{receipt.paymentReference ?? "PENDING"}</span></p>
      </section>

      <p className="mt-5 text-center font-bold uppercase tracking-[.18em]">Thank you</p>
      <VendorFooter receipt={receipt} />
    </div>
  )
}

function KenyaTaxRecord({ receipt }: PreviewProps) {
  return (
    <div className="border-t-[10px] border-red-900 p-7 font-mono text-[10px]">
      <header className="grid grid-cols-[1fr_auto] gap-5 border-b-2 border-red-900 pb-4"><div><p className="text-[9px] font-bold uppercase tracking-[.18em] text-red-900">Tax invoice</p><p className="mt-1 text-xl font-black">{receipt.merchant.name}</p>{receipt.merchant.address && <p className="mt-1 opacity-60">{receipt.merchant.address}</p>}{receipt.merchant.contacts && <p className="opacity-60">{receipt.merchant.contacts}</p>}</div><ReceiptText className="size-8 text-red-900" /></header>
      <section className="grid gap-1 border-b border-red-900/30 py-4"><p>Invoice number <span className="float-right font-bold">{receipt.sourceNumber ?? "PENDING"}</span></p><p>Date / time <span className="float-right font-bold">{issuedAt(receipt)}</span></p>{(receipt.fiscal.sellerPin || receipt.merchant.taxIdentifier) && <p>Seller PIN <span className="float-right">{receipt.fiscal.sellerPin ?? receipt.merchant.taxIdentifier}</span></p>}{receipt.fiscal.buyerPin && <p>Buyer PIN <span className="float-right">{receipt.fiscal.buyerPin}</span></p>}</section>
      <section className="py-4"><div className="mb-3 grid grid-cols-[1fr_auto] bg-red-950 px-3 py-2 font-bold text-white"><span>ITEM / QTY</span><span>AMOUNT</span></div><ItemRows receipt={receipt} /></section>
      <Totals receipt={receipt} label="Gross total" />
      {(receipt.fiscal.etrScuIdentifier || receipt.fiscal.qrPresent !== null) && <section className="mt-3 border border-red-900 p-3"><p className="mb-2 font-bold uppercase text-red-900">Fiscal information</p>{receipt.fiscal.etrScuIdentifier && <p>SCU / Register <span className="float-right">{receipt.fiscal.etrScuIdentifier}</span></p>}{receipt.fiscal.qrPresent !== null && <p>Verification QR on source <span className="float-right">{receipt.fiscal.qrPresent ? "Yes" : "No"}</span></p>}</section>}
      <PaymentDetails receipt={receipt} /><VendorFooter receipt={receipt} />
    </div>
  )
}

function ProfessionalInvoice({ receipt }: PreviewProps) {
  return (
    <div className="min-h-[760px] border-t-[12px] border-neutral-950 p-12 font-sans text-[11px]">
      <header className="grid grid-cols-[1fr_auto] gap-10"><div><MerchantMark receipt={receipt} className="mb-6" /><p className="text-3xl font-black tracking-tight">{receipt.merchant.name}</p>{receipt.merchant.address && <p className="mt-2 max-w-xs opacity-65">{receipt.merchant.address}</p>}{receipt.merchant.contacts && <p className="opacity-65">{receipt.merchant.contacts}</p>}</div><div className="text-right"><p className="text-4xl font-light uppercase tracking-tight">Invoice</p><p className="mt-3 font-mono">{receipt.sourceNumber ?? "NUMBER PENDING"}</p><p className="mt-1 opacity-60">{issuedAt(receipt)}</p></div></header>
      <section className="mt-12 grid grid-cols-2 gap-12 border-y py-6"><div><p className="text-[9px] font-bold uppercase tracking-wider opacity-55">From</p><p className="mt-2 font-bold">{receipt.merchant.name}</p>{receipt.merchant.taxIdentifier && <p>PIN / Tax ID: {receipt.merchant.taxIdentifier}</p>}</div><div><p className="text-[9px] font-bold uppercase tracking-wider opacity-55">Bill to</p><p className="mt-2 font-bold">{receipt.buyer.name ?? "Buyer pending review"}</p>{receipt.buyer.taxIdentifier && <p>PIN / Tax ID: {receipt.buyer.taxIdentifier}</p>}</div></section>
      <section className="mt-8"><div className="mb-4 grid grid-cols-[1fr_auto] bg-neutral-950 px-4 py-3 font-bold uppercase tracking-wider text-white"><span>Service / description</span><span>Amount</span></div><ItemRows receipt={receipt} empty="Service description pending review" /></section>
      <Totals receipt={receipt} boxed /><PaymentDetails receipt={receipt} />{receipt.notes && <p className="mt-8 border-l-4 border-neutral-950 pl-4 opacity-70">{receipt.notes}</p>}<VendorFooter receipt={receipt} />
    </div>
  )
}

function ConsultingInvoice({ receipt }: PreviewProps) {
  return (
    <div className="min-h-[760px] border-l-[14px] border-orange-700 p-12 font-sans text-[11px]">
      <header className="grid grid-cols-[.7fr_1.3fr] gap-10"><div><FileText className="size-8 text-orange-700" /><p className="mt-6 text-[9px] font-bold uppercase tracking-[.22em] text-orange-700">Service invoice</p><p className="mt-2 font-mono">{receipt.sourceNumber ?? "PENDING"}</p></div><div><p className="text-4xl font-semibold tracking-tight">{receipt.merchant.name}</p>{receipt.merchant.address && <p className="mt-4 max-w-md opacity-65">{receipt.merchant.address}</p>}{receipt.merchant.contacts && <p className="opacity-65">{receipt.merchant.contacts}</p>}</div></header>
      <section className="mt-12 grid grid-cols-[1fr_auto] gap-8 rounded-2xl bg-orange-50 p-6"><div><p className="text-[9px] font-bold uppercase tracking-wider text-orange-800">Prepared for</p><p className="mt-2 text-lg font-semibold">{receipt.buyer.name ?? "Client pending review"}</p></div><div className="text-right"><p className="text-[9px] font-bold uppercase tracking-wider text-orange-800">Issued</p><p className="mt-2 font-medium">{issuedAt(receipt)}</p></div></section>
      <section className="mt-9"><p className="mb-4 border-b-2 border-orange-700 pb-2 text-[9px] font-bold uppercase tracking-[.18em] text-orange-800">Services</p><ItemRows receipt={receipt} empty="Service scope pending review" /></section>
      <div className="mt-10 ml-auto max-w-sm bg-neutral-950 p-6 text-white"><p className="text-[9px] uppercase tracking-wider text-white/55">Amount due</p><p className="mt-2 text-3xl font-black">{formatMoney(receipt.totalMinor, receipt.currency, receipt.locale)}</p>{receipt.taxMinor > 0 && <p className="mt-3 text-white/65">Includes tax {formatMoney(receipt.taxMinor, receipt.currency, receipt.locale)}</p>}</div>
      <PaymentDetails receipt={receipt} />{receipt.notes && <p className="mt-10 border-t pt-5 opacity-70">{receipt.notes}</p>}<VendorFooter receipt={receipt} />
    </div>
  )
}

function MinimalDigitalReceipt({ receipt }: PreviewProps) {
  return (
    <div className="p-8 font-sans text-[11px]">
      <header className="flex items-start justify-between gap-6 border-b pb-6"><div className="flex items-center gap-3"><MerchantMark receipt={receipt} className="rounded-full bg-neutral-950 text-white" /><div><p className="text-lg font-bold">{receipt.merchant.name}</p>{receipt.merchant.contacts && <p className="opacity-55">{receipt.merchant.contacts}</p>}</div></div><p className="rounded-full bg-emerald-100 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-800">Paid</p></header>
      <section className="py-8 text-center"><p className="text-[9px] font-bold uppercase tracking-[.18em] opacity-50">Payment total</p><p className="mt-2 text-4xl font-black tracking-tight">{formatMoney(receipt.totalMinor, receipt.currency, receipt.locale)}</p><p className="mt-2 opacity-55">{issuedAt(receipt)}</p></section>
      <section className="border-y py-5"><ItemRows receipt={receipt} dense /></section>
      <section className="grid gap-2 py-5"><p><span className="opacity-55">Receipt number</span><span className="float-right font-mono">{receipt.sourceNumber ?? "Pending"}</span></p>{receipt.paymentMethod && <p><span className="opacity-55">Payment method</span><span className="float-right">{receipt.paymentMethod}</span></p>}{receipt.paymentReference && <p><span className="opacity-55">Reference</span><span className="float-right font-mono">{receipt.paymentReference}</span></p>}</section>
      <VendorFooter receipt={receipt} />
    </div>
  )
}

function TemplateBody({ receipt }: PreviewProps) {
  switch (receipt.templateId) {
    case "compact-58mm": return <CompactTill receipt={receipt} />
    case "supermarket-itemized": return <SupermarketTill receipt={receipt} />
    case "restaurant-hospitality": return <RestaurantCheck receipt={receipt} />
    case "fuel-forecourt": return <FuelDocket receipt={receipt} />
    case "mobile-money-record": return <MobileMoneyRecord receipt={receipt} />
    case "kenya-tax-reference": return <KenyaTaxRecord receipt={receipt} />
    case "professional-a4-invoice": return <ProfessionalInvoice receipt={receipt} />
    case "service-consulting-invoice": return <ConsultingInvoice receipt={receipt} />
    case "minimal-ledger-copy": return <MinimalDigitalReceipt receipt={receipt} />
    default: return <ClassicThermal receipt={receipt} />
  }
}

function paperClass(templateId: ReceiptViewModel["templateId"]) {
  switch (templateId) {
    case "compact-58mm": return "max-w-[250px] receipt-edge"
    case "supermarket-itemized": return "max-w-[365px] receipt-edge"
    case "restaurant-hospitality": return "max-w-[380px] receipt-edge"
    case "fuel-forecourt": return "max-w-[360px] receipt-edge"
    case "mobile-money-record": return "max-w-[330px] receipt-edge"
    case "kenya-tax-reference": return "max-w-[410px] receipt-edge"
    case "professional-a4-invoice":
    case "service-consulting-invoice": return "max-w-[720px]"
    case "minimal-ledger-copy": return "max-w-[430px]"
    default: return "max-w-[340px] receipt-edge"
  }
}

export function ReceiptPreview({ receipt, className }: { receipt: ReceiptViewModel; className?: string }) {
  const width = paperClass(receipt.templateId)
  return (
    <article aria-label={`${TEMPLATE_LABELS[receipt.templateId]} preview`} className={cn("print-receipt relative mx-auto w-full", className)}>
      <div className={cn("paper-shadow relative mx-auto w-full overflow-hidden bg-[#fffef9] text-[#171612]", width)}><StatusWatermark receipt={receipt} /><TemplateBody receipt={receipt} /></div>
      <ArchiveDisclosure receipt={receipt} className={width.replace("receipt-edge", "")} />
    </article>
  )
}
