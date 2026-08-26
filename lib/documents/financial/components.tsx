import { Image, StyleSheet, Text, View } from "@react-pdf/renderer"

export const financialPdfStyles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingRight: 40,
    paddingBottom: 42,
    paddingLeft: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#17202a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#d9dee5",
  },
  headerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logo: {
    width: 32,
    height: 32,
  },
  schoolName: {
    fontSize: 12,
    fontWeight: 700,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
  },
  footer: {
    position: "absolute",
    right: 40,
    bottom: 20,
    left: 40,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#d9dee5",
    textAlign: "right",
    fontSize: 8,
    color: "#68737d",
  },
})

export type FinancialDocumentHeaderProps = {
  title: string
  logo?: string
}

export function FinancialDocumentHeader({ title, logo }: FinancialDocumentHeaderProps) {
  return (
    <View style={financialPdfStyles.header}>
      <View style={financialPdfStyles.headerBrand}>
        {logo ? (
          // React PDF's Image component does not expose the HTML alt prop.
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={logo} style={financialPdfStyles.logo} />
        ) : null}
        <Text style={financialPdfStyles.schoolName}>Colegio REAL de Escuinapa</Text>
      </View>
      <Text style={financialPdfStyles.title}>{title}</Text>
    </View>
  )
}

export function FinancialDocumentFooter() {
  return (
    <Text
      fixed
      style={financialPdfStyles.footer}
      render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
    />
  )
}
