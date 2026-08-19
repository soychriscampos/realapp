from pathlib import Path
from decimal import Decimal, InvalidOperation
import os
import sys

import pandas as pd
from supabase import create_client


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]
OUTPUT_DIR = BASE_DIR / "output"
REPORTS_DIR = BASE_DIR / "reports"

REPORTS_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# SUPABASE
# ============================================================

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


# ============================================================
# CONSTANTS
# ============================================================

CYCLE_CODE = "25-26"

EXPECTED_COUNTS = {
    "agreements": 195,
    "charges": 1210,       # 1128 tuition + 82 enrollment
    "payments": 571,
    "allocations": 702,
}

EXPECTED_PAYMENT_TOTAL = Decimal("905100.00")
EXPECTED_ALLOCATION_TOTAL = Decimal("905100.00")


# ============================================================
# HELPERS
# ============================================================

def clean(value):
    if pd.isna(value):
        return None

    value = str(value).strip()

    if value == "":
        return None

    return value


def money(value):
    if pd.isna(value):
        return Decimal("0.00")

    try:
        return Decimal(str(value)).quantize(
            Decimal("0.01")
        )
    except InvalidOperation:
        raise ValueError(
            f"Invalid monetary value: {value!r}"
        )


def fetch_exactly_one(table, filters, label, columns="*"):
    query = supabase.table(table).select(columns)

    for key, value in filters.items():
        query = query.eq(key, value)

    rows = query.execute().data

    if len(rows) == 0:
        raise RuntimeError(
            f"{label}: expected 1 row, found 0. "
            f"Filters: {filters}"
        )

    if len(rows) > 1:
        raise RuntimeError(
            f"{label}: expected 1 row, found {len(rows)}. "
            f"Filters: {filters}"
        )

    return rows[0]


def fetch_zero_or_one(table, filters, label, columns="*"):
    query = supabase.table(table).select(columns)

    for key, value in filters.items():
        query = query.eq(key, value)

    rows = query.execute().data

    if len(rows) > 1:
        raise RuntimeError(
            f"{label}: duplicate target rows found. "
            f"Filters: {filters}"
        )

    if not rows:
        return None

    return rows[0]


def assert_file(path):
    if not path.exists():
        raise RuntimeError(
            f"Missing staging file: {path}"
        )


# ============================================================
# LOAD STAGING FILES
# ============================================================

agreements_path = (
    OUTPUT_DIR
    / "historical_financial_agreements.csv"
)

charges_path = (
    OUTPUT_DIR
    / "historical_charges.csv"
)

payments_path = (
    OUTPUT_DIR
    / "historical_payments.csv"
)

allocations_path = (
    OUTPUT_DIR
    / "historical_payment_allocations.csv"
)

balances_path = (
    OUTPUT_DIR
    / "historical_charge_balances.csv"
)

for path in [
    agreements_path,
    charges_path,
    payments_path,
    allocations_path,
    balances_path,
]:
    assert_file(path)


agreements_df = pd.read_csv(
    agreements_path,
    dtype="string",
)

charges_df = pd.read_csv(
    charges_path,
    dtype="string",
)

payments_df = pd.read_csv(
    payments_path,
    dtype="string",
)

allocations_df = pd.read_csv(
    allocations_path,
    dtype="string",
)

balances_df = pd.read_csv(
    balances_path,
    dtype="string",
)


# ============================================================
# PRE-FLIGHT VALIDATION
# ============================================================

actual_counts = {
    "agreements": len(agreements_df),
    "charges": len(charges_df),
    "payments": len(payments_df),
    "allocations": len(allocations_df),
}

for name, expected in EXPECTED_COUNTS.items():
    actual = actual_counts[name]

    if actual != expected:
        raise RuntimeError(
            f"{name}: expected {expected}, found {actual}. "
            "Run ETL 03 again and review before loading."
        )


staging_payment_total = sum(
    (money(v) for v in payments_df["amount"]),
    Decimal("0.00"),
)

