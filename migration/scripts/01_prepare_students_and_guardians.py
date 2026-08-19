from pathlib import Path

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
# HELPERS
# ============================================================

def clean_text(value):
    if pd.isna(value):
        return None

    value = str(value).strip()

    if not value:
        return None

    return value


def clean_phone(value):
    """
    Evita que pandas convierta teléfonos como:
    526951036910.0

    en el CSV de salida.
    """

    if pd.isna(value):
        return None

    value = str(value).strip()

    if value.endswith(".0"):
        value = value[:-2]

    return value or None


def map_enrollment_status(value):
    mapping = {
        "ACTIVO": "ACTIVA",
        "BAJA": "BAJA",
    }

    value = clean_text(value)

    if value not in mapping:
        raise ValueError(
            f"Estatus legacy no reconocido: {value!r}"
        )

    return mapping[value]


def map_classification(oficial_sep):
    if bool(oficial_sep):
        return "OFFICIAL_SEP"

    return "CAMPUS"


def normalize_level(value):
    value = clean_text(value)

    mapping = {
        "Preescolar": "PREESCOLAR",
        "Primaria": "PRIMARIA",
    }

    if value not in mapping:
        raise ValueError(
            f"Nivel legacy no reconocido: {value!r}"
        )

    return mapping[value]


# ============================================================
# LOAD RAW LEGACY DATA
# ============================================================

alumnos = pd.read_csv(
    INPUT_DIR / "alumnos_rows.csv",
    dtype={
        "id": "string",
        "alumno_code": "string",
        "nombre_completo": "string",
        "sexo": "string",
        "nivel": "string",
        "grado": "Int64",
        "estatus": "string",
    },
)

contactos = pd.read_csv(
    INPUT_DIR / "contactos_rows.csv",
    dtype={
        "tutor_id": "string",
        "nombre": "string",
        "whatsapp": "string",
        "email": "string",
    },
)

alumno_contacto = pd.read_csv(
    INPUT_DIR / "alumno_contacto_rows.csv",
    dtype={
        "alumno_id": "string",
        "tutor_id": "string",
        "parentesco": "string",
        "prioridad": "Int64",
    },
)

ciclos = pd.read_csv(
    INPUT_DIR / "ciclos_rows.csv",
    dtype={
        "id": "string",
        "ciclo": "string",
    },
)


# ============================================================
# VALIDATE CYCLE
# ============================================================

cycle_rows = ciclos.loc[
    ciclos["ciclo"].str.strip() == "25-26"
]

if len(cycle_rows) != 1:
    raise ValueError(
        f"Se esperaba exactamente un ciclo 25-26; "
        f"se encontraron {len(cycle_rows)}"
    )

legacy_cycle_id = cycle_rows.iloc[0]["id"]


# ============================================================
# STUDENTS
# ============================================================
#
# Regla acordada:
# birth_date SIEMPRE NULL aunque legacy tenga información.
# ============================================================

students = pd.DataFrame(
    {
        "legacy_id": alumnos["id"].map(clean_text),
        "student_code": alumnos["alumno_code"].map(clean_text),
        "full_name": alumnos["nombre_completo"].map(clean_text),
        "sex": alumnos["sexo"].map(clean_text),

        # Intencionalmente no migramos fecha de nacimiento.
        "birth_date": None,
    }
)


# ============================================================
# GUARDIANS
# ============================================================
#
# Regla acordada:
# NO migrar ningún email legacy.
#
# Tampoco migramos cuentas/passwords.
# auth_user_id se creará posteriormente mediante onboarding.
# ============================================================

guardians = pd.DataFrame(
    {
        "legacy_id": contactos["tutor_id"].map(clean_text),
        "full_name": contactos["nombre"].map(clean_text),
        "phone": contactos["whatsapp"].map(clean_phone),

        # Intencionalmente descartamos email legacy.
        "email": None,

        # No existe usuario Auth todavía.
        "auth_user_id": None,
    }
)


