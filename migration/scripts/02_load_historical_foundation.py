from pathlib import Path
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
# HELPERS
# ============================================================

def clean(value):
    if pd.isna(value):
        return None

    value = str(value).strip()

    if value == "":
        return None

    return value


def bool_value(value):
    if pd.isna(value):
        return False

    if isinstance(value, bool):
        return value

    return str(value).strip().lower() in {
        "true",
        "1",
        "t",
        "yes",
        "si",
        "sí",
    }


def fetch_exactly_one(table, filters, label):
    query = supabase.table(table).select("*")

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


def fetch_zero_or_one(table, filters, label):
    query = supabase.table(table).select("*")

    for key, value in filters.items():
        query = query.eq(key, value)

    rows = query.execute().data

    if len(rows) > 1:
        raise RuntimeError(
            f"{label}: duplicate target rows found. "
            f"Filters: {filters}"
        )

    if len(rows) == 0:
        return None

    return rows[0]


# ============================================================
# LOAD STAGING OUTPUTS FROM ETL 01
# ============================================================

students_df = pd.read_csv(
    OUTPUT_DIR / "students.csv",
    dtype="string",
)

guardians_df = pd.read_csv(
    OUTPUT_DIR / "guardians.csv",
    dtype="string",
)

student_guardians_df = pd.read_csv(
    OUTPUT_DIR / "student_guardians.csv",
    dtype="string",
)

enrollments_df = pd.read_csv(
    OUTPUT_DIR / "enrollments_25_26.csv",
    dtype="string",
)


# ============================================================
# PRE-FLIGHT COUNTS
# ============================================================

EXPECTED = {
    "students": 99,
    "guardians": 132,
    "student_guardians": 163,
    "enrollments": 99,
}

actual = {
    "students": len(students_df),
    "guardians": len(guardians_df),
    "student_guardians": len(student_guardians_df),
    "enrollments": len(enrollments_df),
}

for name, expected_count in EXPECTED.items():
    if actual[name] != expected_count:
        raise RuntimeError(
            f"{name}: expected {expected_count}, "
            f"found {actual[name]}"
        )


# ============================================================
# RESOLVE TARGET CATALOGS
# ============================================================

cycle = fetch_exactly_one(
    "school_cycles",
    {"code": "25-26"},
    "Historical cycle 25-26",
)

cycle_id = cycle["id"]


classifications = {}

for code in ["OFFICIAL_SEP", "CAMPUS"]:
    row = fetch_exactly_one(
        "enrollment_classifications",
        {"code": code},
        f"Classification {code}",
    )

    classifications[code] = row["id"]


education_levels = {}

for code in ["PREESCOLAR", "PRIMARIA"]:
    row = fetch_exactly_one(
        "education_levels",
        {"code": code},
        f"Education level {code}",
    )

    education_levels[code] = row["id"]


# ============================================================
# GRADE MAP
# ============================================================
#
# ETL 01 dejó:
#
# education_level_code
# grade_sort_order
#
# Ejemplo:
# PRIMARIA + 3
#
# Los resolvemos contra los catálogos reales.
# ============================================================

grade_map = {}

for level_code, education_level_id in education_levels.items():

    rows = (
        supabase
        .table("grade_levels")
        .select("id,education_level_id,code,name,sort_order")
        .eq("education_level_id", education_level_id)
        .execute()
        .data
    )

    for row in rows:
        grade_map[
            (
                level_code,
                int(row["sort_order"]),
            )
        ] = row["id"]


# ============================================================
# GROUP MAP — HISTORICAL GROUP A
# ============================================================

group_map = {}

groups = (
    supabase
    .table("groups")
    .select("id,cycle_id,grade_level_id,code")
    .eq("cycle_id", cycle_id)
    .eq("code", "A")
    .execute()
    .data
)

for row in groups:
    group_map[row["grade_level_id"]] = row["id"]


# ============================================================
# RESULT MAPS
# ============================================================

student_id_map = {}
guardian_id_map = {}

stats = {
    "students_inserted": 0,
    "students_updated": 0,

    "guardians_inserted": 0,
    "guardians_updated": 0,

    "student_guardians_inserted": 0,
    "student_guardians_updated": 0,

    "enrollments_inserted": 0,
    "enrollments_updated": 0,
}


