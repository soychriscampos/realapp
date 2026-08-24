import { createClient } from "@supabase/supabase-js";

const URL = "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
    console.error("❌ Falta SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const admin = createClient(URL, SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

function fail(label, error) {
    if (error) {
        console.error(`\n❌ ${label}`);
        console.error(error);
        process.exit(1);
    }
}

//
// 1. CATÁLOGOS
//

const { data: previousCycle, error: previousCycleError } = await admin
    .from("school_cycles")
    .select("id, code, starts_on, ends_on")
    .eq("code", "25-26")
    .single();

fail("No se encontró el ciclo 25-26", previousCycleError);

const { data: currentCycle, error: currentCycleError } = await admin
    .from("school_cycles")
    .select("id")
    .eq("code", "26-27")
    .single();

fail("No se encontró el ciclo 26-27", currentCycleError);

const { data: primaria, error: primariaError } = await admin
    .from("education_levels")
    .select("id")
    .eq("code", "PRIMARIA")
    .single();

fail("No se encontró Primaria", primariaError);

const { data: grades, error: gradesError } = await admin
    .from("grade_levels")
    .select("id, code")
    .eq("education_level_id", primaria.id);

fail("No se encontraron grados de Primaria", gradesError);

const gradeByCode = Object.fromEntries(
    grades.map((grade) => [grade.code, grade.id])
);

const { data: groups, error: groupsError } = await admin
    .from("groups")
    .select("id, grade_level_id, code")
    .eq("cycle_id", previousCycle.id)
    .eq("is_active", true);

fail("No se pudieron consultar los grupos del ciclo anterior", groupsError);

const { data: classifications, error: classificationsError } = await admin
    .from("enrollment_classifications")
    .select("id, code")
    .eq("is_active", true);

fail("No se encontraron clasificaciones", classificationsError);

const classificationByCode = Object.fromEntries(
    classifications.map((classification) => [
        classification.code,
        classification.id,
    ])
);

function groupForGrade(gradeId) {
    return (
        groups.find(
            (group) =>
                group.grade_level_id === gradeId &&
                group.code === "A"
        )?.id ?? null
    );
}

//
// 2. CASOS DE CONTINUIDAD
//
// Están inscritos únicamente en 25-26.
// NO deben tener enrollment en 26-27.
//

const continuityStudents = [
    {
        student_code: "DEV-CONT-001",
        full_name: "Prueba Continuidad Uno",
        sex: "H",
        birth_date: "2018-02-10",
        previous_grade: "1",
        classification: "OFFICIAL_SEP",
    },
    {
        student_code: "DEV-CONT-002",
        full_name: "Prueba Continuidad Dos",
        sex: "M",
        birth_date: "2017-05-18",
        previous_grade: "2",
        classification: "OFFICIAL_SEP",
    },
    {
        student_code: "DEV-CONT-003",
        full_name: "Prueba Continuidad Tres",
        sex: "H",
        birth_date: "2014-09-03",
        previous_grade: "5",
        classification: "CAMPUS",
    },
];

//
// 3. CREAR ALUMNOS + ENROLLMENT HISTÓRICO
//

for (const student of continuityStudents) {
    let studentId;

    const { data: existingStudents, error: existingStudentError } =
        await admin
            .from("students")
            .select("id")
            .eq("student_code", student.student_code)
            .limit(1);

    fail(
        `No se pudo consultar ${student.student_code}`,
        existingStudentError
    );

    if (existingStudents.length > 0) {
        studentId = existingStudents[0].id;
        console.log(`↺ ${student.student_code} ya existe`);
    } else {
        const { data: createdStudent, error: createStudentError } =
            await admin
                .from("students")
                .insert({
                    student_code: student.student_code,
                    full_name: student.full_name,
                    sex: student.sex,
                    birth_date: student.birth_date,
                })
                .select("id")
                .single();

        fail(
            `No se pudo crear ${student.student_code}`,
            createStudentError
        );

        studentId = createdStudent.id;
        console.log(`✓ ${student.student_code} creado`);
    }

    //
    // Seguridad: estos casos NO deben tener matrícula actual.
    //

    const { data: currentEnrollment, error: currentEnrollmentError } =
        await admin
            .from("enrollments")
            .select("id")
            .eq("student_id", studentId)
            .eq("cycle_id", currentCycle.id)
            .maybeSingle();

    fail(
        `No se pudo revisar enrollment actual de ${student.student_code}`,
        currentEnrollmentError
    );

    if (currentEnrollment) {
        console.error(
            `\n❌ ${student.student_code} ya tiene enrollment en 26-27.`
        );
        console.error(
            "Elimínalo de este caso de prueba o usa otro student_code."
        );
        process.exit(1);
    }

    //
    // Si ya tiene histórico 25-26, no duplicarlo.
    //

    const { data: previousEnrollment, error: previousEnrollmentError } =
        await admin
            .from("enrollments")
            .select("id")
            .eq("student_id", studentId)
            .eq("cycle_id", previousCycle.id)
            .maybeSingle();

    fail(
        `No se pudo revisar enrollment anterior de ${student.student_code}`,
        previousEnrollmentError
    );

    if (previousEnrollment) {
        console.log(
            `↺ ${student.student_code} ya tiene matrícula en 25-26`
        );
        continue;
    }

    const gradeId = gradeByCode[student.previous_grade];

    if (!gradeId) {
        throw new Error(
            `No existe Primaria ${student.previous_grade} en grade_levels`
        );
    }

    const classificationId =
        classificationByCode[student.classification];

    if (!classificationId) {
        throw new Error(
            `No existe clasificación ${student.classification}`
        );
    }

    const { error: enrollmentError } = await admin
        .from("enrollments")
        .insert({
            student_id: studentId,
            cycle_id: previousCycle.id,
            grade_level_id: gradeId,
            group_id: groupForGrade(gradeId),
            classification_id: classificationId,
            status: "ACTIVA",
            enrolled_on: previousCycle.starts_on,
            classes_start_on: previousCycle.starts_on,
        });

    fail(
        `No se pudo crear matrícula histórica de ${student.student_code}`,
        enrollmentError
    );

    console.log(
        `✓ ${student.student_code} — 25-26 / Primaria ${student.previous_grade} / sin 26-27`
    );
}

console.log(`
✅ Seed de continuidad completado

Casos disponibles:

DEV-CONT-001 — 1° anterior → debería sugerir 2°
DEV-CONT-002 — 2° anterior → debería sugerir 3°
DEV-CONT-003 — 5° anterior → debería sugerir 6°

Los tres:
- tienen enrollment en 25-26;
- no tienen enrollment en 26-27;
- deben aparecer en "Activar alumnos del ciclo anterior".
`);