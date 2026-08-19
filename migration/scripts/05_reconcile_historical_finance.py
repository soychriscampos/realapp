from pathlib import Path
from decimal import Decimal, InvalidOperation
import os
import sys

import pandas as pd
from supabase import create_client


BASE_DIR = Path(__file__).resolve().parents[1]
OUTPUT_DIR = BASE_DIR / "output"
REPORTS_DIR = BASE_DIR / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL:
    raise RuntimeError("Missing SUPABASE_URL")

if not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Missing SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
)

CYCLE_CODE = "25-26"
EXPECTED_TOTAL_PAYMENTS = Decimal("905100.00")
EXPECTED_TOTAL_ALLOCATIONS = Decimal("905100.00")
EXPECTED_TOTAL_OUTSTANDING = Decimal("466200.00")


def clean(value):
    if pd.isna(value):
        return None
    value = str(value).strip()
    return value or None


def money(value):
    if pd.isna(value):
        return Decimal("0.00")
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"))
    except InvalidOperation:
        raise ValueError(f"Invalid monetary value: {value!r}")


def money_str(value):
    return format(money(value), ".2f")


def fetch_exactly_one(table, filters, label, columns="*"):
    query = supabase.table(table).select(columns)
    for key, value in filters.items():
        query = query.eq(key, value)
    rows = query.execute().data
    if len(rows) != 1:
        raise RuntimeError(
            f"{label}: expected 1 row, found {len(rows)}. Filters: {filters}"
        )
    return rows[0]


# ----------------------------
# Load staging
# ----------------------------

balances_path = OUTPUT_DIR / "historical_charge_balances.csv"
payments_path = OUTPUT_DIR / "historical_payments.csv"
charges_path = OUTPUT_DIR / "historical_charges.csv"
allocations_path = OUTPUT_DIR / "historical_payment_allocations.csv"
students_source_path = BASE_DIR / "input" / "alumnos_rows.csv"

for path in [
    balances_path,
    payments_path,
    charges_path,
    allocations_path,
    students_source_path,
]:
    if not path.exists():
        raise RuntimeError(f"Missing required file: {path}")

balances_df = pd.read_csv(balances_path, dtype="string")
payments_df = pd.read_csv(payments_path, dtype="string")
charges_df = pd.read_csv(charges_path, dtype="string")
allocations_df = pd.read_csv(allocations_path, dtype="string")
students_source = pd.read_csv(students_source_path, dtype="string")

student_ref = {
    clean(row["id"]): {
        "student_code": clean(row["alumno_code"]),
        "full_name": clean(row["nombre_completo"]),
        "legacy_status": clean(row["estatus"]),
        "level": clean(row["nivel"]),
        "grade": clean(row["grado"]),
    }
    for _, row in students_source.iterrows()
}

staging = {
    student_id: {
        "charges_total": Decimal("0.00"),
        "payments_total": Decimal("0.00"),
        "allocations_total": Decimal("0.00"),
        "outstanding_total": Decimal("0.00"),
        "tuition_outstanding": Decimal("0.00"),
        "enrollment_outstanding": Decimal("0.00"),
        "last_payment": None,
        "payment_count": 0,
        "charge_count": 0,
        "allocation_count": 0,
    }
    for student_id in student_ref
}

for _, row in balances_df.iterrows():
    student_id = clean(row["legacy_student_id"])
    original = money(row["original_amount"])
    remaining = money(row["remaining_amount"])
    concept = clean(row["concept_code"])
    s = staging[student_id]
    s["charges_total"] += original
    s["outstanding_total"] += remaining
    s["charge_count"] += 1
    if concept == "TUITION":
        s["tuition_outstanding"] += remaining
    elif concept == "ENROLLMENT_FEE":
        s["enrollment_outstanding"] += remaining

for _, row in payments_df.iterrows():
    student_id = clean(row["legacy_student_id"])
    amount = money(row["amount"])
    received_at = clean(row["received_at"])
    s = staging[student_id]
    s["payments_total"] += amount
    s["payment_count"] += 1
    if received_at and (s["last_payment"] is None or received_at > s["last_payment"]):
        s["last_payment"] = received_at

for _, row in allocations_df.iterrows():
    student_id = clean(row["legacy_student_id"])
    s = staging[student_id]
    s["allocations_total"] += money(row["amount"])
    s["allocation_count"] += 1


# ----------------------------
# Resolve target data
# ----------------------------

cycle = fetch_exactly_one(
    "school_cycles",
    {"code": CYCLE_CODE},
    f"Cycle {CYCLE_CODE}",
    columns="id,code",
)
cycle_id = cycle["id"]

