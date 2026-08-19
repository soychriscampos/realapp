from pathlib import Path
from decimal import Decimal, InvalidOperation
from collections import defaultdict
import sys

import pandas as pd


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]

INPUT_DIR = BASE_DIR / "input"
OUTPUT_DIR = BASE_DIR / "output"
REPORTS_DIR = BASE_DIR / "reports"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# CONSTANTS
# ============================================================

CYCLE_CODE = "25-26"

CYCLE_START = pd.Timestamp("2025-09-01")
CYCLE_END = pd.Timestamp("2026-08-31")

TUITION_BASE = {
    "Preescolar": Decimal("1500"),
    "Primaria": Decimal("1600"),
}

METHOD_MAP = {
    "Efectivo": "CASH",
    "Transferencia": "TRANSFER",
}

RECEIVER_MAP = {
    "Christian": "Christian",
    "Fran": "Fran",
    "Citlali": "Citlali",
    "Desconocido": "Fran",
    "Mancillas": "Fran",
}

CONCEPT_MAP = {
    "COLEGIATURA": "TUITION",
    "INSCRIPCION": "ENROLLMENT_FEE",
}

# Corrección ya identificada y documentada:
#
# La aplicación SEP de Adriana Guzmán Castro está ligada
# en legacy al pago de Inscripción, cuando corresponde
# al pago de Colegiatura del mismo día.
#
ADRIANA_APPLICATION_ID = (
    "45163107-e74d-42c5-b0b0-22d0e9e32e96"
)

ADRIANA_WRONG_PAYMENT_ID = (
    "aa69e6e2-5ac6-4a09-be11-4afc4eaaee44"
)

ADRIANA_CORRECT_PAYMENT_ID = (
    "45b7f84a-83e2-42ac-8591-0cbe0b130d8f"
)


# ============================================================
# VERIFIED HISTORICAL ENROLLMENT-FEE CORRECTIONS
# ============================================================
#
# Correcciones confirmadas administrativamente.
# No se modifica la fuente legacy.
#
# Las claves usan alumno_code porque son referencias humanas
# estables y fáciles de auditar.
# ============================================================

ENROLLMENT_FEE_OVERRIDES = {
    # Ehitan Kaleth Guerrero Espinoza
    "A-0035": {
        "amount": Decimal("2500"),
        "reason": (
            "LEGACY_CORRECTION: historical enrollment fee "
            "confirmed as 2500; legacy 2400 price was incorrect"
        ),
    },

    # Manuel Iván Pacheco Ramírez
    "A-0108": {
        "amount": Decimal("1000"),
        "reason": (
            "LEGACY_CORRECTION: student entered mid-cycle; "
            "historical enrollment fee confirmed as 1000"
        ),
    },

    # Amaya Yoselin Sánchez Barrón
    "A-0018": {
        "amount": Decimal("2400"),
        "reason": (
            "LEGACY_CORRECTION: historical enrollment fee "
            "confirmed as 2400; legacy 1100 price was incorrect"
        ),
    },

    # Héctor Efraín Rodríguez Cárdenas
    "A-0024": {
        "amount": Decimal("1100"),
        "reason": (
            "LEGACY_CORRECTION: pre-registration/enrollment fee "
            "confirmed as 1100; legacy year was recorded one year late"
        ),
    },

    # Valentina Ayleen Deciga Rivas
    "A-0109": {
        "amount": Decimal("1000"),
        "reason": (
            "LEGACY_CORRECTION: enrollment fee confirmed as 1000; "
            "no historical payment was reported, so charge remains open"
        ),
    },

    # Valentino Lerma Cisneros
    "A-0110": {
        "amount": Decimal("1000"),
        "reason": (
            "LEGACY_CORRECTION: enrollment fee confirmed as 1000; "
            "historical payment was omitted from legacy and will be backfilled"
        ),
    },
}


# ============================================================
# VERIFIED HISTORICAL PAYMENT DATE CORRECTIONS
# ============================================================
#
# Héctor's pre-registration payment was recorded with year 2025
# but administratively corresponds to 2024.
# We identify it by student code + payment type + source date.
# ============================================================

PAYMENT_DATE_OVERRIDES = {
    ("A-0024", "ENROLLMENT_FEE", "2025-02-28"): "2024-02-28",
}


# ============================================================
# VERIFIED HISTORICAL TUITION APPLICATION CORRECTIONS
# ============================================================
#
# Emiliano entered in November 2025. His November tuition was
# incorrectly applied to SEP in legacy. We match the application
# by student code + payment date + amount + source period.
# ============================================================

TUITION_APPLICATION_PERIOD_OVERRIDES = {
    # ========================================================
    # Emiliano Echeagaray Aguilar — A-0106
    # Entró en noviembre.
    # ========================================================

    ("A-0106", "2025-11-03", Decimal("1100.00"), "SEP"): "NOV",
    ("A-0106", "2025-12-02", Decimal("1100.00"), "NOV"): "DIC/JUL",
    ("A-0106", "2026-01-12", Decimal("1100.00"), "DIC/JUL"): "ENE",
    ("A-0106", "2026-02-03", Decimal("1100.00"), "MAR/AGO"): "FEB",
    ("A-0106", "2026-03-03", Decimal("1100.00"), "ENE"): "MAR/AGO",
    ("A-0106", "2026-03-12", Decimal("1100.00"), "FEB"): "MAR/AGO",
    ("A-0106", "2026-03-24", Decimal("1100.00"), "MAR/AGO"): "ABR",

    # ========================================================
    # Vania Villavelazquez Degollado — A-0107
    # Enero es gratis.
    # ========================================================

    ("A-0107", "2026-01-27", Decimal("1000.00"), "ENE"): "FEB",
    ("A-0107", "2026-03-03", Decimal("1000.00"), "FEB"): "MAR/AGO",

    # ========================================================
    # Abril Danae Valadez Padilla — A-0111
    # Abril es gratis.
    # ========================================================

    ("A-0111", "2026-04-29", Decimal("1500.00"), "ABR"): "MAY",
    ("A-0111", "2026-06-02", Decimal("1500.00"), "MAY"): "JUN",
}


# ============================================================
# VERIFIED FREE ENTRY MONTHS
# ============================================================
#
# These students entered late in the month and that entry month
# is explicitly not charged.
# ============================================================

FREE_ENTRY_MONTHS = {
    "A-0107": {(2026, 1)},  # Vania: January free
    "A-0111": {(2026, 4)},  # Abril: April free
}


# ============================================================
# MANUAL HISTORICAL PAYMENT BACKFILLS
# ============================================================
#
# These payments are known to have occurred but were omitted
# from the legacy payments table.
#
# approximate_date=True means the date is intentionally
# reconstructed/tentative during migration.
#
# amount=None for tuition components means "use the reconstructed
# charge amount for that coverage period".
# ============================================================

