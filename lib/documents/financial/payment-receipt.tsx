import { Document, Page, Text, View } from "@react-pdf/renderer"

import type { StudentPaymentDetail } from "@/lib/admin/student-account"
import type { StudentDetail } from "@/lib/admin/students"
import { FinancialDocumentFooter, FinancialDocumentHeader, financialPdfStyles } from "./components"
import { formatCurrencyMXN, formatDate } from "./format"
import { renderFinancialPdf } from "./render"

type PaymentReceiptStudent = Pick<StudentDetail, "fullName" | "studentCode">

type PaymentReceiptPayment = Pick<
  StudentPaymentDetail,
  | "id"
  | "amount"
  | "receivedAt"
  | "methodName"
  | "receivedByName"
  | "bankReference"
  | "receiptVisibleNote"
> & {
  allocations: Array<{
    conceptName: string
    cycleCode: string
    amount: string
  }>
}

export type PaymentReceiptPdfData = {
  student: PaymentReceiptStudent
  payment: PaymentReceiptPayment
}

export function PaymentReceiptDocument({ data }: { data: PaymentReceiptPdfData }) {
  return (
    <Document title="Comprobante de pago">
      <Page size="A4" style={financialPdfStyles.page}>
        <FinancialDocumentHeader title="Comprobante de pago" />

        <View style={styles.studentBlock}>
          <View style={styles.studentColumn}>
            <Text style={styles.label}>Alumno</Text>
            <Text style={styles.value}>{data.student.fullName}</Text>
            {data.student.studentCode ? (
              <Text style={styles.muted}>Matrícula: {data.student.studentCode}</Text>
            ) : null}
          </View>
          <View style={styles.studentColumn}>
            <Text style={styles.label}>Folio</Text>
            <Text style={styles.value}>{data.payment.id}</Text>
            <Text style={styles.muted}>Fecha: {formatDate(data.payment.receivedAt)}</Text>
          </View>
        </View>

        <View style={styles.amountBlock}>
          <Text style={styles.label}>Monto total</Text>
          <Text style={styles.amountValue}>{formatCurrencyMXN(Number(data.payment.amount))}</Text>
        </View>

        <View style={styles.detailsTable}>
          <DetailRow label="Método de pago" value={data.payment.methodName} />
          {data.payment.bankReference ? (
            <DetailRow label="Referencia" value={data.payment.bankReference} />
          ) : null}
          <DetailRow label="Recibió" value={data.payment.receivedByName} />
        </View>

        <Text style={styles.sectionTitle}>Aplicaciones del pago</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.applicationLabel}>Cargo</Text>
            <Text style={styles.applicationAmount}>Importe aplicado</Text>
          </View>
          {data.payment.allocations.map((allocation, index) => (
            <View key={`${allocation.conceptName}-${allocation.cycleCode}-${index}`} style={styles.tableRow}>
              <View style={styles.applicationLabel}>
                <Text>{allocation.conceptName}</Text>
                <Text style={styles.muted}>{allocation.cycleCode}</Text>
              </View>
              <Text style={styles.applicationAmount}>
                {formatCurrencyMXN(Number(allocation.amount))}
              </Text>
            </View>
          ))}
        </View>

        {data.payment.receiptVisibleNote ? (
          <View style={styles.noteBlock}>
            <Text style={styles.label}>Nota</Text>
            <Text>{data.payment.receiptVisibleNote}</Text>
          </View>
        ) : null}

        <FinancialDocumentFooter />
      </Page>
    </Document>
  )
}

export function generatePaymentReceiptPdf(data: PaymentReceiptPdfData): Promise<Buffer> {
  return renderFinancialPdf(<PaymentReceiptDocument data={data} />)
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  )
}

const styles = {
  studentBlock: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginBottom: 22,
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
  amountBlock: {
    paddingVertical: 16,
    marginBottom: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#d9dee5",
  },
  amountValue: {
    fontSize: 24,
    fontWeight: 700,
  },
  detailsTable: {
    borderTopWidth: 1,
    borderTopColor: "#e3e7eb",
  },
  detailRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#e3e7eb",
  },
  detailValue: {
    width: "62%",
    textAlign: "right" as const,
  },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 7,
    fontSize: 11,
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
    paddingVertical: 6,
    paddingHorizontal: 7,
    borderTopWidth: 1,
    borderTopColor: "#e3e7eb",
    fontSize: 9,
  },
  tableHeader: {
    borderTopWidth: 0,
    backgroundColor: "#f4f6f8",
    fontWeight: 700,
  },
  applicationLabel: {
    flexGrow: 1,
  },
  applicationAmount: {
    width: "32%",
    textAlign: "right" as const,
  },
  noteBlock: {
    padding: 10,
    marginTop: 22,
    borderWidth: 1,
    borderColor: "#d9dee5",
  },
}
