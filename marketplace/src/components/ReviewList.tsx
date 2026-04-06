import { Card, Group, Stack, Text } from '@mantine/core'
import type { ReviewItem } from '../types/api'
import { StarRating } from './StarRating'

interface ReviewListProps {
  reviews: ReviewItem[]
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function ReviewList({ reviews }: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="md">
        No reviews yet. Be the first to share your experience.
      </Text>
    )
  }

  return (
    <Stack gap="md">
      {reviews.map((r) => (
        <Card key={r.reviewId} withBorder padding="md">
          <Group justify="space-between" mb="xs">
            <Text fw={600} size="sm">
              {r.teacherName}
            </Text>
            <Text size="xs" c="dimmed">
              {formatDate(r.createdAt)}
            </Text>
          </Group>
          <StarRating rating={r.rating} showCount={false} size="sm" />
          {r.reviewText && (
            <Text size="sm" mt="xs">
              {r.reviewText}
            </Text>
          )}
        </Card>
      ))}
    </Stack>
  )
}