MANUAL_HISTORICAL_PAYMENT_BACKFILLS = [
    {
        "student_code": "A-0110",
        "payment_code": "BACKFILL-A-0110-20260415-INS-ABR",
        "received_at": "2026-04-15",
        "approximate_date": True,
        "receiver": "Fran",
        "method": "CASH",
        "notes": (
            "Historical backfill confirmed during migration. "
            "Legacy system did not contain this payment. "
            "Payment date is approximate. Covers enrollment fee and April tuition."
        ),
        "allocations": [
            {
                "concept": "ENROLLMENT_FEE",
                "coverage_year": None,
                "coverage_month": None,
                "amount": Decimal("1000.00"),
            },
            {
                "concept": "TUITION",
                "coverage_year": 2026,
                "coverage_month": 4,
                "amount": None,
            },
        ],
    },
    {
        "student_code": "A-0110",
        "payment_code": "BACKFILL-A-0110-20260515-MAY",
        "received_at": "2026-05-15",
        "approximate_date": True,
        "receiver": "Fran",
        "method": "CASH",
        "notes": (
            "Historical backfill confirmed during migration. "
            "Legacy system did not contain this payment. "
            "Payment date is approximate. Covers May tuition."
        ),
        "allocations": [
            {
                "concept": "TUITION",
                "coverage_year": 2026,
                "coverage_month": 5,
                "amount": None,
            },
        ],
    },
    {
        "student_code": "A-0110",
        "payment_code": "BACKFILL-A-0110-20260615-JUN",
        "received_at": "2026-06-15",
        "approximate_date": True,
        "receiver": "Fran",
        "method": "CASH",
        "notes": (
            "Historical backfill confirmed during migration. "
            "Legacy system did not contain this payment. "
            "Payment date is approximate. Covers June tuition."
        ),
        "allocations": [
            {
                "concept": "TUITION",
                "coverage_year": 2026,
                "coverage_month": 6,
                "amount": None,
            },
        ],
    },
    {
        "student_code": "A-0110",
        "payment_code": "BACKFILL-A-0110-20260720-JUL-AGO",
        "received_at": "2026-07-20",
        "approximate_date": False,
        "receiver": "Christian",
        "method": "CASH",
        "notes": (
            "Historical backfill confirmed during migration. "
            "Legacy system did not contain this payment. "
            "Covers July and August tuition."
        ),
        "allocations": [
            {
                "concept": "TUITION",
                "coverage_year": 2026,
                "coverage_month": 7,
                "amount": None,
            },
            {
                "concept": "TUITION",
                "coverage_year": 2026,
                "coverage_month": 8,
                "amount": None,
            },
        ],
    },
]


# ============================================================
# TARGET TUITION MONTHS
# ============================================================
#
# coverage_year/month = mes que cubre el cargo
# due_date            = fecha real en que vencía
#
# JUL se cobraba junto con DIC.
# AGO se cobraba junto con MAR.
# ============================================================

TUITION_MONTHS = {
    "SEP": [
        (2025, 9, "2025-09-05"),
    ],
    "OCT": [
        (2025, 10, "2025-10-05"),
    ],
    "NOV": [
        (2025, 11, "2025-11-05"),
    ],
    "DIC/JUL": [
        (2025, 12, "2025-12-05"),
        (2026, 7, "2025-12-05"),
    ],
    "ENE": [
        (2026, 1, "2026-01-05"),
    ],
    "FEB": [
        (2026, 2, "2026-02-05"),
    ],
    "MAR/AGO": [
        (2026, 3, "2026-03-05"),
        (2026, 8, "2026-03-05"),
    ],
    "ABR": [
        (2026, 4, "2026-04-05"),
    ],
    "MAY": [
        (2026, 5, "2026-05-05"),
    ],
    "JUN": [
        (2026, 6, "2026-06-05"),
    ],
}


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
        return Decimal("0")

    try:
        return Decimal(str(value)).quantize(
            Decimal("0.01")
        )
    except InvalidOperation:
        raise ValueError(
            f"Invalid monetary value: {value!r}"
        )


def money_str(value):
    return format(
        Decimal(value).quantize(Decimal("0.01")),
        ".2f",
    )


def normalize_payment_type(value):
    value = clean(value)

    if not value:
        return None

    normalized = (
        value.lower()
        .replace("ó", "o")
        .replace("í", "i")
        .strip()
    )

    if normalized == "colegiatura":
        return "TUITION"

    if normalized == "inscripcion":
        return "ENROLLMENT_FEE"

    raise ValueError(
        f"Unknown payment type: {value!r}"
    )


def payment_timestamp(value):
    """
    Legacy stores payment date without meaningful time.

    We use noon in America/Mazatlan (-07:00)
    to preserve the historical calendar date and avoid
    accidental date changes during timezone conversion.
    """

    date = pd.Timestamp(value)

    return (
        date.strftime("%Y-%m-%d")
        + "T12:00:00-07:00"
    )


def charge_key(
    student_legacy_id,
    concept,
    coverage_year=None,
    coverage_month=None,
):
    if concept == "ENROLLMENT_FEE":
        return (
            f"{student_legacy_id}"
            f"|ENROLLMENT_FEE|25-26"
        )

    return (
        f"{student_legacy_id}"
        f"|TUITION|"
        f"{int(coverage_year):04d}-"
        f"{int(coverage_month):02d}"
    )


def agreement_key(
    student_legacy_id,
    concept,
    valid_from,
):
    return (
        f"{student_legacy_id}"
        f"|{concept}|"
        f"{pd.Timestamp(valid_from).date()}"
    )


def payment_code(legacy_payment_id):
    return f"LEGACY-{legacy_payment_id}"


def allocation_key(
    legacy_application_id,
    target_charge_key,
    suffix,
):
    return (
        f"{legacy_application_id}"
        f"|{target_charge_key}"
        f"|{suffix}"
    )


# ============================================================
# LOAD LEGACY CSV
# ============================================================

alumnos = pd.read_csv(
    INPUT_DIR / "alumnos_rows.csv",
    dtype="string",
)

precios = pd.read_csv(
    INPUT_DIR / "precios_alumno_rows.csv",
    dtype="string",
)

calendario = pd.read_csv(
    INPUT_DIR / "calendario_ciclo_rows.csv",
    dtype="string",
)

pagos = pd.read_csv(
    INPUT_DIR / "pagos_rows.csv",
    dtype="string",
)

aplicaciones = pd.read_csv(
    INPUT_DIR / "pago_aplicaciones_rows.csv",
    dtype="string",
)

ciclos = pd.read_csv(
    INPUT_DIR / "ciclos_rows.csv",
    dtype="string",
)


# ============================================================
# BASIC NORMALIZATION
# ============================================================

precios["vigencia_desde_dt"] = pd.to_datetime(
    precios["vigencia_desde"]
)

pagos["fecha_pago_dt"] = pd.to_datetime(
    pagos["fecha_pago"]
)

pagos["creado_en_dt"] = pd.to_datetime(
    pagos["creado_en"],
    errors="coerce",
)

precios["importe_decimal"] = (
    precios["importe_base"].map(money)
)

aplicaciones["monto_decimal"] = (
    aplicaciones["monto_aplicado"].map(money)
)

pagos["monto_decimal"] = (
    pagos["monto_total"].map(money)
)


# ============================================================
# VALIDATE CYCLE
# ============================================================

cycle_rows = ciclos.loc[
    ciclos["ciclo"].str.strip() == CYCLE_CODE
]

if len(cycle_rows) != 1:
    raise RuntimeError(
        f"Expected exactly one cycle {CYCLE_CODE}; "
        f"found {len(cycle_rows)}"
    )

LEGACY_CYCLE_ID = clean(
    cycle_rows.iloc[0]["id"]
)