# ============================================================
# 1. STUDENTS
# ============================================================

print()
print("Loading students...")

for _, row in students_df.iterrows():

    legacy_id = clean(row["legacy_id"])

    payload = {
        "student_code": clean(row["student_code"]),
        "full_name": clean(row["full_name"]),
        "sex": clean(row["sex"]),

        # Regla explícita de migración.
        "birth_date": None,

        "legacy_id": legacy_id,
    }

    existing = fetch_zero_or_one(
        "students",
        {"legacy_id": legacy_id},
        f"Student legacy_id={legacy_id}",
    )

    if existing is None:

        result = (
            supabase
            .table("students")
            .insert(payload)
            .execute()
        )

        new_row = result.data[0]

        stats["students_inserted"] += 1

    else:

        (
            supabase
            .table("students")
            .update(payload)
            .eq("id", existing["id"])
            .execute()
        )

        new_row = {
            **existing,
            **payload,
        }

        stats["students_updated"] += 1

    student_id_map[legacy_id] = new_row["id"]


# ============================================================
# 2. GUARDIANS
# ============================================================

print("Loading guardians...")

for _, row in guardians_df.iterrows():

    legacy_id = clean(row["legacy_id"])

    payload = {
        "full_name": clean(row["full_name"]),
        "phone": clean(row["phone"]),

        # Regla explícita:
        # no migrar emails legacy.
        "email": None,

        # Auth se resolverá por onboarding nuevo.
        "auth_user_id": None,

        "legacy_id": legacy_id,
    }

    existing = fetch_zero_or_one(
        "guardians",
        {"legacy_id": legacy_id},
        f"Guardian legacy_id={legacy_id}",
    )

    if existing is None:

        result = (
            supabase
            .table("guardians")
            .insert(payload)
            .execute()
        )

        new_row = result.data[0]

        stats["guardians_inserted"] += 1

    else:

        (
            supabase
            .table("guardians")
            .update(payload)
            .eq("id", existing["id"])
            .execute()
        )

        new_row = {
            **existing,
            **payload,
        }

        stats["guardians_updated"] += 1

    guardian_id_map[legacy_id] = new_row["id"]


# ============================================================
# 3. STUDENT ↔ GUARDIAN
# ============================================================

print("Loading student_guardians...")

for _, row in student_guardians_df.iterrows():

    legacy_student_id = clean(
        row["legacy_student_id"]
    )

    legacy_guardian_id = clean(
        row["legacy_guardian_id"]
    )

    student_id = student_id_map.get(
        legacy_student_id
    )

    guardian_id = guardian_id_map.get(
        legacy_guardian_id
    )

    if not student_id:
        raise RuntimeError(
            f"Missing mapped student: "
            f"{legacy_student_id}"
        )

    if not guardian_id:
        raise RuntimeError(
            f"Missing mapped guardian: "
            f"{legacy_guardian_id}"
        )

    relationship = clean(row["relationship"])

    if not relationship:
        # Target requires NOT NULL.
        # We don't invent a family relationship;
        # use a neutral historical label.
        relationship = "NO_ESPECIFICADO"

    priority_raw = clean(row["priority"])

    if priority_raw is None:
        raise RuntimeError(
            "student_guardians contains "
            "a NULL priority"
        )

    priority = int(float(priority_raw))

    payload = {
        "student_id": student_id,
        "guardian_id": guardian_id,
        "relationship": relationship,
        "priority": priority,
        "via_whatsapp": bool_value(
            row["via_whatsapp"]
        ),

        # Email legacy no se migra.
        "via_email": False,

        "is_active": True,

        # Relación histórica disponible al inicio
        # del ciclo migrado.
        "started_at": "2025-09-01",

        "ended_at": None,
    }

    existing = fetch_zero_or_one(
        "student_guardians",
        {
            "student_id": student_id,
            "guardian_id": guardian_id,
        },
        (
            "student_guardian "
            f"{legacy_student_id}/"
            f"{legacy_guardian_id}"
        ),
    )

    if existing is None:

        (
            supabase
            .table("student_guardians")
            .insert(payload)
            .execute()
        )

        stats[
            "student_guardians_inserted"
        ] += 1

    else:

        (
            supabase
            .table("student_guardians")
            .update(payload)
            .eq("id", existing["id"])
            .execute()
        )

        stats[
            "student_guardians_updated"
        ] += 1


