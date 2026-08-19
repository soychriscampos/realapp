from pathlib import Path
from decimal import Decimal, InvalidOperation
import os
import pandas as pd
from supabase import create_client


BASE_DIR = Path(__file__).resolve().parents[1]
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


def fetch_all_rows(query_factory, page_size=1000):
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


cycle = fetch_exactly_one(
    "school_cycles",
    {"code": CYCLE_CODE},
    f"Cycle {CYCLE_CODE}",
    columns="id,code",
)
cycle_id = cycle["id"]


students = fetch_all_rows(
    lambda: (
        supabase
        .table("students")
        .select("id,student_code,full_name,legacy_id")
    )
)

students_by_id = {
    row["id"]: row
    for row in students
}


enrollments = fetch_all_rows(
    lambda: (
        supabase
        .table("enrollments")
        .select("id,student_id,status,cycle_id")
        .eq("cycle_id", cycle_id)
    )
)

enrollment_by_student_id = {
    row["student_id"]: row
    for row in enrollments
}


concepts = fetch_all_rows(
    lambda: (
        supabase
        .table("financial_concepts")
        .select("id,code")
    )
)

concept_code_by_id = {
    row["id"]: row["code"]
    for row in concepts
}


charges = fetch_all_rows(
    lambda: (
        supabase
        .table("charges")
        .select(
            "id,student_id,financial_concept_id,"
            "coverage_year,coverage_month,"
            "original_amount,due_date,status,legacy_reference"
        )
        .eq("cycle_id", cycle_id)
    )
)


allocations = fetch_all_rows(
    lambda: (
        supabase
        .table("payment_allocations")
        .select("id,student_id,charge_id,amount,reversed_at")
    )
)


allocated_by_charge = {}

for allocation in allocations:
    if allocation["reversed_at"] is not None:
        continue

    charge_id = allocation["charge_id"]
    allocated_by_charge[charge_id] = (
        allocated_by_charge.get(
            charge_id,
            Decimal("0.00"),
        )
        + money(allocation["amount"])
    )


student_debt = {}

for charge in charges:
    if charge["status"] != "ACTIVE":
        continue

    student_id = charge["student_id"]
    original = money(charge["original_amount"])
    allocated = allocated_by_charge.get(
        charge["id"],
        Decimal("0.00"),
    )
    remaining = original - allocated

    if remaining <= 0:
        continue

    concept = concept_code_by_id.get(
        charge["financial_concept_id"],
        "UNKNOWN",
    )

    info = student_debt.setdefault(
        student_id,
        {
            "total_outstanding": Decimal("0.00"),
            "tuition_outstanding": Decimal("0.00"),
            "enrollment_outstanding": Decimal("0.00"),
            "other_outstanding": Decimal("0.00"),
            "open_charge_count": 0,
            "oldest_due_date": None,
            "latest_due_date": None,
            "open_periods": [],
        },
    )

    info["total_outstanding"] += remaining
    info["open_charge_count"] += 1

    due_date = clean(charge["due_date"])

    if due_date:
        if (
            info["oldest_due_date"] is None
            or due_date < info["oldest_due_date"]
        ):
            info["oldest_due_date"] = due_date

        if (
            info["latest_due_date"] is None
            or due_date > info["latest_due_date"]
        ):
            info["latest_due_date"] = due_date

    if concept == "TUITION":
        info["tuition_outstanding"] += remaining

        year = charge["coverage_year"]
        month = charge["coverage_month"]

        if year and month:
            info["open_periods"].append(
                f"{int(year):04d}-{int(month):02d}"
            )

    elif concept == "ENROLLMENT_FEE":
        info["enrollment_outstanding"] += remaining

    else:
        info["other_outstanding"] += remaining


rows = []

