import { TextInput } from '@mantine/core'
import { IconSearch, IconX } from '@tabler/icons-react'
import type { ChangeEvent } from 'react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchBar({ value, onChange, placeholder = 'Search educational plugins...' }: SearchBarProps) {
  return (
    <TextInput
      placeholder={placeholder}
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.currentTarget.value)}
      leftSection={<IconSearch size={16} />}
      rightSection={
        value ? (
          <IconX
            size={16}
            style={{ cursor: 'pointer' }}
            onClick={() => onChange('')}
            role="button"
            aria-label="Clear search"
          />
        ) : null
      }
      size="md"
      aria-label="Search plugins"
    />
  )
}
