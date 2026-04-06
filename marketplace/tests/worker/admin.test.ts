// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import workerHandler from '../../worker/index'
import { createExecutionContext, createTestHarness, type TestHarness } from './helpers/test-env'

const ADMIN_HEADERS = { Authorization: 'Bearer test-admin-token' }

async function fetchJson<T = unknown>(
  harness: TestHarness,
  path: string,
  init: RequestInit = {}
): Promise<{ status: number; body: T }> {
  const request = new Request(`http://test.local${path}`, init)
  const response = await workerHandler.fetch(request, harness.env, createExecutionContext())
  const text = await response.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, body: body as T }
}

interface SubmissionListShape {
  submissions: { pluginId: string; pluginName: string; submissionStatus: string }[]
}

interface ReportListShape {
  reports: { reportId: string; reportStatus: string; pluginName: string }[]
}

describe('admin auth', () => {
  let harness: TestHarness
  beforeEach(async () => { harness = await createTestHarness() })

  it('401 without Authorization header', async () => {
    const { status } = await fetchJson(harness, '/admin/submissions')
    expect(status).toBe(401)
  })

  it('401 with wrong token', async () => {
    const { status } = await fetchJson(harness, '/admin/submissions', {
      headers: { Authorization: 'Bearer wrong-token' },
    })
    expect(status).toBe(401)
  })

  it('200 with correct token', async () => {
    const { status } = await fetchJson(harness, '/admin/submissions', { headers: ADMIN_HEADERS })
    expect(status).toBe(200)
  })
})

describe('GET /admin/submissions', () => {
  it('returns only pending plugins', async () => {
    const harness = await createTestHarness()
    const { body } = await fetchJson<SubmissionListShape>(harness, '/admin/submissions', { headers: ADMIN_HEADERS })
    expect(body.submissions.length).toBe(1)
    expect(body.submissions[0].pluginId).toBe('pending-puzzle')
  })
})

describe('PUT /admin/submissions/:pluginId/approve', () => {
  it('approves a pending plugin', async () => {
    const harness = await createTestHarness()
    const approve = await fetchJson<{ status: string }>(
      harness,
      '/admin/submissions/pending-puzzle/approve',
      { method: 'PUT', headers: ADMIN_HEADERS }
    )
    expect(approve.status).toBe(200)
    expect(approve.body.status).toBe('approved')

    // Now shows up in marketplace list
    const list = await fetchJson<{ total: number }>(harness, '/marketplace/plugins?category=Misc&limit=100')
    expect(list.body.total).toBe(1)
  })

  it('returns 404 for non-existent plugin', async () => {
    const harness = await createTestHarness()
    const { status } = await fetchJson(harness, '/admin/submissions/nonexistent/approve', {
      method: 'PUT',
      headers: ADMIN_HEADERS,
    })
    expect(status).toBe(404)
  })
})

describe('PUT /admin/submissions/:pluginId/reject', () => {
  it('rejects a pending plugin with reason', async () => {
    const harness = await createTestHarness()
    const { status, body } = await fetchJson<{ status: string }>(
      harness,
      '/admin/submissions/pending-puzzle/reject',
      {
        method: 'PUT',
        headers: { ...ADMIN_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: 'Not educational' }),
      }
    )
    expect(status).toBe(200)
    expect(body.status).toBe('rejected')
  })

  it('requires rejectionReason', async () => {
    const harness = await createTestHarness()
    const { status } = await fetchJson(harness, '/admin/submissions/pending-puzzle/reject', {
      method: 'PUT',
      headers: { ...ADMIN_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(status).toBe(400)
  })
})

describe('GET /admin/reports', () => {
  it('lists all reports with plugin name', async () => {
    const harness = await createTestHarness()
    const { status, body } = await fetchJson<ReportListShape>(harness, '/admin/reports', { headers: ADMIN_HEADERS })
    expect(status).toBe(200)
    expect(body.reports.length).toBe(1)
    expect(body.reports[0].pluginName).toBe('Color Mixer')
  })

  it('filters by status=open', async () => {
    const harness = await createTestHarness()
    const { body } = await fetchJson<ReportListShape>(harness, '/admin/reports?status=open', { headers: ADMIN_HEADERS })
    expect(body.reports.length).toBe(1)
    expect(body.reports[0].reportStatus).toBe('open')
  })

  it('filters by status=resolved (empty initially)', async () => {
    const harness = await createTestHarness()
    const { body } = await fetchJson<ReportListShape>(harness, '/admin/reports?status=resolved', { headers: ADMIN_HEADERS })
    expect(body.reports.length).toBe(0)
  })
})

describe('PUT /admin/reports/:reportId', () => {
  it('resolves a report with notes', async () => {
    const harness = await createTestHarness()
    const { status, body } = await fetchJson<{ status: string }>(
      harness,
      '/admin/reports/report_1',
      {
        method: 'PUT',
        headers: { ...ADMIN_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution: 'resolved', notes: 'Fixed in v0.6' }),
      }
    )
    expect(status).toBe(200)
    expect(body.status).toBe('resolved')

    // Now in resolved list
    const resolved = await fetchJson<ReportListShape>(harness, '/admin/reports?status=resolved', { headers: ADMIN_HEADERS })
    expect(resolved.body.reports.length).toBe(1)
  })

  it('dismisses a report', async () => {
    const harness = await createTestHarness()
    const { body } = await fetchJson<{ status: string }>(
      harness,
      '/admin/reports/report_1',
      {
        method: 'PUT',
        headers: { ...ADMIN_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution: 'dismissed' }),
      }
    )
    expect(body.status).toBe('dismissed')
  })

  it('returns 404 for non-existent report', async () => {
    const harness = await createTestHarness()
    const { status } = await fetchJson(harness, '/admin/reports/nonexistent', {
      method: 'PUT',
      headers: { ...ADMIN_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution: 'resolved' }),
    })
    expect(status).toBe(404)
  })

  it('rejects invalid resolution value', async () => {
    const harness = await createTestHarness()
    const { status } = await fetchJson(harness, '/admin/reports/report_1', {
      method: 'PUT',
      headers: { ...ADMIN_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution: 'invalid' }),
    })
    expect(status).toBe(400)
  })
})
