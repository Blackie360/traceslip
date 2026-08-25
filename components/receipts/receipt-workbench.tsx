"use client"
/* eslint-disable @next/next/no-img-element -- blob and private source previews cannot use the image optimizer */

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  CircleAlert,
  Download,
  FileCheck2,
  FileSearch,
  FileUp,
  Loader2,
  MessageSquareText,
  Plus,
  Printer,
  RotateCw,
  Save,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
  Undo2,
  UploadCloud,
  WandSparkles,
} from "lucide-react"
import { toast } from "sonner"

import { ReceiptPreview } from "@/components/receipts/receipt-preview"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { safeSuggestionKeys, type ReviewableSuggestionKey } from "@/lib/extraction-review"
import { MAX_UPLOAD_BYTES } from "@/lib/files"
import { formatMoney, majorToMinor, minorToMajor } from "@/lib/money"
import { applyReceiptExtraction } from "@/lib/receipt-auto-fill"
import {
  EMPTY_RECEIPT_VIEW_MODEL,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  RECEIPT_TEMPLATE_IDS,
  TEMPLATE_LABELS,
  type ReceiptExtraction,
  type ReceiptViewModel,
  type SourceSuggestion,
} from "@/lib/receipt-types"
import { cn } from "@/lib/utils"

type ProjectOption = { id: string; name: string }
type ProcessingStage = "idle" | "uploading" | "validating" | "extracting" | "ready" | "error"
type DuplicateMatch = {
  id: string
  archiveId: string
  reason: string
  status?: string
  merchantName?: string
  issuedAt?: string | null
  currency?: string
  totalMinor?: number
}
type HistoryEntry = {
  receipt: ReceiptViewModel
  extraction: ReceiptExtraction | null
  appliedKeys: Set<ReviewableSuggestionKey>
}

const SUGGESTION_LABELS: Record<ReviewableSuggestionKey, string> = {
  expenseCategory: "Expense category",
  merchantName: "Paid to / merchant",
  merchantAddress: "Merchant address",
  merchantContacts: "Merchant contact",
  merchantTaxIdentifier: "Merchant tax ID",
  sourceNumber: "Source number",
  issuedAt: "Date & time",
  currency: "Currency",
  paymentMethod: "Payment method",
  paymentReference: "Payment reference",
  buyerName: "Customer name",
  buyerTaxIdentifier: "Customer tax ID",
  sellerPin: "Seller PIN",
  etrScuIdentifier: "ETR / SCU identifier",
  qrPresent: "QR visible",
  subtotalMinor: "Subtotal",
  discountMinor: "Discount",
  taxMinor: "Tax",
  feesMinor: "Fees",
  totalMinor: "Grand total",
}

const MONEY_SUGGESTION_KEYS = new Set<ReviewableSuggestionKey>([
  "subtotalMinor",
  "discountMinor",
  "taxMinor",
  "feesMinor",
  "totalMinor",
])

const PIPELINE_STEPS = [
  { key: "uploading", label: "Upload", description: "Sending source", icon: UploadCloud },
  { key: "validating", label: "Validate", description: "Checking file", icon: ShieldCheck },
  { key: "extracting", label: "Extract", description: "Reading details", icon: FileSearch },
  { key: "ready", label: "Review", description: "Draft populated", icon: FileCheck2 },
] as const

