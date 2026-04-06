import { Badge, Button, Group, ScrollArea } from '@mantine/core'

export const CATEGORIES = [
  'All',
  'Math',
  'Science',
  'English/Language Arts',
  'History/Social Studies',
  'Art',
  'Music',
  'Physical Education',
  'Computer Science',
  'Foreign Languages',
  'Misc',
] as const

interface CategoryPillsProps {
  selected: string
  counts: Record<string, number>
  onSelect: (category: string) => void
}

export function CategoryPills({ selected, counts, onSelect }: CategoryPillsProps) {
  return (
    <ScrollArea type="auto" offsetScrollbars>
      <Group gap="xs" wrap="nowrap">
        {CATEGORIES.map((cat) => {
          const isSelected = selected === cat
          const count = counts[cat]
          return (
            <Button
              key={cat}
              size="xs"
              radius="xl"
              variant={isSelected ? 'filled' : 'light'}
              onClick={() => onSelect(cat)}
              style={{ flexShrink: 0 }}
            >
              {cat}
              {typeof count === 'number' && count > 0 && (
                <Badge ml={6} size="xs" variant="white" color="blue">
                  {count}
                </Badge>
              )}
            </Button>
          )
        })}
      </Group>
    </ScrollArea>
  )
}
