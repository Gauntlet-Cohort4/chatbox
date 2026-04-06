import { ActionIcon, Card, CopyButton, Group, Stack, Text, Tooltip } from '@mantine/core'
import { IconCheck, IconCopy } from '@tabler/icons-react'

interface JoinCodeDisplayProps {
  joinCode: string
}

export function JoinCodeDisplay({ joinCode }: JoinCodeDisplayProps) {
  return (
    <Card withBorder padding="lg" radius="md">
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          Share this code with your students
        </Text>
        <Group gap="md" align="center">
          <Text
            fw={700}
            size="xl"
            ff="monospace"
            style={{ letterSpacing: 2, fontSize: 32 }}
          >
            {joinCode}
          </Text>
          <CopyButton value={joinCode}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? 'Copied!' : 'Copy to clipboard'}>
                <ActionIcon
                  color={copied ? 'teal' : 'gray'}
                  variant="light"
                  onClick={copy}
                  aria-label="Copy join code"
                >
                  {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        </Group>
        <Text size="xs" c="dimmed">
          Students enter this code once in their ChatBridge app to receive your deployed plugins.
        </Text>
      </Stack>
    </Card>
  )
}