staging_allocation_total = sum(
    (money(v) for v in allocations_df["amount"]),
    Decimal("0.00"),
)

if staging_payment_total != EXPECTED_PAYMENT_TOTAL:
    raise RuntimeError(
        "Unexpected staging payment total: "
        f"{staging_payment_total}"
    )

if staging_allocation_total != EXPECTED_ALLOCATION_TOTAL:
    raise RuntimeError(
        "Unexpected staging allocation total: "
        f"{staging_allocation_total}"
    )

if staging_payment_total != staging_allocation_total:
    raise RuntimeError(
        "Staging payments and allocations do not reconcile."
    )


# ============================================================
# RESOLVE CYCLE + CONCEPTS
# ============================================================

cycle = fetch_exactly_one(
    "school_cycles",
    {"code": CYCLE_CODE},
    f"Cycle {CYCLE_CODE}",
    columns="id,code",
)

cycle_id = cycle["id"]


concept_map = {}

for code in [
    "TUITION",
    "ENROLLMENT_FEE",
]:
    row = fetch_exactly_one(
        "financial_concepts",
        {"code": code},
        f"Financial concept {code}",
        columns="id,code",
    )

    concept_map[code] = row["id"]


# ============================================================
# RESOLVE IMPORTED STUDENTS + ENROLLMENTS
# ============================================================

legacy_student_ids = sorted(
    set(
        clean(v)
        for v in charges_df[
            "legacy_student_id"
        ]
    )
)

student_id_map = {}
enrollment_id_map = {}

print()
print("Resolving students and enrollments...")

for legacy_student_id in legacy_student_ids:

    student = fetch_exactly_one(
        "students",
        {"legacy_id": legacy_student_id},
        f"Student {legacy_student_id}",
        columns="id,legacy_id",
    )

    student_id = student["id"]

    enrollment = fetch_exactly_one(
        "enrollments",
        {
            "student_id": student_id,
            "cycle_id": cycle_id,
        },
        (
            "Enrollment "
            f"{legacy_student_id}/{CYCLE_CODE}"
        ),
        columns="id,student_id,cycle_id",
    )

    student_id_map[
        legacy_student_id
    ] = student_id

    enrollment_id_map[
        legacy_student_id
    ] = enrollment["id"]


# ============================================================
# LOAD STATS
# ============================================================

stats = {
    "agreements_inserted": 0,
    "agreements_updated": 0,
    "charges_inserted": 0,
    "charges_updated": 0,
    "payments_inserted": 0,
    "payments_updated": 0,
    "allocations_inserted": 0,
    "allocations_updated": 0,
}


# ============================================================
# 1. FINANCIAL AGREEMENTS
# ============================================================
#
# Idempotency:
# enrollment_id + financial_concept_id + valid_from
#
# The table has an exclusion constraint preventing overlaps,
# but no natural UNIQUE constraint for an upsert.
# ============================================================

print("Loading financial agreements...")

agreement_id_by_key = {}
agreement_id_by_legacy_price_id = {}

