import { Alert, Anchor, Center, Loader, Stack, Text, Title } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listTeacherPlugins } from '../api/endpoints'
import { ClassroomPluginCard } from '../components/ClassroomPluginCard'
import { JoinCodeDisplay } from '../components/JoinCodeDisplay'
import type { UseAuthResult } from '../hooks/useAuth'
import type { TeacherPlugin } from '../types/api'

interface ClassroomPageProps {
  auth: UseAuthResult
}

interface Section {
  title: string
  status: TeacherPlugin['status']
  description: string
  icon: string
}

const SECTIONS: Section[] = [
  {
    title: 'Pending Review',
    status: 'pending_review',
    description: 'Download and inspect these plugins before approving.',
    icon: '⏳',
  },
  { title: 'Approved', status: 'approved', description: 'Ready to deploy to students.', icon: '✓' },
  { title: 'Deployed', status: 'deployed', description: 'Live and available to students.', icon: '●' },
  {
    title: 'Revoked',
    status: 'revoked',
    description: 'Removed from students. Re-deploy or delete.',
    icon: '⛔',
  },
]

export function ClassroomPage({ auth }: ClassroomPageProps) {
  const [plugins, setPlugins] = useState<TeacherPlugin[]>([])
  const [joinCode, setJoinCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const teacherId = auth.teacher?.teacherId ?? null

  const load = useCallback(async () => {
    if (!teacherId) return
    setLoading(true)
    try {
      const res = await listTeacherPlugins(teacherId)
      setPlugins(res.plugins)
      setJoinCode(res.joinCode)
    } catch {
      setPlugins([])
    } finally {
      setLoading(false)
    }
  }, [teacherId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <Center h={400}>
        <Loader />
      </Center>
    )
  }

  if (!teacherId) {
    return <Alert color="yellow">No teacher session found. Please re-open from ChatBridge.</Alert>
  }

  const hasAny = plugins.length > 0

  return (
    <Stack gap="lg">
      <Title order={2}>My Classroom</Title>
      {joinCode && <JoinCodeDisplay joinCode={joinCode} />}

      {!hasAny && (
        <Alert color="blue">
          Your classroom is empty.{' '}
          <Anchor component={Link} to="/">
            Browse the marketplace
          </Anchor>{' '}
          to find plugins for your students.
        </Alert>
      )}

      {SECTIONS.map((section) => {
        const items = plugins.filter((p) => p.status === section.status)
        if (items.length === 0) return null
        return (
          <Stack key={section.status} gap="xs">
            <div>
              <Title order={4}>
                {section.icon} {section.title} ({items.length})
              </Title>
              <Text size="xs" c="dimmed">
                {section.description}
              </Text>
            </div>
            <Stack gap="xs">
              {items.map((p) => (
                <ClassroomPluginCard
                  key={p.pluginId}
                  plugin={p}
                  teacherId={teacherId}
                  onChanged={() => void load()}
                />
              ))}
            </Stack>
          </Stack>
        )
      })}
    </Stack>
  )
}