students_target = (
    supabase
    .table("students")
    .select("id,student_code,full_name,legacy_id")
    .not_.is_("legacy_id", "null")
    .execute()
    .data
)
student_target_by_legacy = {
    clean(row["legacy_id"]): row
    for row in students_target
}
legacy_by_student_id = {
    row["id"]: legacy_id
    for legacy_id, row in student_target_by_legacy.items()
}

enrollments_target = (
    supabase
    .table("enrollments")
    .select("id,student_id,status")
    .eq("cycle_id", cycle_id)
    .execute()
    .data
)
enrollment_by_student_id = {
    row["student_id"]: row
    for row in enrollments_target
}

def fetch_all_rows(query_factory, page_size=1000):
    """
    Fetch all rows from Supabase/PostgREST in pages.
    The project may cap each response at 1000 rows even when
    a larger .range() is requested.
    """
    rows = []
    start = 0

    while True:
        page = (
            query_factory()
            .range(start, start + page_size - 1)
            .execute()
            .data
        )

        rows.extend(page)

        if len(page) < page_size:
            break

        start += page_size

    return rows


charges_target = fetch_all_rows(
    lambda: (
        supabase
        .table("charges")
        .select(
            "id,student_id,financial_concept_id,coverage_year,coverage_month,"
            "original_amount,status,legacy_reference"
        )
        .eq("cycle_id", cycle_id)
    )
)

payments_target = (
    supabase
    .table("payments")
    .select("id,student_id,received_at,amount,status,payment_code,legacy_id")
    .execute()
    .data
)

allocations_target = (
    supabase
    .table("payment_allocations")
    .select("id,student_id,payment_id,charge_id,amount,reversed_at,legacy_id")
    .execute()
    .data
)

concept_rows = (
    supabase
    .table("financial_concepts")
    .select("id,code")
    .execute()
    .data
)
concept_code_by_id = {
    row["id"]: row["code"]
    for row in concept_rows
}

staging_payment_codes = {
    clean(v) for v in payments_df["payment_code"]
}
staging_allocation_keys = {
    clean(v) for v in allocations_df["legacy_allocation_key"]
}

target_migrated_payments = [
    row for row in payments_target
    if clean(row["payment_code"]) in staging_payment_codes
]

target_migrated_allocations = [
    row for row in allocations_target
    if clean(row["legacy_id"]) in staging_allocation_keys
]

target = {
    legacy_id: {
        "charges_total": Decimal("0.00"),
        "payments_total": Decimal("0.00"),
        "allocations_total": Decimal("0.00"),
        "outstanding_total": Decimal("0.00"),
        "tuition_outstanding": Decimal("0.00"),
        "enrollment_outstanding": Decimal("0.00"),
        "last_payment": None,
        "payment_count": 0,
        "charge_count": 0,
        "allocation_count": 0,
    }
    for legacy_id in student_target_by_legacy
}

for charge in charges_target:
    if charge["status"] != "ACTIVE":
        continue
    legacy_id = legacy_by_student_id.get(charge["student_id"])
    if not legacy_id:
        continue
    target[legacy_id]["charges_total"] += money(charge["original_amount"])
    target[legacy_id]["charge_count"] += 1

for payment in target_migrated_payments:
    if payment["status"] != "CONFIRMED":
        continue
    legacy_id = legacy_by_student_id.get(payment["student_id"])
    if not legacy_id:
        continue
    t = target[legacy_id]
    t["payments_total"] += money(payment["amount"])
    t["payment_count"] += 1
    received_at = clean(payment["received_at"])
    if received_at and (t["last_payment"] is None or received_at > t["last_payment"]):
        t["last_payment"] = received_at

allocated_by_charge = {}

for allocation in target_migrated_allocations:
    if allocation["reversed_at"] is not None:
        continue
    amount = money(allocation["amount"])
    allocated_by_charge[allocation["charge_id"]] = (
        allocated_by_charge.get(allocation["charge_id"], Decimal("0.00"))
        + amount
    )
    legacy_id = legacy_by_student_id.get(allocation["student_id"])
    if not legacy_id:
        continue
    target[legacy_id]["allocations_total"] += amount
    target[legacy_id]["allocation_count"] += 1