# ============================================================
# INDEX STUDENTS
# ============================================================

student_rows = {}

for _, row in alumnos.iterrows():
    legacy_id = clean(row["id"])

    if legacy_id in student_rows:
        raise RuntimeError(
            f"Duplicate student id: {legacy_id}"
        )

    student_rows[legacy_id] = row


student_code_by_id = {}

for student_id, row in student_rows.items():
    student_code = clean(row["alumno_code"])

    if not student_code:
        raise RuntimeError(
            f"Student without alumno_code: {student_id}"
        )

    student_code_by_id[student_id] = student_code


student_id_by_code = {
    code: student_id
    for student_id, code in student_code_by_id.items()
}


# ============================================================
# VALIDATE PAYMENT METHODS + RECEIVERS
# ============================================================

unknown_methods = sorted(
    set(
        clean(x)
        for x in pagos["metodo_de_pago"]
        if clean(x) not in METHOD_MAP
    )
)

if unknown_methods:
    raise RuntimeError(
        "Unknown payment methods: "
        f"{unknown_methods}"
    )


unknown_receivers = sorted(
    set(
        clean(x)
        for x in pagos["recibio"]
        if clean(x) not in RECEIVER_MAP
    )
)

if unknown_receivers:
    raise RuntimeError(
        "Unknown payment receivers: "
        f"{unknown_receivers}"
    )


# ============================================================
# PRICE HISTORY
# ============================================================

price_history = defaultdict(list)

for _, row in precios.iterrows():

    student_id = clean(row["alumno_id"])
    legacy_concept = clean(row["concepto"])

    if legacy_concept not in CONCEPT_MAP:
        raise RuntimeError(
            "Unknown legacy price concept: "
            f"{legacy_concept}"
        )

    target_concept = CONCEPT_MAP[
        legacy_concept
    ]

    price_history[
        (student_id, target_concept)
    ].append(
        {
            "legacy_price_id": clean(row["id"]),
            "valid_from": row["vigencia_desde_dt"],
            "amount": row["importe_decimal"],
            "notes": clean(row["notas"]),
        }
    )


for key in price_history:
    price_history[key].sort(
        key=lambda x: x["valid_from"]
    )


# ============================================================
# PRICE LOOKUP
# ============================================================

def price_effective_on(
    student_id,
    concept,
    effective_date,
):
    history = price_history.get(
        (student_id, concept),
        [],
    )

    if not history:
        return None, "NO_PRICE_HISTORY"

    effective_date = pd.Timestamp(effective_date)

    eligible = [
        item
        for item in history
        if item["valid_from"] <= effective_date
    ]

    if eligible:
        return eligible[-1], "EXACT_OR_PRIOR"

    # If there is no prior price, use the earliest available
    # only as staging evidence and flag it for review.
    return history[0], "FUTURE_FALLBACK"


# ============================================================
# EARLIEST ENROLLMENT-FEE PAYMENT BY STUDENT
# ============================================================

enrollment_payment_dates = defaultdict(list)

for _, row in pagos.iterrows():

    payment_type = normalize_payment_type(
        row["tipo_de_pago"]
    )

    if payment_type == "ENROLLMENT_FEE":
        enrollment_payment_dates[
            clean(row["alumno_id"])
        ].append(
            row["fecha_pago_dt"]
        )


# ============================================================
# PERIODS OBSERVED FOR BAJA STUDENTS
# ============================================================
#
# We do not invent a withdrawal date.
#
# Therefore for BAJA records we only prepare tuition
# obligations for periods actually evidenced by legacy
# payment applications.
#
# This is deliberately reported for review.
# ============================================================

applied_periods_by_student = defaultdict(set)

for _, row in aplicaciones.iterrows():
    applied_periods_by_student[
        clean(row["alumno_id"])
    ].add(
        clean(row["periodo"])
    )


# ============================================================
# OUTPUT CONTAINERS
# ============================================================

agreement_rows = []
charge_rows = []
payment_rows = []
allocation_rows = []
credit_candidate_rows = []
anomaly_rows = []


# ============================================================
# 1. AGREEMENT STAGING
# ============================================================
#
# We preserve price-history changes.
#
# For TUITION:
# institutional reference base:
#   Preescolar = 1500
#   Primaria   = 1600
#
# agreed_amount is always the source of truth.
#
# If agreed < institutional base, we represent the
# historical difference as FIXED_AMOUNT for staging.
#
# We are NOT creating benefits/base_rates in DB here.
# ============================================================

for (
    student_id,
    concept,
), history in price_history.items():

    student = student_rows.get(student_id)

    if student is None:
        anomaly_rows.append(
            {
                "severity": "ERROR",
                "type": "PRICE_WITHOUT_STUDENT",
                "legacy_id": student_id,
                "details": concept,
            }
        )
        continue

    level = clean(student["nivel"])

    # Only relevant history up to end of migrated cycle.
    relevant = [
        item
        for item in history
        if item["valid_from"] <= CYCLE_END
    ]

    if not relevant:
        continue

    for index, item in enumerate(relevant):

        valid_from = item["valid_from"]

        if index + 1 < len(relevant):
            valid_until = (
                relevant[index + 1]["valid_from"]
                - pd.Timedelta(days=1)
            )
        else:
            valid_until = None

        agreed = item["amount"]

        if concept == "TUITION":
            base = TUITION_BASE.get(level)

            if base is None:
                raise RuntimeError(
                    f"Unknown education level: {level}"
                )

            if agreed < base:
                benefit_type = "FIXED_AMOUNT"
                benefit_value = base - agreed
            else:
                benefit_type = None
                benefit_value = None

            # If legacy price is above institutional reference,
            # preserve the actual historical agreement without
            # fabricating a "negative benefit".
            if agreed > base:
                base_snapshot = agreed
            else:
                base_snapshot = base

        else:
            # Legacy does not provide a reliable universal
            # enrollment-fee base snapshot per student.
            #
            # For historical migration we preserve the agreed
            # amount itself as the snapshot.
            base_snapshot = agreed
            benefit_type = None
            benefit_value = None

        agreement_rows.append(
            {
                "legacy_agreement_key":
                    agreement_key(
                        student_id,
                        concept,
                        valid_from,
                    ),

                "legacy_student_id":
                    student_id,

                "concept_code":
                    concept,

                "legacy_price_id":
                    item["legacy_price_id"],

                "base_amount_snapshot":
                    money_str(base_snapshot),

                "benefit_type_snapshot":
                    benefit_type,

                "benefit_value_snapshot":
                    (
                        money_str(benefit_value)
                        if benefit_value is not None
                        else None
                    ),

                "agreed_amount":
                    money_str(agreed),

                "valid_from":
                    valid_from.strftime("%Y-%m-%d"),

                "valid_until":
                    (
                        valid_until.strftime("%Y-%m-%d")
                        if valid_until is not None
                        else None
                    ),

                "reason":
                    item["notes"],

                "source":
                    "LEGACY_PRICE_HISTORY",
            }
        )


# ============================================================
# 2. HISTORICAL CHARGES
# ============================================================

charge_amount_by_key = {}
charge_period_by_key = {}


