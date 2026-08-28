"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Menu } from "@base-ui/react/menu"
import { Toast } from "@base-ui/react/toast"
import { ChevronLeft, Ellipsis, LoaderCircle, Pencil, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, useTransition } from "react"

import {
  changeEnrollmentClassification,
  changeEnrollmentFinancialPlan,
  changeEnrollmentGroup,
  changeEnrollmentGrade,
  correctEnrollmentAcademicDates,
  finalizeSelectedEnrollments,
  getEnrollmentFeeCoverage,
  graduateEnrollment,
  reactivateEnrollmentFinancial,
  regularizeEnrollmentFinancialStart,
  setEnrollmentTuitionDiscount,
  withdrawEnrollment,
} from "@/app/admin/matricula/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  getEnrollmentGroupLabel,
  formatEnrollmentStatus,
  type EnrollmentFinancialCoverage,
  type EnrollmentListItem,
  type FinancialPlanOption,
} from "@/lib/admin/enrollments"
import type { TuitionDiscountCategory } from "@/lib/admin/discount-categories"
import { calculateTuitionDiscountPreview, formatCurrency, formatTuitionDiscountValue, tuitionDiscountTypeLabel } from "@/lib/admin/tuition-discount-preview"

type GroupOption = { id: string; name: string; code: string; cycle_id: string; grade_level_id: string }
type ClassificationOption = { id: string; name: string }
type GradeOption = { id: string; name: string; education_level_id: string }
type EducationLevelOption = { id: string; name: string }
type ActionMode = "editor" | "plan" | "group" | "classification" | "grade" | "dates" | "discount" | "withdrawal" | "reactivation" | "regularization" | "finalization" | "graduation"

type EnrollmentActionsProps = {
  enrollment: EnrollmentListItem
  groups: GroupOption[]
  classifications: ClassificationOption[]
  grades?: GradeOption[]
  educationLevels?: EducationLevelOption[]
  tenPaymentPlans: FinancialPlanOption[]
  financialCoverage: EnrollmentFinancialCoverage[]
  discountCategories: TuitionDiscountCategory[]
  section?: "menu" | "school" | "financial"
  schoolAction?: "editor" | "quick"
  canGraduate?: boolean
}

