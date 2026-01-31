import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { db } from '@/db/client'
import { serviceCredentials } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { decrypt, getEncryptionPassword } from '@/lib/encryption'
import { testServiceConnection } from '@/lib/service-test'

export const dynamic = 'force-dynamic'

const testCredentialSchema = z.object({
  credentialId: z.string().uuid().optional(),
  service: z.enum(['pi-hole', 'plex', 'minecraft', 'nas']).optional(),
  hostname: z.string().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  apiKey: z.string().optional(),
})

/**
 * POST /api/services/credentials/test
 * Test connection to a service
 * Can use either:
 * - credentialId: Test using stored credentials
 * - service + hostname + port + apiKey: Test with provided credentials
 */
export async function POST(request: Request) {
  try {
    const session = await requireAuth()

    const body = await request.json()
    const validated = testCredentialSchema.parse(body)

    let service: 'pi-hole' | 'plex' | 'minecraft' | 'nas'
    let hostname: string
    let port: number
    let apiKey: string | undefined

    if (validated.credentialId) {
      // Fetch credential from database
      const userId = session.user.id

      const credential = await db.query.serviceCredentials.findFirst({
        where: and(
          eq(serviceCredentials.id, validated.credentialId),
          eq(serviceCredentials.userId, userId)
        ),
      })

      if (!credential) {
        return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
      }

      service = credential.service
      hostname = credential.hostname
      port = credential.port

      // Decrypt API key for testing
      const password = getEncryptionPassword()
      apiKey = credential.apiKey ? await decrypt(credential.apiKey, password) : undefined
    } else {
      // Use provided credentials
      if (!validated.service || !validated.hostname || !validated.port) {
        return NextResponse.json(
          {
            error: 'Either credentialId or service + hostname + port must be provided',
          },
          { status: 400 }
        )
      }

      service = validated.service
      hostname = validated.hostname
      port = validated.port
      apiKey = validated.apiKey
    }

    // Test the connection
    const result = await testServiceConnection(service, hostname, port, apiKey)

    return NextResponse.json({
      success: result.success,
      message: result.message,
      responseTime: result.responseTime,
    })
  } catch (error) {
    console.error('Failed to test service connection:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    return NextResponse.json(
      {
        error: 'Failed to test connection',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}