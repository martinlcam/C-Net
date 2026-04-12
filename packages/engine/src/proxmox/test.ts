import { ProxmoxService } from "./service"

export interface ProxmoxConnectionTestResult {
  success: boolean
  message: string
  details?: {
    nodes?: number
    version?: string
  }
}

function fail(message: string): ProxmoxConnectionTestResult {
  return { success: false, message }
}

function classifyError(error: Error): ProxmoxConnectionTestResult {
  const msg = error.message

  if (msg.includes("401") || msg.includes("Unauthorized"))
    return fail("Authentication failed. Please check your user and token credentials.")

  if (msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED") || msg.includes("timeout"))
    return fail(
      `Connection failed. Please check the hostname/IP and ensure Proxmox is accessible. Details: ${msg}`
    )

  if (msg.includes("certificate") || msg.includes("SSL"))
    return fail(
      `SSL certificate error. Try unchecking "Verify SSL" if using a self-signed certificate. Details: ${msg}`
    )

  return fail(`Connection test failed: ${msg}`)
}

export async function testProxmoxConnection(
  host: string,
  user: string,
  token: string,
  _verifySSL = false
): Promise<ProxmoxConnectionTestResult> {
  try {
    const proxmox = new ProxmoxService(host, user, token)
    const nodes = await proxmox.getNodes()

    const firstNode = nodes?.[0]
    if (!firstNode) {
      return fail("Connection successful but no nodes found in the cluster")
    }

    try {
      await proxmox.getNodeStatus(firstNode.node)
    } catch (statusError) {
      return fail(
        `Connection successful but failed to fetch node status: ${
          statusError instanceof Error ? statusError.message : "Unknown error"
        }`
      )
    }

    return {
      success: true,
      message: `Successfully connected to Proxmox. Found ${nodes.length} node(s).`,
      details: { nodes: nodes.length },
    }
  } catch (error) {
    if (error instanceof Error) return classifyError(error)
    return fail("Unknown error occurred while testing connection")
  }
}
