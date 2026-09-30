import { computed, ref, type Ref } from 'vue'

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  key: string
  direction: SortDirection
}

export type Accessor<T> = Record<string, (row: T) => string | number>

/**
 * Client-side column sorting for admin tables: one click ascends, a second
 * click on the same column flips direction.
 */
export function useTableSort<T>(rows: Ref<T[]>, accessor: Accessor<T>, initialKey: string) {
  const sort = ref<SortState>({ key: initialKey, direction: 'asc' })

  function toggle(key: string): void {
    if (sort.value.key === key) {
      sort.value.direction = sort.value.direction === 'asc' ? 'desc' : 'asc'
    } else {
      sort.value = { key, direction: 'asc' }
    }
  }

  const sorted = computed<T[]>(() => {
    const read = accessor[sort.value.key]
    if (!read) return rows.value
    const factor = sort.value.direction === 'asc' ? 1 : -1
    return [...rows.value].sort((a, b) => {
      const left = read(a)
      const right = read(b)
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor
      return String(left).localeCompare(String(right)) * factor
    })
  })

  function ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    if (sort.value.key !== key) return 'none'
    return sort.value.direction === 'asc' ? 'ascending' : 'descending'
  }

  return { sort, sorted, toggle, ariaSort }
}