for charge in charges_target:
    if charge["status"] != "ACTIVE":
        continue
    legacy_id = legacy_by_student_id.get(charge["student_id"])
    if not legacy_id:
        continue
    original = money(charge["original_amount"])
    allocated = allocated_by_charge.get(charge["id"], Decimal("0.00"))
    remaining = original - allocated
    concept = concept_code_by_id.get(charge["financial_concept_id"])
    target[legacy_id]["outstanding_total"] += remaining
    if concept == "TUITION":
        target[legacy_id]["tuition_outstanding"] += remaining
    elif concept == "ENROLLMENT_FEE":
        target[legacy_id]["enrollment_outstanding"] += remaining


# ----------------------------
# Build per-student report
# ----------------------------

rows = []

for legacy_id, ref in student_ref.items():
    stage = staging[legacy_id]
    tgt = target.get(legacy_id, {
        "charges_total": Decimal("0.00"),
        "payments_total": Decimal("0.00"),
        "allocations_total": Decimal("0.00"),
        "outstanding_total": Decimal("0.00"),
        "tuition_outstanding": Decimal("0.00"),
        "enrollment_outstanding": Decimal("0.00"),
        "last_payment": None,
        "payment_count": 0,
        "charge_count": 0,
        "allocation_count": 0,
    })

    target_student = student_target_by_legacy.get(legacy_id)
    enrollment_status = None

    if target_student:
        enrollment = enrollment_by_student_id.get(target_student["id"])
        if enrollment:
            enrollment_status = enrollment["status"]

    diff_payments = tgt["payments_total"] - stage["payments_total"]
    diff_allocations = tgt["allocations_total"] - stage["allocations_total"]
    diff_outstanding = tgt["outstanding_total"] - stage["outstanding_total"]

    flags = []
    if ref["legacy_status"] == "BAJA":
        flags.append("BAJA")

    if tgt["outstanding_total"] == 0:
        flags.append("SALDO_CERO")
    else:
        flags.append("SALDO_PENDIENTE")

    if tgt["enrollment_outstanding"] > 0:
        flags.append("INSCRIPCION_PENDIENTE")

    if tgt["tuition_outstanding"] > 0:
        flags.append("COLEGIATURA_PENDIENTE")

    if tgt["payments_total"] == 0:
        flags.append("SIN_PAGOS")

    if diff_payments != 0:
        flags.append("DIFERENCIA_PAGOS")

    if diff_allocations != 0:
        flags.append("DIFERENCIA_APLICACIONES")

    if diff_outstanding != 0:
        flags.append("DIFERENCIA_SALDO")

    rows.append({
        "student_code": ref["student_code"],
        "full_name": ref["full_name"],
        "legacy_status": ref["legacy_status"],
        "target_enrollment_status": enrollment_status,
        "level": ref["level"],
        "grade": ref["grade"],
        "staging_charges": money_str(stage["charges_total"]),
        "target_charges": money_str(tgt["charges_total"]),
        "staging_payments": money_str(stage["payments_total"]),
        "target_payments": money_str(tgt["payments_total"]),
        "payment_difference": money_str(diff_payments),
        "staging_allocations": money_str(stage["allocations_total"]),
        "target_allocations": money_str(tgt["allocations_total"]),
        "allocation_difference": money_str(diff_allocations),
        "staging_outstanding": money_str(stage["outstanding_total"]),
        "target_outstanding": money_str(tgt["outstanding_total"]),
        "outstanding_difference": money_str(diff_outstanding),
        "tuition_outstanding": money_str(tgt["tuition_outstanding"]),
        "enrollment_outstanding": money_str(tgt["enrollment_outstanding"]),
        "last_payment": tgt["last_payment"],
        "payment_count": tgt["payment_count"],
        "charge_count": tgt["charge_count"],
        "allocation_count": tgt["allocation_count"],
        "flags": "|".join(flags),
    })

report_df = pd.DataFrame(rows)

# Numeric sort helper
report_df["_target_outstanding_num"] = report_df["target_outstanding"].astype(float)
report_df = report_df.sort_values(
    by=["_target_outstanding_num", "student_code"],
    ascending=[False, True],
).drop(columns=["_target_outstanding_num"])

difference_mask = (
    report_df["payment_difference"].astype(float).ne(0)
    | report_df["allocation_difference"].astype(float).ne(0)
    | report_df["outstanding_difference"].astype(float).ne(0)
)
differences_df = report_df[difference_mask].copy()

special_df = report_df[
    report_df["flags"].str.contains(
        "SALDO_PENDIENTE|BAJA|DIFERENCIA_",
        regex=True,
        na=False,
    )
].copy()


# ----------------------------
# Global validation
# ----------------------------