export function EnrollmentActions({
  enrollment,
  groups,
  classifications,
  grades = [],
  educationLevels = [],
  tenPaymentPlans,
  financialCoverage,
  discountCategories,
  section = "menu",
  schoolAction = "editor",
  canGraduate = false,
}: EnrollmentActionsProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<ActionMode | null>(null)
  const [fromEditor, setFromEditor] = useState(false)
  const [step, setStep] = useState<"form" | "review">("form")
  const [targetId, setTargetId] = useState("")
  const [gradeLevelId, setGradeLevelId] = useState(enrollment.gradeLevel.id)
  const [gradeGroupId, setGradeGroupId] = useState(enrollment.group?.id ?? "")
  const [enrolledOn, setEnrolledOn] = useState(enrollment.enrolledOn)
  const [classesStartOn, setClassesStartOn] = useState(enrollment.classesStartOn ?? "")
  const [dateFocus, setDateFocus] = useState<"enrolledOn" | "classesStartOn">("enrolledOn")
  const [effectiveOn, setEffectiveOn] = useState(dateInput(new Date()))
  const [currentPeriodAction, setCurrentPeriodAction] = useState<"KEEP_FULL" | "PROPORTIONAL" | "AGREED" | "WAIVE">("KEEP_FULL")
  const [currentPeriodAmount, setCurrentPeriodAmount] = useState("")
  const [futureMode, setFutureMode] = useState<"STOP_FUTURE" | "KEEP_REMAINING">("STOP_FUTURE")
  const [economicStartOn, setEconomicStartOn] = useState(dateInput(new Date()))
  const [regularizationAmount, setRegularizationAmount] = useState("")
  const [regularizationDueDate, setRegularizationDueDate] = useState("")
  const [initialTuitionMode, setInitialTuitionMode] = useState<"FULL" | "PROPORTIONAL">("FULL")
  const [initialTuitionAmount, setInitialTuitionAmount] = useState("")
  const [enrollmentFeeCoverage, setEnrollmentFeeCoverage] = useState<"loading" | "covered" | "uncovered" | "error" | null>(null)
  const [enrollmentFeeMode, setEnrollmentFeeMode] = useState<"FULL" | "PROPORTIONAL">("FULL")
  const [enrollmentFeeAmount, setEnrollmentFeeAmount] = useState("")
  const [discountCategoryId, setDiscountCategoryId] = useState("")
  const [discountEffectMode, setDiscountEffectMode] = useState<"CURRENT" | "NEXT" | "PROPORTIONAL">("CURRENT")
  const [discountCurrentPeriodAmount, setDiscountCurrentPeriodAmount] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const toastManager = Toast.useToastManager()

  const compatiblePlans = tenPaymentPlans.filter(
    (plan) =>
      plan.cycleId === enrollment.cycleId &&
      plan.educationLevelId === enrollment.educationLevel.id
  )
  const compatibleGroups = groups.filter(
    (group) =>
      group.cycle_id === enrollment.cycleId &&
      group.grade_level_id === enrollment.gradeLevel.id &&
      group.id !== enrollment.group?.id
  )
  const availableClassifications = classifications.filter(
    (classification) => classification.id !== enrollment.classification.id
  )
  const reactivationGroups = groups.filter(
    (group) =>
      group.cycle_id === enrollment.cycleId &&
      group.grade_level_id === enrollment.gradeLevel.id
  )
  const reactivationCoverage = financialCoverage.find(
    (coverage) =>
      coverage.cycleId === enrollment.cycleId &&
      coverage.educationLevelId === enrollment.educationLevel.id
  )
  const regularizationCoverage = reactivationCoverage
  const regularizationPeriod = regularizationCoverage?.months.find((period) => {
    const [year, month] = economicStartOn.split("-").map(Number)
    return period.year === year && period.month === month
  }) ?? null
  const firstRegularizationPeriod = regularizationCoverage?.months.reduce((earliest, period) =>
    period.year * 12 + period.month < earliest.year * 12 + earliest.month ? period : earliest
  , regularizationCoverage.months[0] ?? null) ?? null
  const firstRegularizationPeriodStart = firstRegularizationPeriod
    ? `${firstRegularizationPeriod.year}-${String(firstRegularizationPeriod.month).padStart(2, "0")}-01`
    : null
  const regularizationBeforeFirstPeriod = Boolean(firstRegularizationPeriodStart && economicStartOn < firstRegularizationPeriodStart)
  const regularizationIsPartial = isPartialCoverageMonth(economicStartOn, regularizationCoverage?.months ?? [])
  const regularizationNeedsAmount = regularizationBeforeFirstPeriod || regularizationIsPartial
  const currentIndividualAmount = enrollment.currentTuition?.agreedAmount ?? null
  const regularizationSuggestedAmount = (() => {
    if (!regularizationNeedsAmount || currentIndividualAmount === null || !isDate(economicStartOn)) return ""
    const [year, month, day] = economicStartOn.split("-").map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const applicableDays = daysInMonth - day + 1
    return (Math.round(currentIndividualAmount * applicableDays / daysInMonth * 100) / 100).toFixed(2)
  })()
  const reactivationIsPartial = isPartialCoverageMonth(economicStartOn, reactivationCoverage?.months ?? [])
  const reactivationTuitionAgreement = enrollment.tuitionAgreements.find(
    (agreement) =>
      agreement.validFrom <= effectiveOn &&
      (!agreement.validUntil || agreement.validUntil >= effectiveOn)
  ) ?? null
  const selectedDiscountCategory = discountCategories.find((category) => category.id === discountCategoryId) ?? null
  const selectedDiscountVersion = selectedDiscountCategory
    ? selectedDiscountCategory.versions
        .filter((version) => version.validFrom <= effectiveOn && (!version.validUntil || version.validUntil >= effectiveOn))
        .sort((left, right) => right.validFrom.localeCompare(left.validFrom))[0] ?? null
    : null
  const discountPreview = selectedDiscountVersion && enrollment.currentTuition
    ? calculateTuitionDiscountPreview(enrollment.currentTuition.baseAmount, selectedDiscountCategory?.discountType ?? "FIXED_AMOUNT", selectedDiscountVersion.value)
    : null

  useEffect(() => {
    if (mode !== "regularization") return
    const update = window.setTimeout(() => {
      if (regularizationSuggestedAmount) setRegularizationAmount(regularizationSuggestedAmount)
      else setRegularizationAmount("")
      setRegularizationDueDate(regularizationBeforeFirstPeriod ? "" : regularizationPeriod?.dueDate ?? "")
    }, 0)
    return () => window.clearTimeout(update)
  }, [mode, regularizationBeforeFirstPeriod, regularizationPeriod, regularizationSuggestedAmount])

  const selectedTarget = useMemo(() => {
    if (mode === "editor" || mode === "withdrawal" || mode === "reactivation" || mode === "discount" || mode === "finalization" || mode === "graduation" || mode === "grade" || mode === "dates") return null
    if (mode === "plan") return compatiblePlans.find((plan) => plan.id === targetId) ?? null
    if (mode === "group") return compatibleGroups.find((group) => group.id === targetId) ?? null
    return availableClassifications.find((classification) => classification.id === targetId) ?? null
  }, [availableClassifications, compatibleGroups, compatiblePlans, mode, targetId])

  const canChange = !["FINALIZADA", "NO_CONTINUA", "EGRESADA"].includes(enrollment.status)
  const canEditSchool = !["NO_CONTINUA", "EGRESADA"].includes(enrollment.status) && (enrollment.status !== "FINALIZADA" || canGraduate)
  const planAvailable = enrollment.currentPlan?.installmentCount === 12 && compatiblePlans.length > 0

  async function openAction(nextMode: Exclude<ActionMode, "editor">, keepEditor = false, nextDateFocus?: "enrolledOn" | "classesStartOn") {
    setMode(nextMode)
    setFromEditor(keepEditor)
    setOpen(true)
    setStep("form")
    setTargetId("")
    setGradeLevelId(enrollment.gradeLevel.id)
    setGradeGroupId(enrollment.group?.id ?? "")
    setEnrolledOn(enrollment.enrolledOn)
    setClassesStartOn(enrollment.classesStartOn ?? "")
    if (nextMode === "dates") setDateFocus(nextDateFocus ?? "enrolledOn")
    setEffectiveOn(nextMode === "finalization" || nextMode === "graduation" ? enrollment.cycle.endsOn : dateInput(new Date()))
    setCurrentPeriodAction("KEEP_FULL")
    setCurrentPeriodAmount("")
    setFutureMode("STOP_FUTURE")
    setEconomicStartOn(nextMode === "regularization" ? enrollment.economicStartOn : dateInput(new Date()))
    setRegularizationAmount("")
    setRegularizationDueDate("")
    setInitialTuitionMode("FULL")
    setInitialTuitionAmount("")
    setEnrollmentFeeCoverage(nextMode === "reactivation" ? "loading" : null)
    setEnrollmentFeeMode("FULL")
    setEnrollmentFeeAmount("")
    setDiscountCategoryId("")
    setDiscountEffectMode("CURRENT")
    setDiscountCurrentPeriodAmount("")
    setReason("")
    setError(null)

    if (nextMode === "reactivation") {
      const result = await getEnrollmentFeeCoverage({
        studentId: enrollment.student.id,
        cycleId: enrollment.cycleId,
      })
      if (!result.ok) {
        setEnrollmentFeeCoverage("error")
        setError(result.message)
        return
      }
      setEnrollmentFeeCoverage(result.covered ? "covered" : "uncovered")
    }
  }

  function openEditor() {
    setMode("editor")
    setFromEditor(false)
    setOpen(true)
    setStep("form")
    setError(null)
  }

  function close() {
    if (isPending) return
    setOpen(false)
    setMode(null)
    setStep("form")
    setError(null)
  }

  function review() {
    if (!mode) return
    if (mode === "graduation") {
      if (!["ACTIVA", "FINALIZADA"].includes(enrollment.status) || !canGraduate) {
        setError("Esta matrícula no está disponible para egreso.")
        return
      }
      if (!isDate(effectiveOn) || effectiveOn < enrollment.cycle.startsOn || effectiveOn > enrollment.cycle.endsOn) {
        setError(`La fecha de egreso debe estar entre ${formatDate(enrollment.cycle.startsOn)} y ${formatDate(enrollment.cycle.endsOn)}.`)
        return
      }
      setError(null)
      setStep("review")
      return
    }
    if (mode === "editor") return
    if (mode === "finalization") {
      if (enrollment.status !== "ACTIVA") {
        setError("Solo se puede finalizar una matrícula activa.")
        return
      }
      if (!isDate(effectiveOn) || effectiveOn < enrollment.cycle.startsOn || effectiveOn > enrollment.cycle.endsOn) {
        setError(`La fecha de finalización debe estar entre ${formatDate(enrollment.cycle.startsOn)} y ${formatDate(enrollment.cycle.endsOn)}.`)
        return
      }
      setError(null)
      setStep("review")
      return
    }
    if (mode === "grade") {
      if (!gradeLevelId) {
        setError("Selecciona un grado.")
        return
      }
      if (!isDate(effectiveOn)) {
        setError("Captura una fecha efectiva válida.")
        return
      }
      if (gradeLevelId === enrollment.gradeLevel.id && gradeGroupId === (enrollment.group?.id ?? "")) {
        setError("No hay cambios que guardar.")
        return
      }
      if (!reason.trim()) {
        setError("Indica el motivo de la corrección de grado.")
        return
      }
      setError(null)
      setStep("review")
      return
    }
    if (mode === "dates") {
      if (!isDate(enrolledOn) || (classesStartOn !== "" && !isDate(classesStartOn))) {
        setError("Captura fechas académicas válidas.")
        return
      }
      if (!isDate(effectiveOn)) {
        setError("Captura una fecha efectiva válida.")
        return
      }
      if (enrolledOn === enrollment.enrolledOn && (classesStartOn || null) === enrollment.classesStartOn) {
        setError("No hay cambios que guardar.")
        return
      }
      if (!reason.trim()) {
        setError("Indica el motivo de la corrección de fechas.")
        return
      }
      setError(null)
      setStep("review")
      return
    }
    if (mode === "regularization") {
      const firstAllowedDate = enrollment.enrolledOn > enrollment.cycle.startsOn ? enrollment.enrolledOn : enrollment.cycle.startsOn
      if (enrollment.status !== "ACTIVA") {
        setError("Solo se puede regularizar una matrícula activa.")
        return
      }
      if (!isDate(economicStartOn) || economicStartOn < firstAllowedDate || economicStartOn > enrollment.cycle.endsOn) {
        setError(`La nueva fecha debe estar entre ${formatDate(firstAllowedDate)} y ${formatDate(enrollment.cycle.endsOn)}.`)
        return
      }
      if (economicStartOn === enrollment.economicStartOn) {
        setError("La nueva fecha debe ser diferente al inicio económico actual.")
        return
      }
      if (regularizationNeedsAmount && (!regularizationAmount.trim() || !Number.isFinite(Number(regularizationAmount)) || Number(regularizationAmount) < 0)) {
        setError("Captura un importe válido para el periodo inicial.")
        return
      }
      if (regularizationBeforeFirstPeriod && !regularizationDueDate.trim()) {
        setError("Define cuándo este cargo se considerará vencido.")
        return
      }
      if (!reason.trim()) {
        setError("Indica el motivo de la regularización.")
        return
      }
      setError(null)
      setStep("review")
      return
    }
    if (mode === "reactivation") {
      const firstAllowedDate = enrollment.closedOn && enrollment.closedOn > enrollment.cycle.startsOn
        ? enrollment.closedOn
        : enrollment.cycle.startsOn
      if (!isDate(effectiveOn) || effectiveOn < firstAllowedDate || effectiveOn > enrollment.cycle.endsOn) {
        setError(`La fecha de reingreso debe estar entre ${formatDate(firstAllowedDate)} y ${formatDate(enrollment.cycle.endsOn)}.`)
        return
      }
      if (!isDate(economicStartOn) || economicStartOn < effectiveOn || economicStartOn > enrollment.cycle.endsOn) {
        setError("El inicio económico debe ser igual o posterior al reingreso y estar dentro del ciclo.")
        return
      }
      if (!targetId) {
        setError("Selecciona un grupo para el reingreso.")
        return
      }
      if (reactivationIsPartial) {
        const amount = initialTuitionMode === "FULL" ? reactivationTuitionAgreement?.agreedAmount ?? Number.NaN : Number(initialTuitionAmount)
        if (!Number.isFinite(amount) || amount < 0) {
          setError(initialTuitionMode === "FULL" ? "No encontramos la colegiatura vigente para el primer periodo." : "Captura un monto válido para el primer periodo.")
          return
        }
      }
      if (enrollmentFeeCoverage === "loading" || enrollmentFeeCoverage === "error") {
        setError("Espera a que confirmemos el estado de la inscripción antes de continuar.")
        return
      }
      if (enrollmentFeeCoverage === "uncovered" && enrollmentFeeMode === "PROPORTIONAL" && (!enrollmentFeeAmount || !Number.isFinite(Number(enrollmentFeeAmount)) || Number(enrollmentFeeAmount) < 0)) {
        setError("Captura un monto válido para la inscripción proporcional.")
        return
      }
      if (!reason.trim()) {
        setError("Indica el motivo de la reactivación.")
        return
      }
      setError(null)
      setStep("review")
      return
    }
    if (mode === "discount") {
      if (!enrollment.currentTuition) {
        setError("No encontramos una colegiatura vigente para esta matrícula.")
        return
      }
      if (!discountCategoryId || !selectedDiscountCategory) {
        setError("Selecciona una categoría de descuento.")
        return
      }
      if (!selectedDiscountVersion) {
        setError("La categoría seleccionada no tiene un valor configurado para esa fecha efectiva.")
        return
      }
      if (!isDate(effectiveOn) || effectiveOn < enrollment.currentTuition.validFrom || effectiveOn < enrollment.cycle.startsOn || effectiveOn > enrollment.cycle.endsOn) {
        setError("La fecha efectiva debe estar dentro del ciclo y no puede ser anterior al acuerdo de colegiatura vigente.")
        return
      }
      if (discountEffectMode === "PROPORTIONAL" && (!discountCurrentPeriodAmount || !Number.isFinite(Number(discountCurrentPeriodAmount)) || Number(discountCurrentPeriodAmount) < 0)) {
        setError("Captura un monto final válido para el periodo actual.")
        return
      }
      if (!reason.trim()) {
        setError("Indica el motivo del descuento.")
        return
      }
      setError(null)
      setStep("review")
      return
    }
    if (mode !== "withdrawal" && !selectedTarget) {
      setError(`Selecciona ${mode === "plan" ? "un plan" : mode === "group" ? "un grupo" : "una clasificación"}.`)
      return
    }
    if (!isDate(effectiveOn)) {
      setError("Captura una fecha efectiva válida.")
      return
    }
    if (mode === "withdrawal") {
      const firstAllowedDate = enrollment.enrolledOn > enrollment.cycle.startsOn
        ? enrollment.enrolledOn
        : enrollment.cycle.startsOn
      if (effectiveOn < firstAllowedDate || effectiveOn > enrollment.cycle.endsOn) {
        setError(`La fecha de baja debe estar entre ${formatDate(firstAllowedDate)} y ${formatDate(enrollment.cycle.endsOn)}.`)
        return
      }
      const requiresAmount = currentPeriodAction === "PROPORTIONAL" || currentPeriodAction === "AGREED"
      if (requiresAmount && (!currentPeriodAmount || !Number.isFinite(Number(currentPeriodAmount)) || Number(currentPeriodAmount) < 0)) {
        setError("Captura un monto final válido para el periodo actual.")
        return
      }
    }
    if (!reason.trim()) {
      setError(mode === "withdrawal" ? "Indica el motivo de la baja." : "Indica el motivo del cambio.")
      return
    }
    setError(null)
    setStep("review")
  }

  function submit() {
    if (!mode) return

    if (mode === "graduation") {
      startTransition(async () => {
        const result = await graduateEnrollment({ enrollmentId: enrollment.id, effectiveOn })
        if (!result.ok) {
          setError(result.message)
          setStep("form")
          return
        }
        toastManager.add({ title: "Egreso registrado", description: "La matrícula se marcó como egresada." })
        close()
        router.refresh()
      })
      return
    }
    if (mode === "editor") return

    if (mode === "finalization") {
      startTransition(async () => {
        const result = await finalizeSelectedEnrollments({
          enrollmentIds: [enrollment.id],
          effectiveOn,
        })

        if (!result.ok) {
          setError(result.message)
          setStep("form")
          return
        }

        toastManager.add({ title: "Matrícula finalizada", description: "La matrícula ahora está finalizada." })
        close()
        router.refresh()
      })
      return
    }

    if (mode === "grade") {
      startTransition(async () => {
        const result = await changeEnrollmentGrade({
          enrollmentId: enrollment.id,
          gradeLevelId,
          groupId: gradeGroupId || null,
          effectiveOn,
          reason,
        })
        if (!result.ok) {
          setError(result.message)
          setStep("form")
          return
        }
        toastManager.add({ title: "Grado corregido", description: "Los datos escolares fueron actualizados." })
        close()
        router.refresh()
      })
      return
    }

    if (mode === "dates") {
      startTransition(async () => {
        const result = await correctEnrollmentAcademicDates({
          enrollmentId: enrollment.id,
          enrolledOn,
          classesStartOn: classesStartOn || null,
          effectiveOn,
          reason,
        })
        if (!result.ok) {
          setError(result.message)
          setStep("form")
          return
        }
        toastManager.add({ title: "Fechas corregidas", description: "Las fechas académicas fueron actualizadas." })
        close()
        router.refresh()
      })
      return
    }

    if (mode === "regularization") {
      startTransition(async () => {
        const result = await regularizeEnrollmentFinancialStart({
          enrollmentId: enrollment.id,
          studentId: enrollment.student.id,
          economicStartOn,
          initialPeriodAmount: regularizationNeedsAmount ? regularizationAmount : null,
          initialPeriodDueDate: regularizationBeforeFirstPeriod ? regularizationDueDate : regularizationPeriod?.dueDate ?? null,
          reason,
        })

        if (!result.ok) {
          setError(result.message)
          setStep("form")
          return
        }

        toastManager.add({ title: "Inicio financiero regularizado", description: "La matrícula se actualizó correctamente." })
        close()
        router.refresh()
      })
      return
    }

    if (mode === "reactivation") {
      if (!targetId) return
      const tuitionAmount = reactivationIsPartial
        ? initialTuitionMode === "FULL"
          ? reactivationTuitionAgreement?.agreedAmount.toString() ?? null
          : initialTuitionAmount
        : null

      startTransition(async () => {
        const result = await reactivateEnrollmentFinancial({
          enrollmentId: enrollment.id,
          reactivatedOn: effectiveOn,
          groupId: targetId,
          economicStartOn,
          initialTuitionAmount: tuitionAmount,
          enrollmentFeeMode: enrollmentFeeCoverage === "uncovered" ? enrollmentFeeMode : null,
          enrollmentFeeAmount: enrollmentFeeCoverage === "uncovered" ? enrollmentFeeAmount : null,
          reason,
        })

        if (!result.ok) {
          setError(result.message)
          setStep("form")
          return
        }

        toastManager.add({ title: "Matrícula reactivada", description: "La matrícula ya está activa." })
        close()
        router.refresh()
      })
      return
    }

    if (mode === "discount") {
      if (!selectedDiscountCategory) return
      startTransition(async () => {
        const result = await setEnrollmentTuitionDiscount({
          enrollmentId: enrollment.id,
          studentId: enrollment.student.id,
          categoryId: selectedDiscountCategory.id,
          effectiveOn,
          effectMode: discountEffectMode,
          currentPeriodAmount: discountEffectMode === "PROPORTIONAL" ? discountCurrentPeriodAmount : null,
          reason,
        })

        if (!result.ok) {
          setError(result.message)
          setStep("form")
          return
        }

        toastManager.add({ title: "Descuento actualizado", description: "La colegiatura se actualizó según la configuración seleccionada." })
        close()
        router.refresh()
      })
      return
    }

    if (mode === "withdrawal") {
      startTransition(async () => {
        const result = await withdrawEnrollment({
          enrollmentId: enrollment.id,
          withdrawnOn: effectiveOn,
          mode: futureMode,
          currentPeriodAction,
          currentPeriodAmount: currentPeriodAmount || null,
          reason,
        })

        if (!result.ok) {
          setError(result.message)
          setStep("form")
          return
        }

        toastManager.add({ title: "Baja registrada", description: "La matrícula se actualizó a baja." })
        close()
        router.refresh()
      })
      return
    }

    if (!selectedTarget) return
    const selectedTargetId = selectedTarget.id
    const action = mode

    startTransition(async () => {
      const result = action === "plan"
        ? await changeEnrollmentFinancialPlan({
            enrollmentId: enrollment.id,
            targetFinancialPlanId: selectedTargetId,
            effectiveOn,
            reason,
          })
        : action === "group"
          ? await changeEnrollmentGroup({
              enrollmentId: enrollment.id,
              groupId: selectedTargetId,
              effectiveOn,
              reason,
            })
          : await changeEnrollmentClassification({
              enrollmentId: enrollment.id,
              classificationId: selectedTargetId,
              effectiveOn,
              reason,
            })

      if (!result.ok) {
        setError(result.message)
        setStep("form")
        return
      }

      toastManager.add({
        title: "Cambio guardado",
        description: `${actionLabel(action)} actualizado correctamente.`,
      })
      close()
      router.refresh()
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => nextOpen ? setOpen(true) : close()}>
      {section === "menu" ? <Menu.Root>
        <Menu.Trigger
          aria-label={`Acciones de matrícula de ${enrollment.student.fullName}`}
          disabled={!canChange}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:invisible"
        >
          <Ellipsis className="size-4" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" sideOffset={6}>
            <Menu.Popup className="z-50 min-w-52 rounded-xl border border-border bg-white p-1 shadow-lg outline-none">
              {enrollment.status !== "BAJA" && <><Menu.Item onClick={() => void openAction("plan")} disabled={!planAvailable} className="flex h-9 items-center rounded-lg px-2 text-sm outline-none hover:bg-muted data-disabled:pointer-events-none data-disabled:opacity-50">
                Cambiar plan
              </Menu.Item>
              <Menu.Item onClick={() => void openAction("group")} disabled={!compatibleGroups.length} className="flex h-9 items-center rounded-lg px-2 text-sm outline-none hover:bg-muted data-disabled:pointer-events-none data-disabled:opacity-50">
                Cambiar grupo
              </Menu.Item>
              <Menu.Item onClick={() => void openAction("classification")} disabled={!availableClassifications.length} className="flex h-9 items-center rounded-lg px-2 text-sm outline-none hover:bg-muted data-disabled:pointer-events-none data-disabled:opacity-50">
                Cambiar clasificación
              </Menu.Item></>}
              {enrollment.status === "ACTIVA" && <Menu.Item onClick={() => openAction("discount")} disabled={!enrollment.currentTuition || !discountCategories.length} className="flex h-9 items-center rounded-lg px-2 text-sm outline-none hover:bg-muted data-disabled:pointer-events-none data-disabled:opacity-50">Asignar descuento</Menu.Item>}
              {enrollment.status === "ACTIVA" && <Menu.Item onClick={() => openAction("regularization")} className="flex h-9 items-center rounded-lg px-2 text-sm outline-none hover:bg-muted">Regularizar inicio financiero</Menu.Item>}
              {enrollment.status === "ACTIVA" && <><Menu.Separator className="my-1 h-px bg-border" /><Menu.Item onClick={() => openAction("finalization")} className="flex h-9 items-center rounded-lg px-2 text-sm outline-none hover:bg-muted">Finalizar matrícula</Menu.Item><Menu.Item onClick={() => openAction("withdrawal")} className="flex h-9 items-center rounded-lg px-2 text-sm text-destructive outline-none hover:bg-destructive/10">Dar de baja</Menu.Item></>}
              {enrollment.status === "BAJA" && <Menu.Item onClick={() => void openAction("reactivation")} className="flex h-9 items-center rounded-lg px-2 text-sm outline-none hover:bg-muted">Reactivar</Menu.Item>}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root> : <EnrollmentActionPanel
        section={section}
        enrollment={enrollment}
        canChange={canChange}
        canEditSchool={canEditSchool}
        planAvailable={planAvailable}
        canAssignDiscount={Boolean(enrollment.currentTuition && discountCategories.length)}
        schoolAction={schoolAction}
        onOpenEditor={openEditor}
        onOpenAction={openAction}
      />}

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2">
          <header className="flex min-h-14 items-center justify-between border-b border-border px-4 sm:px-6">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold">{mode ? actionLabel(mode) : "Acción"}</Dialog.Title>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{enrollment.student.fullName}</p>
            </div>
            <Dialog.Close aria-label="Cerrar acción" className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <X className="size-4" />
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            {step === "form" && mode === "editor" && <EnrollmentEditorForm enrollment={enrollment} groups={compatibleGroups} classifications={availableClassifications} grades={grades} educationLevels={educationLevels} canGraduate={canGraduate} onSelect={(nextMode, nextDateFocus) => void openAction(nextMode, true, nextDateFocus)} onSelectState={(nextMode) => void openAction(nextMode, true)} />}
            {step === "form" && mode === "grade" && <GradeCorrectionForm enrollment={enrollment} grades={grades} educationLevels={educationLevels} groups={groups} gradeLevelId={gradeLevelId} setGradeLevelId={(value) => { setGradeLevelId(value); if (!groups.some((group) => group.id === gradeGroupId && group.grade_level_id === value)) setGradeGroupId("") }} groupId={gradeGroupId} setGroupId={setGradeGroupId} effectiveOn={effectiveOn} setEffectiveOn={setEffectiveOn} reason={reason} setReason={setReason} />}
            {step === "form" && mode === "dates" && <AcademicDatesCorrectionForm enrollment={enrollment} enrolledOn={enrolledOn} setEnrolledOn={setEnrolledOn} classesStartOn={classesStartOn} setClassesStartOn={setClassesStartOn} effectiveOn={effectiveOn} setEffectiveOn={setEffectiveOn} reason={reason} setReason={setReason} focus={dateFocus} />}
            {step === "form" && mode === "finalization" && <FinalizationForm enrollment={enrollment} effectiveOn={effectiveOn} setEffectiveOn={setEffectiveOn} />}
            {step === "form" && mode && mode !== "editor" && mode !== "grade" && mode !== "dates" && mode !== "finalization" && mode !== "graduation" && mode !== "reactivation" && mode !== "discount" && mode !== "regularization" && <ActionForm mode={mode} enrollment={enrollment} targetId={targetId} setTargetId={setTargetId} effectiveOn={effectiveOn} setEffectiveOn={setEffectiveOn} reason={reason} setReason={setReason} groups={compatibleGroups} classifications={availableClassifications} plans={compatiblePlans} planAvailable={planAvailable} currentPeriodAction={currentPeriodAction} setCurrentPeriodAction={setCurrentPeriodAction} currentPeriodAmount={currentPeriodAmount} setCurrentPeriodAmount={setCurrentPeriodAmount} futureMode={futureMode} setFutureMode={setFutureMode} />}
            {step === "form" && mode === "reactivation" && <ReactivationForm enrollment={enrollment} groups={reactivationGroups} groupId={targetId} setGroupId={setTargetId} reactivatedOn={effectiveOn} setReactivatedOn={setEffectiveOn} economicStartOn={economicStartOn} setEconomicStartOn={setEconomicStartOn} isPartial={reactivationIsPartial} tuitionAgreement={reactivationTuitionAgreement} tuitionMode={initialTuitionMode} setTuitionMode={setInitialTuitionMode} tuitionAmount={initialTuitionAmount} setTuitionAmount={setInitialTuitionAmount} enrollmentFeeCoverage={enrollmentFeeCoverage} enrollmentFeeMode={enrollmentFeeMode} setEnrollmentFeeMode={setEnrollmentFeeMode} enrollmentFeeAmount={enrollmentFeeAmount} setEnrollmentFeeAmount={setEnrollmentFeeAmount} reason={reason} setReason={setReason} />}
            {step === "form" && mode === "discount" && <DiscountForm enrollment={enrollment} categories={discountCategories} categoryId={discountCategoryId} setCategoryId={setDiscountCategoryId} effectiveOn={effectiveOn} setEffectiveOn={setEffectiveOn} effectMode={discountEffectMode} setEffectMode={setDiscountEffectMode} currentPeriodAmount={discountCurrentPeriodAmount} setCurrentPeriodAmount={setDiscountCurrentPeriodAmount} selectedCategory={selectedDiscountCategory} selectedVersion={selectedDiscountVersion} preview={discountPreview} reason={reason} setReason={setReason} />}
            {step === "form" && mode === "regularization" && <RegularizationForm enrollment={enrollment} economicStartOn={economicStartOn} setEconomicStartOn={setEconomicStartOn} amount={regularizationAmount} setAmount={setRegularizationAmount} dueDate={regularizationDueDate} setDueDate={setRegularizationDueDate} beforeFirstPeriod={regularizationBeforeFirstPeriod} isPartial={regularizationIsPartial} needsAmount={regularizationNeedsAmount} coveragePeriod={regularizationPeriod} reason={reason} setReason={setReason} />}
            {step === "review" && mode === "withdrawal" && <WithdrawalReview enrollment={enrollment} withdrawnOn={effectiveOn} currentPeriodAction={currentPeriodAction} currentPeriodAmount={currentPeriodAmount} futureMode={futureMode} reason={reason} />}
            {step === "review" && mode === "reactivation" && <ReactivationReview group={reactivationGroups.find((group) => group.id === targetId) ?? null} reactivatedOn={effectiveOn} economicStartOn={economicStartOn} isPartial={reactivationIsPartial} tuitionMode={initialTuitionMode} tuitionAmount={initialTuitionMode === "FULL" ? reactivationTuitionAgreement?.agreedAmount.toString() ?? "" : initialTuitionAmount} enrollmentFeeCoverage={enrollmentFeeCoverage} enrollmentFeeMode={enrollmentFeeMode} enrollmentFeeAmount={enrollmentFeeAmount} reason={reason} />}
            {step === "review" && mode === "discount" && selectedDiscountCategory && <DiscountReview enrollment={enrollment} category={selectedDiscountCategory} version={selectedDiscountVersion} preview={discountPreview} effectiveOn={effectiveOn} effectMode={discountEffectMode} currentPeriodAmount={discountCurrentPeriodAmount} reason={reason} />}
            {step === "review" && mode === "regularization" && <RegularizationReview enrollment={enrollment} economicStartOn={economicStartOn} amount={regularizationNeedsAmount ? regularizationAmount : ""} dueDate={regularizationBeforeFirstPeriod ? regularizationDueDate : regularizationPeriod?.dueDate ?? ""} beforeFirstPeriod={regularizationBeforeFirstPeriod} reason={reason} />}
            {step === "review" && mode === "finalization" && <FinalizationReview enrollment={enrollment} effectiveOn={effectiveOn} />}
            {step === "review" && mode === "grade" && <GradeCorrectionReview enrollment={enrollment} grades={grades} groups={groups} gradeLevelId={gradeLevelId} groupId={gradeGroupId} effectiveOn={effectiveOn} reason={reason} />}
            {step === "review" && mode === "dates" && <AcademicDatesCorrectionReview enrollment={enrollment} enrolledOn={enrolledOn} classesStartOn={classesStartOn} effectiveOn={effectiveOn} reason={reason} />}
            {step === "form" && mode === "graduation" && <GraduationForm enrollment={enrollment} effectiveOn={effectiveOn} setEffectiveOn={setEffectiveOn} />}
            {step === "review" && mode === "graduation" && <GraduationReview enrollment={enrollment} effectiveOn={effectiveOn} />}
            {step === "review" && mode && mode !== "withdrawal" && mode !== "reactivation" && mode !== "discount" && mode !== "regularization" && selectedTarget && <ActionReview mode={mode} enrollment={enrollment} target={selectedTarget} effectiveOn={effectiveOn} reason={reason} />}
          </div>

          {error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:px-6" role="alert">{error}</p>}
          <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6">
            <Button variant="ghost" className="h-10" disabled={isPending} onClick={() => step === "review" ? setStep("form") : mode === "editor" ? close() : fromEditor ? setMode("editor") : close()}>
              <ChevronLeft /> {mode === "regularization" && step === "form" || mode === "editor" ? "Cancelar" : "Atrás"}
            </Button>
            {mode === "editor" ? null : step === "review" ? (
              <Button className="h-10" disabled={isPending} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />}{isPending ? "Guardando..." : mode === "finalization" ? "Confirmar finalización" : mode === "graduation" ? "Confirmar egreso" : mode === "withdrawal" ? "Confirmar baja" : mode === "reactivation" ? "Confirmar reactivación" : mode === "discount" ? "Confirmar descuento" : mode === "regularization" ? "Confirmar regularización" : mode === "grade" || mode === "dates" ? "Confirmar corrección" : "Confirmar cambio"}</Button>
            ) : (
              <Button className="h-10" disabled={isPending} onClick={mode === "regularization" ? submit : review}>{mode === "regularization" ? "Confirmar regularización" : "Revisar"}</Button>
            )}
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function EnrollmentActionPanel({
  section,
  enrollment,
  canChange,
  canEditSchool,
  planAvailable,
  canAssignDiscount,
  schoolAction,
  onOpenEditor,
  onOpenAction,
}: {
  section: "school" | "financial"
  enrollment: EnrollmentListItem
  canChange: boolean
  canEditSchool: boolean
  planAvailable: boolean
  canAssignDiscount: boolean
  schoolAction: "editor" | "quick"
  onOpenEditor: () => void
  onOpenAction: (mode: Exclude<ActionMode, "editor">) => Promise<void>
}) {
  if (section === "school") {
    if (schoolAction === "editor") {
      if (!canEditSchool) return null
      return <Dialog.Trigger render={<Button variant="ghost" size="sm" onClick={onOpenEditor}><Pencil /> Editar</Button>} />
    }

    if (!canEditSchool || enrollment.status !== "ACTIVA") return null
    return (
      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void onOpenAction("withdrawal")}>
          Dar de baja
        </Button>
      </div>
    )
  }

  if (!canChange || enrollment.status !== "ACTIVA") return null

  return (
    <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
      <Button variant="outline" size="sm" disabled={!planAvailable} onClick={() => void onOpenAction("plan")}>
        Cambiar plan
      </Button>
      <Button variant="outline" size="sm" disabled={!canAssignDiscount} onClick={() => void onOpenAction("discount")}>
        {enrollment.currentDiscount ? "Modificar descuento" : "Asignar descuento"}
      </Button>
      <Button variant="outline" size="sm" onClick={() => void onOpenAction("regularization")}>
        Regularizar inicio financiero
      </Button>
    </div>
  )
}

function EnrollmentEditorForm({ enrollment, groups, classifications, grades, educationLevels, canGraduate, onSelect, onSelectState }: {
  enrollment: EnrollmentListItem
  groups: GroupOption[]
  classifications: ClassificationOption[]
  grades: GradeOption[]
  educationLevels: EducationLevelOption[]
  canGraduate: boolean
  onSelect: (mode: Exclude<ActionMode, "editor">, dateFocus?: "enrolledOn" | "classesStartOn") => void
  onSelectState: (mode: Exclude<ActionMode, "editor">) => void
}) {
  const canChangeExistingValues = !["BAJA", "FINALIZADA", "NO_CONTINUA", "EGRESADA"].includes(enrollment.status)
  const derivedEducationLevel = educationLevels.find((level) => level.id === enrollment.educationLevel.id)?.name ?? enrollment.educationLevel.name
  const stateOptions = enrollment.status === "ACTIVA"
    ? [
        ...(enrollment.gradeLevel.isTerminal ? [{ value: "EGRESADA", label: "Egresada", mode: "graduation" as const }] : []),
        { value: "FINALIZADA", label: "Finalizada", mode: "finalization" as const },
        { value: "BAJA", label: "Baja", mode: "withdrawal" as const },
      ]
    : enrollment.status === "FINALIZADA" && canGraduate
      ? [{ value: "EGRESADA", label: "Egresada", mode: "graduation" as const }]
      : enrollment.status === "BAJA"
        ? [{ value: "ACTIVA", label: "Activa", mode: "reactivation" as const }]
        : []

  return (
    <section className="space-y-4">
      <div><h2 className="text-lg font-semibold">Editar matrícula</h2><p className="mt-1 text-sm text-muted-foreground">Selecciona la opción que deseas editar.</p></div>
      <div className="divide-y divide-border border-y border-border">
        <EditorRow label="Matrícula" value={formatEnrollmentStatus(enrollment.status)}>
          <select aria-label="Nuevo estado" className="min-w-0 flex-1 bg-transparent text-right text-sm outline-none" value="" onChange={(event) => { const option = stateOptions.find((item) => item.value === event.target.value); if (option) onSelectState(option.mode) }}>
            <option value="">{formatEnrollmentStatus(enrollment.status)}</option>
            {stateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </EditorRow>
        <EditorRow label="Nivel (derivado)" value={derivedEducationLevel} />
        <EditorRow label="Grado" value={enrollment.gradeLevel.name} editable={Boolean(grades.length)} onClick={() => onSelect("grade")} />
        <EditorRow label="Grupo" value={enrollment.group ? getEnrollmentGroupLabel(enrollment.group) : "Sin grupo"} editable={canChangeExistingValues && Boolean(groups.length)} onClick={() => onSelect("group")} />
        <EditorRow label="Clasificación" value={enrollment.classification.name} editable={canChangeExistingValues && Boolean(classifications.length)} onClick={() => onSelect("classification")} />
        <EditorRow label="Fecha de matrícula" value={formatDate(enrollment.enrolledOn)} editable onClick={() => onSelect("dates", "enrolledOn")} />
        <EditorRow label="Inicio de clases" value={enrollment.classesStartOn ? formatDate(enrollment.classesStartOn) : "Sin fecha registrada"} editable onClick={() => onSelect("dates", "classesStartOn")} />
      </div>
      <div className="grid gap-2 pt-4">
        <p className="text-sm font-medium">Acceso rápido</p>
        {enrollment.status === "ACTIVA" && <Button variant="outline" className="w-full justify-center text-destructive hover:text-destructive" onClick={() => onSelect("withdrawal")}>Dar de baja</Button>}
        {!["ACTIVA", "BAJA", "FINALIZADA"].includes(enrollment.status) && <p className="text-sm text-muted-foreground">No hay transiciones disponibles para este estado.</p>}
      </div>
    </section>
  )
}

function EditorRow({ label, value, editable = false, onClick, children }: { label: string; value: string; editable?: boolean; onClick?: () => void; children?: React.ReactNode }) {
  const className = "flex min-h-14 w-full items-center gap-4 py-3 text-left text-sm"
  const content = <><span className="shrink-0 text-muted-foreground">{label}</span>{children ?? <span className="ml-auto min-w-0 truncate text-right font-medium">{value}</span>}{editable && <span aria-hidden="true" className="text-muted-foreground">›</span>}</>
  return editable ? <button type="button" className={`${className} hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50`} onClick={onClick}>{content}</button> : <div className={className}>{content}</div>
}

function GradeCorrectionForm({ enrollment, grades, educationLevels, groups, gradeLevelId, setGradeLevelId, groupId, setGroupId, effectiveOn, setEffectiveOn, reason, setReason }: {
  enrollment: EnrollmentListItem
  grades: GradeOption[]
  educationLevels: EducationLevelOption[]
  groups: GroupOption[]
  gradeLevelId: string
  setGradeLevelId: (value: string) => void
  groupId: string
  setGroupId: (value: string) => void
  effectiveOn: string
  setEffectiveOn: (value: string) => void
  reason: string
  setReason: (value: string) => void
}) {
  const selectedGrade = grades.find((grade) => grade.id === gradeLevelId) ?? null
  const compatibleGroups = groups.filter((group) => group.grade_level_id === gradeLevelId)
  const selectedLevel = educationLevels.find((level) => level.id === selectedGrade?.education_level_id)?.name ?? "Sin nivel"

  return (
    <section className="space-y-5">
      <div><h2 className="text-lg font-semibold">Corregir grado</h2><p className="mt-1 text-sm text-muted-foreground">El nivel se deriva automáticamente del grado. Si el grado cambia, selecciona un grupo compatible o deja la matrícula sin grupo.</p></div>
      <Field label="Grado"><select className={selectClass} value={gradeLevelId} onChange={(event) => setGradeLevelId(event.target.value)}><option value="">Selecciona un grado</option>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></Field>
      <Field label="Nivel derivado"><Input value={selectedLevel} readOnly /></Field>
      <Field label="Grupo"><select className={selectClass} value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">Sin grupo</option>{compatibleGroups.map((group) => <option key={group.id} value={group.id}>{getEnrollmentGroupLabel(group)}</option>)}</select></Field>
      <Field label="Fecha efectiva"><Input type="date" min={enrollment.cycle.startsOn} max={enrollment.cycle.endsOn} value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} /></Field>
      <Field label="Motivo"><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe la corrección administrativa" /></Field>
    </section>
  )
}

function GradeCorrectionReview({ enrollment, grades, groups, gradeLevelId, groupId, effectiveOn, reason }: {
  enrollment: EnrollmentListItem
  grades: GradeOption[]
  groups: GroupOption[]
  gradeLevelId: string
  groupId: string
  effectiveOn: string
  reason: string
}) {
  const grade = grades.find((option) => option.id === gradeLevelId)
  const group = groups.find((option) => option.id === groupId)
  return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Revisar corrección de grado</h2><p className="mt-1 text-sm text-muted-foreground">Confirma el cambio antes de aplicarlo.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Grado actual" value={enrollment.gradeLevel.name} /><Summary label="Grado nuevo" value={grade?.name ?? "Sin seleccionar"} /><Summary label="Grupo nuevo" value={group ? getEnrollmentGroupLabel(group) : "Sin grupo"} /><Summary label="Fecha efectiva" value={formatDate(effectiveOn)} /><Summary label="Motivo" value={reason} /></dl></section>
}

function AcademicDatesCorrectionForm({ enrollment, enrolledOn, setEnrolledOn, classesStartOn, setClassesStartOn, effectiveOn, setEffectiveOn, reason, setReason, focus }: {
  enrollment: EnrollmentListItem
  enrolledOn: string
  setEnrolledOn: (value: string) => void
  classesStartOn: string
  setClassesStartOn: (value: string) => void
  effectiveOn: string
  setEffectiveOn: (value: string) => void
  reason: string
  setReason: (value: string) => void
  focus: "enrolledOn" | "classesStartOn"
}) {
  return (
    <section className="space-y-5">
      <div><h2 className="text-lg font-semibold">Corregir fechas académicas</h2><p className="mt-1 text-sm text-muted-foreground">Las fechas deben permanecer dentro del ciclo escolar. La fecha de cierre no se modifica.</p></div>
      <Field label="Fecha de matrícula"><Input autoFocus={focus === "enrolledOn"} type="date" min={enrollment.cycle.startsOn} max={enrollment.cycle.endsOn} value={enrolledOn} onChange={(event) => setEnrolledOn(event.target.value)} /></Field>
      <Field label="Inicio de clases"><Input autoFocus={focus === "classesStartOn"} type="date" min={enrollment.cycle.startsOn} max={enrollment.cycle.endsOn} value={classesStartOn} onChange={(event) => setClassesStartOn(event.target.value)} /></Field>
      <Field label="Fecha efectiva"><Input type="date" min={enrollment.cycle.startsOn} max={enrollment.cycle.endsOn} value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} /></Field>
      <Field label="Motivo"><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe la corrección administrativa" /></Field>
    </section>
  )
}

function AcademicDatesCorrectionReview({ enrollment, enrolledOn, classesStartOn, effectiveOn, reason }: {
  enrollment: EnrollmentListItem
  enrolledOn: string
  classesStartOn: string
  effectiveOn: string
  reason: string
}) {
  return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Revisar corrección de fechas</h2><p className="mt-1 text-sm text-muted-foreground">Confirma los valores antes de aplicarlos.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Fecha de matrícula" value={`${formatDate(enrollment.enrolledOn)} → ${formatDate(enrolledOn)}`} /><Summary label="Inicio de clases" value={`${enrollment.classesStartOn ? formatDate(enrollment.classesStartOn) : "Sin fecha"} → ${classesStartOn ? formatDate(classesStartOn) : "Sin fecha"}`} /><Summary label="Fecha efectiva" value={formatDate(effectiveOn)} /><Summary label="Motivo" value={reason} /></dl></section>
}

function FinalizationForm({ enrollment, effectiveOn, setEffectiveOn }: {
  enrollment: EnrollmentListItem
  effectiveOn: string
  setEffectiveOn: (value: string) => void
}) {
  return (
    <section className="space-y-5">
      <div><h2 className="text-lg font-semibold">Finalizar matrícula</h2><p className="mt-1 text-sm text-muted-foreground">La matrícula conservará su ciclo e historial y cambiará de ACTIVA a FINALIZADA.</p></div>
      <dl className="divide-y divide-border border-y border-border"><Summary label="Alumno" value={enrollment.student.fullName} /><Summary label="Ciclo" value={enrollment.cycle.name} /><Summary label="Estado actual" value="Activa" /><Summary label="Nuevo estado" value="Finalizada" /></dl>
      <Field label="Fecha efectiva"><Input type="date" min={enrollment.cycle.startsOn} max={enrollment.cycle.endsOn} value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} /><span className="text-xs font-normal text-muted-foreground">Debe estar dentro del ciclo escolar.</span></Field>
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">No se crearán matrículas nuevas ni se modificarán pagos, cargos o calificaciones.</p>
    </section>
  )
}

