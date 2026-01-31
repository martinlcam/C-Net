import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
import { db } from '@/db/client'
import { infrastructureConfigs } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { encrypt, getEncryptionPassword } from '@/lib/encryption'
import { testProxmoxConnection } from '@/lib/proxmox-test'

const configSchema = z.object({
  proxmoxHost: z.string().min(1),
  proxmoxUser: z.string().min(1),
  proxmoxToken: z.string().min(1),
  proxmoxVerifySSL: z.boolean().optional().default(false),
})

export async function GET() {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    const config = await db.query.infrastructureConfigs.findFirst({
      where: eq(infrastructureConfigs.userId, userId),
    })

    if (!config) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
    }

    // Return config without token for security
    return NextResponse.json({
      data: {
        id: config.id,
        proxmoxHost: config.proxmoxHost,
        proxmoxUser: config.proxmoxUser,
        proxmoxVerifySSL: config.proxmoxVerifySSL,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    })
  } catch (error) {
    console.error('Failed to fetch infrastructure config:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    const body = await request.json()
    const validated = configSchema.parse(body)

    // Test connection before saving
    const connectionTest = await testProxmoxConnection(
      validated.proxmoxHost,
      validated.proxmoxUser,
      validated.proxmoxToken,
      validated.proxmoxVerifySSL
    )

    if (!connectionTest.success) {
      return NextResponse.json(
        {
          error: 'Connection test failed',
          message: connectionTest.message,
        },
        { status: 400 }
      )
    }

    // Encrypt token
    const password = getEncryptionPassword()
    const encryptedToken = await encrypt(validated.proxmoxToken, password)

    // Check if config exists
    const existing = await db.query.infrastructureConfigs.findFirst({
      where: eq(infrastructureConfigs.userId, userId),
    })

    if (existing) {
      // Update existing config
      const [updated] = await db
        .update(infrastructureConfigs)
        .set({
          proxmoxHost: validated.proxmoxHost,
          proxmoxUser: validated.proxmoxUser,
          proxmoxToken: encryptedToken,
          proxmoxVerifySSL: validated.proxmoxVerifySSL ?? false,
          updatedAt: new Date(),
        })
        .where(eq(infrastructureConfigs.id, existing.id))
        .returning()

      return NextResponse.json({ data: updated, message: 'Configuration updated' })
    } else {
      // Create new config
      const [created] = await db
        .insert(infrastructureConfigs)
        .values({
          userId,
          proxmoxHost: validated.proxmoxHost,
          proxmoxUser: validated.proxmoxUser,
          proxmoxToken: encryptedToken,
          proxmoxVerifySSL: validated.proxmoxVerifySSL ?? false,
        })
        .returning()

      return NextResponse.json({ data: created, message: 'Configuration created' }, { status: 201 })
    }
  } catch (error) {
    console.error('Failed to save infrastructure config:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    return NextResponse.json(
      {
        error: 'Failed to save configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