for _, row in agreements_df.iterrows():

    legacy_student_id = clean(
        row["legacy_student_id"]
    )

    concept_code = clean(
        row["concept_code"]
    )

    enrollment_id = enrollment_id_map[
        legacy_student_id
    ]

    concept_id = concept_map[
        concept_code
    ]

    valid_from = clean(
        row["valid_from"]
    )

    legacy_price_id = clean(
        row["legacy_price_id"]
    )

    payload = {
        "enrollment_id":
            enrollment_id,

        "financial_concept_id":
            concept_id,

        # Historical migration does not fabricate current
        # base_rate / benefit catalog rows.
        "base_rate_id":
            None,

        "benefit_id":
            None,

        "base_amount_snapshot":
            clean(
                row["base_amount_snapshot"]
            ),

        "benefit_type_snapshot":
            clean(
                row[
                    "benefit_type_snapshot"
                ]
            ),

        "benefit_value_snapshot":
            clean(
                row[
                    "benefit_value_snapshot"
                ]
            ),

        "agreed_amount":
            clean(
                row["agreed_amount"]
            ),

        "valid_from":
            valid_from,

        "valid_until":
            clean(
                row["valid_until"]
            ),

        "reason":
            clean(
                row["reason"]
            ),

        "authorized_by":
            None,
    }

    existing = fetch_zero_or_one(
        "student_financial_agreements",
        {
            "enrollment_id":
                enrollment_id,
            "financial_concept_id":
                concept_id,
            "valid_from":
                valid_from,
        },
        (
            "Agreement "
            f"{legacy_student_id}/"
            f"{concept_code}/"
            f"{valid_from}"
        ),
        columns="id",
    )

    if existing is None:

        result = (
            supabase
            .table(
                "student_financial_agreements"
            )
            .insert(payload)
            .execute()
        )

        agreement_id = result.data[0]["id"]

        stats[
            "agreements_inserted"
        ] += 1

    else:

        agreement_id = existing["id"]

        (
            supabase
            .table(
                "student_financial_agreements"
            )
            .update(payload)
            .eq("id", agreement_id)
            .execute()
        )

        stats[
            "agreements_updated"
        ] += 1


    logical_key = clean(
        row["legacy_agreement_key"]
    )

    agreement_id_by_key[
        logical_key
    ] = agreement_id

    if legacy_price_id:
        if (
            legacy_price_id
            in agreement_id_by_legacy_price_id
            and
            agreement_id_by_legacy_price_id[
                legacy_price_id
            ] != agreement_id
        ):
            raise RuntimeError(
                "legacy_price_id maps to multiple "
                f"agreements: {legacy_price_id}"
            )

        agreement_id_by_legacy_price_id[
            legacy_price_id
        ] = agreement_id


# ============================================================
# 2. CHARGES
# ============================================================
#
# Idempotency:
# charges.legacy_reference = legacy_charge_key
#
# No UNIQUE constraint exists, so duplicates cause an abort.
# ============================================================

print("Loading charges...")

charge_id_map = {}

for _, row in charges_df.iterrows():

    legacy_charge_key = clean(
        row["legacy_charge_key"]
    )

    legacy_student_id = clean(
        row["legacy_student_id"]
    )

    concept_code = clean(
        row["concept_code"]
    )

    student_id = student_id_map[
        legacy_student_id
    ]

    enrollment_id = enrollment_id_map[
        legacy_student_id
    ]

    concept_id = concept_map[
        concept_code
    ]

    legacy_price_id = clean(
        row["legacy_price_id"]
    )

    agreement_id = None

    if legacy_price_id:
        agreement_id = (
            agreement_id_by_legacy_price_id
            .get(legacy_price_id)
        )

        if agreement_id is None:
            raise RuntimeError(
                "Charge references unknown "
                f"legacy_price_id: {legacy_price_id}"
            )


    coverage_year = clean(
        row["coverage_year"]
    )

    coverage_month = clean(
        row["coverage_month"]
    )

    payload = {
        "student_id":
            student_id,

        "enrollment_id":
            enrollment_id,

        "cycle_id":
            cycle_id,

        "financial_concept_id":
            concept_id,

        # Historical charges are reconstructed directly
        # and do not need a plan-period FK.
        "financial_plan_period_id":
            None,

        "financial_agreement_id":
            agreement_id,

        "coverage_year":
            (
                int(float(coverage_year))
                if coverage_year
                else None
            ),

        "coverage_month":
            (
                int(float(coverage_month))
                if coverage_month
                else None
            ),

        "original_amount":
            clean(
                row["original_amount"]
            ),

        "due_date":
            clean(
                row["due_date"]
            ),

        "origin":
            clean(
                row["origin"]
            ),

        "status":
            clean(
                row["status"]
            ),

        "created_by":
            None,

        "legacy_reference":
            legacy_charge_key,
    }

    existing = fetch_zero_or_one(
        "charges",
        {
            "legacy_reference":
                legacy_charge_key
        },
        f"Charge {legacy_charge_key}",
        columns="id",
    )

    if existing is None:

        result = (
            supabase
            .table("charges")
            .insert(payload)
            .execute()
        )

        charge_id = result.data[0]["id"]

        stats[
            "charges_inserted"
        ] += 1

    else:

        charge_id = existing["id"]

        (
            supabase
            .table("charges")
            .update(payload)
            .eq("id", charge_id)
            .execute()
        )

        stats[
            "charges_updated"
        ] += 1

    charge_id_map[
        legacy_charge_key
    ] = charge_id