function FinalizationReview({ enrollment, effectiveOn }: { enrollment: EnrollmentListItem; effectiveOn: string }) {
  return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Revisar finalización</h2><p className="mt-1 text-sm text-muted-foreground">Confirma el cambio antes de aplicarlo.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Alumno" value={enrollment.student.fullName} /><Summary label="Ciclo" value={enrollment.cycle.name} /><Summary label="Estado" value="Activa → Finalizada" /><Summary label="Fecha efectiva" value={formatDate(effectiveOn)} /></dl></section>
}

function GraduationForm({ enrollment, effectiveOn, setEffectiveOn }: {
  enrollment: EnrollmentListItem
  effectiveOn: string
  setEffectiveOn: (value: string) => void
}) {
  const transitionLabel = enrollment.status === "ACTIVA" ? "La matrícula cambiará a Egresada." : "La matrícula cambiará de Finalizada a Egresada."
  return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Marcar como egresado</h2><p className="mt-1 text-sm text-muted-foreground">{transitionLabel}</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Alumno" value={enrollment.student.fullName} /><Summary label="Ciclo" value={enrollment.cycle.name} /><Summary label="Nivel / grado" value={`${enrollment.educationLevel.name} · ${enrollment.gradeLevel.name}`} /></dl><Field label="Fecha efectiva de egreso"><Input type="date" min={enrollment.cycle.startsOn} max={enrollment.cycle.endsOn} value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} /><span className="text-xs font-normal text-muted-foreground">Captura la fecha efectiva dentro del ciclo escolar.</span></Field></section>
}

