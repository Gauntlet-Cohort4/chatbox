import { Badge, Box, Card, Group, Image, Stack, Text } from '@mantine/core'
import { Link } from 'react-router-dom'
import type { PluginListItem } from '../types/api'
import { getPluginImageUrl } from '../api/endpoints'
import { StarRating } from './StarRating'

interface PluginCardProps {
  plugin: PluginListItem
}

export function PluginCard({ plugin }: PluginCardProps) {
  return (
    <Card
      component={Link}
      to={`/plugin/${encodeURIComponent(plugin.pluginId)}`}
      className="plugin-card"
      shadow="md"
      padding="md"
      radius="md"
      withBorder
      style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}
    >
      <Card.Section>
        {plugin.screenshotKey ? (
          <Image
            src={getPluginImageUrl(plugin.pluginId)}
            alt={`Screenshot of ${plugin.pluginName}`}
            height={160}
            fit="cover"
            fallbackSrc="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 180'><rect width='320' height='180' fill='%23eef2ff'/><text x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle' fill='%237c83ff' font-family='sans-serif' font-size='18'>No screenshot</text></svg>"
          />
        ) : (
          <Box
            h={160}
            style={{
              background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4338ca',
              fontSize: 14,
            }}
          >
            {plugin.pluginName}
          </Box>
        )}
      </Card.Section>

      <Stack gap="xs" mt="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Text fw={600} size="sm" lineClamp={1}>
            {plugin.pluginName}
          </Text>
          <Badge size="xs" variant="light" color="blue">
            {plugin.category}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed" lineClamp={1}>
          by {plugin.author}
        </Text>
        <Text size="xs" c="dimmed" lineClamp={2} mih={32}>
          {plugin.description}
        </Text>
        <StarRating rating={plugin.averageRating} totalRatings={plugin.totalRatings} size="xs" />
      </Stack>
    </Card>
  )
}