def add_charge(
    *,
    student_id,
    concept,
    amount,
    due_date,
    coverage_year=None,
    coverage_month=None,
    legacy_period=None,
    price_record=None,
    price_resolution=None,
):
    key = charge_key(
        student_id,
        concept,
        coverage_year,
        coverage_month,
    )

    if key in charge_amount_by_key:
        raise RuntimeError(
            f"Duplicate charge key: {key}"
        )

    charge_amount_by_key[key] = amount
    charge_period_by_key[key] = legacy_period

    charge_rows.append(
        {
            "legacy_charge_key": key,
            "legacy_student_id": student_id,
            "cycle_code": CYCLE_CODE,
            "concept_code": concept,

            "coverage_year": coverage_year,
            "coverage_month": coverage_month,

            "original_amount":
                money_str(amount),

            "due_date":
                pd.Timestamp(
                    due_date
                ).strftime("%Y-%m-%d"),

            "origin":
                "LEGACY_MIGRATION",

            "status":
                "ACTIVE",

            "legacy_period":
                legacy_period,

            "legacy_price_id":
                (
                    price_record[
                        "legacy_price_id"
                    ]
                    if price_record
                    else None
                ),

            "price_resolution":
                price_resolution,
        }
    )


# ------------------------------------------------------------
# ENROLLMENT FEE CHARGES
# ------------------------------------------------------------

for student_id, student in student_rows.items():

    student_code = student_code_by_id[
        student_id
    ]

    override = ENROLLMENT_FEE_OVERRIDES.get(
        student_code
    )

    # --------------------------------------------------------
    # Verified manual historical correction
    # --------------------------------------------------------

    if override is not None:

        amount = override["amount"]

        payment_dates = enrollment_payment_dates.get(
            student_id,
            [],
        )

        if payment_dates:
            source_due_date = min(payment_dates)

            student_payment_type = "ENROLLMENT_FEE"
            source_due_date_key = (
                source_due_date.strftime("%Y-%m-%d")
            )

            due_override = PAYMENT_DATE_OVERRIDES.get(
                (
                    student_code,
                    student_payment_type,
                    source_due_date_key,
                )
            )

            effective_due_date = (
                pd.Timestamp(due_override)
                if due_override
                else source_due_date
            )
        else:
            effective_due_date = pd.Timestamp(
                "2025-09-05"
            )

        add_charge(
            student_id=student_id,
            concept="ENROLLMENT_FEE",
            amount=amount,
            due_date=effective_due_date,
            legacy_period="INS",
            price_record=None,
            price_resolution=(
                "VERIFIED_HISTORICAL_OVERRIDE"
            ),
        )

        anomaly_rows.append(
            {
                "severity": "INFO",
                "type":
                    "LEGACY_ENROLLMENT_FEE_CORRECTION",

                "legacy_id":
                    student_id,

                "details":
                    (
                        f"{student_code}; "
                        f"amount={money_str(amount)}; "
                        f"{override['reason']}"
                    ),
            }
        )

        continue

    # --------------------------------------------------------
    # Normal legacy reconstruction
    # --------------------------------------------------------

    history = price_history.get(
        (student_id, "ENROLLMENT_FEE"),
        [],
    )

    if not history:
        # No price and no verified correction.
        # We do NOT invent a charge.
        continue

    payment_dates = enrollment_payment_dates.get(
        student_id,
        [],
    )

    if payment_dates:
        effective_date = min(payment_dates)
        resolution_context = (
            "FIRST_ENROLLMENT_PAYMENT_DATE"
        )
    else:
        effective_date = pd.Timestamp(
            "2025-09-05"
        )
        resolution_context = "DUE_DATE"

    price_record, price_resolution = (
        price_effective_on(
            student_id,
            "ENROLLMENT_FEE",
            effective_date,
        )
    )

    if price_record is None:
        continue

    if price_resolution == "FUTURE_FALLBACK":
        anomaly_rows.append(
            {
                "severity": "WARNING",
                "type":
                    "ENROLLMENT_PRICE_FUTURE_FALLBACK",
                "legacy_id":
                    student_id,
                "details":
                    (
                        f"effective_date="
                        f"{effective_date.date()}; "
                        f"using price from "
                        f"{price_record['valid_from'].date()}"
                    ),
            }
        )

    add_charge(
        student_id=student_id,
        concept="ENROLLMENT_FEE",
        amount=price_record["amount"],
        due_date=effective_date,
        legacy_period="INS",
        price_record=price_record,
        price_resolution=(
            f"{resolution_context}:"
            f"{price_resolution}"
        ),
    )


# ------------------------------------------------------------
# TUITION CHARGES
# ------------------------------------------------------------

for student_id, student in student_rows.items():

    status = clean(student["estatus"])

    if status not in {"ACTIVO", "BAJA"}:
        raise RuntimeError(
            f"Unexpected student status: {status}"
        )

    observed_periods = (
        applied_periods_by_student.get(
            student_id,
            set(),
        )
    )

    tuition_history = price_history.get(
        (student_id, "TUITION"),
        [],
    )

    if not tuition_history:
        anomaly_rows.append(
            {
                "severity": "ERROR",
                "type": "MISSING_TUITION_PRICE",
                "legacy_id": student_id,
                "details": "No tuition price history",
            }
        )
        continue

    student_code = student_code_by_id[
        student_id
    ]

    first_tuition_valid_from = tuition_history[0][
        "valid_from"
    ]

    first_coverage_month = (
        first_tuition_valid_from.year,
        first_tuition_valid_from.month,
    )

    free_months = FREE_ENTRY_MONTHS.get(
        student_code,
        set(),
    )

    for legacy_period, components in (
        TUITION_MONTHS.items()
    ):

        if status == "BAJA":
            if legacy_period not in observed_periods:
                continue

        # Resolve the price using the legacy combined-period
        # anchor, but decide whether each component exists by
        # its own coverage month.
        anchor_due_date = pd.Timestamp(
            components[0][2]
        )

        price_record, price_resolution = (
            price_effective_on(
                student_id,
                "TUITION",
                anchor_due_date,
            )
        )

        if price_record is None:
            anomaly_rows.append(
                {
                    "severity": "ERROR",
                    "type": "MISSING_TUITION_PRICE",
                    "legacy_id": student_id,
                    "details": legacy_period,
                }
            )
            continue

        # A FUTURE_FALLBACK is acceptable only when the component
        # belongs to the same or a later coverage month than the
        # student's first tuition month.
        if price_resolution == "FUTURE_FALLBACK":
            anomaly_rows.append(
                {
                    "severity": "INFO",
                    "type":
                        "LATE_ENTRY_PRICE_USED_FOR_VALID_COMPONENTS",
                    "legacy_id": student_id,
                    "details":
                        (
                            f"{legacy_period}; "
                            f"using "
                            f"{price_record['valid_from'].date()}"
                        ),
                }
            )

        for (
            coverage_year,
            coverage_month,
            due_date,
        ) in components:

            coverage_key = (
                int(coverage_year),
                int(coverage_month),
            )

            # No obligations before the student's first tuition
            # coverage month.
            if coverage_key < first_coverage_month:
                anomaly_rows.append(
                    {
                        "severity": "INFO",
                        "type":
                            "LATE_ENTRY_TUITION_MONTH_SKIPPED",
                        "legacy_id": student_id,
                        "details":
                            (
                                f"{coverage_year:04d}-"
                                f"{coverage_month:02d}; "
                                f"first tuition valid from "
                                f"{first_tuition_valid_from.date()}"
                            ),
                    }
                )
                continue

            # Explicitly free entry months.
            if coverage_key in free_months:
                anomaly_rows.append(
                    {
                        "severity": "INFO",
                        "type":
                            "VERIFIED_FREE_ENTRY_MONTH_SKIPPED",
                        "legacy_id": student_id,
                        "details":
                            (
                                f"{student_code}; "
                                f"{coverage_year:04d}-"
                                f"{coverage_month:02d}"
                            ),
                    }
                )
                continue

            add_charge(
                student_id=student_id,
                concept="TUITION",
                amount=price_record["amount"],
                due_date=due_date,
                coverage_year=coverage_year,
                coverage_month=coverage_month,
                legacy_period=legacy_period,
                price_record=price_record,
                price_resolution=price_resolution,
            )

    if status == "BAJA":
        anomaly_rows.append(
            {
                "severity": "INFO",
                "type":
                    "BAJA_CHARGES_LIMITED_TO_EVIDENCE",
                "legacy_id": student_id,
                "details":
                    ",".join(
                        sorted(observed_periods)
                    ),
            }
        )