# ============================================================
# 4. ENROLLMENTS 25-26
# ============================================================

print("Loading enrollments 25-26...")

for _, row in enrollments_df.iterrows():

    legacy_enrollment_id = clean(
        row["legacy_id"]
    )

    legacy_student_id = clean(
        row["legacy_student_id"]
    )

    student_id = student_id_map.get(
        legacy_student_id
    )

    if not student_id:
        raise RuntimeError(
            f"Missing student for enrollment: "
            f"{legacy_student_id}"
        )


    level_code = clean(
        row["education_level_code"]
    )

    grade_number = int(
        float(row["grade_sort_order"])
    )

    grade_level_id = grade_map.get(
        (level_code, grade_number)
    )

    if not grade_level_id:
        raise RuntimeError(
            "Unable to resolve grade: "
            f"{level_code} {grade_number}"
        )


    group_id = group_map.get(
        grade_level_id
    )

    if not group_id:
        raise RuntimeError(
            "Historical group A not found for "
            f"{level_code} {grade_number}"
        )


    classification_code = clean(
        row["classification_code"]
    )

    classification_id = classifications.get(
        classification_code
    )

    if not classification_id:
        raise RuntimeError(
            "Unknown classification: "
            f"{classification_code}"
        )


    status = clean(row["status"])

    if status not in {
        "ACTIVA",
        "BAJA",
    }:
        raise RuntimeError(
            f"Unexpected enrollment status: {status}"
        )


    payload = {
        "student_id": student_id,
        "cycle_id": cycle_id,
        "grade_level_id": grade_level_id,
        "group_id": group_id,
        "classification_id": classification_id,

        "academic_participation_override":
            None,

        "status": status,

        "enrolled_on": clean(
            row["enrolled_on"]
        ),

        "classes_start_on": clean(
            row["classes_start_on"]
        ),

        # No inventamos fecha histórica de baja.
        "closed_on": None,

        # ETL ejecutado administrativamente.
        "created_by": None,

        "legacy_id": legacy_enrollment_id,
    }


    # La regla estructural real es:
    #
    # UNIQUE(student_id, cycle_id)
    #
    # Por eso usamos esa combinación para
    # idempotencia, no legacy_id.

    existing = fetch_zero_or_one(
        "enrollments",
        {
            "student_id": student_id,
            "cycle_id": cycle_id,
        },
        (
            "Enrollment "
            f"{legacy_student_id} / 25-26"
        ),
    )

    if existing is None:

        (
            supabase
            .table("enrollments")
            .insert(payload)
            .execute()
        )

        stats["enrollments_inserted"] += 1

    else:

        (
            supabase
            .table("enrollments")
            .update(payload)
            .eq("id", existing["id"])
            .execute()
        )

        stats["enrollments_updated"] += 1


# ============================================================
# POST-LOAD VALIDATION
# ============================================================

print()
print("Validating loaded data...")


# Students imported from legacy
loaded_students = (
    supabase
    .table("students")
    .select("id,legacy_id", count="exact")
    .not_.is_("legacy_id", "null")
    .execute()
)

student_count = loaded_students.count


# Guardians imported from legacy
loaded_guardians = (
    supabase
    .table("guardians")
    .select("id,legacy_id", count="exact")
    .not_.is_("legacy_id", "null")
    .execute()
)

guardian_count = loaded_guardians.count


# Historical enrollments
loaded_enrollments = (
    supabase
    .table("enrollments")
    .select("id", count="exact")
    .eq("cycle_id", cycle_id)
    .execute()
)

enrollment_count = loaded_enrollments.count


# Relationships specifically between imported entities
loaded_relationships = (
    supabase
    .table("student_guardians")
    .select("id,student_id,guardian_id")
    .execute()
    .data
)

imported_student_ids = set(
    student_id_map.values()
)

imported_guardian_ids = set(
    guardian_id_map.values()
)