# ============================================================
# 3. PAYMENTS
# ============================================================
#
# payment_code is UNIQUE in target.
# For legacy rows it is LEGACY-<uuid>.
# For manual backfills it is the explicit BACKFILL-* code.
# ============================================================

print("Loading payments...")

payment_id_map = {}

for _, row in payments_df.iterrows():

    legacy_payment_id = clean(
        row["legacy_payment_id"]
    )

    legacy_student_id = clean(
        row["legacy_student_id"]
    )

    payment_code = clean(
        row["payment_code"]
    )

    student_id = student_id_map[
        legacy_student_id
    ]

    payload = {
        "payment_code":
            payment_code,

        "student_id":
            student_id,

        "received_at":
            clean(
                row["received_at"]
            ),

        "amount":
            clean(
                row["amount"]
            ),

        "method":
            clean(
                row["method"]
            ),

        "status":
            clean(
                row["status"]
            ),

        # Historical receiver is preserved as text snapshot.
        "received_by":
            None,

        "received_by_name_snapshot":
            clean(
                row[
                    "received_by_name_snapshot"
                ]
            ),

        "notes":
            clean(
                row["notes"]
            ),

        "legacy_id":
            legacy_payment_id,
    }

    existing = fetch_zero_or_one(
        "payments",
        {
            "payment_code":
                payment_code
        },
        f"Payment {payment_code}",
        columns="id,legacy_id",
    )

    if existing is None:

        result = (
            supabase
            .table("payments")
            .insert(payload)
            .execute()
        )

        payment_id = result.data[0]["id"]

        stats[
            "payments_inserted"
        ] += 1

    else:

        payment_id = existing["id"]

        existing_legacy_id = clean(
            existing.get("legacy_id")
        )

        if (
            existing_legacy_id
            and
            existing_legacy_id
            != legacy_payment_id
        ):
            raise RuntimeError(
                "payment_code collision: "
                f"{payment_code}"
            )

        (
            supabase
            .table("payments")
            .update(payload)
            .eq("id", payment_id)
            .execute()
        )

        stats[
            "payments_updated"
        ] += 1

    payment_id_map[
        legacy_payment_id
    ] = payment_id


# ============================================================
# 4. PAYMENT ALLOCATIONS
# ============================================================
#
# Idempotency:
# payment_allocations.legacy_id =
# historical_payment_allocations.legacy_allocation_key
#
# No UNIQUE constraint exists; duplicates cause an abort.
# ============================================================

print("Loading payment allocations...")