function GraduationReview({ enrollment, effectiveOn }: { enrollment: EnrollmentListItem; effectiveOn: string }) {
  return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Revisar egreso</h2><p className="mt-1 text-sm text-muted-foreground">Confirma el cambio antes de aplicarlo.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Alumno" value={enrollment.student.fullName} /><Summary label="Matrícula" value={`${formatEnrollmentStatus(enrollment.status)} → Egresada`} /><Summary label="Fecha efectiva" value={formatDate(effectiveOn)} /></dl></section>
}

function ActionForm({ mode, enrollment, targetId, setTargetId, effectiveOn, setEffectiveOn, reason, setReason, groups, classifications, plans, planAvailable, currentPeriodAction, setCurrentPeriodAction, currentPeriodAmount, setCurrentPeriodAmount, futureMode, setFutureMode }: {
  mode: ActionMode
  enrollment: EnrollmentListItem
  targetId: string
  setTargetId: (value: string) => void
  effectiveOn: string
  setEffectiveOn: (value: string) => void
  reason: string
  setReason: (value: string) => void
  groups: GroupOption[]
  classifications: ClassificationOption[]
  plans: FinancialPlanOption[]
  planAvailable: boolean
  currentPeriodAction: "KEEP_FULL" | "PROPORTIONAL" | "AGREED" | "WAIVE"
  setCurrentPeriodAction: (value: "KEEP_FULL" | "PROPORTIONAL" | "AGREED" | "WAIVE") => void
  currentPeriodAmount: string
  setCurrentPeriodAmount: (value: string) => void
  futureMode: "STOP_FUTURE" | "KEEP_REMAINING"
  setFutureMode: (value: "STOP_FUTURE" | "KEEP_REMAINING") => void
}) {
  const requiresAmount = currentPeriodAction === "PROPORTIONAL" || currentPeriodAction === "AGREED"
  const firstAllowedDate = enrollment.enrolledOn > enrollment.cycle.startsOn
    ? enrollment.enrolledOn
    : enrollment.cycle.startsOn

  return (
    <section className="space-y-5">
      <div><h2 className="text-lg font-semibold">{mode === "withdrawal" ? "Baja de matrícula" : "Nuevo valor"}</h2><p className="mt-1 text-sm text-muted-foreground">{mode === "withdrawal" ? "Define el tratamiento financiero antes de confirmar la baja." : "Revisa el cambio antes de confirmarlo."}</p></div>
      {mode === "plan" && <div className="space-y-3"><p className="text-sm text-muted-foreground">Plan actual: <span className="font-medium text-foreground">{enrollment.currentPlan?.installmentCount ?? "Sin plan"} pagos</span></p><Field label="Plan nuevo"><select value={targetId} onChange={(event) => setTargetId(event.target.value)} disabled={!planAvailable} className={selectClass}><option value="">Selecciona un plan de 10 pagos</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>10 pagos</option>)}</select></Field></div>}
      {mode === "group" && <div className="space-y-3"><p className="text-sm text-muted-foreground">Grupo actual: <span className="font-medium text-foreground">{enrollment.group ? getEnrollmentGroupLabel(enrollment.group) : "Sin grupo"}</span></p><Field label="Grupo nuevo"><select value={targetId} onChange={(event) => setTargetId(event.target.value)} className={selectClass}><option value="">Selecciona un grupo</option>{groups.map((group) => <option key={group.id} value={group.id}>{getEnrollmentGroupLabel(group)}</option>)}</select></Field></div>}
      {mode === "classification" && <div className="space-y-3"><p className="text-sm text-muted-foreground">Clasificación actual: <span className="font-medium text-foreground">{enrollment.classification.name}</span></p><Field label="Clasificación nueva"><select value={targetId} onChange={(event) => setTargetId(event.target.value)} className={selectClass}><option value="">Selecciona una clasificación</option>{classifications.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></div>}
      {mode === "withdrawal" && <><Field label="Fecha efectiva de baja"><Input type="date" min={firstAllowedDate} max={enrollment.cycle.endsOn} value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} /><span className="text-xs font-normal text-muted-foreground">Debe estar entre {formatDate(firstAllowedDate)} y {formatDate(enrollment.cycle.endsOn)}.</span></Field><Field label="Tratamiento del periodo actual"><select value={currentPeriodAction} onChange={(event) => setCurrentPeriodAction(event.target.value as "KEEP_FULL" | "PROPORTIONAL" | "AGREED" | "WAIVE")} className={selectClass}><option value="KEEP_FULL">Conservar completo</option><option value="PROPORTIONAL">Proporcional</option><option value="AGREED">Monto acordado</option><option value="WAIVE">Condonar</option></select></Field>{requiresAmount && <Field label="Monto final"><Input inputMode="decimal" value={currentPeriodAmount} onChange={(event) => setCurrentPeriodAmount(event.target.value)} placeholder="0.00" /></Field>}<Field label="Tratamiento de periodos futuros"><select value={futureMode} onChange={(event) => setFutureMode(event.target.value as "STOP_FUTURE" | "KEEP_REMAINING")} className={selectClass}><option value="STOP_FUTURE">Cancelar futuros</option><option value="KEEP_REMAINING">Conservar obligaciones</option></select></Field></>}
      {mode !== "withdrawal" && <Field label="Fecha efectiva"><Input type="date" value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} /></Field>}
      <Field label="Motivo"><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={mode === "withdrawal" ? "Explica el motivo de la baja" : "Explica el motivo del cambio"} rows={3} /></Field>
    </section>
  )
}

