"use client"

import { useMemo, useState } from "react"

export function useEnrollmentSelection({ availableKeys }: { availableKeys: string[] }) {
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectedKeysState, setSelectedKeys] = useState<string[]>([])
  const availableKeySet = useMemo(() => new Set(availableKeys), [availableKeys])
  const selectedKeys = useMemo(() => selectedKeysState.filter((key) => availableKeySet.has(key)), [availableKeySet, selectedKeysState])
  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys])
  const selectedCount = selectedKeys.length
  const allSelected = availableKeys.length > 0 && selectedCount === availableKeys.length
  const someSelected = selectedCount > 0 && !allSelected

  function enterSelectionMode() {
    setIsSelecting(true)
  }

  function exitSelectionMode() {
    setIsSelecting(false)
    setSelectedKeys([])
  }

  function toggle(key: string) {
    setSelectedKeys((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key])
  }

  function toggleAll() {
    setSelectedKeys(allSelected ? [] : [...availableKeys])
  }

  function remove(key: string) {
    setSelectedKeys((current) => current.filter((item) => item !== key))
  }

  return {
    isSelecting,
    selectedKeys,
    selectedKeySet,
    selectedCount,
    allSelected,
    someSelected,
    enterSelectionMode,
    exitSelectionMode,
    toggle,
    toggleAll,
    remove,
  }
}
