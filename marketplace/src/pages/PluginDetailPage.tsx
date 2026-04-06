import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Center,
  Code,
  Grid,
  Group,
  Image,
  Loader,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  addTeacherPlugin,
  getPluginDetail,
  getPluginImageUrl,
  listReviews,
} from '../api/endpoints'
import { RatingDistribution } from '../components/RatingDistribution'
import { ReportDialog } from '../components/ReportDialog'
import { ReviewForm } from '../components/ReviewForm'
import { ReviewList } from '../components/ReviewList'
import { StarRating } from '../components/StarRating'
import type { UseAuthResult } from '../hooks/useAuth'
import type { PluginDetailResponse, ReviewItem } from '../types/api'

interface PluginDetailPageProps {
  auth: UseAuthResult
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function PluginDetailPage({ auth }: PluginDetailPageProps) {
  const { pluginId = '' } = useParams<{ pluginId: string }>()
  const [plugin, setPlugin] = useState<PluginDetailResponse | null>(null)
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [addingToClassroom, setAddingToClassroom] = useState(false)
  const [reportOpened, { open: openReport, close: closeReport }] = useDisclosure(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setNotFound(false)
    try {
      const [detailRes, reviewsRes] = await Promise.all([
        getPluginDetail(pluginId),
        listReviews(pluginId).catch(() => ({ reviews: [], total: 0 })),
      ])
      setPlugin(detailRes)
      setReviews(reviewsRes.reviews)
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [pluginId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleAddToClassroom() {
    if (!auth.teacher) return
    setAddingToClassroom(true)
    try {
      await addTeacherPlugin(auth.teacher.teacherId, pluginId)
      notifications.show({
        title: 'Added to classroom',
        message: 'Review and deploy it from My Classroom.',
        color: 'green',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add plugin'
      notifications.show({ title: 'Error', message, color: 'red' })
    } finally {
      setAddingToClassroom(false)
    }
  }

  if (loading) {
    return (
      <Center h={400}>
        <Loader />
      </Center>
    )
  }

  if (notFound || !plugin) {
    return (
      <Alert color="yellow" title="Plugin not found">
        The plugin you are looking for doesn't exist or hasn't been approved yet.{' '}
        <Anchor component={Link} to="/">
          Browse other plugins
        </Anchor>
      </Alert>
    )
  }

  const capabilities = parseJson<{
    supportsScreenshot?: boolean
    supportsVerboseState?: boolean
    supportsEventLog?: boolean
  }>(plugin.capabilities, {})
  const userInterface = parseJson<{ sandboxPermissions?: string[] }>(plugin.userInterfaceConfig, {})
  const tools = parseJson<Array<{ toolName: string; toolDescription: string }>>(
    plugin.toolDefinitions,
    []
  )

  const existingReview = auth.teacher
    ? reviews.find((r) => r.teacherName === auth.teacher?.teacherName)
    : null

  return (
    <>
      <Grid>
        <Grid.Col span={{ base: 12, md: 7 }}>
          {plugin.screenshotKey ? (
            <Image
              src={getPluginImageUrl(plugin.pluginId)}
              alt={`Screenshot of ${plugin.pluginName}`}
              radius="md"
              fit="cover"
              h={360}
              fallbackSrc="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'><rect width='640' height='360' fill='%23eef2ff'/><text x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle' fill='%237c83ff' font-family='sans-serif' font-size='24'>No screenshot</text></svg>"
            />
          ) : (
            <Box
              h={360}
              style={{
                borderRadius: 8,
                background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4338ca',
                fontSize: 24,
              }}
            >
              {plugin.pluginName}
            </Box>
          )}
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack gap="sm">
            <Title order={2}>{plugin.pluginName}</Title>
            <Text c="dimmed" size="sm">
              by {plugin.author} · v{plugin.version}
            </Text>
            <Group>
              <Badge variant="light">{plugin.category}</Badge>
              <Badge color="gray" variant="light">
                {plugin.contentRating}
              </Badge>
            </Group>
            <StarRating rating={plugin.averageRating} totalRatings={plugin.totalRatings} />
            {plugin.ratingDistribution && <RatingDistribution distribution={plugin.ratingDistribution} />}
            <Text size="sm" c="dimmed">
              Bundle size: {formatBytes(plugin.bundleSizeBytes)}
            </Text>
            {auth.isAuthenticated ? (
              <>
                <Button onClick={handleAddToClassroom} loading={addingToClassroom} fullWidth>
                  Add to Classroom
                </Button>
                <Button variant="subtle" color="red" onClick={openReport} fullWidth>
                  Report plugin
                </Button>
              </>
            ) : (
              <Text size="xs" c="dimmed">
                Open this page from the ChatBridge app to add plugins to your classroom.
              </Text>
            )}
          </Stack>
        </Grid.Col>
      </Grid>

      <Tabs defaultValue="overview" mt="xl">
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="reviews">Reviews ({plugin.totalRatings})</Tabs.Tab>
          <Tabs.Tab value="technical">Technical</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <Stack gap="md">
            <Text>{plugin.description}</Text>
            {tools.length > 0 && (
              <>
                <Title order={4}>Tools</Title>
                <Stack gap="xs">
                  {tools.map((t) => (
                    <Box key={t.toolName}>
                      <Code>{t.toolName}</Code>
                      <Text size="sm" c="dimmed">
                        {t.toolDescription}
                      </Text>
                    </Box>
                  ))}
                </Stack>
              </>
            )}
            {plugin.contextPrompt && (
              <>
                <Title order={4}>Context prompt</Title>
                <Text size="sm" c="dimmed">
                  {plugin.contextPrompt}
                </Text>
              </>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="reviews" pt="md">
          <Stack gap="md">
            {auth.isAuthenticated && (
              <ReviewForm
                pluginId={pluginId}
                mode={existingReview ? 'edit' : 'create'}
                initialRating={existingReview?.rating}
                initialText={existingReview?.reviewText}
                onSubmitted={() => void loadData()}
              />
            )}
            <ReviewList reviews={reviews} />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="technical" pt="md">
          <Stack gap="md">
            <Box>
              <Text size="sm" fw={600}>
                Sandbox permissions
              </Text>
              <Group gap="xs" mt={4}>
                {(userInterface.sandboxPermissions ?? []).map((perm) => (
                  <Badge key={perm} variant="light">
                    {perm}
                  </Badge>
                ))}
              </Group>
            </Box>
            <Box>
              <Text size="sm" fw={600}>
                Capabilities
              </Text>
              <Group gap="xs" mt={4}>
                {capabilities.supportsScreenshot && <Badge variant="light">Screenshots</Badge>}
                {capabilities.supportsVerboseState && <Badge variant="light">Verbose state</Badge>}
                {capabilities.supportsEventLog && <Badge variant="light">Event log</Badge>}
              </Group>
            </Box>
            <Box>
              <Text size="sm" fw={600}>
                Bundle hash
              </Text>
              <Code block style={{ wordBreak: 'break-all' }}>
                {plugin.bundleHash}
              </Code>
            </Box>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <ReportDialog pluginId={pluginId} opened={reportOpened} onClose={closeReport} />
    </>
  )
}