for _, row in allocations_df.iterrows():

    legacy_allocation_key = clean(
        row["legacy_allocation_key"]
    )

    legacy_payment_id = clean(
        row["legacy_payment_id"]
    )

    legacy_student_id = clean(
        row["legacy_student_id"]
    )

    legacy_charge_key = clean(
        row["legacy_charge_key"]
    )

    student_id = student_id_map[
        legacy_student_id
    ]

    payment_id = payment_id_map.get(
        legacy_payment_id
    )

    charge_id = charge_id_map.get(
        legacy_charge_key
    )

    if not payment_id:
        raise RuntimeError(
            "Allocation references unknown payment: "
            f"{legacy_payment_id}"
        )

    if not charge_id:
        raise RuntimeError(
            "Allocation references unknown charge: "
            f"{legacy_charge_key}"
        )

    payload = {
        "student_id":
            student_id,

        "payment_id":
            payment_id,

        "charge_id":
            charge_id,

        "amount":
            clean(
                row["amount"]
            ),

        "allocation_mode":
            clean(
                row["allocation_mode"]
            ),

        "created_by":
            None,

        "reversed_at":
            None,

        "legacy_id":
            legacy_allocation_key,
    }

    existing = fetch_zero_or_one(
        "payment_allocations",
        {
            "legacy_id":
                legacy_allocation_key
        },
        (
            "Payment allocation "
            f"{legacy_allocation_key}"
        ),
        columns="id",
    )

    if existing is None:

        (
            supabase
            .table("payment_allocations")
            .insert(payload)
            .execute()
        )

        stats[
            "allocations_inserted"
        ] += 1

    else:

        (
            supabase
            .table("payment_allocations")
            .update(payload)
            .eq("id", existing["id"])
            .execute()
        )

        stats[
            "allocations_updated"
        ] += 1


# ============================================================
# POST-LOAD VALIDATION
# ============================================================

print()
print("Validating historical finance in Supabase...")


# ------------------------------------------------------------
# Payments
# ------------------------------------------------------------

target_payment_rows = []

for legacy_payment_id, payment_id in (
    payment_id_map.items()
):

    row = fetch_exactly_one(
        "payments",
        {"id": payment_id},
        f"Loaded payment {legacy_payment_id}",
        columns="id,amount,status,legacy_id",
    )

    target_payment_rows.append(row)


target_payment_total = sum(
    (
        money(row["amount"])
        for row in target_payment_rows
        if row["status"] == "CONFIRMED"
    ),
    Decimal("0.00"),
)


# ------------------------------------------------------------
# Allocations
# ------------------------------------------------------------

target_allocation_total = Decimal("0.00")
loaded_allocation_count = 0

for legacy_allocation_key in (
    allocations_df[
        "legacy_allocation_key"
    ].tolist()
):

    row = fetch_exactly_one(
        "payment_allocations",
        {
            "legacy_id":
                clean(legacy_allocation_key)
        },
        (
            "Loaded allocation "
            f"{legacy_allocation_key}"
        ),
        columns="id,amount,reversed_at",
    )

    loaded_allocation_count += 1

    if row["reversed_at"] is None:
        target_allocation_total += money(
            row["amount"]
        )


# ------------------------------------------------------------
# Charges
# ------------------------------------------------------------

target_charge_total = Decimal("0.00")

for legacy_charge_key, charge_id in (
    charge_id_map.items()
):

    row = fetch_exactly_one(
        "charges",
        {"id": charge_id},
        f"Loaded charge {legacy_charge_key}",
        columns="id,original_amount,status",
    )

    if row["status"] == "ACTIVE":
        target_charge_total += money(
            row["original_amount"]
        )


expected_staging_remaining = sum(
    (
        money(v)
        for v in balances_df[
            "remaining_amount"
        ]
    ),
    Decimal("0.00"),
)

target_remaining = (
    target_charge_total
    - target_allocation_total
)


# ============================================================
# STRICT VALIDATION
# ============================================================

errors = []

if len(agreement_id_by_key) != EXPECTED_COUNTS["agreements"]:
    errors.append(
        "Agreement count mismatch after load."
    )

if len(charge_id_map) != EXPECTED_COUNTS["charges"]:
    errors.append(
        "Charge count mismatch after load."
    )

if len(payment_id_map) != EXPECTED_COUNTS["payments"]:
    errors.append(
        "Payment count mismatch after load."
    )

if (
    loaded_allocation_count
    != EXPECTED_COUNTS["allocations"]
):
    errors.append(
        "Allocation count mismatch after load."
    )

