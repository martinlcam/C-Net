import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { db } from '@/db/client'
import { serviceCredentials } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { encrypt, getEncryptionPassword } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

const updateCredentialSchema = z.object({
  hostname: z.string().min(1, 'Hostname is required').optional(),
  port: z.number().int().min(1).max(65535, 'Port must be between 1 and 65535').optional(),
  apiKey: z.string().optional(),
})

/**
 * PATCH /api/services/credentials/[id]
 * Update an existing service credential
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const userId = session.user.id
    const { id } = await params

    const body = await request.json()
    const validated = updateCredentialSchema.parse(body)

    // Verify the credential belongs to the user
    const existing = await db.query.serviceCredentials.findFirst({
      where: and(eq(serviceCredentials.id, id), eq(serviceCredentials.userId, userId)),
    })

    if (!existing) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
    }

    // Prepare update data
    const updateData: {
      hostname?: string
      port?: number
      apiKey?: string
    } = {}

    if (validated.hostname !== undefined) {
      updateData.hostname = validated.hostname
    }

    if (validated.port !== undefined) {
      updateData.port = validated.port
    }

    // Encrypt API key if provided
    if (validated.apiKey !== undefined) {
      const password = getEncryptionPassword()
      updateData.apiKey = validated.apiKey ? await encrypt(validated.apiKey, password) : ''
    }

    // Update the credential
    const [updated] = await db
      .update(serviceCredentials)
      .set(updateData)
      .where(eq(serviceCredentials.id, id))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update credential' }, { status: 500 })
    }

    // Return updated credential without decrypted API key
    return NextResponse.json({
      data: {
        id: updated.id,
        service: updated.service,
        hostname: updated.hostname,
        port: updated.port,
        createdAt: updated.createdAt,
      },
      message: 'Credential updated successfully',
    })
  } catch (error) {
    console.error('Failed to update service credential:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    return NextResponse.json(
      {
        error: 'Failed to update credential',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/services/credentials/[id]
 * Delete a service credential
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const userId = session.user.id
    const { id } = await params

    // Verify the credential belongs to the user
    const existing = await db.query.serviceCredentials.findFirst({
      where: and(eq(serviceCredentials.id, id), eq(serviceCredentials.userId, userId)),
    })

    if (!existing) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
    }

    // Delete the credential (cascade will handle any dependent data)
    await db.delete(serviceCredentials).where(eq(serviceCredentials.id, id))

    return NextResponse.json({
      message: 'Credential deleted successfully',
    })
  } catch (error) {
    console.error('Failed to delete service credential:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete credential',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}