function ActionReview({ mode, enrollment, target, effectiveOn, reason }: { mode: ActionMode; enrollment: EnrollmentListItem; target: { id: string; name?: string; code?: string; installmentCount?: number }; effectiveOn: string; reason: string }) {
  const current = mode === "plan" ? `${enrollment.currentPlan?.installmentCount ?? "Sin plan"} pagos` : mode === "group" ? (enrollment.group ? getEnrollmentGroupLabel(enrollment.group) : "Sin grupo") : enrollment.classification.name
  const next = mode === "plan" ? `${target.installmentCount ?? 10} pagos` : mode === "group" ? getEnrollmentGroupLabel({ name: target.name ?? "", code: target.code ?? "" }) : target.name ?? ""

  return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Revisión</h2><p className="mt-1 text-sm text-muted-foreground">Confirma este cambio de matrícula.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label={mode === "plan" ? "Plan actual" : mode === "group" ? "Grupo actual" : "Clasificación actual"} value={current} /><Summary label={mode === "plan" ? "Plan nuevo" : mode === "group" ? "Grupo nuevo" : "Clasificación nueva"} value={next} /><Summary label="Fecha efectiva" value={formatDate(effectiveOn)} /><Summary label="Motivo" value={reason} /></dl></section>
}

function WithdrawalReview({ enrollment, withdrawnOn, currentPeriodAction, currentPeriodAmount, futureMode, reason }: {
  enrollment: EnrollmentListItem
  withdrawnOn: string
  currentPeriodAction: "KEEP_FULL" | "PROPORTIONAL" | "AGREED" | "WAIVE"
  currentPeriodAmount: string
  futureMode: "STOP_FUTURE" | "KEEP_REMAINING"
  reason: string
}) {
  const currentActionLabel = {
    KEEP_FULL: "Conservar completo",
    PROPORTIONAL: "Proporcional",
    AGREED: "Monto acordado",
    WAIVE: "Condonar",
  }[currentPeriodAction]
  const futureModeLabel = futureMode === "STOP_FUTURE" ? "Cancelar futuros" : "Conservar obligaciones"
  const gradeGroup = `${enrollment.educationLevel.name} ${enrollment.gradeLevel.name}${enrollment.group ? ` ${getEnrollmentGroupLabel(enrollment.group)}` : ""}`
  return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Revisión de baja</h2><p className="mt-1 text-sm text-muted-foreground">Confirma el tratamiento de la matrícula y sus colegiaturas.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Alumno" value={enrollment.student.fullName} /><Summary label="Ciclo" value={enrollment.cycle.name} /><Summary label="Grado / grupo" value={gradeGroup} /><Summary label="Fecha de baja" value={formatDate(withdrawnOn)} /><Summary label="Periodo actual" value={currentActionLabel} />{(currentPeriodAction === "PROPORTIONAL" || currentPeriodAction === "AGREED") && <Summary label="Monto final" value={`$${currentPeriodAmount}`} />}<Summary label="Periodos futuros" value={futureModeLabel} /><Summary label="Motivo" value={reason} /></dl></section>
}