# ============================================================
# 3. PAYMENT STAGING
# ============================================================

payment_by_legacy_id = {}

for _, row in pagos.iterrows():

    legacy_payment_id = clean(row["id"])
    student_id = clean(row["alumno_id"])

    method_source = clean(
        row["metodo_de_pago"]
    )

    receiver_source = clean(
        row["recibio"]
    )

    target_method = METHOD_MAP[
        method_source
    ]

    target_receiver = RECEIVER_MAP[
        receiver_source
    ]

    payment_type = normalize_payment_type(
        row["tipo_de_pago"]
    )

    student_code = student_code_by_id[
        student_id
    ]

    source_payment_date = row[
        "fecha_pago_dt"
    ].strftime("%Y-%m-%d")

    payment_date_override = (
        PAYMENT_DATE_OVERRIDES.get(
            (
                student_code,
                payment_type,
                source_payment_date,
            )
        )
    )

    effective_payment_date = (
        pd.Timestamp(payment_date_override)
        if payment_date_override
        else row["fecha_pago_dt"]
    )

    if payment_date_override:
        anomaly_rows.append(
            {
                "severity": "INFO",
                "type":
                    "LEGACY_PAYMENT_DATE_CORRECTION",
                "legacy_id":
                    legacy_payment_id,
                "details":
                    (
                        f"{student_code}; "
                        f"{source_payment_date} -> "
                        f"{payment_date_override}"
                    ),
            }
        )

    target_row = {
        "legacy_payment_id":
            legacy_payment_id,

        "payment_code":
            payment_code(
                legacy_payment_id
            ),

        "legacy_student_id":
            student_id,

        "received_at":
            payment_timestamp(
                effective_payment_date
            ),

        "amount":
            money_str(
                row["monto_decimal"]
            ),

        "method":
            target_method,

        "status":
            "CONFIRMED",

        # Historical receiver is a snapshot,
        # not an Auth/profile FK.
        "received_by":
            None,

        "received_by_name_snapshot":
            target_receiver,

        "notes":
            clean(row["observaciones"]),

        "legacy_payment_type":
            payment_type,

        "legacy_receiver_original":
            receiver_source,

        "legacy_created_at":
            clean(row["creado_en"]),

        "legacy_comprobante_url":
            clean(row["comprobante_url"]),
    }

    payment_rows.append(target_row)

    payment_by_legacy_id[
        legacy_payment_id
    ] = {
        **target_row,
        "amount_decimal":
            row["monto_decimal"],
        "payment_date":
            effective_payment_date,
    }


# ============================================================
# PROCESS MANUAL HISTORICAL PAYMENT BACKFILLS
# ============================================================
#
# Backfills are appended after legacy payments are staged.
# They are intentionally outside the legacy payment total.
# ============================================================

manual_backfill_payment_ids = set()

for backfill in MANUAL_HISTORICAL_PAYMENT_BACKFILLS:

    student_code = backfill["student_code"]
    student_id = student_id_by_code.get(student_code)

    if not student_id:
        raise RuntimeError(
            f"Backfill student not found: {student_code}"
        )

    legacy_payment_id = backfill["payment_code"]

    if legacy_payment_id in payment_by_legacy_id:
        raise RuntimeError(
            f"Duplicate payment/backfill id: {legacy_payment_id}"
        )

    allocation_specs = backfill["allocations"]
    resolved_allocations = []
    total_amount = Decimal("0")

    for spec in allocation_specs:
        concept = spec["concept"]

        if concept == "ENROLLMENT_FEE":
            target_key = charge_key(
                student_id,
                "ENROLLMENT_FEE",
            )
        else:
            target_key = charge_key(
                student_id,
                "TUITION",
                spec["coverage_year"],
                spec["coverage_month"],
            )

        if target_key not in charge_amount_by_key:
            raise RuntimeError(
                "Backfill target charge missing: "
                f"{student_code} -> {target_key}"
            )

        amount = spec["amount"]

        if amount is None:
            amount = charge_amount_by_key[
                target_key
            ]

        amount = money(amount)
        total_amount += amount

        resolved_allocations.append(
            {
                "target_key": target_key,
                "amount": amount,
                "concept": concept,
            }
        )

    received_at = payment_timestamp(
        pd.Timestamp(backfill["received_at"])
    )

    notes = backfill["notes"]

    target_row = {
        "legacy_payment_id":
            legacy_payment_id,

        "payment_code":
            legacy_payment_id,

        "legacy_student_id":
            student_id,

        "received_at":
            received_at,

        "amount":
            money_str(total_amount),

        "method":
            backfill["method"],

        "status":
            "CONFIRMED",

        "received_by":
            None,

        "received_by_name_snapshot":
            backfill["receiver"],

        "notes":
            notes,

        "legacy_payment_type":
            "MANUAL_HISTORICAL_BACKFILL",

        "legacy_receiver_original":
            backfill["receiver"],

        "legacy_created_at":
            None,

        "legacy_comprobante_url":
            None,

        "source":
            "MANUAL_HISTORICAL_BACKFILL",

        "approximate_date":
            backfill["approximate_date"],
    }

    payment_rows.append(target_row)

    payment_by_legacy_id[
        legacy_payment_id
    ] = {
        **target_row,
        "amount_decimal":
            total_amount,
        "payment_date":
            pd.Timestamp(
                backfill["received_at"]
            ),
        "resolved_allocations":
            resolved_allocations,
    }

    manual_backfill_payment_ids.add(
        legacy_payment_id
    )

    anomaly_rows.append(
        {
            "severity": "INFO",
            "type":
                "MANUAL_HISTORICAL_PAYMENT_BACKFILL",
            "legacy_id":
                legacy_payment_id,
            "details":
                (
                    f"{student_code}; "
                    f"amount={money_str(total_amount)}; "
                    f"receiver={backfill['receiver']}; "
                    f"date={backfill['received_at']}; "
                    f"approximate={backfill['approximate_date']}"
                ),
        }
    )


# ============================================================
# 4. CORRECT KNOWN LEGACY APPLICATION
# ============================================================

