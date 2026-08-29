type GradeForDestination = { id: string; education_level_id: string; sort_order: number }
type LevelForDestination = { id: string; sort_order: number }
type GroupForDestination = { id: string; cycle_id: string; grade_level_id: string }

export function nextGradeId(previousGradeId: string, grades: GradeForDestination[], levels: LevelForDestination[]) {
  const orderedGrades = [...grades].sort((left, right) => {
    const leftLevel = levels.find((level) => level.id === left.education_level_id)?.sort_order ?? Number.MAX_SAFE_INTEGER
    const rightLevel = levels.find((level) => level.id === right.education_level_id)?.sort_order ?? Number.MAX_SAFE_INTEGER
    return leftLevel - rightLevel || left.sort_order - right.sort_order
  })
  const index = orderedGrades.findIndex((grade) => grade.id === previousGradeId)
  return index >= 0 ? orderedGrades[index + 1]?.id ?? "" : ""
}

export function defaultGroupId(groups: GroupForDestination[], cycleId: string, gradeLevelId: string) {
  const compatibleGroups = groups.filter((group) => group.cycle_id === cycleId && group.grade_level_id === gradeLevelId)
  return compatibleGroups.length === 1 ? compatibleGroups[0].id : ""
}