for student_id, debt in student_debt.items():
    student = students_by_id.get(student_id)

    if not student:
        continue

    enrollment = enrollment_by_student_id.get(
        student_id
    )

    flags = []

    if debt["enrollment_outstanding"] > 0:
        flags.append("INSCRIPCION_PENDIENTE")

    if debt["tuition_outstanding"] > 0:
        flags.append("COLEGIATURA_PENDIENTE")

    if enrollment and enrollment["status"] == "BAJA":
        flags.append("BAJA")

    if len(debt["open_periods"]) >= 3:
        flags.append("3_O_MAS_PERIODOS")

    rows.append(
        {
            "student_code":
                student["student_code"],

            "full_name":
                student["full_name"],

            "enrollment_status":
                (
                    enrollment["status"]
                    if enrollment
                    else None
                ),

            "total_outstanding":
                f"{debt['total_outstanding']:.2f}",

            "tuition_outstanding":
                f"{debt['tuition_outstanding']:.2f}",

            "enrollment_outstanding":
                f"{debt['enrollment_outstanding']:.2f}",

            "other_outstanding":
                f"{debt['other_outstanding']:.2f}",

            "open_charge_count":
                debt["open_charge_count"],

            "open_tuition_periods":
                ",".join(
                    sorted(
                        set(
                            debt["open_periods"]
                        )
                    )
                ),

            "oldest_due_date":
                debt["oldest_due_date"],

            "latest_due_date":
                debt["latest_due_date"],

            "flags":
                "|".join(flags),
        }
    )


df = pd.DataFrame(rows)

if df.empty:
    raise RuntimeError(
        "No outstanding balances found."
    )

df["_sort_total"] = df[
    "total_outstanding"
].astype(float)

df = (
    df.sort_values(
        by=[
            "_sort_total",
            "student_code",
        ],
        ascending=[
            False,
            True,
        ],
    )
    .drop(
        columns=[
            "_sort_total"
        ]
    )
)


total_outstanding = sum(
    (
        money(value)
        for value in df[
            "total_outstanding"
        ]
    ),
    Decimal("0.00"),
)

tuition_outstanding = sum(
    (
        money(value)
        for value in df[
            "tuition_outstanding"
        ]
    ),
    Decimal("0.00"),
)

enrollment_outstanding = sum(
    (
        money(value)
        for value in df[
            "enrollment_outstanding"
        ]
    ),
    Decimal("0.00"),
)

other_outstanding = sum(
    (
        money(value)
        for value in df[
            "other_outstanding"
        ]
    ),
    Decimal("0.00"),
)


full_path = (
    REPORTS_DIR
    / "06_outstanding_students.csv"
)

high_priority_path = (
    REPORTS_DIR
    / "06_high_priority_review.csv"
)

summary_path = (
    REPORTS_DIR
    / "06_outstanding_summary.txt"
)

df.to_csv(
    full_path,
    index=False,
)


high_priority = df[
    (
        df["enrollment_outstanding"]
        .astype(float)
        > 0
    )
    |
    (
        df["flags"]
        .str.contains(
            "BAJA|3_O_MAS_PERIODOS",
            regex=True,
            na=False,
        )
    )
].copy()

high_priority.to_csv(
    high_priority_path,
    index=False,
)


summary_lines = [
    "ETL 06 - Outstanding Balance Review",
    "===================================",
    "",
    f"Cycle: {CYCLE_CODE}",
    f"Students with balance: {len(df)}",
    "",
    "MONEY",
    f"Total outstanding: ${total_outstanding:.2f}",
    f"Tuition outstanding: ${tuition_outstanding:.2f}",
    f"Enrollment outstanding: ${enrollment_outstanding:.2f}",
    f"Other outstanding: ${other_outstanding:.2f}",
    "",
    "REVIEW",
    f"High priority rows: {len(high_priority)}",
    f"Enrollment pending: {(df['enrollment_outstanding'].astype(float) > 0).sum()}",
    f"BAJA with balance: {df['flags'].str.contains('BAJA', na=False).sum()}",
    f"3+ tuition periods open: {df['flags'].str.contains('3_O_MAS_PERIODOS', na=False).sum()}",
    "",
    "Top 10 balances:",
]

for _, row in df.head(10).iterrows():
    summary_lines.append(
        f"- {row['student_code']} | "
        f"{row['full_name']} | "
        f"${row['total_outstanding']}"
    )


summary_path.write_text(
    "\n".join(summary_lines),
    encoding="utf-8",
)


print()
print("ETL 06 - Outstanding Balance Review")
print("-----------------------------------")
print(f"students with balance: {len(df)}")
print()
print(f"total outstanding:     ${total_outstanding:.2f}")
print(f"tuition outstanding:   ${tuition_outstanding:.2f}")
print(f"enrollment outstanding:${enrollment_outstanding:.2f}")
print(f"other outstanding:     ${other_outstanding:.2f}")
print()
print(f"high priority rows:    {len(high_priority)}")
print()
print(f"Full report: {full_path}")
print(f"High priority: {high_priority_path}")
print(f"Summary: {summary_path}")
