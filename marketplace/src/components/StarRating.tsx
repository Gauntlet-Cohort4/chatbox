import { Group, Text } from '@mantine/core'

interface StarRatingProps {
  rating: number
  totalRatings?: number
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showCount?: boolean
}

function starChar(index: number, rating: number): string {
  if (rating >= index + 1) return '★'
  if (rating >= index + 0.5) return '★' // simple full-star treatment for half
  return '☆'
}

export function StarRating({ rating, totalRatings, size = 'sm', showCount = true }: StarRatingProps) {
  const rounded = Math.round(rating * 10) / 10
  return (
    <Group gap={4} align="center">
      <Text size={size} c="yellow.6" aria-label={`${rounded} stars`}>
        {[0, 1, 2, 3, 4].map((i) => starChar(i, rating)).join('')}
      </Text>
      {showCount && (
        <Text size={size} c="dimmed">
          {rounded.toFixed(1)}
          {typeof totalRatings === 'number' && ` (${totalRatings})`}
        </Text>
      )}
    </Group>
  )
}