function ProcessingRail({ stage, progress, error }: { stage: ProcessingStage; progress: number; error: string | null }) {
  if (stage === "idle") return null
  const currentIndex = PIPELINE_STEPS.findIndex((step) => step.key === stage)

  return (
    <section className={cn("app-panel no-print mb-5 p-4", stage === "error" && "border-destructive/35")} aria-live="polite">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Automatic receipt processing</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {stage === "ready"
              ? "High-confidence details are already in the editable draft."
              : stage === "error"
                ? "The source is still available for manual entry or retry."
                : "Keep this page open while TraceSlip reads the source."}
          </p>
        </div>
        {stage === "ready" ? (
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300"><CheckCircle2 />Ready to review</Badge>
        ) : stage !== "error" ? (
          <span className="text-xs font-medium tabular-nums text-muted-foreground">{progress}%</span>
        ) : null}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {PIPELINE_STEPS.map((step, index) => {
          const complete = stage === "ready" || (currentIndex >= 0 && index < currentIndex)
          const active = step.key === stage
          const Icon = step.icon
          return (
            <div key={step.key} className="min-w-0">
              <div className={cn("mb-2 h-1 rounded-full bg-muted", (complete || active) && "bg-emerald-500")} />
              <div className="flex items-start gap-2">
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground", (complete || active) && "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300")}>
                  {active && stage !== "ready" ? <Loader2 className="size-3.5 animate-spin" /> : complete ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                </span>
                <span className="min-w-0"><span className="block truncate text-xs font-medium">{step.label}</span><span className="hidden truncate text-[10px] text-muted-foreground sm:block">{step.description}</span></span>
              </div>
            </div>
          )
        })}
      </div>
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
    </section>
  )
}

function formatSuggestion(key: ReviewableSuggestionKey, suggestion: SourceSuggestion<unknown>, extraction: ReceiptExtraction, receipt: ReceiptViewModel) {
  if (MONEY_SUGGESTION_KEYS.has(key)) {
    return formatMoney(Number(suggestion.normalizedValue), extraction.currency.normalizedValue ?? receipt.currency, receipt.locale)
  }
  if (typeof suggestion.normalizedValue === "boolean") return suggestion.normalizedValue ? "Yes" : "No"
  return String(suggestion.normalizedValue)
}

function SuggestionRow({
  keyName,
  suggestion,
  extraction,
  receipt,
  applied,
}: {
  keyName: ReviewableSuggestionKey
  suggestion: SourceSuggestion<unknown>
  extraction: ReceiptExtraction
  receipt: ReceiptViewModel
  applied: boolean
}) {
  return (
    <div className="flex gap-3 p-4">
      <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", applied ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300")}>
        {applied ? <Check className="size-3" /> : <AlertTriangle className="size-3" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{SUGGESTION_LABELS[keyName]}</span><Badge variant={applied ? "secondary" : "outline"}>{Math.round(suggestion.confidence * 100)}%</Badge></span>
        <span className="mt-1 block truncate text-sm">{formatSuggestion(keyName, suggestion, extraction, receipt)}</span>
        <span className="mt-1 block text-xs text-muted-foreground">Evidence: “{suggestion.rawSourceText ?? "No visible evidence"}”</span>
        <span className={cn("mt-1.5 block text-[10px] font-semibold", applied ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300")}>{applied ? "Filled automatically" : "Confirm or correct in the draft"}</span>
      </span>
    </div>
  )
}

export function ReceiptWorkbench({
  projects,
  initialReceipt,
  initialAttachmentId,
  initialAttachmentMime,
  initialExtraction,
}: {
  projects: ProjectOption[]
  initialReceipt?: ReceiptViewModel
  initialAttachmentId?: string | null
  initialAttachmentMime?: string | null
  initialExtraction?: ReceiptExtraction | null
}) {
  const initialCanAutoFill = Boolean(initialReceipt && initialExtraction && initialReceipt.status === "draft")
  const [receipt, setReceipt] = useState<ReceiptViewModel>(() => initialCanAutoFill
    ? applyReceiptExtraction(initialReceipt!, initialExtraction!)
    : initialReceipt ?? EMPTY_RECEIPT_VIEW_MODEL)
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "")
  const [receiptId, setReceiptId] = useState<string | undefined>(initialReceipt?.id)
  const [attachmentId, setAttachmentId] = useState<string | undefined>(initialAttachmentId ?? undefined)
  const [file, setFile] = useState<File | null>(null)
  const [sourceUrl, setSourceUrl] = useState<string | undefined>(initialAttachmentId ? `/api/attachments/${initialAttachmentId}` : undefined)
  const [rotation, setRotation] = useState(0)
  const [extraction, setExtraction] = useState<ReceiptExtraction | null>(initialExtraction ?? null)
  const [appliedKeys, setAppliedKeys] = useState<Set<ReviewableSuggestionKey>>(() => new Set(initialCanAutoFill && initialExtraction ? safeSuggestionKeys(initialExtraction) : []))
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [processingStage, setProcessingStage] = useState<ProcessingStage>(initialCanAutoFill ? "ready" : "idle")
  const [processingProgress, setProcessingProgress] = useState(initialCanAutoFill ? 100 : 0)
  const [processingError, setProcessingError] = useState<string | null>(null)
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([])
  const [draftDescription, setDraftDescription] = useState("")
  const [descriptionSource, setDescriptionSource] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const readOnly = receipt.status !== "draft"
  const sourceMime = file?.type ?? initialAttachmentMime
  const selectedProject = projects.find((project) => project.id === projectId)
  const processing = ["uploading", "validating", "extracting"].includes(processingStage)

  useEffect(() => () => {
    if (sourceUrl?.startsWith("blob:")) URL.revokeObjectURL(sourceUrl)
  }, [sourceUrl])

  const suggestions = useMemo(() => {
    if (!extraction) return []
    return (Object.keys(SUGGESTION_LABELS) as ReviewableSuggestionKey[])
      .map((key) => ({ key, suggestion: extraction[key] as SourceSuggestion<unknown> }))
      .filter((item) => item.suggestion.normalizedValue !== null)
  }, [extraction])
  const reviewSuggestions = useMemo(
    () => suggestions.filter(({ key }) => !appliedKeys.has(key)),
    [appliedKeys, suggestions]
  )
  const appliedSuggestions = useMemo(
    () => suggestions.filter(({ key }) => appliedKeys.has(key)),
    [appliedKeys, suggestions]
  )

  function pushHistory(current = receipt) {
    setHistory((items) => [...items.slice(-9), {
      receipt: current,
      extraction,
      appliedKeys: new Set(appliedKeys),
    }])
  }

  function undo() {
    setHistory((items) => {
      const previous = items.at(-1)
      if (previous) {
        setReceipt(previous.receipt)
        setExtraction(previous.extraction)
        setAppliedKeys(previous.appliedKeys)
      }
      return items.slice(0, -1)
    })
    toast.success("Automatic fill undone")
  }

  function openFilePicker() {
    if (!fileInput.current || busy) return
    fileInput.current.value = ""
    fileInput.current.click()
  }

  function openCamera() {
    if (!cameraInput.current || busy) return
    cameraInput.current.value = ""
    cameraInput.current.click()
  }

  function validateFile(nextFile: File) {
    if (nextFile.size > MAX_UPLOAD_BYTES) return "Files must be 10 MB or smaller"
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(nextFile.type)) return "Choose a JPEG, PNG, WebP, or PDF source"
    return null
  }

  async function requestExtraction(targetReceiptId: string, targetAttachmentId: string, enhanced = false) {
    const response = await fetch(`/api/receipts/${targetReceiptId}/extract`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ attachmentId: targetAttachmentId, enhanced }),
    })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error)
    return {
      extraction: body.extraction as ReceiptExtraction,
      cached: Boolean(body.cached),
      possibleDuplicates: (body.possibleDuplicates ?? []) as DuplicateMatch[],
    }
  }

  function applyAutomatic(
    result: ReceiptExtraction,
    baseReceipt: ReceiptViewModel,
    possibleDuplicates: DuplicateMatch[] = []
  ) {
    const keys = safeSuggestionKeys(result)
    pushHistory(baseReceipt)
    setReceipt(applyReceiptExtraction(baseReceipt, result, keys))
    setExtraction(result)
    setAppliedKeys(new Set(keys))
    setProcessingStage("ready")
    setProcessingProgress(100)
    setProcessingError(null)
    setDuplicateMatches((current) => {
      const combined = [...current, ...possibleDuplicates]
      return combined.filter((match, index) => combined.findIndex((item) => item.id === match.id) === index)
    })
    if (keys.length) toast.success(`${keys.length} source-backed fields filled automatically`)
    else toast.warning("Source attached, but its details need manual review")
  }

  async function processFile(nextFile: File) {
    const validationError = validateFile(nextFile)
    if (validationError) {
      toast.error(validationError)
      return
    }
    if (!projectId) {
      toast.error("Choose a project before adding a receipt")
      return
    }
    if (busy) return

    setFile(nextFile)
    setSourceUrl(URL.createObjectURL(nextFile))
    setRotation(0)
    setExtraction(null)
    setAppliedKeys(new Set())
    setDuplicateMatches([])
    setProcessingError(null)
    setProcessingStage("uploading")
    setProcessingProgress(3)
    setBusy("upload")

    try {
      const sign = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, receiptId, filename: nextFile.name, mimeType: nextFile.type, byteSize: nextFile.size }),
      })
      const signed = await sign.json()
      if (!sign.ok) throw new Error(signed.error)

      const chunkSize = 2 * 1024 * 1024
      for (let offset = 0; offset < nextFile.size; offset += chunkSize) {
        const end = Math.min(offset + chunkSize, nextFile.size)
        const uploaded = await fetch(`${signed.signedUrl}&offset=${offset}`, {
          method: "PUT",
          headers: { "content-type": "application/octet-stream" },
          body: nextFile.slice(offset, end),
        })
        if (!uploaded.ok) throw new Error((await uploaded.json()).error ?? "Database upload failed")
        setProcessingProgress(Math.max(8, Math.round((end / nextFile.size) * 72)))
      }

      setBusy("validate")
      setProcessingStage("validating")
      setProcessingProgress(80)
      const complete = await fetch("/api/uploads/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attachmentId: signed.attachmentId }),
      })
      const completed = await complete.json()
      if (!complete.ok) throw new Error(completed.error)

      const baseReceipt = { ...receipt, id: signed.receiptId, archiveId: signed.archiveId, hasOriginalSource: true }
      setReceiptId(signed.receiptId)
      setAttachmentId(signed.attachmentId)
      setReceipt(baseReceipt)
      if (completed.duplicate) {
        setDuplicateMatches([{ ...completed.duplicate, reason: "Identical source file" }])
        toast.warning(`Possible duplicate: ${completed.duplicate.archiveId}`)
      }

      setBusy("extract")
      setProcessingStage("extracting")
      setProcessingProgress(88)
      const result = await requestExtraction(signed.receiptId, signed.attachmentId)
      applyAutomatic(result.extraction, baseReceipt, result.possibleDuplicates)
      if (result.cached) toast.info("Previous extraction was reused")
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Automatic processing failed"
      setProcessingStage("error")
      setProcessingError(message)
      toast.error(message)
    } finally {
      setBusy(null)
    }
  }

  async function retryExtraction(enhanced = false) {
    if (!receiptId || !attachmentId || busy) return
    setBusy(enhanced ? "enhanced" : "extract")
    setProcessingStage("extracting")
    setProcessingProgress(88)
    setProcessingError(null)
    try {
      const result = await requestExtraction(receiptId, attachmentId, enhanced)
      applyAutomatic(result.extraction, receipt, result.possibleDuplicates)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Extraction failed"
      setProcessingStage("error")
      setProcessingError(message)
      toast.error(message)
    } finally {
      setBusy(null)
    }
  }

  async function createFromDescription() {
    const description = draftDescription.trim()
    if (!projectId) {
      toast.error("Choose a project before creating a draft")
      return
    }
    if (description.length < 20) {
      toast.error("Describe the merchant, transaction, and amount in at least 20 characters")
      return
    }
    if (busy) return
    setBusy("describe")
    try {
      const response = await fetch("/api/receipts/draft-from-description", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, description }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      const nextReceipt = body.receipt as ReceiptViewModel
      const nextExtraction = body.extraction as ReceiptExtraction
      setReceipt(nextReceipt)
      setReceiptId(nextReceipt.id)
      setExtraction(nextExtraction)
      setAppliedKeys(new Set(safeSuggestionKeys(nextExtraction)))
      setDescriptionSource(description)
      setProcessingStage("idle")
      setProcessingError(null)
      setDuplicateMatches([])
      toast.success("Editable draft created. Attach transaction evidence before finalizing.")
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "The draft could not be created")
    } finally {
      setBusy(null)
    }
  }

  function addLine() {
    const sourceTotal = receipt.lines.length === 0 ? receipt.totalMinor : 0
    setReceipt((current) => ({
      ...current,
      lines: [...current.lines, { id: crypto.randomUUID(), description: "", quantity: "1", unitPriceMinor: sourceTotal, discountMinor: 0, taxMinor: 0, totalMinor: sourceTotal }],
      subtotalMinor: current.subtotalMinor || sourceTotal,
    }))
  }

  function editLine(index: number, key: string, value: string) {
    const lines = receipt.lines.map((line, lineIndex) => lineIndex === index
      ? { ...line, [key]: key === "description" || key === "quantity" ? value : majorToMinor(value || 0, receipt.currency) }
      : line)
    setReceipt((current) => ({ ...current, lines }))
  }

  async function save() {
    if (!receiptId) return false
    setBusy("save")
    try {
      const response = await fetch(`/api/receipts/${receiptId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceNumber: receipt.sourceNumber,
          documentKind: receipt.documentKind,
          expenseCategory: receipt.expenseCategory,
          templateId: receipt.templateId,
          merchantName: receipt.merchant.name,
          merchantAddress: receipt.merchant.address,
          merchantContacts: receipt.merchant.contacts,
          merchantTaxIdentifier: receipt.merchant.taxIdentifier,
          buyerName: receipt.buyer.name,
          buyerTaxIdentifier: receipt.buyer.taxIdentifier,
          issuedAt: receipt.issuedAt,
          currency: receipt.currency,
          subtotalMinor: receipt.subtotalMinor,
          discountMinor: receipt.discountMinor,
          taxMinor: receipt.taxMinor,
          feesMinor: receipt.feesMinor,
          totalMinor: receipt.totalMinor,
          paymentMethod: receipt.paymentMethod,
          paymentReference: receipt.paymentReference,
          fiscal: receipt.fiscal,
          notes: receipt.notes,
          lines: receipt.lines,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      if (body.warnings?.length) toast.warning(body.warnings.join(" "))
      else toast.success("Draft saved with a new version")
      return true
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Save failed")
      return false
    } finally {
      setBusy(null)
    }
  }

  async function finalize() {
    if (!receiptId || !await save()) return
    setBusy("finalize")
    try {
      const response = await fetch(`/api/receipts/${receiptId}/finalize`, { method: "POST" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      setReceipt((current) => ({ ...current, status: "final", finalizedAt: new Date().toISOString() }))
      toast.success("Receipt finalized and locked")
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Finalization failed")
    } finally {
      setBusy(null)
    }
  }

  const fieldsDisabled = readOnly || processing

  return (
    <div className="receipt-workbench space-y-5 pb-20">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <div>
          <p className="ledger-label text-accent">{receipt.archiveId}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{readOnly ? "Final receipt record" : receiptId ? "Review receipt draft" : "Create a receipt draft"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{receiptId ? "Review every detail, attach the transaction source, then save or finalize." : "Upload a source or describe your legitimate transaction in plain language."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {history.length > 0 && !readOnly ? <Button variant="outline" onClick={undo}><Undo2 />Undo AI fill</Button> : null}
          {receiptId && receipt.hasOriginalSource ? <><Button variant="outline" onClick={() => window.print()}><Printer />Print</Button><Link href={`/api/receipts/${receiptId}/pdf?format=thermal`} className={cn(buttonVariants({ variant: "outline" }))}><Download />Thermal PDF</Link><Link href={`/api/receipts/${receiptId}/pdf?format=a4`} className={cn(buttonVariants({ variant: "outline" }))}><Download />A4 PDF</Link></> : null}
          {receiptId && !receipt.hasOriginalSource ? <Badge variant="outline" className="border-amber-500/40 text-amber-800 dark:text-amber-300"><CircleAlert />Attach source to export</Badge> : null}
          {!readOnly && receiptId ? <Button variant="outline" onClick={save} disabled={Boolean(busy)}><Save />Save draft</Button> : null}
          {!readOnly && receiptId ? <Button onClick={finalize} disabled={Boolean(busy)}><Check />Finalize</Button> : null}
        </div>
      </div>

      <ProcessingRail stage={processingStage} progress={processingProgress} error={processingError} />
      <input ref={cameraInput} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => { const next = event.target.files?.[0]; if (next) void processFile(next) }} />
      <input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => { const next = event.target.files?.[0]; if (next) void processFile(next) }} />

      {!receiptId ? (
        <section className="app-panel no-print overflow-hidden">
          <div className="flex flex-col gap-2 border-b bg-muted/35 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Capture a receipt</p><p className="mt-0.5 text-sm text-muted-foreground">Take a photo or upload a source. Extraction starts immediately.</p></div><Badge variant="secondary"><Sparkles />AI-assisted draft</Badge></div>
          <div className="grid gap-5 p-5 lg:grid-cols-[280px_1fr]">
            <div className="rounded-lg border bg-muted/25 p-4">
              <Field><FieldLabel htmlFor="project">File this receipt under</FieldLabel><select id="project" value={projectId} onChange={(event) => setProjectId(event.target.value)} disabled={Boolean(busy)} className="h-10 w-full border bg-background px-3 text-sm"><option value="">Choose project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><FieldDescription>{selectedProject ? `The draft will be created in ${selectedProject.name}.` : "A project is required before upload."}</FieldDescription></Field>
              <div className="mt-5 border-t pt-4"><p className="text-xs font-medium text-muted-foreground">Handled automatically</p><ol className="mt-3 space-y-2 text-sm"><li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />Private source upload</li><li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />Duplicate and calculation checks</li><li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />Merchant, category, date, tax, and totals</li></ol></div>
            </div>
            <div className="grid min-h-64 content-center rounded-xl border-2 border-dashed border-border bg-background p-6 text-center transition-colors hover:border-emerald-500/70 sm:p-8" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const next = event.dataTransfer.files[0]; if (next) void processFile(next) }}>
              <span className="mx-auto grid size-14 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">{busy ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}</span>
              <p className="mt-5 text-lg font-semibold">Snap it. We’ll fill the expense.</p>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">Use the rear camera for paper receipts, or upload an image or PDF already on this device.</p>
              <div className="mx-auto mt-5 grid w-full max-w-sm gap-2 sm:grid-cols-2">
                <Button type="button" size="lg" onClick={openCamera} disabled={!projectId || Boolean(busy)}><Camera />Take photo</Button>
                <Button type="button" size="lg" variant="outline" onClick={openFilePicker} disabled={!projectId || Boolean(busy)}><FileUp />Choose file</Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">JPEG, PNG, WebP, or PDF · 10 MB max · drag and drop supported</p>
            </div>
          </div>
          <div className="grid gap-5 border-t bg-[#1f1d19] p-5 text-[#f7f1e7] lg:grid-cols-[280px_1fr]">
            <div>
              <span className="grid size-10 place-items-center rounded-lg bg-orange-400/15 text-orange-300"><MessageSquareText className="size-5" /></span>
              <p className="mt-4 text-lg font-semibold">Describe the transaction</p>
              <p className="mt-2 text-sm leading-6 text-white/60">The AI drafts only the details you provide. Official references, tax IDs, and payment proof must come from an attached source.</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/[.04] p-4">
              <label htmlFor="receipt-description" className="text-sm font-medium">What happened?</label>
              <Textarea
                id="receipt-description"
                className="mt-2 min-h-28 border-white/15 bg-black/20 text-white placeholder:text-white/35"
                value={draftDescription}
                disabled={Boolean(busy)}
                maxLength={4000}
                placeholder="Example: My business, Loop Bazaar, received KES 2,500 from Amina for website maintenance on 24 August 2026. Payment method was M-PESA."
                onChange={(event) => setDraftDescription(event.target.value)}
              />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-white/45">Creates an editable draft—not a finalized receipt.</p>
                <Button type="button" onClick={createFromDescription} disabled={!projectId || draftDescription.trim().length < 20 || Boolean(busy)}>
                  {busy === "describe" ? <Loader2 className="animate-spin" /> : <WandSparkles />}Create draft with AI
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {receiptId && extraction ? (
        <section className="app-panel no-print grid gap-px bg-border sm:grid-cols-3">
          <div className="bg-card p-4"><p className="text-xs font-medium text-muted-foreground">Draft input</p><p className="mt-1 flex items-center gap-2 text-sm font-semibold"><FileCheck2 className="size-4 text-emerald-600" />{attachmentId ? "Source secured" : "Description captured"}</p></div>
          <div className="bg-card p-4"><p className="text-xs font-medium text-muted-foreground">Filled automatically</p><p className="mt-1 text-2xl font-semibold tabular-nums">{appliedSuggestions.length}</p></div>
          <div className="bg-card p-4"><p className="text-xs font-medium text-muted-foreground">Needs your review</p><p className={cn("mt-1 text-2xl font-semibold tabular-nums", reviewSuggestions.length ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300")}>{reviewSuggestions.length}</p></div>
        </section>
      ) : null}

      {duplicateMatches.length ? (
        <Alert className="no-print border-amber-500/35 bg-amber-500/[.07]">
          <CircleAlert className="text-amber-700 dark:text-amber-300" />
          <AlertTitle>Possible duplicate expense</AlertTitle>
          <AlertDescription>Review before saving: {duplicateMatches.map((match) => `${match.archiveId} (${match.reason})`).join(", ")}.</AlertDescription>
        </Alert>
      ) : null}

      {receiptId ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(320px,.8fr)_minmax(520px,1.2fr)_minmax(340px,.85fr)]">
          <section className="app-panel no-print min-h-[520px] bg-[#17211f] p-4 text-white">
            <div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-white/45">{sourceUrl ? "Original source" : "Draft basis"}</p><p className="mt-1 text-xs text-white/60">{sourceUrl ? "Private · unchanged" : "Evidence still required"}</p></div>{sourceUrl && sourceMime !== "application/pdf" ? <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => setRotation((value) => (value + 90) % 360)}><RotateCw />Rotate</Button> : null}</div>
            <div className="grid min-h-[460px] place-items-center overflow-auto rounded-lg bg-black/20 p-3">{sourceUrl ? (sourceMime === "application/pdf" ? <iframe title="Original receipt PDF" src={sourceUrl} className="h-[600px] w-full bg-white" /> : <img src={sourceUrl} alt="Original receipt source" className="max-h-[700px] max-w-full object-contain transition-transform" style={{ transform: `rotate(${rotation}deg)` }} />) : descriptionSource ? <div className="w-full max-w-md rounded-xl border border-white/15 bg-white/[.06] p-5 text-left"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-orange-300"><MessageSquareText className="size-4" />User description</p><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-white/80">{descriptionSource}</p><div className="mt-5 border-t border-white/10 pt-4"><p className="text-xs leading-5 text-amber-200/80">This description can prepare a draft, but it is not transaction evidence.</p><Button className="mt-3" size="sm" onClick={openFilePicker} disabled={Boolean(busy)}><FileUp />Attach payment source</Button></div></div> : <div className="text-center text-white/55"><Camera className="mx-auto size-8" /><p className="mt-3 text-sm font-medium">No transaction source attached</p><p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-white/40">Attach the original receipt, payment confirmation, or invoice before finalizing.</p>{!readOnly ? <Button className="mt-4" size="sm" onClick={openFilePicker} disabled={Boolean(busy)}><FileUp />Attach source</Button> : null}</div>}</div>
          </section>

          <section className="app-panel no-print p-5">
            <div className="mb-5 flex items-center justify-between gap-4"><div><p className="ledger-label">Editable draft</p><p className="mt-1 text-sm text-muted-foreground">AI-filled values remain editable until finalization.</p></div>{processingStage === "error" && !readOnly ? <Button onClick={() => retryExtraction(false)} disabled={Boolean(busy)}>{busy === "extract" ? <Loader2 className="animate-spin" /> : <Sparkles />}Retry extraction</Button> : null}</div>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel>Paid to / merchant</FieldLabel><FieldDescription>Payment recipient, not the payment network.</FieldDescription><Input value={receipt.merchant.name} disabled={fieldsDisabled} onChange={(event) => setReceipt((current) => ({ ...current, merchant: { ...current.merchant, name: event.target.value } }))} /></Field>
                <Field><FieldLabel htmlFor="expense-category">Expense category</FieldLabel><FieldDescription>AI-suggested from visible merchant or item evidence.</FieldDescription><select id="expense-category" value={receipt.expenseCategory ?? ""} disabled={fieldsDisabled} onChange={(event) => setReceipt((current) => ({ ...current, expenseCategory: event.target.value ? event.target.value as ReceiptViewModel["expenseCategory"] : null }))} className="h-9 border bg-background px-3 text-sm"><option value="">Choose category</option>{EXPENSE_CATEGORIES.map((category) => <option key={category} value={category}>{EXPENSE_CATEGORY_LABELS[category]}</option>)}</select></Field>
                <Field><FieldLabel>Source number</FieldLabel><Input value={receipt.sourceNumber ?? ""} disabled={fieldsDisabled} onChange={(event) => setReceipt((current) => ({ ...current, sourceNumber: event.target.value || null }))} /></Field>
                <Field><FieldLabel>Date & time</FieldLabel><Input type="datetime-local" value={receipt.issuedAt ? receipt.issuedAt.slice(0, 16) : ""} disabled={fieldsDisabled} onChange={(event) => setReceipt((current) => ({ ...current, issuedAt: event.target.value ? new Date(event.target.value).toISOString() : null }))} /></Field>
                <Field><FieldLabel>Currency</FieldLabel><Input value={receipt.currency} maxLength={3} disabled={fieldsDisabled} onChange={(event) => setReceipt((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} /></Field>
                <Field><FieldLabel>Payment method</FieldLabel><Input value={receipt.paymentMethod ?? ""} disabled={fieldsDisabled} onChange={(event) => setReceipt((current) => ({ ...current, paymentMethod: event.target.value || null }))} /></Field>
                <Field><FieldLabel>Payment reference</FieldLabel><Input value={receipt.paymentReference ?? ""} disabled={fieldsDisabled} onChange={(event) => setReceipt((current) => ({ ...current, paymentReference: event.target.value || null }))} /></Field>
              </div>

              <details className="rounded-lg border bg-muted/20 p-4"><summary className="cursor-pointer text-sm font-medium">Merchant, customer, and tax details</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel>Merchant address</FieldLabel><Input value={receipt.merchant.address ?? ""} disabled={fieldsDisabled} onChange={(event) => setReceipt((current) => ({ ...current, merchant: { ...current.merchant, address: event.target.value || null } }))} /></Field>
                <Field><FieldLabel>Merchant contact</FieldLabel><Input value={receipt.merchant.contacts ?? ""} disabled={fieldsDisabled} onChange={(event) => setReceipt((current) => ({ ...current, merchant: { ...current.merchant, contacts: event.target.value || null } }))} /></Field>
                <Field><FieldLabel>Merchant tax ID</FieldLabel><Input value={receipt.merchant.taxIdentifier ?? ""} disabled={fieldsDisabled} onChange={(event) => setReceipt((current) => ({ ...current, merchant: { ...current.merchant, taxIdentifier: event.target.value || null } }))} /></Field>
                <Field><FieldLabel>Customer name</FieldLabel><Input value={receipt.buyer.name ?? ""} disabled={fieldsDisabled} onChange={(event) => setReceipt((current) => ({ ...current, buyer: { ...current.buyer, name: event.target.value || null } }))} /></Field>
                <Field><FieldLabel>Customer tax ID</FieldLabel><Input value={receipt.buyer.taxIdentifier ?? ""} disabled={fieldsDisabled} onChange={(event) => setReceipt((current) => ({ ...current, buyer: { ...current.buyer, taxIdentifier: event.target.value || null } }))} /></Field>
                <Field><FieldLabel>Seller PIN</FieldLabel><Input value={receipt.fiscal.sellerPin ?? ""} disabled={fieldsDisabled} onChange={(event) => setReceipt((current) => ({ ...current, fiscal: { ...current.fiscal, sellerPin: event.target.value || null } }))} /></Field>
                <Field><FieldLabel>ETR / SCU identifier</FieldLabel><Input value={receipt.fiscal.etrScuIdentifier ?? ""} disabled={fieldsDisabled} onChange={(event) => setReceipt((current) => ({ ...current, fiscal: { ...current.fiscal, etrScuIdentifier: event.target.value || null } }))} /></Field>
              </div></details>

              <div className="border-t pt-4"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium">Service or line items</p>{!readOnly ? <Button size="sm" variant="outline" onClick={addLine}><Plus />Add service/item</Button> : null}</div><div className="space-y-3">
                {receipt.lines.length === 0 && !readOnly ? <div className="rounded-lg border border-dashed bg-muted/30 p-4"><p className="text-sm font-medium">No service description was visible in the source.</p><p className="mt-1 text-xs text-muted-foreground">Add what the payment was for before saving the receipt.</p><Button className="mt-3" size="sm" variant="outline" onClick={addLine}><Plus />Add service description</Button></div> : null}
                {receipt.lines.map((line, index) => <div key={line.id} className="grid gap-2 rounded-lg border bg-muted/15 p-3 sm:grid-cols-[1fr_76px_110px_36px] sm:border-0 sm:bg-transparent sm:p-0"><Input aria-label="Service or item description" placeholder="Service paid for" value={line.description} disabled={fieldsDisabled} onChange={(event) => editLine(index, "description", event.target.value)} /><Input aria-label="Quantity" value={line.quantity} disabled={fieldsDisabled} onChange={(event) => editLine(index, "quantity", event.target.value)} /><Input aria-label="Line total" type="number" step="0.01" value={minorToMajor(line.totalMinor, receipt.currency)} disabled={fieldsDisabled} onChange={(event) => editLine(index, "totalMinor", event.target.value)} />{!readOnly ? <Button size="icon" variant="ghost" aria-label="Remove line" onClick={() => setReceipt((current) => ({ ...current, lines: current.lines.filter((_, lineIndex) => lineIndex !== index) }))}><Trash2 /></Button> : null}</div>)}
              </div></div>

              <div className="grid gap-4 border-t pt-4 sm:grid-cols-3">{(["subtotalMinor", "taxMinor", "totalMinor"] as const).map((key) => <Field key={key}><FieldLabel>{key === "subtotalMinor" ? "Subtotal" : key === "taxMinor" ? "Tax" : "Grand total"}</FieldLabel><Input type="number" step="0.01" value={minorToMajor(receipt[key], receipt.currency)} disabled={fieldsDisabled} onChange={(event) => setReceipt((current) => ({ ...current, [key]: majorToMinor(event.target.value || 0, current.currency) }))} /></Field>)}</div>
              <Field><FieldLabel>Notes</FieldLabel><Textarea value={receipt.notes ?? ""} disabled={fieldsDisabled} onChange={(event) => setReceipt((current) => ({ ...current, notes: event.target.value || null }))} /></Field>
              <Field><FieldLabel>Paper preset</FieldLabel><select value={receipt.templateId} disabled={fieldsDisabled} onChange={(event) => setReceipt((current) => ({ ...current, templateId: event.target.value as ReceiptViewModel["templateId"] }))} className="h-9 border bg-background px-3 text-sm">{RECEIPT_TEMPLATE_IDS.map((id) => <option key={id} value={id}>{TEMPLATE_LABELS[id]}</option>)}</select><FieldDescription>Template changes never alter reviewed data.</FieldDescription></Field>
            </FieldGroup>
          </section>

          <aside className="no-print space-y-4">
            {extraction ? <section className="app-panel"><div className="flex items-start justify-between gap-3 border-b p-4"><div><p className="flex items-center gap-2 font-semibold"><Tags className="size-4 text-emerald-600" />Review queue</p><p className="mt-0.5 text-xs text-muted-foreground">Only uncertain extracted values need attention.</p></div><Badge variant={reviewSuggestions.length ? "outline" : "secondary"}>{reviewSuggestions.length ? `${reviewSuggestions.length} to check` : "All clear"}</Badge></div>
              {extraction.calculationWarnings.length ? <Alert className="m-3 w-auto"><AlertTriangle /><AlertTitle>Calculation check</AlertTitle><AlertDescription>{extraction.calculationWarnings.join(" ")}</AlertDescription></Alert> : null}
              {reviewSuggestions.length ? <div className="max-h-[430px] divide-y overflow-y-auto">{reviewSuggestions.map(({ key, suggestion }) => <SuggestionRow key={key} keyName={key} suggestion={suggestion} extraction={extraction} receipt={receipt} applied={false} />)}</div> : <div className="p-5 text-center"><CheckCircle2 className="mx-auto size-7 text-emerald-600" /><p className="mt-2 text-sm font-medium">No uncertain fields</p><p className="mt-1 text-xs text-muted-foreground">Still compare the draft with the source before finalizing.</p></div>}
              {appliedSuggestions.length ? <details className="border-t"><summary className="cursor-pointer px-4 py-3 text-xs font-medium text-muted-foreground">View {appliedSuggestions.length} auto-filled fields and evidence</summary><div className="max-h-[340px] divide-y overflow-y-auto border-t">{appliedSuggestions.map(({ key, suggestion }) => <SuggestionRow key={key} keyName={key} suggestion={suggestion} extraction={extraction} receipt={receipt} applied />)}</div></details> : null}
              {!readOnly ? <div className="grid gap-2 border-t p-4"><Button variant="outline" onClick={() => retryExtraction(true)} disabled={Boolean(busy)}>{busy === "enhanced" ? <Loader2 className="animate-spin" /> : <Sparkles />}Run enhanced retry</Button><p className="text-center text-[10px] text-muted-foreground">Retry replaces only safe draft fields. It never saves or finalizes.</p></div> : null}
            </section> : null}
            <div className="app-panel sticky top-20 overflow-auto bg-muted/45 p-4"><p className="ledger-label mb-4">Paper preview</p><ReceiptPreview receipt={receipt} /></div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
