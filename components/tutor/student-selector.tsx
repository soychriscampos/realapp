import Link from "next/link"
import type { TutorStudent } from "@/app/tutor/data"

export function StudentSelector({ students, selectedId, hrefBase }: { students: TutorStudent[]; selectedId: string; hrefBase: string }) {
  if (students.length <= 1) return null
  return <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Seleccionar alumno">{students.map((student) => <Link key={student.id} href={`${hrefBase}?student=${student.id}`} className={student.id === selectedId ? "shrink-0 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background" : "shrink-0 rounded-lg border border-border bg-white px-3 py-2 text-sm text-muted-foreground hover:text-foreground"}>{student.fullName}</Link>)}</div>
}

export function StudentContext({ student }: { student: TutorStudent }) {
  return <div><h1 className="text-2xl font-semibold tracking-tight">{student.fullName}</h1>{student.enrollment && <p className="mt-1 text-sm text-muted-foreground">{student.enrollment.levelName} · {student.enrollment.gradeName}{student.enrollment.groupName ? ` · ${student.enrollment.groupName}` : ""} · {student.enrollment.cycleName}</p>}</div>
}
