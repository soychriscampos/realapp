import {
  Document,
  Page,
  Text,
  View,
} from "@react-pdf/renderer"

import type {
  StudentAccountMovement,
  StudentAccountSummary,
  StudentChargeBalance,
} from "@/lib/admin/student-account"
import type { StudentDetail } from "@/lib/admin/students"
import { FinancialDocumentFooter, FinancialDocumentHeader, financialPdfStyles } from "./components"
import { formatCurrencyMXN, formatDate } from "./format"
import { renderFinancialPdf } from "./render"

type AccountStatementStudent = Pick<StudentDetail, "fullName" | "studentCode"> & {
  enrollment: Pick<NonNullable<StudentDetail["enrollment"]>, "cycle" | "educationLevel" | "gradeLevel" | "group"> | null
}

type AccountStatementCharge = Pick<
  StudentChargeBalance,
  | "id"
  | "cycleId"
  | "cycleCode"
  | "conceptName"
  | "dueDate"
  | "effectiveAmount"
  | "totalApplied"
  | "outstandingAmount"
  | "isPaid"
  | "isOverdue"
>

type AccountStatementMovement = Pick<
  StudentAccountMovement,
  | "movementOn"
  | "id"
  | "parentId"
  | "description"
  | "movementType"
  | "receivedByNameSnapshot"
  | "debit"
  | "credit"
  | "status"
>

export type AccountStatementPdfData = {
  student: AccountStatementStudent
  generatedAt: string | Date
  summary: StudentAccountSummary
  charges: AccountStatementCharge[]
  movements: AccountStatementMovement[]
}

export function AccountStatementDocument({ data }: { data: AccountStatementPdfData }) {
  const cutoff = dateKey(data.generatedAt)
  const currentCycleId = data.student.enrollment?.cycle.id ?? null
  const relevantCycleIds = getRelevantCycleIds(data.charges, currentCycleId, cutoff)
  const charges = data.charges.filter(
    (charge) => relevantCycleIds.has(charge.cycleId) && dateKey(charge.dueDate) <= cutoff
  )
  const chargeIds = new Set(charges.map((charge) => charge.id))
  const movements = data.movements.filter(
    (movement) =>
      movement.status !== "VOID" &&
      dateKey(movement.movementOn) <= cutoff &&
      isMovementRelevantToCharges(movement, chargeIds)
  )
  const previousCycleCodes = Array.from(
    new Set(charges
      .filter((charge) => charge.cycleId !== currentCycleId)
      .map((charge) => charge.cycleCode)
      .filter(Boolean))
  )

  return (
    <Document title="Estado de cuenta">
      <Page size="A4" style={financialPdfStyles.page}>
        <FinancialDocumentHeader title="Estado de cuenta" />

        <View style={styles.studentBlock}>
          <View style={styles.studentColumn}>
            <Text style={styles.label}>Alumno</Text>
            <Text style={styles.value}>{data.student.fullName}</Text>
            {data.student.studentCode ? (
              <Text style={styles.muted}>Matrícula: {data.student.studentCode}</Text>
            ) : null}
          </View>
          <View style={styles.studentColumn}>
            <Text style={styles.label}>Ciclo</Text>
            <Text style={styles.value}>{data.student.enrollment?.cycle.name ?? ""}</Text>
            <Text style={styles.muted}>Fecha de corte: {formatDate(data.generatedAt)}</Text>
          </View>
        </View>

        <View style={styles.academicRow}>
          <Text>Nivel: {data.student.enrollment?.educationLevel.name ?? ""}</Text>
          <Text>Grado: {data.student.enrollment?.gradeLevel.name ?? ""}</Text>
          <Text>Grupo: {data.student.enrollment?.group?.code ?? ""}</Text>
        </View>
        {previousCycleCodes.length ? (
          <Text style={styles.muted}>Ciclos anteriores con adeudo: {previousCycleCodes.join(", ")}</Text>
        ) : null}

        <Text style={styles.sectionTitle}>Resumen financiero</Text>
        <View style={styles.summaryGrid}>
          <SummaryItem label="Saldo" value={data.summary.overdueTotal} />
          <SummaryItem label="Saldo a favor" value={data.summary.availableCredit} />
        </View>

        <Text style={styles.sectionTitle}>Cargos</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.chargeConcept}>Concepto</Text>
            <Text style={styles.chargeCycle}>Ciclo</Text>
            <Text style={styles.chargeDate}>Vencimiento</Text>
            <Text style={styles.amount}>Importe</Text>
            <Text style={styles.amount}>Pendiente</Text>
          </View>
          {charges.map((charge, index) => (
            <View key={`${charge.cycleCode}-${charge.conceptName}-${charge.dueDate}-${index}`} style={styles.tableRow}>
              <Text style={styles.chargeConcept}>{charge.conceptName}</Text>
              <Text style={styles.chargeCycle}>{charge.cycleCode}</Text>
              <Text style={styles.chargeDate}>{formatDate(charge.dueDate)}</Text>
              <Text style={styles.amount}>{formatCurrencyMXN(Number(charge.effectiveAmount))}</Text>
              <Text style={styles.amount}>{formatCurrencyMXN(Number(charge.outstandingAmount))}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Movimientos</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.movementDate}>Fecha</Text>
            <Text style={styles.movementDescription}>Descripción</Text>
            <Text style={styles.amount}>Cargo</Text>
            <Text style={styles.amount}>Abono</Text>
          </View>
          {movements.map((movement, index) => (
            <View key={`${movement.movementOn}-${movement.description}-${index}`} style={styles.tableRow}>
              <Text style={styles.movementDate}>{formatDate(movement.movementOn)}</Text>
              <Text style={styles.movementDescription}>{movement.description}</Text>
              <Text style={styles.amount}>{formatCurrencyMXN(Number(movement.debit))}</Text>
              <Text style={styles.amount}>{formatCurrencyMXN(Number(movement.credit))}</Text>
            </View>
          ))}
        </View>

        <FinancialDocumentFooter />
      </Page>
    </Document>
  )
}

export function generateAccountStatementPdf(data: AccountStatementPdfData): Promise<Buffer> {
  return renderFinancialPdf(<AccountStatementDocument data={data} />)
}

function getRelevantCycleIds(
  charges: AccountStatementCharge[],
  currentCycleId: string | null,
  cutoff: string
) {
  const cycleIds = new Set<string>()
  if (currentCycleId) cycleIds.add(currentCycleId)

  for (const charge of charges) {
    if (
      charge.cycleId !== currentCycleId &&
      dateKey(charge.dueDate) <= cutoff &&
      Number(charge.outstandingAmount) > 0
    ) {
      cycleIds.add(charge.cycleId)
    }
  }

  return cycleIds
}

function isMovementRelevantToCharges(
  movement: AccountStatementMovement,
  chargeIds: Set<string>
) {
  if (movement.movementType === "CHARGE") return chargeIds.has(movement.id)
  if (movement.parentId) return chargeIds.has(movement.parentId)
  return true
}

function dateKey(value: string | Date) {
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, "0")
    const day = String(value.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  return value.slice(0, 10)
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.summaryValue}>{formatCurrencyMXN(Number(value))}</Text>
    </View>
  )
}

