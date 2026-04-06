/**
 * Top-level layout shell: sticky header, main content area, footer.
 */
import { AppShell, Burger, Button, Group, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { UseAuthResult } from '../hooks/useAuth'

interface LayoutProps {
  children: ReactNode
  auth: UseAuthResult
}

export function Layout({ children, auth }: LayoutProps) {
  const [opened, { toggle, close }] = useDisclosure()
  const location = useLocation()

  const navLinks = [
    { to: '/', label: 'Browse' },
    { to: '/submit', label: 'Submit Plugin' },
    ...(auth.isAuthenticated ? [{ to: '/classroom', label: 'My Classroom' }] : []),
    { to: '/admin', label: 'Admin' },
  ]

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { desktop: true, mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text component={Link} to="/" size="lg" fw={700} c="blue" style={{ textDecoration: 'none' }}>
              ChatBridge Marketplace
            </Text>
          </Group>
          <Group gap="md" visibleFrom="sm">
            {navLinks.map((link) => (
              <Button
                key={link.to}
                component={Link}
                to={link.to}
                variant={location.pathname === link.to ? 'light' : 'subtle'}
                size="sm"
              >
                {link.label}
              </Button>
            ))}
            {auth.isAuthenticated && auth.teacher && (
              <Group gap="xs">
                <Text size="sm" c="dimmed">
                  {auth.teacher.teacherName}
                </Text>
                <Button size="xs" variant="subtle" onClick={auth.logout}>
                  Sign out
                </Button>
              </Group>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        {navLinks.map((link) => (
          <Button
            key={link.to}
            component={Link}
            to={link.to}
            variant={location.pathname === link.to ? 'light' : 'subtle'}
            fullWidth
            onClick={close}
            mb="xs"
          >
            {link.label}
          </Button>
        ))}
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
