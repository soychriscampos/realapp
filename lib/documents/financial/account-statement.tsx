import {
  Document,
  Page,
  Text,
  View,
} from "@react-pdf/renderer"

import type {
  StudentAccountMovement,
  StudentChargeBalance,
} from "@/lib/admin/student-account"
import type { StudentDetail } from "@/lib/admin/students"
import { FinancialDocumentFooter, FinancialDocumentHeader, financialPdfStyles } from "./components"
import { formatCurrencyMXN, formatDate } from "./format"
import { renderFinancialPdf } from "./render"

type AccountStatementStudent = Pick<StudentDetail, "fullName" | "studentCode"> & {
  enrollment: Pick<NonNullable<StudentDetail["enrollment"]>, "cycle" | "educationLevel" | "gradeLevel" | "group"> | null
}

export type AccountStatementCharge = Pick<
  StudentChargeBalance,
  | "id"
  | "cycleId"
  | "cycleCode"
  | "conceptCode"
  | "conceptName"
  | "coverageYear"
  | "coverageMonth"
  | "dueDate"
  | "outstandingAmount"
> & { paidAmount: string }

export type AccountStatementMovement = Pick<
  StudentAccountMovement,
  | "movementOn"
  | "recordedAt"
  | "description"
  | "debit"
  | "credit"
> & { cycleCode: string }

export type AccountStatementPdfData = {
  student: AccountStatementStudent
  generatedAt: string | Date
  currentCycleId: string | null
  status: "AL CORRIENTE" | "ADEUDO"
  pendingAmount: string | null
  charges: AccountStatementCharge[]
  movements: AccountStatementMovement[]
}

export function AccountStatementDocument({ data }: { data: AccountStatementPdfData }) {
  const currentCharges = data.charges.filter((charge) => charge.cycleId === data.currentCycleId)
  const previousCharges = data.charges.filter((charge) => charge.cycleId !== data.currentCycleId)

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
        <Text style={styles.status}>ESTADO: {data.status}</Text>

        <Text style={styles.sectionTitle}>Resumen financiero</Text>
        {data.pendingAmount !== null ? (
          <View style={styles.summaryGrid}>
            <SummaryItem label="PENDIENTE DE PAGO" value={data.pendingAmount} />
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Conceptos del ciclo actual</Text>
        <ChargeTable charges={currentCharges} />

        {previousCharges.length ? (
          <>
            <Text style={styles.sectionTitle}>Adeudos de ciclos anteriores</Text>
            <ChargeTable charges={previousCharges} />
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Historial de pagos</Text>
        {data.movements.length ? (
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.movementDate}>Fecha</Text>
              <Text style={styles.movementDescription}>Descripción</Text>
              <Text style={styles.amount}>Abono</Text>
            </View>
            {data.movements.map((movement, index) => (
              <View key={`${movement.movementOn}-${movement.description}-${index}`} style={styles.tableRow}>
                <Text style={styles.movementDate}>{formatDate(movement.movementOn)}</Text>
                <Text style={styles.movementDescription}>{movement.description}</Text>
                <Text style={styles.amount}>{formatCurrencyMXN(Number(movement.credit))}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyState}>Aún no hay pagos registrados para este alumno.</Text>
        )}

        <FinancialDocumentFooter />
      </Page>
    </Document>
  )
}

export function generateAccountStatementPdf(data: AccountStatementPdfData): Promise<Buffer> {
  return renderFinancialPdf(<AccountStatementDocument data={data} />)
}

function ChargeTable({ charges }: { charges: AccountStatementCharge[] }) {
  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHeader]}>
        <Text style={styles.chargeConcept}>Concepto</Text>
        <Text style={styles.chargeCycle}>Ciclo</Text>
        <Text style={styles.chargeDate}>Vencimiento</Text>
        <Text style={styles.amount}>Pagado</Text>
        <Text style={styles.amount}>Pendiente</Text>
      </View>
      {charges.map((charge, index) => (
        <View key={`${charge.cycleCode}-${charge.conceptName}-${charge.dueDate}-${index}`} style={styles.tableRow}>
          <View style={styles.chargeConcept}>
            {chargeLabel(charge).period ? <Text style={styles.chargePeriod}>{chargeLabel(charge).period}</Text> : null}
            <Text>{chargeLabel(charge).name}</Text>
          </View>
          <Text style={styles.chargeCycle}>{charge.cycleCode}</Text>
          <Text style={styles.chargeDate}>{formatDate(charge.dueDate)}</Text>
          <Text style={styles.amount}>{formatCurrencyMXN(Number(charge.paidAmount))}</Text>
          <Text style={styles.amount}>{formatCurrencyMXN(Number(charge.outstandingAmount))}</Text>
        </View>
      ))}
    </View>
  )
}

function chargeLabel(charge: AccountStatementCharge) {
  if (
    charge.conceptCode === "TUITION" &&
    charge.coverageYear &&
    charge.coverageMonth &&
    charge.coverageMonth >= 1 &&
    charge.coverageMonth <= 12
  ) {
    const month = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"][charge.coverageMonth - 1]
    return { period: `${month} ${String(charge.coverageYear).slice(-2)}`, name: charge.conceptName }
  }

  return { period: null, name: charge.conceptName }
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
  status: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: 700,
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
  chargePeriod: { fontWeight: 700 },
  emptyState: {
    padding: 8,
    borderWidth: 1,
    borderColor: "#d9dee5",
    fontSize: 9,
    color: "#68737d",
  },
}