correction_match = (
    aplicaciones["id"].astype(str)
    == ADRIANA_APPLICATION_ID
)

if correction_match.sum() != 1:
    anomaly_rows.append(
        {
            "severity": "ERROR",
            "type":
                "EXPECTED_ADRIANA_CORRECTION_NOT_FOUND",
            "legacy_id":
                ADRIANA_APPLICATION_ID,
            "details":
                f"matches={correction_match.sum()}",
        }
    )
else:
    current_payment = clean(
        aplicaciones.loc[
            correction_match,
            "pago_id",
        ].iloc[0]
    )

    if current_payment != ADRIANA_WRONG_PAYMENT_ID:
        anomaly_rows.append(
            {
                "severity": "ERROR",
                "type":
                    "ADRIANA_CORRECTION_SOURCE_CHANGED",
                "legacy_id":
                    ADRIANA_APPLICATION_ID,
                "details":
                    (
                        f"expected wrong payment "
                        f"{ADRIANA_WRONG_PAYMENT_ID}; "
                        f"found {current_payment}"
                    ),
            }
        )
    else:
        aplicaciones.loc[
            correction_match,
            "pago_id",
        ] = ADRIANA_CORRECT_PAYMENT_ID

        anomaly_rows.append(
            {
                "severity": "INFO",
                "type": "LEGACY_CORRECTION",
                "legacy_id":
                    ADRIANA_APPLICATION_ID,
                "details":
                    (
                        "Mislinked pago_id corrected: "
                        f"{ADRIANA_WRONG_PAYMENT_ID} -> "
                        f"{ADRIANA_CORRECT_PAYMENT_ID}"
                    ),
            }
        )


# ============================================================
# CHARGE OUTSTANDING TRACKER
# ============================================================

charge_remaining = {
    key: amount
    for key, amount
    in charge_amount_by_key.items()
}


# ============================================================
# 5. TUITION PAYMENT APPLICATIONS
# ============================================================

applications_work = aplicaciones.copy()

applications_work = applications_work.merge(
    pagos[
        [
            "id",
            "fecha_pago_dt",
            "creado_en_dt",
        ]
    ],
    left_on="pago_id",
    right_on="id",
    how="left",
    suffixes=("", "_payment"),
)

applications_work = applications_work.sort_values(
    by=[
        "fecha_pago_dt",
        "creado_en_dt",
        "pago_id",
        "id",
    ],
    na_position="last",
)


payment_allocated_total = defaultdict(
    lambda: Decimal("0")
)


def append_allocation(
    *,
    legacy_application_id,
    legacy_payment_id,
    student_id,
    target_charge_key,
    amount,
    legacy_period,
    suffix,
    source,
):
    if amount <= 0:
        return

    allocation_rows.append(
        {
            "legacy_allocation_key":
                allocation_key(
                    legacy_application_id,
                    target_charge_key,
                    suffix,
                ),

            "legacy_application_id":
                legacy_application_id,

            "legacy_payment_id":
                legacy_payment_id,

            "legacy_student_id":
                student_id,

            "legacy_charge_key":
                target_charge_key,

            "amount":
                money_str(amount),

            "allocation_mode":
                "MANUAL",

            "legacy_period":
                legacy_period,

            "source":
                source,
        }
    )

    payment_allocated_total[
        legacy_payment_id
    ] += amount


# ============================================================
# ALLOCATE MANUAL HISTORICAL BACKFILLS
# ============================================================

for legacy_payment_id in sorted(
    manual_backfill_payment_ids
):

    payment = payment_by_legacy_id[
        legacy_payment_id
    ]

    student_id = payment[
        "legacy_student_id"
    ]

    for index, allocation in enumerate(
        payment["resolved_allocations"],
        start=1,
    ):
        target_key = allocation[
            "target_key"
        ]

        amount = allocation["amount"]

        available = charge_remaining.get(
            target_key
        )

        if available is None:
            anomaly_rows.append(
                {
                    "severity": "ERROR",
                    "type":
                        "BACKFILL_WITHOUT_TARGET_CHARGE",
                    "legacy_id":
                        legacy_payment_id,
                    "details":
                        target_key,
                }
            )
            continue

        applied = min(amount, available)

        if applied != amount:
            anomaly_rows.append(
                {
                    "severity": "ERROR",
                    "type":
                        "BACKFILL_EXCEEDS_RECONSTRUCTED_CHARGE",
                    "legacy_id":
                        legacy_payment_id,
                    "details":
                        (
                            f"{target_key}; "
                            f"requested={money_str(amount)}; "
                            f"available={money_str(available)}"
                        ),
                }
            )
            continue

        append_allocation(
            legacy_application_id=
                f"BACKFILL:{legacy_payment_id}",

            legacy_payment_id=
                legacy_payment_id,

            student_id=
                student_id,

            target_charge_key=
                target_key,

            amount=
                applied,

            legacy_period=
                "BACKFILL",

            suffix=
                index,

            source=
                "MANUAL_HISTORICAL_BACKFILL",
        )

        charge_remaining[
            target_key
        ] -= applied


for _, row in applications_work.iterrows():

    legacy_app_id = clean(row["id"])
    legacy_payment_id = clean(row["pago_id"])
    student_id = clean(row["alumno_id"])
    period = clean(row["periodo"])

    amount_to_apply = money(
        row["monto_aplicado"]
    )

    payment = payment_by_legacy_id.get(
        legacy_payment_id
    )

    if payment is None:
        anomaly_rows.append(
            {
                "severity": "ERROR",
                "type":
                    "APPLICATION_PAYMENT_NOT_FOUND",
                "legacy_id":
                    legacy_app_id,
                "details":
                    legacy_payment_id,
            }
        )
        continue

    if (
        payment["legacy_student_id"]
        != student_id
    ):
        anomaly_rows.append(
            {
                "severity": "ERROR",
                "type":
                    "APPLICATION_STUDENT_MISMATCH",
                "legacy_id":
                    legacy_app_id,
                "details":
                    legacy_payment_id,
            }
        )
        continue

    if (
        payment["legacy_payment_type"]
        != "TUITION"
    ):
        anomaly_rows.append(
            {
                "severity": "ERROR",
                "type":
                    "TUITION_APPLICATION_ON_NON_TUITION_PAYMENT",
                "legacy_id":
                    legacy_app_id,
                "details":
                    legacy_payment_id,
            }
        )
        continue

    student_code = student_code_by_id[
        student_id
    ]

    payment_date_key = (
        payment["payment_date"]
        .strftime("%Y-%m-%d")
    )

    corrected_period = (
        TUITION_APPLICATION_PERIOD_OVERRIDES.get(
            (
                student_code,
                payment_date_key,
                amount_to_apply,
                period,
            )
        )
    )

    if corrected_period:
        anomaly_rows.append(
            {
                "severity": "INFO",
                "type":
                    "LEGACY_TUITION_PERIOD_CORRECTION",
                "legacy_id":
                    legacy_app_id,
                "details":
                    (
                        f"{student_code}; "
                        f"{period} -> {corrected_period}; "
                        f"payment_date={payment_date_key}; "
                        f"amount={money_str(amount_to_apply)}"
                    ),
            }
        )

        period = corrected_period

    components = TUITION_MONTHS.get(
        period
    )

    if not components:
        anomaly_rows.append(
            {
                "severity": "ERROR",
                "type":
                    "UNKNOWN_APPLICATION_PERIOD",
                "legacy_id":
                    legacy_app_id,
                "details":
                    period,
            }
        )
        continue

    remaining_application = (
        amount_to_apply
    )

    split_index = 1

    # Sequentially:
    # DIC then JUL
    # MAR then AGO
    for (
        coverage_year,
        coverage_month,
        _due_date,
    ) in components:

        target_key = charge_key(
            student_id,
            "TUITION",
            coverage_year,
            coverage_month,
        )

        if target_key not in charge_remaining:
            anomaly_rows.append(
                {
                    "severity": "ERROR",
                    "type":
                        "APPLICATION_WITHOUT_TARGET_CHARGE",
                    "legacy_id":
                        legacy_app_id,
                    "details":
                        target_key,
                }
            )
            break

        available = charge_remaining[
            target_key
        ]

        applied = min(
            remaining_application,
            available,
        )

        if applied > 0:
            append_allocation(
                legacy_application_id=
                    legacy_app_id,

                legacy_payment_id=
                    legacy_payment_id,

                student_id=
                    student_id,

                target_charge_key=
                    target_key,

                amount=
                    applied,

                legacy_period=
                    period,

                suffix=
                    split_index,

                source=
                    "LEGACY_PAYMENT_APPLICATION",
            )

            charge_remaining[
                target_key
            ] -= applied

            remaining_application -= applied

            split_index += 1

        if remaining_application <= 0:
            break

    if remaining_application > 0:
        anomaly_rows.append(
            {
                "severity": "ERROR",
                "type":
                    "APPLICATION_EXCEEDS_RECONSTRUCTED_CHARGE",
                "legacy_id":
                    legacy_app_id,
                "details":
                    (
                        f"period={period}; "
                        f"unallocated="
                        f"{money_str(remaining_application)}"
                    ),
            }
        )