# ============================================================
# STUDENT ↔ GUARDIAN
# ============================================================
#
# En esta fase conservamos legacy IDs como referencias.
#
# El LOAD posterior resolverá:
#
# legacy_student_id  -> students.id
# legacy_guardian_id -> guardians.id
#
# Como no migramos emails:
# via_email = False
# ============================================================

student_guardians = pd.DataFrame(
    {
        "legacy_student_id":
            alumno_contacto["alumno_id"].map(clean_text),

        "legacy_guardian_id":
            alumno_contacto["tutor_id"].map(clean_text),

        "relationship":
            alumno_contacto["parentesco"].map(clean_text),

        "priority":
            alumno_contacto["prioridad"],

        "via_whatsapp":
            alumno_contacto["via_whatsapp"]
            .fillna(False)
            .astype(bool),

        # No migramos email ni comunicación por email.
        "via_email": False,

        "is_active": True,
    }
)


# ============================================================
# ENROLLMENTS 25-26 — STAGING
# ============================================================
#
# Todavía NO ponemos UUIDs nuevos.
#
# El próximo script resolverá:
#
# education_level_code + grade_sort_order
#        ↓
# grade_levels.id
#
# classification_code
#        ↓
# enrollment_classifications.id
#
# 25-26
#        ↓
# school_cycles.id
#
# El legacy no tiene enrollment_id, así que generamos una
# referencia estable y legible para idempotencia/rastreo.
# ============================================================

enrollments = pd.DataFrame(
    {
        "legacy_id":
            "25-26:" + alumnos["id"].astype(str),

        "legacy_student_id":
            alumnos["id"].map(clean_text),

        "legacy_cycle_id":
            legacy_cycle_id,

        "cycle_code":
            "25-26",

        "education_level_code":
            alumnos["nivel"].map(normalize_level),

        "grade_sort_order":
            alumnos["grado"],

        "classification_code":
            alumnos["oficial_sep"].map(
                map_classification
            ),

        "status":
            alumnos["estatus"].map(
                map_enrollment_status
            ),

        # El ciclo legacy inicia el 1 de septiembre de 2025.
        "enrolled_on":
            "2025-09-01",

        "classes_start_on":
            "2025-09-01",

        # No inventamos fecha de baja.
        "closed_on":
            None,

        "academic_participation_override":
            None,
    }
)


# ============================================================
# VALIDATIONS
# ============================================================

errors = []


# ------------------------------------------------------------
# Students
# ------------------------------------------------------------

if students["legacy_id"].isna().any():
    errors.append(
        "Hay students sin legacy_id."
    )

if students["student_code"].isna().any():
    errors.append(
        "Hay students sin student_code."
    )

if students["student_code"].duplicated().any():
    duplicated = (
        students.loc[
            students["student_code"].duplicated(
                keep=False
            ),
            "student_code",
        ]
        .tolist()
    )

    errors.append(
        f"student_code duplicados: {duplicated}"
    )

if students["legacy_id"].duplicated().any():
    errors.append(
        "Hay legacy_id duplicados en students."
    )


# ------------------------------------------------------------
# Guardians
# ------------------------------------------------------------

if guardians["legacy_id"].isna().any():
    errors.append(
        "Hay guardians sin legacy_id."
    )

if guardians["full_name"].isna().any():
    errors.append(
        "Hay guardians sin nombre."
    )

if guardians["legacy_id"].duplicated().any():
    errors.append(
        "Hay legacy_id duplicados en guardians."
    )


# ------------------------------------------------------------
# Student guardians
# ------------------------------------------------------------

student_ids = set(students["legacy_id"])
guardian_ids = set(guardians["legacy_id"])

missing_students = (
    set(student_guardians["legacy_student_id"])
    - student_ids
)

missing_guardians = (
    set(student_guardians["legacy_guardian_id"])
    - guardian_ids
)

if missing_students:
    errors.append(
        "student_guardians contiene alumnos inexistentes: "
        f"{sorted(missing_students)}"
    )

