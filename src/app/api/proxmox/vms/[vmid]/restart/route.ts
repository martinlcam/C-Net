import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
import { db } from '@/db/client'
import { infrastructureConfigs } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ProxmoxService } from '@/services/proxmox'
import { decrypt, getEncryptionPassword } from '@/lib/encryption'
import { logAuditAction } from '@/lib/audit'
import { getClientIp } from '@/lib/utils'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ vmid: string }> }
) {
  try {
    const session = await requireAuth()
    const userId = session.user.id
    const { vmid } = await params
    const ipAddress = getClientIp(request.headers)

    // Get user's Proxmox config
    const config = await db.query.infrastructureConfigs.findFirst({
      where: eq(infrastructureConfigs.userId, userId),
    })

    if (!config) {
      return NextResponse.json({ error: 'Proxmox configuration not found' }, { status: 404 })
    }

    // Decrypt token
    const password = getEncryptionPassword()
    const token = await decrypt(config.proxmoxToken, password)

    // Create Proxmox service instance
    const proxmox = new ProxmoxService(config.proxmoxHost, config.proxmoxUser, token)

    // Restart VM
    const taskId = await proxmox.restartVM(Number.parseInt(vmid, 10))

    // Log audit action
    await logAuditAction({
      userId,
      action: 'VM_RESTARTED',
      resourceType: 'vm',
      resourceId: vmid,
      status: 'success',
      ipAddress: ipAddress || undefined,
    })

    return NextResponse.json({ success: true, taskId })
  } catch (error) {
    const { vmid } = await params
    const session = await requireAuth().catch(() => null)
    
    if (session) {
      await logAuditAction({
        userId: session.user.id,
        action: 'VM_RESTARTED',
        resourceType: 'vm',
        resourceId: vmid,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: getClientIp(request.headers) || undefined,
      })
    }

    console.error('Failed to restart VM:', error)
    return NextResponse.json(
      {
        error: 'Failed to restart VM',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
