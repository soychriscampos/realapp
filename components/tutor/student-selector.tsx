import Link from "next/link"
import type { TutorStudent } from "@/app/tutor/data"
import type { TutorCycle } from "@/app/tutor/data"

export function StudentSelector({ students, selectedId, hrefBase, cycleId }: { students: TutorStudent[]; selectedId: string; hrefBase: string; cycleId?: string }) {
  if (students.length <= 1) return null
  return <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Seleccionar alumno">{students.map((student) => <Link key={student.id} href={`${hrefBase}?student=${student.id}${cycleId ? `&cycle=${cycleId}` : ""}`} className={student.id === selectedId ? "shrink-0 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background" : "shrink-0 rounded-lg border border-border bg-white px-3 py-2 text-sm text-muted-foreground hover:text-foreground"}>{student.fullName}</Link>)}</div>
}

export function CycleSelector({ cycles, selectedId, studentId, hrefBase }: { cycles: TutorCycle[]; selectedId: string; studentId: string; hrefBase: string }) {
  if (!cycles.length) return <p className="text-sm text-muted-foreground">Sin ciclo disponible</p>
  if (cycles.length === 1) return <p className="text-sm text-muted-foreground">{cycles[0].name}</p>
  return <div className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Seleccionar ciclo escolar">{cycles.map((cycle) => <Link key={cycle.id} href={`${hrefBase}?student=${studentId}&cycle=${cycle.id}`} className={cycle.id === selectedId ? "shrink-0 rounded-lg border border-foreground bg-foreground px-3 py-2 text-sm font-medium text-background" : "shrink-0 rounded-lg border border-border bg-white px-3 py-2 text-sm text-muted-foreground hover:text-foreground"}>{cycle.name}</Link>)}</div>
}

export function StudentContext({ student }: { student: TutorStudent }) {
  return <div><h1 className="text-2xl font-semibold tracking-tight">{student.fullName}</h1>{student.enrollment && <p className="mt-1 text-sm text-muted-foreground">{student.enrollment.levelName} · {student.enrollment.gradeName}{student.enrollment.groupName ? ` · ${student.enrollment.groupName}` : ""} · {student.enrollment.cycleName}</p>}</div>
}