relationship_count = sum(
    1
    for rel in loaded_relationships
    if rel["student_id"] in imported_student_ids
    and rel["guardian_id"] in imported_guardian_ids
)


# ============================================================
# STRICT VALIDATION
# ============================================================

validation_errors = []

if student_count != 99:
    validation_errors.append(
        f"Expected 99 legacy students, "
        f"found {student_count}"
    )

if guardian_count != 132:
    validation_errors.append(
        f"Expected 132 legacy guardians, "
        f"found {guardian_count}"
    )

if relationship_count != 163:
    validation_errors.append(
        f"Expected 163 student_guardians, "
        f"found {relationship_count}"
    )

if enrollment_count != 99:
    validation_errors.append(
        f"Expected 99 enrollments 25-26, "
        f"found {enrollment_count}"
    )


# Birth dates must all be null by migration rule.
birth_dates = (
    supabase
    .table("students")
    .select("id,birth_date")
    .in_("id", list(imported_student_ids))
    .execute()
    .data
)

with_birth_date = [
    row
    for row in birth_dates
    if row["birth_date"] is not None
]

if with_birth_date:
    validation_errors.append(
        f"{len(with_birth_date)} imported students "
        "have birth_date but should be NULL"
    )


# Emails must all be null by migration rule.
guardian_emails = (
    supabase
    .table("guardians")
    .select("id,email")
    .in_("id", list(imported_guardian_ids))
    .execute()
    .data
)

with_email = [
    row
    for row in guardian_emails
    if row["email"] is not None
]

if with_email:
    validation_errors.append(
        f"{len(with_email)} imported guardians "
        "have email but should be NULL"
    )


# ============================================================
# REPORT
# ============================================================

report_lines = [
    "ETL 02 - Historical Foundation Load",
    "===================================",
    "",
    f"Cycle: 25-26 ({cycle_id})",
    "",
    "Operations:",
    (
        f"Students inserted: "
        f"{stats['students_inserted']}"
    ),
    (
        f"Students updated: "
        f"{stats['students_updated']}"
    ),
    (
        f"Guardians inserted: "
        f"{stats['guardians_inserted']}"
    ),
    (
        f"Guardians updated: "
        f"{stats['guardians_updated']}"
    ),
    (
        "Student guardians inserted: "
        f"{stats['student_guardians_inserted']}"
    ),
    (
        "Student guardians updated: "
        f"{stats['student_guardians_updated']}"
    ),
    (
        f"Enrollments inserted: "
        f"{stats['enrollments_inserted']}"
    ),
    (
        f"Enrollments updated: "
        f"{stats['enrollments_updated']}"
    ),
    "",
    "Final counts:",
    f"Legacy students: {student_count}",
    f"Legacy guardians: {guardian_count}",
    (
        "Student guardian relationships: "
        f"{relationship_count}"
    ),
    (
        "Enrollments 25-26: "
        f"{enrollment_count}"
    ),
    "",
    (
        "Students with birth_date: "
        f"{len(with_birth_date)}"
    ),
    (
        "Guardians with email: "
        f"{len(with_email)}"
    ),
]

if validation_errors:

    report_lines += [
        "",
        "VALIDATION: FAILED",
        "",
    ]

    report_lines.extend(
        f"- {error}"
        for error in validation_errors
    )

else:

    report_lines += [
        "",
        "VALIDATION: PASS",
    ]


report_path = (
    REPORTS_DIR
    / "02_historical_foundation_load.txt"
)

report_path.write_text(
    "\n".join(report_lines),
    encoding="utf-8",
)


# ============================================================
# FINAL
# ============================================================

if validation_errors:

    print()
    print("ETL 02 VALIDATION FAILED")
    print("------------------------")

    for error in validation_errors:
        print(f"- {error}")

    print()
    print(f"Report: {report_path}")

    sys.exit(1)


print()
print("ETL 02 completed successfully")
print("--------------------------------")
print(f"legacy students:       {student_count}")
print(f"legacy guardians:      {guardian_count}")
print(
    "student_guardians:     "
    f"{relationship_count}"
)
print(
    "enrollments 25-26:     "
    f"{enrollment_count}"
)
print("birth dates migrated:  0")
print("guardian emails:       0")
print()
print(f"Report: {report_path}")