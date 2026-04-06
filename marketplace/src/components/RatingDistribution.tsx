import { Box, Group, Progress, Stack, Text } from '@mantine/core'

interface RatingDistributionProps {
  distribution: Record<number, number>
}

export function RatingDistribution({ distribution }: RatingDistributionProps) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0)
  const max = Math.max(...Object.values(distribution), 1)

  return (
    <Stack gap={4}>
      {[5, 4, 3, 2, 1].map((star) => {
        const count = distribution[star] ?? 0
        const percent = (count / max) * 100
        return (
          <Group key={star} gap="sm" wrap="nowrap">
            <Text size="xs" w={24} ta="right">
              {star} ★
            </Text>
            <Box flex={1}>
              <Progress value={percent} size="sm" color="yellow" />
            </Box>
            <Text size="xs" w={32} c="dimmed">
              {count}
            </Text>
          </Group>
        )
      })}
      <Text size="xs" c="dimmed" ta="right" mt="xs">
        {total} total review{total === 1 ? '' : 's'}
      </Text>
    </Stack>
  )
}