# ============================================================
# 6. ENROLLMENT-FEE PAYMENT ALLOCATIONS
# ============================================================
#
# Legacy normally has no pago_aplicaciones for Inscripción.
# We reconstruct their allocation chronologically.
# ============================================================

enrollment_payments = [
    value
    for value in payment_by_legacy_id.values()
    if value["legacy_payment_type"]
    == "ENROLLMENT_FEE"
]

enrollment_payments.sort(
    key=lambda x: (
        x["payment_date"],
        x["legacy_payment_id"],
    )
)


for payment in enrollment_payments:

    student_id = payment[
        "legacy_student_id"
    ]

    legacy_payment_id = payment[
        "legacy_payment_id"
    ]

    target_key = charge_key(
        student_id,
        "ENROLLMENT_FEE",
    )

    if target_key not in charge_remaining:
        anomaly_rows.append(
            {
                "severity": "ERROR",
                "type":
                    "ENROLLMENT_PAYMENT_WITHOUT_CHARGE",
                "legacy_id":
                    legacy_payment_id,
                "details":
                    student_id,
            }
        )
        continue

    already_allocated = (
        payment_allocated_total[
            legacy_payment_id
        ]
    )

    available_payment = (
        payment["amount_decimal"]
        - already_allocated
    )

    if available_payment <= 0:
        continue

    available_charge = (
        charge_remaining[target_key]
    )

    applied = min(
        available_payment,
        available_charge,
    )

    if applied > 0:
        synthetic_application_id = (
            f"INSCRIPTION:"
            f"{legacy_payment_id}"
        )

        append_allocation(
            legacy_application_id=
                synthetic_application_id,

            legacy_payment_id=
                legacy_payment_id,

            student_id=
                student_id,

            target_charge_key=
                target_key,

            amount=
                applied,

            legacy_period=
                "INS",

            suffix=
                1,

            source=
                "RECONSTRUCTED_ENROLLMENT_ALLOCATION",
        )

        charge_remaining[
            target_key
        ] -= applied


# ============================================================
# 7. PAYMENT RECONCILIATION + CREDIT CANDIDATES
# ============================================================

for legacy_payment_id, payment in (
    payment_by_legacy_id.items()
):

    paid = payment["amount_decimal"]

    allocated = payment_allocated_total[
        legacy_payment_id
    ]

    difference = paid - allocated

    if difference < 0:
        anomaly_rows.append(
            {
                "severity": "ERROR",
                "type":
                    "PAYMENT_OVERALLOCATED",
                "legacy_id":
                    legacy_payment_id,
                "details":
                    (
                        f"payment={money_str(paid)}; "
                        f"allocated="
                        f"{money_str(allocated)}"
                    ),
            }
        )

    elif difference > 0:
        credit_candidate_rows.append(
            {
                "legacy_payment_id":
                    legacy_payment_id,

                "legacy_student_id":
                    payment[
                        "legacy_student_id"
                    ],

                "payment_amount":
                    money_str(paid),

                "allocated_amount":
                    money_str(allocated),

                "unallocated_amount":
                    money_str(difference),

                "proposed_action":
                    "REVIEW_AS_CREDIT",
            }
        )


# ============================================================
# 8. CHARGE RECONCILIATION
# ============================================================

charge_balance_rows = []

for charge in charge_rows:

    key = charge["legacy_charge_key"]

    original = money(
        charge["original_amount"]
    )

    remaining = charge_remaining[
        key
    ]

    applied = original - remaining

    charge_balance_rows.append(
        {
            "legacy_charge_key": key,
            "legacy_student_id":
                charge["legacy_student_id"],
            "concept_code":
                charge["concept_code"],
            "coverage_year":
                charge["coverage_year"],
            "coverage_month":
                charge["coverage_month"],
            "original_amount":
                money_str(original),
            "allocated_amount":
                money_str(applied),
            "remaining_amount":
                money_str(remaining),
            "legacy_period":
                charge["legacy_period"],
        }
    )


# ============================================================
# 9. PAYMENT TOTAL VALIDATION
# ============================================================

legacy_payment_total = sum(
    (
        money(value)
        for value in pagos["monto_total"]
    ),
    Decimal("0"),
)

prepared_payment_total = sum(
    (
        money(row["amount"])
        for row in payment_rows
    ),
    Decimal("0"),
)

allocation_total = sum(
    (
        money(row["amount"])
        for row in allocation_rows
    ),
    Decimal("0"),
)

credit_candidate_total = sum(
    (
        money(row["unallocated_amount"])
        for row in credit_candidate_rows
    ),
    Decimal("0"),
)


manual_backfill_total = sum(
    (
        payment_by_legacy_id[payment_id][
            "amount_decimal"
        ]
        for payment_id in manual_backfill_payment_ids
    ),
    Decimal("0"),
)

expected_prepared_payment_total = (
    legacy_payment_total
    + manual_backfill_total
)

if (
    prepared_payment_total
    != expected_prepared_payment_total
):
    anomaly_rows.append(
        {
            "severity": "ERROR",
            "type":
                "PAYMENT_TOTAL_CHANGED_DURING_TRANSFORM",
            "legacy_id": None,
            "details":
                (
                    f"legacy="
                    f"{money_str(legacy_payment_total)}; "
                    f"manual_backfills="
                    f"{money_str(manual_backfill_total)}; "
                    f"expected_prepared="
                    f"{money_str(expected_prepared_payment_total)}; "
                    f"prepared="
                    f"{money_str(prepared_payment_total)}"
                ),
        }
    )


