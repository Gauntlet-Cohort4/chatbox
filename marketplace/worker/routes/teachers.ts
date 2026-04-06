/**
 * Teacher registration routes.
 */
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { teacherQueries } from '../db/queries'
import { badRequest, json, serverError } from '../lib/responses'
import { randomJoinCode, randomToken } from '../lib/crypto'
import type { Env } from '../types'

const RegisterBodySchema = z.object({
  teacherName: z.string().min(1).max(100),
})

const MAX_JOIN_CODE_ATTEMPTS = 10

// POST /teachers/register
export async function registerTeacher(request: Request, env: Env): Promise<Response> {
  const bodyJson = await readJson(request)
  if (bodyJson == null) return badRequest('Body must be JSON')
  const parsed = RegisterBodySchema.safeParse(bodyJson)
  if (!parsed.success) return badRequest('teacherName is required')

  const teacherId = `teacher_${nanoid(12)}`
  const apiToken = randomToken(32)

  // Collision-check join code
  let joinCode: string | null = null
  for (let attempt = 0; attempt < MAX_JOIN_CODE_ATTEMPTS; attempt++) {
    const candidate = randomJoinCode()
    const existing = await teacherQueries.getByJoinCode(env.DB, candidate)
    if (!existing) {
      joinCode = candidate
      break
    }
  }
  if (joinCode == null) {
    return serverError('Failed to generate unique join code')
  }

  await teacherQueries.register(env.DB, {
    teacherId,
    teacherName: parsed.data.teacherName,
    joinCode,
    apiToken,
    createdAt: Date.now(),
  })

  return json({ teacherId, teacherName: parsed.data.teacherName, joinCode, apiToken }, { status: 201 })
}

async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