function DiscountForm({ enrollment, categories, categoryId, setCategoryId, effectiveOn, setEffectiveOn, effectMode, setEffectMode, currentPeriodAmount, setCurrentPeriodAmount, selectedCategory, selectedVersion, preview, reason, setReason }: {
  enrollment: EnrollmentListItem
  categories: TuitionDiscountCategory[]
  categoryId: string
  setCategoryId: (value: string) => void
  effectiveOn: string
  setEffectiveOn: (value: string) => void
  effectMode: "CURRENT" | "NEXT" | "PROPORTIONAL"
  setEffectMode: (value: "CURRENT" | "NEXT" | "PROPORTIONAL") => void
  currentPeriodAmount: string
  setCurrentPeriodAmount: (value: string) => void
  selectedCategory: TuitionDiscountCategory | null
  selectedVersion: TuitionDiscountCategory["currentVersion"]
  preview: { discountAmount: number; agreedAmount: number } | null
  reason: string
  setReason: (value: string) => void
}) {
  const currentCategory = enrollment.currentDiscount?.name ?? "Sin descuento"

  return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Descuento de colegiatura</h2><p className="mt-1 text-sm text-muted-foreground">La aplicación financiera se confirmará al guardar.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Alumno" value={enrollment.student.fullName} /><Summary label="Ciclo" value={enrollment.cycle.name} /><Summary label="Nivel" value={enrollment.educationLevel.name} /><Summary label="Colegiatura base" value={enrollment.currentTuition ? formatCurrency(enrollment.currentTuition.baseAmount) : "Sin dato"} /><Summary label="Categoría actual" value={currentCategory} /><Summary label="Monto individual actual" value={enrollment.currentTuition ? formatCurrency(enrollment.currentTuition.agreedAmount) : "Sin dato"} /></dl><Field label="Categoría de descuento"><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={selectClass}><option value="">Selecciona una categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field><Field label="Fecha efectiva"><Input type="date" min={enrollment.currentTuition?.validFrom ?? enrollment.cycle.startsOn} max={enrollment.cycle.endsOn} value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} /></Field>{selectedCategory && <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"><p className="font-medium">{selectedCategory.name}</p><p className="text-muted-foreground">{tuitionDiscountTypeLabel(selectedCategory.discountType)}{selectedVersion ? ` · ${formatTuitionDiscountValue(selectedVersion.value, selectedCategory.discountType)}` : " · Sin valor para esta fecha"}</p>{preview && <dl className="mt-3 grid gap-1 border-t border-border pt-3"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Descuento resultante</dt><dd className="font-medium">-{formatCurrency(preview.discountAmount)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Monto individual resultante</dt><dd className="font-medium">{formatCurrency(preview.agreedAmount)}</dd></div></dl>}</div>}<Field label="Efecto del cambio"><select value={effectMode} onChange={(event) => setEffectMode(event.target.value as "CURRENT" | "NEXT" | "PROPORTIONAL")} className={selectClass}><option value="CURRENT">Aplicar desde el periodo actual</option><option value="NEXT">Aplicar desde el siguiente periodo</option><option value="PROPORTIONAL">Definir monto final del periodo actual</option></select></Field>{effectMode === "PROPORTIONAL" && <Field label="Monto final del periodo actual"><Input inputMode="decimal" value={currentPeriodAmount} onChange={(event) => setCurrentPeriodAmount(event.target.value)} placeholder="0.00" /></Field>}<Field label="Motivo"><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica el motivo del descuento" rows={3} /></Field></section>
}

