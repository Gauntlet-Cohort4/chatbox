import { SimpleGrid, Skeleton, Text } from '@mantine/core'
import type { PluginListItem } from '../types/api'
import { PluginCard } from './PluginCard'

interface PluginGridProps {
  plugins: PluginListItem[]
  isLoading: boolean
}

export function PluginGrid({ plugins, isLoading }: PluginGridProps) {
  if (isLoading) {
    const skeletonIds = ['sk-a', 'sk-b', 'sk-c', 'sk-d', 'sk-e', 'sk-f']
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {skeletonIds.map((id) => (
          <Skeleton key={id} height={300} radius="md" />
        ))}
      </SimpleGrid>
    )
  }

  if (plugins.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No plugins found. Try a different search or category.
      </Text>
    )
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      {plugins.map((p) => (
        <PluginCard key={p.pluginId} plugin={p} />
      ))}
    </SimpleGrid>
  )
}