if missing_guardians:
    errors.append(
        "student_guardians contiene tutores inexistentes: "
        f"{sorted(missing_guardians)}"
    )

if student_guardians[
    ["legacy_student_id", "legacy_guardian_id"]
].duplicated().any():
    errors.append(
        "Hay relaciones alumno-tutor duplicadas."
    )


# ------------------------------------------------------------
# Enrollments
# ------------------------------------------------------------

if len(enrollments) != len(students):
    errors.append(
        "El número de enrollments no coincide "
        "con el número de students."
    )

if enrollments["legacy_student_id"].duplicated().any():
    errors.append(
        "Hay más de una matrícula 25-26 "
        "para algún alumno."
    )


valid_levels = {
    "PREESCOLAR",
    "PRIMARIA",
}

invalid_levels = set(
    enrollments["education_level_code"]
) - valid_levels

if invalid_levels:
    errors.append(
        f"Niveles inválidos: {invalid_levels}"
    )


valid_grades = set(range(1, 7))

invalid_grades = (
    set(
        enrollments[
            "grade_sort_order"
        ].dropna().astype(int)
    )
    - valid_grades
)

if invalid_grades:
    errors.append(
        f"Grados inválidos: {invalid_grades}"
    )


# ------------------------------------------------------------
# Stop if anything is wrong
# ------------------------------------------------------------

if errors:
    print("\nETL VALIDATION FAILED\n")

    for error in errors:
        print(f"- {error}")

    raise SystemExit(1)


# ============================================================
# OUTPUT
# ============================================================

students.to_csv(
    OUTPUT_DIR / "students.csv",
    index=False,
)

guardians.to_csv(
    OUTPUT_DIR / "guardians.csv",
    index=False,
)

student_guardians.to_csv(
    OUTPUT_DIR / "student_guardians.csv",
    index=False,
)

enrollments.to_csv(
    OUTPUT_DIR / "enrollments_25_26.csv",
    index=False,
)


# ============================================================
# REPORT
# ============================================================

guardian_counts = (
    student_guardians
    .groupby("legacy_student_id")
    .size()
)

students_without_guardian = (
    set(students["legacy_id"])
    - set(student_guardians["legacy_student_id"])
)

report_lines = [
    "ETL 01 - Students / Guardians / Enrollments",
    "============================================",
    "",
    f"Students: {len(students)}",
    f"Guardians: {len(guardians)}",
    (
        "Student-guardian relationships: "
        f"{len(student_guardians)}"
    ),
    f"Enrollments 25-26: {len(enrollments)}",
    "",
    (
        "Students without guardian: "
        f"{len(students_without_guardian)}"
    ),
    "",
    "Enrollment status:",
    enrollments["status"]
        .value_counts()
        .to_string(),
    "",
    "Classification:",
    enrollments["classification_code"]
        .value_counts()
        .to_string(),
    "",
    "Education level:",
    enrollments["education_level_code"]
        .value_counts()
        .to_string(),
    "",
    "Guardians per student:",
    guardian_counts
        .value_counts()
        .sort_index()
        .to_string(),
    "",
    "VALIDATION: PASS",
]

report_path = (
    REPORTS_DIR
    / "01_students_and_guardians.txt"
)

report_path.write_text(
    "\n".join(report_lines),
    encoding="utf-8",
)


# ============================================================
# CONSOLE SUMMARY
# ============================================================

print()
print("ETL 01 completed successfully")
print("--------------------------------")
print(f"students:             {len(students)}")
print(f"guardians:            {len(guardians)}")
print(
    "student_guardians:    "
    f"{len(student_guardians)}"
)
print(
    "enrollments 25-26:    "
    f"{len(enrollments)}"
)
print(
    "without guardian:     "
    f"{len(students_without_guardian)}"
)
print()
print(f"Output:  {OUTPUT_DIR}")
print(f"Report:  {report_path}")