if target_payment_total != EXPECTED_PAYMENT_TOTAL:
    errors.append(
        "Target payment total mismatch: "
        f"{target_payment_total}"
    )

if (
    target_allocation_total
    != EXPECTED_ALLOCATION_TOTAL
):
    errors.append(
        "Target allocation total mismatch: "
        f"{target_allocation_total}"
    )

if target_payment_total != target_allocation_total:
    errors.append(
        "Target payments and allocations "
        "do not reconcile."
    )

if target_remaining != expected_staging_remaining:
    errors.append(
        "Derived outstanding balance differs "
        "from staging: "
        f"target={target_remaining}; "
        f"staging={expected_staging_remaining}"
    )


# ============================================================
# REPORT
# ============================================================

report_lines = [
    "ETL 04 - Historical Finance Load",
    "================================",
    "",
    f"Cycle: {CYCLE_CODE}",
    "",
    "OPERATIONS",
    (
        "Agreements inserted: "
        f"{stats['agreements_inserted']}"
    ),
    (
        "Agreements updated: "
        f"{stats['agreements_updated']}"
    ),
    (
        "Charges inserted: "
        f"{stats['charges_inserted']}"
    ),
    (
        "Charges updated: "
        f"{stats['charges_updated']}"
    ),
    (
        "Payments inserted: "
        f"{stats['payments_inserted']}"
    ),
    (
        "Payments updated: "
        f"{stats['payments_updated']}"
    ),
    (
        "Allocations inserted: "
        f"{stats['allocations_inserted']}"
    ),
    (
        "Allocations updated: "
        f"{stats['allocations_updated']}"
    ),
    "",
    "FINAL COUNTS",
    (
        f"Agreements: "
        f"{len(agreement_id_by_key)}"
    ),
    (
        f"Charges: "
        f"{len(charge_id_map)}"
    ),
    (
        f"Payments: "
        f"{len(payment_id_map)}"
    ),
    (
        f"Allocations: "
        f"{loaded_allocation_count}"
    ),
    "",
    "MONEY",
    (
        "Confirmed payments: "
        f"${target_payment_total:.2f}"
    ),
    (
        "Active allocations: "
        f"${target_allocation_total:.2f}"
    ),
    (
        "Active charge total: "
        f"${target_charge_total:.2f}"
    ),
    (
        "Derived outstanding: "
        f"${target_remaining:.2f}"
    ),
    (
        "Staging outstanding: "
        f"${expected_staging_remaining:.2f}"
    ),
    "",
]

if errors:
    report_lines.append(
        "VALIDATION: FAILED"
    )
    report_lines.append("")
    report_lines.extend(
        f"- {error}"
        for error in errors
    )
else:
    report_lines.append(
        "VALIDATION: PASS"
    )


report_path = (
    REPORTS_DIR
    / "04_historical_finance_load.txt"
)

report_path.write_text(
    "\n".join(report_lines),
    encoding="utf-8",
)


# ============================================================
# FINAL
# ============================================================

print()
print("ETL 04 - Historical Finance Load")
print("--------------------------------")
print(
    f"agreements:           "
    f"{len(agreement_id_by_key)}"
)
print(
    f"charges:              "
    f"{len(charge_id_map)}"
)
print(
    f"payments:             "
    f"{len(payment_id_map)}"
)
print(
    f"allocations:          "
    f"{loaded_allocation_count}"
)
print()
print(
    "payments total:       "
    f"${target_payment_total:.2f}"
)
print(
    "allocations total:    "
    f"${target_allocation_total:.2f}"
)
print(
    "outstanding:          "
    f"${target_remaining:.2f}"
)
print()
print(f"Report: {report_path}")

if errors:
    print()
    print("VALIDATION: FAILED")

    for error in errors:
        print(f"- {error}")

    sys.exit(1)

print()
print("VALIDATION: PASS")
print(
    "Historical finance loaded successfully."
)