global_staging_payments = sum(
    (money(v) for v in report_df["staging_payments"]),
    Decimal("0.00"),
)
global_target_payments = sum(
    (money(v) for v in report_df["target_payments"]),
    Decimal("0.00"),
)
global_staging_allocations = sum(
    (money(v) for v in report_df["staging_allocations"]),
    Decimal("0.00"),
)
global_target_allocations = sum(
    (money(v) for v in report_df["target_allocations"]),
    Decimal("0.00"),
)
global_staging_outstanding = sum(
    (money(v) for v in report_df["staging_outstanding"]),
    Decimal("0.00"),
)
global_target_outstanding = sum(
    (money(v) for v in report_df["target_outstanding"]),
    Decimal("0.00"),
)

errors = []

if global_target_payments != EXPECTED_TOTAL_PAYMENTS:
    errors.append(
        f"Target payments expected {EXPECTED_TOTAL_PAYMENTS}, "
        f"found {global_target_payments}."
    )

if global_target_allocations != EXPECTED_TOTAL_ALLOCATIONS:
    errors.append(
        f"Target allocations expected {EXPECTED_TOTAL_ALLOCATIONS}, "
        f"found {global_target_allocations}."
    )

if global_target_outstanding != EXPECTED_TOTAL_OUTSTANDING:
    errors.append(
        f"Target outstanding expected {EXPECTED_TOTAL_OUTSTANDING}, "
        f"found {global_target_outstanding}."
    )

if global_staging_payments != global_target_payments:
    errors.append("Staging vs target payment totals differ.")

if global_staging_allocations != global_target_allocations:
    errors.append("Staging vs target allocation totals differ.")

if global_staging_outstanding != global_target_outstanding:
    errors.append("Staging vs target outstanding totals differ.")

if not differences_df.empty:
    errors.append(
        f"{len(differences_df)} students have reconciliation differences."
    )


# ----------------------------
# Write reports
# ----------------------------

full_report_path = REPORTS_DIR / "05_student_reconciliation.csv"
special_report_path = REPORTS_DIR / "05_special_review.csv"
summary_report_path = REPORTS_DIR / "05_reconciliation_summary.txt"

report_df.to_csv(full_report_path, index=False)
special_df.to_csv(special_report_path, index=False)

pending_students = report_df[
    report_df["target_outstanding"].astype(float) > 0
]
zero_students = report_df[
    report_df["target_outstanding"].astype(float) == 0
]
baja_students = report_df[
    report_df["legacy_status"] == "BAJA"
]
enrollment_pending = report_df[
    report_df["enrollment_outstanding"].astype(float) > 0
]

summary_lines = [
    "ETL 05 - Historical Reconciliation",
    "==================================",
    "",
    f"Students reviewed: {len(report_df)}",
    "",
    "MONEY",
    f"Staging payments: ${global_staging_payments:.2f}",
    f"Target payments: ${global_target_payments:.2f}",
    f"Staging allocations: ${global_staging_allocations:.2f}",
    f"Target allocations: ${global_target_allocations:.2f}",
    f"Staging outstanding: ${global_staging_outstanding:.2f}",
    f"Target outstanding: ${global_target_outstanding:.2f}",
    "",
    "STUDENTS",
    f"Outstanding balance: {len(pending_students)}",
    f"Zero balance: {len(zero_students)}",
    f"Enrollment fee pending: {len(enrollment_pending)}",
    f"BAJA: {len(baja_students)}",
    f"Reconciliation differences: {len(differences_df)}",
    "",
]

if errors:
    summary_lines.append("VALIDATION: FAILED")
    summary_lines.append("")
    summary_lines.extend(f"- {error}" for error in errors)
else:
    summary_lines.append("VALIDATION: PASS")

summary_report_path.write_text(
    "\n".join(summary_lines),
    encoding="utf-8",
)

print()
print("ETL 05 - Historical Reconciliation")
print("----------------------------------")
print(f"students reviewed:     {len(report_df)}")
print(f"students with balance: {len(pending_students)}")
print(f"students at zero:      {len(zero_students)}")
print(f"enrollment pending:    {len(enrollment_pending)}")
print(f"BAJA:                  {len(baja_students)}")
print()
print(f"payments:              ${global_target_payments:.2f}")
print(f"allocations:           ${global_target_allocations:.2f}")
print(f"outstanding:           ${global_target_outstanding:.2f}")
print(f"differences:           {len(differences_df)}")
print()
print(f"Full report: {full_report_path}")
print(f"Special review: {special_report_path}")
print(f"Summary: {summary_report_path}")

if errors:
    print()
    print("VALIDATION: FAILED")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print()
print("VALIDATION: PASS")
print("Historical staging and Supabase reconcile.")