function DiscountReview({ enrollment, category, version, preview, effectiveOn, effectMode, currentPeriodAmount, reason }: {
  enrollment: EnrollmentListItem
  category: TuitionDiscountCategory
  version: TuitionDiscountCategory["currentVersion"]
  preview: { discountAmount: number; agreedAmount: number } | null
  effectiveOn: string
  effectMode: "CURRENT" | "NEXT" | "PROPORTIONAL"
  currentPeriodAmount: string
  reason: string
}) {
  const effectLabel = effectMode === "CURRENT" ? "Aplicar desde el periodo actual" : effectMode === "NEXT" ? "Aplicar desde el siguiente periodo" : "Monto final del periodo actual"
  return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Revisión del descuento</h2><p className="mt-1 text-sm text-muted-foreground">Confirma la categoría y el efecto financiero.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Alumno" value={enrollment.student.fullName} /><Summary label="Categoría" value={category.name} /><Summary label="Valor" value={version ? formatTuitionDiscountValue(version.value, category.discountType) : "Sin valor"} /><Summary label="Fecha efectiva" value={formatDate(effectiveOn)} /><Summary label="Efecto" value={effectLabel} />{effectMode === "PROPORTIONAL" && <Summary label="Monto final actual" value={formatCurrency(Number(currentPeriodAmount))} />}<Summary label="Colegiatura base" value={enrollment.currentTuition ? formatCurrency(enrollment.currentTuition.baseAmount) : "Sin dato"} /><Summary label="Descuento resultante" value={preview ? `-${formatCurrency(preview.discountAmount)}` : "Sin dato"} /><Summary label="Monto individual resultante" value={preview ? formatCurrency(preview.agreedAmount) : "Sin dato"} /><Summary label="Motivo" value={reason} /></dl></section>
}

