import { ProxmoxService } from '@/services/proxmox'

export interface ProxmoxConnectionTestResult {
  success: boolean
  message: string
  details?: {
    nodes?: number
    version?: string
  }
}

/**
 * Tests the connection to a Proxmox server with the provided credentials.
 * Returns a test result with success status and message.
 */
export async function testProxmoxConnection(
  host: string,
  user: string,
  token: string,
  _verifySSL = false
): Promise<ProxmoxConnectionTestResult> {
  try {
    // Create Proxmox service instance with provided credentials
    const proxmox = new ProxmoxService(host, user, token)

    // Test 1: Try to get nodes (this validates authentication and basic connection)
    const nodes = await proxmox.getNodes()

    if (!nodes || nodes.length === 0) {
      return {
        success: false,
        message: 'Connection successful but no nodes found in the cluster',
      }
    }

    // Test 2: Try to get status of the first node (validates API access)
    const firstNode = nodes[0]
    if (!firstNode) {
      return {
        success: false,
        message: 'Connection successful but no nodes found in the cluster',
      }
    }
    try {
      await proxmox.getNodeStatus(firstNode.node)
    } catch (statusError) {
      return {
        success: false,
        message: `Connection successful but failed to fetch node status: ${
          statusError instanceof Error ? statusError.message : 'Unknown error'
        }`,
      }
    }

    return {
      success: true,
      message: `Successfully connected to Proxmox. Found ${nodes.length} node(s).`,
      details: {
        nodes: nodes.length,
      },
    }
  } catch (error) {
    // Handle specific error types
    if (error instanceof Error) {
      // Authentication errors
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        return {
          success: false,
          message: 'Authentication failed. Please check your user and token credentials.',
        }
      }

      // Connection errors
      if (
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('timeout')
      ) {
        return {
          success: false,
          message: `Connection failed. Please check the hostname/IP and ensure Proxmox is accessible. Details: ${error.message}`,
        }
      }

      // SSL certificate errors
      if (error.message.includes('certificate') || error.message.includes('SSL')) {
        return {
          success: false,
          message: `SSL certificate error. Try unchecking "Verify SSL" if using a self-signed certificate. Details: ${error.message}`,
        }
      }

      // Generic error
      return {
        success: false,
        message: `Connection test failed: ${error.message}`,
      }
    }

    return {
      success: false,
      message: 'Unknown error occurred while testing connection',
    }
  }
}
