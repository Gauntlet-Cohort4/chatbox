import { Select } from '@mantine/core'

export type SortKey = 'rating' | 'popular' | 'newest' | 'name'

interface SortDropdownProps {
  value: SortKey
  onChange: (value: SortKey) => void
}

const OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'rating', label: 'Highest Rated' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'Name A-Z' },
]

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  return (
    <Select
      value={value}
      onChange={(v) => {
        if (v) onChange(v as SortKey)
      }}
      data={OPTIONS}
      size="sm"
      allowDeselect={false}
      aria-label="Sort plugins"
      w={180}
    />
  )
}
