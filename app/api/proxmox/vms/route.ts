import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"
import { db } from "@/db/client"
import { infrastructureConfigs } from "@/db/schema"
import { eq } from "drizzle-orm"
import { ProxmoxService } from "@/services/proxmox"
import { decrypt, getEncryptionPassword } from "@/lib/encryption"

export async function GET() {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    // Get user's Proxmox config
    const config = await db.query.infrastructureConfigs.findFirst({
      where: eq(infrastructureConfigs.userId, userId),
    })

    if (!config) {
      return NextResponse.json({ error: "Proxmox configuration not found" }, { status: 404 })
    }

    // Decrypt token
    const password = getEncryptionPassword()
    const token = await decrypt(config.proxmoxToken, password)

    // Create Proxmox service instance
    const proxmox = new ProxmoxService(config.proxmoxHost, config.proxmoxUser, token)

    // Get all VMs
    const vms = await proxmox.getAllVMs()

    return NextResponse.json({ data: vms })
  } catch (error) {
    console.error("Failed to fetch VMs:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch VMs",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