function ReactivationForm({ enrollment, groups, groupId, setGroupId, reactivatedOn, setReactivatedOn, economicStartOn, setEconomicStartOn, isPartial, tuitionAgreement, tuitionMode, setTuitionMode, tuitionAmount, setTuitionAmount, enrollmentFeeCoverage, enrollmentFeeMode, setEnrollmentFeeMode, enrollmentFeeAmount, setEnrollmentFeeAmount, reason, setReason }: {
  enrollment: EnrollmentListItem
  groups: GroupOption[]
  groupId: string
  setGroupId: (value: string) => void
  reactivatedOn: string
  setReactivatedOn: (value: string) => void
  economicStartOn: string
  setEconomicStartOn: (value: string) => void
  isPartial: boolean
  tuitionAgreement: { agreedAmount: number } | null
  tuitionMode: "FULL" | "PROPORTIONAL"
  setTuitionMode: (value: "FULL" | "PROPORTIONAL") => void
  tuitionAmount: string
  setTuitionAmount: (value: string) => void
  enrollmentFeeCoverage: "loading" | "covered" | "uncovered" | "error" | null
  enrollmentFeeMode: "FULL" | "PROPORTIONAL"
  setEnrollmentFeeMode: (value: "FULL" | "PROPORTIONAL") => void
  enrollmentFeeAmount: string
  setEnrollmentFeeAmount: (value: string) => void
  reason: string
  setReason: (value: string) => void
}) {
  const firstAllowedDate = enrollment.closedOn && enrollment.closedOn > enrollment.cycle.startsOn
    ? enrollment.closedOn
    : enrollment.cycle.startsOn
  return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Reactivar matrícula</h2><p className="mt-1 text-sm text-muted-foreground">Revisa los datos académicos y financieros antes de confirmar.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Alumno" value={enrollment.student.fullName} /><Summary label="Ciclo" value={enrollment.cycle.name} /><Summary label="Grado" value={enrollment.gradeLevel.name} /><Summary label="Grupo actual" value={enrollment.group ? getEnrollmentGroupLabel(enrollment.group) : "Sin grupo"} /></dl><Field label="Fecha de reingreso"><Input type="date" min={firstAllowedDate} max={enrollment.cycle.endsOn} value={reactivatedOn} onChange={(event) => setReactivatedOn(event.target.value)} /><span className="text-xs font-normal text-muted-foreground">Debe estar entre {formatDate(firstAllowedDate)} y {formatDate(enrollment.cycle.endsOn)}.</span></Field><Field label="Grupo"><select value={groupId} onChange={(event) => setGroupId(event.target.value)} className={selectClass}><option value="">Selecciona un grupo</option>{groups.map((group) => <option key={group.id} value={group.id}>{getEnrollmentGroupLabel(group)}</option>)}</select></Field><Field label="Inicio económico"><Input type="date" min={reactivatedOn || firstAllowedDate} max={enrollment.cycle.endsOn} value={economicStartOn} onChange={(event) => setEconomicStartOn(event.target.value)} /><span className="text-xs font-normal text-muted-foreground">No puede ser anterior al reingreso.</span></Field><div className="space-y-3 border-y border-border py-4"><div><h3 className="text-sm font-semibold">Colegiatura</h3><p className="mt-1 text-sm text-muted-foreground">Plan al reactivar: 12 pagos.</p></div>{isPartial ? <><p className="text-sm text-muted-foreground">El inicio económico cae dentro de un mes ya iniciado.</p><div className="grid gap-2"><Choice label={tuitionAgreement ? `Cobrar completo (${formatCurrency(tuitionAgreement.agreedAmount)})` : "Cobrar completo"} checked={tuitionMode === "FULL"} onChange={() => setTuitionMode("FULL")} /><Choice label="Cobrar proporcional" checked={tuitionMode === "PROPORTIONAL"} onChange={() => setTuitionMode("PROPORTIONAL")} /></div>{tuitionMode === "PROPORTIONAL" && <Field label="Monto del primer periodo"><Input inputMode="decimal" value={tuitionAmount} onChange={(event) => setTuitionAmount(event.target.value)} placeholder="0.00" /></Field>}</> : <p className="text-sm text-muted-foreground">El inicio económico coincide con el comienzo de un periodo. Se aplicará la colegiatura vigente del plan.</p>}</div><div className="space-y-3 border-b border-border pb-4"><div><h3 className="text-sm font-semibold">Inscripción</h3>{enrollmentFeeCoverage === "loading" && <p className="mt-1 text-sm text-muted-foreground">Consultando cobertura de inscripción...</p>}{enrollmentFeeCoverage === "covered" && <p className="mt-1 text-sm text-emerald-700">Inscripción cubierta para este ciclo.</p>}{enrollmentFeeCoverage === "uncovered" && <p className="mt-1 text-sm text-muted-foreground">Debe generar inscripción.</p>}{enrollmentFeeCoverage === "error" && <p className="mt-1 text-sm text-destructive">No pudimos consultar la cobertura de inscripción.</p>}</div>{enrollmentFeeCoverage === "uncovered" && <><div className="grid gap-2"><Choice label="Completa" checked={enrollmentFeeMode === "FULL"} onChange={() => setEnrollmentFeeMode("FULL")} /><Choice label="Proporcional" checked={enrollmentFeeMode === "PROPORTIONAL"} onChange={() => setEnrollmentFeeMode("PROPORTIONAL")} /></div>{enrollmentFeeMode === "PROPORTIONAL" && <Field label="Monto de inscripción"><Input inputMode="decimal" value={enrollmentFeeAmount} onChange={(event) => setEnrollmentFeeAmount(event.target.value)} placeholder="0.00" /></Field>}</>}</div><Field label="Motivo"><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica el motivo de la reactivación" rows={3} /></Field></section>
}

function ReactivationReview({ group, reactivatedOn, economicStartOn, isPartial, tuitionMode, tuitionAmount, enrollmentFeeCoverage, enrollmentFeeMode, enrollmentFeeAmount, reason }: {
  group: GroupOption | null
  reactivatedOn: string
  economicStartOn: string
  isPartial: boolean
  tuitionMode: "FULL" | "PROPORTIONAL"
  tuitionAmount: string
  enrollmentFeeCoverage: "loading" | "covered" | "uncovered" | "error" | null
  enrollmentFeeMode: "FULL" | "PROPORTIONAL"
  enrollmentFeeAmount: string
  reason: string
}) {
  const tuition = isPartial ? `${tuitionMode === "FULL" ? "Completa" : "Proporcional"}${tuitionAmount ? ` · ${formatCurrency(Number(tuitionAmount))}` : ""}` : "Inicio de periodo · colegiatura vigente"
  const fee = enrollmentFeeCoverage === "covered"
    ? "Inscripción cubierta para este ciclo"
    : enrollmentFeeMode === "FULL"
      ? "Inscripción completa"
      : `Inscripción proporcional${enrollmentFeeAmount ? ` · ${formatCurrency(Number(enrollmentFeeAmount))}` : ""}`

  return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Revisión de reactivación</h2><p className="mt-1 text-sm text-muted-foreground">Confirma la reactivación financiera y administrativa.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Fecha de reingreso" value={formatDate(reactivatedOn)} /><Summary label="Inicio económico" value={formatDate(economicStartOn)} /><Summary label="Grupo" value={group ? getEnrollmentGroupLabel(group) : "Sin grupo"} /><Summary label="Plan" value="12 pagos" /><Summary label="Primer periodo" value={tuition} /><Summary label="Inscripción" value={fee} /><Summary label="Motivo" value={reason} /></dl></section>
}

function RegularizationForm({ enrollment, economicStartOn, setEconomicStartOn, amount, setAmount, dueDate, setDueDate, beforeFirstPeriod, isPartial, needsAmount, coveragePeriod, reason, setReason }: {
  enrollment: EnrollmentListItem
  economicStartOn: string
  setEconomicStartOn: (value: string) => void
  amount: string
  setAmount: (value: string) => void
  dueDate: string
  setDueDate: (value: string) => void
  beforeFirstPeriod: boolean
  isPartial: boolean
  needsAmount: boolean
  coveragePeriod: { year: number; month: number; dueDate: string } | null
  reason: string
  setReason: (value: string) => void
}) {
  return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Regularizar inicio financiero</h2><p className="mt-1 text-sm text-muted-foreground">Ajusta el inicio económico de la matrícula activa.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Inicio actual" value={formatDate(enrollment.economicStartOn)} /><Summary label="Alumno" value={enrollment.student.fullName} /></dl><Field label="Nuevo inicio económico"><Input type="date" min={enrollment.enrolledOn > enrollment.cycle.startsOn ? enrollment.enrolledOn : enrollment.cycle.startsOn} max={enrollment.cycle.endsOn} value={economicStartOn} onChange={(event) => setEconomicStartOn(event.target.value)} /></Field>{needsAmount && <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4"><div><p className="text-sm font-medium">Periodo inicial</p><p className="mt-1 text-sm text-muted-foreground">{isPartial ? "Importe proporcional sobre la colegiatura individual vigente." : "Captura el importe del segmento inicial."}</p></div><Field label="Importe inicial"><Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></Field>{beforeFirstPeriod ? <div><Field label="Fecha de vencimiento"><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></Field><p className="mt-1 text-xs text-muted-foreground">Define cuándo este cargo se considerará vencido.</p></div> : <p className="text-xs text-muted-foreground">Vencimiento institucional: {coveragePeriod?.dueDate ? formatDate(coveragePeriod.dueDate) : "Sin dato"}.</p>}</div>}<div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">Esta operación puede crear, ajustar o anular obligaciones de colegiatura. Los pagos existentes no se modifican.</div><Field label="Motivo"><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica el motivo de la regularización" rows={3} /></Field></section>
}

function RegularizationReview({ enrollment, economicStartOn, amount, dueDate, beforeFirstPeriod, reason }: { enrollment: EnrollmentListItem; economicStartOn: string; amount: string; dueDate: string; beforeFirstPeriod: boolean; reason: string }) {
  return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Revisar regularización</h2><p className="mt-1 text-sm text-muted-foreground">Confirma el cambio antes de aplicarlo.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Inicio actual" value={formatDate(enrollment.economicStartOn)} /><Summary label="Nuevo inicio" value={formatDate(economicStartOn)} /><Summary label="Periodo inicial" value={amount ? "Importe inicial" : "Sin importe inicial custom"} /><Summary label="Importe inicial" value={amount ? formatCurrency(Number(amount)) : "No aplica"} />{beforeFirstPeriod && <Summary label="Vencimiento" value={formatDate(dueDate)} />}<Summary label="Motivo" value={reason} /></dl></section>
}

function Choice({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return <label className="flex min-h-10 items-center gap-3 rounded-lg border border-border px-3 text-sm font-medium"><input type="radio" checked={checked} onChange={onChange} />{label}</label>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <Label className="grid gap-2 text-sm font-medium"><span>{label}</span>{children}</Label>
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{value || "Sin dato"}</dd></div>
}

function actionLabel(mode: ActionMode) {
  return mode === "editor" ? "Editar matrícula" : mode === "plan" ? "Cambiar plan" : mode === "group" ? "Cambiar grupo" : mode === "classification" ? "Cambiar clasificación" : mode === "grade" ? "Corregir grado" : mode === "dates" ? "Corregir fechas académicas" : mode === "discount" ? "Asignar descuento" : mode === "withdrawal" ? "Dar de baja" : mode === "reactivation" ? "Reactivar matrícula" : mode === "finalization" ? "Finalizar matrícula" : mode === "graduation" ? "Marcar como egresado" : "Regularizar inicio financiero"
}

function dateInput(date: Date) { return date.toISOString().slice(0, 10) }
function formatDate(value: string) { return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)) }
function isDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime()) }
function isPartialCoverageMonth(value: string, months: Array<{ year: number; month: number }>) {
  if (!isDate(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  return day > 1 && months.some((period) => period.year === year && period.month === month)
}

const selectClass = "h-10 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted"