# ============================================================
# 10. EXPECTED SOURCE COUNTS
# ============================================================

expected_source_counts = {
    "payments": 567,
    "payment_applications": 559,
    "price_rows": 195,
}

actual_source_counts = {
    "payments": len(pagos),
    "payment_applications":
        len(aplicaciones),
    "price_rows": len(precios),
}

for key, expected in (
    expected_source_counts.items()
):
    actual = actual_source_counts[key]

    if actual != expected:
        anomaly_rows.append(
            {
                "severity": "ERROR",
                "type":
                    "UNEXPECTED_SOURCE_COUNT",
                "legacy_id": key,
                "details":
                    (
                        f"expected={expected}; "
                        f"actual={actual}"
                    ),
            }
        )


# ============================================================
# DATAFRAMES
# ============================================================

agreements_df = pd.DataFrame(
    agreement_rows
)

charges_df = pd.DataFrame(
    charge_rows
)

payments_df = pd.DataFrame(
    payment_rows
)

allocations_df = pd.DataFrame(
    allocation_rows
)

credits_df = pd.DataFrame(
    credit_candidate_rows
)

balances_df = pd.DataFrame(
    charge_balance_rows
)

anomalies_df = pd.DataFrame(
    anomaly_rows
)


# ============================================================
# OUTPUT CSV
# ============================================================

agreements_df.to_csv(
    OUTPUT_DIR
    / "historical_financial_agreements.csv",
    index=False,
)

charges_df.to_csv(
    OUTPUT_DIR
    / "historical_charges.csv",
    index=False,
)

payments_df.to_csv(
    OUTPUT_DIR
    / "historical_payments.csv",
    index=False,
)

allocations_df.to_csv(
    OUTPUT_DIR
    / "historical_payment_allocations.csv",
    index=False,
)

credits_df.to_csv(
    OUTPUT_DIR
    / "historical_credit_candidates.csv",
    index=False,
)

balances_df.to_csv(
    OUTPUT_DIR
    / "historical_charge_balances.csv",
    index=False,
)

anomalies_df.to_csv(
    REPORTS_DIR
    / "03_financial_anomalies.csv",
    index=False,
)


# ============================================================
# REPORT
# ============================================================

severity_counts = {}

if not anomalies_df.empty:
    severity_counts = (
        anomalies_df["severity"]
        .value_counts()
        .to_dict()
    )

error_count = severity_counts.get(
    "ERROR",
    0,
)

warning_count = severity_counts.get(
    "WARNING",
    0,
)

info_count = severity_counts.get(
    "INFO",
    0,
)


tuition_charge_count = sum(
    1
    for row in charge_rows
    if row["concept_code"] == "TUITION"
)

enrollment_charge_count = sum(
    1
    for row in charge_rows
    if row["concept_code"]
    == "ENROLLMENT_FEE"
)


report_lines = [
    "ETL 03 - Historical Finance Preparation",
    "=======================================",
    "",
    "SOURCE",
    f"Payments: {len(pagos)}",
    (
        "Payment applications: "
        f"{len(aplicaciones)}"
    ),
    f"Price rows: {len(precios)}",
    "",
    "PREPARED",
    (
        "Financial agreements: "
        f"{len(agreements_df)}"
    ),
    (
        "Tuition charges: "
        f"{tuition_charge_count}"
    ),
    (
        "Enrollment fee charges: "
        f"{enrollment_charge_count}"
    ),
    (
        "Total charges: "
        f"{len(charges_df)}"
    ),
    (
        "Payments: "
        f"{len(payments_df)}"
    ),
    (
        "Payment allocations: "
        f"{len(allocations_df)}"
    ),
    (
        "Credit candidates: "
        f"{len(credits_df)}"
    ),
    "",
    "MONEY",
    (
        "Legacy payment total: "
        f"${money_str(legacy_payment_total)}"
    ),
    (
        "Manual historical backfills: "
        f"${money_str(manual_backfill_total)}"
    ),
    (
        "Prepared payment total: "
        f"${money_str(prepared_payment_total)}"
    ),
    (
        "Allocation total: "
        f"${money_str(allocation_total)}"
    ),
    (
        "Unallocated / credit candidate total: "
        f"${money_str(credit_candidate_total)}"
    ),
    "",
    "ANOMALIES",
    f"Errors: {error_count}",
    f"Warnings: {warning_count}",
    f"Info: {info_count}",
    "",
    (
        "KNOWN CORRECTION: "
        "Adriana Guzmán Castro SEP allocation "
        "relinked to correct tuition payment."
    ),
    (
        "VERIFIED ENROLLMENT CORRECTIONS: "
        "A-0035=2500, A-0108=1000, A-0018=2400, A-0024=1100."
    ),
    (
        "VERIFIED DATE CORRECTION: "
        "A-0024 pre-registration payment moved from 2025-02-28 "
        "to 2024-02-28."
    ),
    (
        "VERIFIED TUITION CORRECTION: "
        "A-0106 November payment/application corrected from SEP to NOV."
    ),
    (
        "LATE ENTRY RULE: tuition periods before the first tuition "
        "valid_from are not generated."
    ),
    "",
    (
        "BAJA RULE: no withdrawal date was invented. "
        "Tuition charges for BAJA students were prepared "
        "only for legacy periods evidenced by applications."
    ),
    "",
]

if error_count:
    report_lines.append(
        "VALIDATION: FAILED"
    )
else:
    report_lines.append(
        "VALIDATION: PASS"
    )


report_path = (
    REPORTS_DIR
    / "03_historical_finance.txt"
)

report_path.write_text(
    "\n".join(report_lines),
    encoding="utf-8",
)


# ============================================================
# CONSOLE
# ============================================================

print()
print("ETL 03 - Historical Finance")
print("----------------------------")
print(
    f"agreements:           "
    f"{len(agreements_df)}"
)
print(
    f"tuition charges:      "
    f"{tuition_charge_count}"
)
print(
    f"enrollment charges:   "
    f"{enrollment_charge_count}"
)
print(
    f"payments:             "
    f"{len(payments_df)}"
)
print(
    f"allocations:          "
    f"{len(allocations_df)}"
)
print(
    f"credit candidates:    "
    f"{len(credits_df)}"
)
print()
print(
    "legacy payments:      "
    f"${money_str(legacy_payment_total)}"
)
print(
    "manual backfills:     "
    f"${money_str(manual_backfill_total)}"
)
print(
    "prepared payments:    "
    f"${money_str(prepared_payment_total)}"
)
print(
    "allocated:            "
    f"${money_str(allocation_total)}"
)
print(
    "unallocated:          "
    f"${money_str(credit_candidate_total)}"
)
print()
print(
    f"errors:               {error_count}"
)
print(
    f"warnings:             {warning_count}"
)
print(
    f"info:                 {info_count}"
)
print()
print(f"Report: {report_path}")
print(
    "Anomalies: "
    f"{REPORTS_DIR / '03_financial_anomalies.csv'}"
)

if error_count:
    print()
    print("VALIDATION: FAILED")
    print(
        "Do NOT load financial data."
    )
    sys.exit(1)

print()
print("VALIDATION: PASS")
print(
    "Financial staging is ready for review."
)