const styles = {
  studentBlock: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginBottom: 12,
  },
  studentColumn: {
    width: "48%",
  },
  label: {
    marginBottom: 3,
    fontSize: 8,
    color: "#68737d",
    textTransform: "uppercase" as const,
  },
  value: {
    fontSize: 11,
    fontWeight: 700,
  },
  muted: {
    marginTop: 3,
    fontSize: 9,
    color: "#68737d",
  },
  academicRow: {
    flexDirection: "row" as const,
    gap: 18,
    paddingVertical: 8,
    marginBottom: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e3e7eb",
    fontSize: 9,
  },
  sectionTitle: {
    marginTop: 14,
    marginBottom: 7,
    fontSize: 11,
    fontWeight: 700,
  },
  summaryGrid: {
    flexDirection: "row" as const,
    gap: 8,
    marginBottom: 2,
  },
  summaryItem: {
    flexGrow: 1,
    flexBasis: 0,
    padding: 9,
    borderWidth: 1,
    borderColor: "#d9dee5",
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: 700,
  },
  table: {
    borderWidth: 1,
    borderColor: "#d9dee5",
  },
  tableRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    minHeight: 24,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: "#e3e7eb",
    fontSize: 8,
  },
  tableHeader: {
    borderTopWidth: 0,
    backgroundColor: "#f4f6f8",
    fontWeight: 700,
  },
  chargeConcept: { width: "27%" },
  chargeCycle: { width: "13%" },
  chargeDate: { width: "17%" },
  amount: { width: "21.5%", textAlign: "right" as const },
  movementDate: { width: "16%" },
  movementDescription: { width: "34%" },
}
