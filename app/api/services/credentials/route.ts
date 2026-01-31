import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { db } from '@/db/client'
import { serviceCredentials } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { encrypt, getEncryptionPassword } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

const createCredentialSchema = z.object({
  service: z.enum(['pi-hole', 'plex', 'minecraft', 'nas']),
  hostname: z.string().min(1, 'Hostname is required'),
  port: z.number().int().min(1).max(65535, 'Port must be between 1 and 65535'),
  apiKey: z.string().optional(),
})

/**
 * GET /api/services/credentials
 * List all service credentials for the authenticated user
 */
export async function GET() {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    const credentials = await db.query.serviceCredentials.findMany({
      where: eq(serviceCredentials.userId, userId),
      orderBy: (credentials, { asc }) => [asc(credentials.service), asc(credentials.createdAt)],
    })

    // Return credentials without decrypted API keys for security
    const safeCredentials = credentials.map((cred) => ({
      id: cred.id,
      service: cred.service,
      hostname: cred.hostname,
      port: cred.port,
      createdAt: cred.createdAt,
      // API key is NOT included in response
    }))

    return NextResponse.json({ data: safeCredentials })
  } catch (error) {
    console.error('Failed to fetch service credentials:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch credentials',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/services/credentials
 * Create a new service credential
 */
export async function POST(request: Request) {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    const body = await request.json()
    const validated = createCredentialSchema.parse(body)

    // Validate API key requirement based on service type
    if (validated.service !== 'minecraft' && !validated.apiKey) {
      return NextResponse.json(
        { error: 'API key is required for this service type' },
        { status: 400 }
      )
    }

    // Check if user already has a credential for this service type
    const existing = await db.query.serviceCredentials.findFirst({
      where: and(
        eq(serviceCredentials.userId, userId),
        eq(serviceCredentials.service, validated.service)
      ),
    })

    if (existing) {
      return NextResponse.json(
        { error: `A credential for ${validated.service} already exists. Please update or delete it first.` },
        { status: 409 }
      )
    }

    // Encrypt API key before storing
    const password = getEncryptionPassword()
    const encryptedApiKey = validated.apiKey
      ? await encrypt(validated.apiKey, password)
      : ''

    // Create new credential
    const [created] = await db
      .insert(serviceCredentials)
      .values({
        userId,
        service: validated.service,
        hostname: validated.hostname,
        port: validated.port,
        apiKey: encryptedApiKey,
      })
      .returning()

    if (!created) {
      return NextResponse.json({ error: 'Failed to create credential' }, { status: 500 })
    }

    // Return created credential without decrypted API key
    return NextResponse.json(
      {
        data: {
          id: created.id,
          service: created.service,
          hostname: created.hostname,
          port: created.port,
          createdAt: created.createdAt,
        },
        message: 'Credential created successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Failed to create service credential:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    return NextResponse.json(
      {
        error: 'Failed to create credential',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}