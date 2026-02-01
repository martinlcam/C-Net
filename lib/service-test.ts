import axios from 'axios'

export interface ServiceTestResult {
  success: boolean
  message?: string
  responseTime?: number
}

/**
 * Test Pi-hole connection by querying the API endpoint
 */
export async function testPiHoleConnection(
  hostname: string,
  port: number,
  apiKey?: string
): Promise<ServiceTestResult> {
  const startTime = Date.now()
  try {
    const protocol = port === 443 ? 'https' : 'http'
    const url = `${protocol}://${hostname}:${port}/admin/api.php?summaryRaw`

    const response = await axios.get(url, {
      timeout: 5000,
      params: apiKey ? { auth: apiKey } : {},
      validateStatus: (status) => status < 500, // Accept 200-499 as success for connection test
    })

    const responseTime = Date.now() - startTime

    if (response.status === 200 && response.data) {
      return {
        success: true,
        message: 'Pi-hole connection successful',
        responseTime,
      }
    } else {
      return {
        success: false,
        message: `Pi-hole returned status ${response.status}`,
        responseTime,
      }
    }
  } catch (error) {
    const responseTime = Date.now() - startTime
    return {
      success: false,
      message: `Failed to connect to Pi-hole: ${error instanceof Error ? error.message : 'Unknown error'}`,
      responseTime,
    }
  }
}

/**
 * Test Plex connection by checking the root endpoint
 */
export async function testPlexConnection(
  hostname: string,
  port: number,
  apiKey?: string
): Promise<ServiceTestResult> {
  const startTime = Date.now()
  try {
    const protocol = port === 443 ? 'https' : 'http'
    const url = `${protocol}://${hostname}:${port}/`

    const headers: Record<string, string> = {}
    if (apiKey) {
      headers['X-Plex-Token'] = apiKey
    }

    const response = await axios.get(url, {
      timeout: 5000,
      headers,
      validateStatus: (status) => status < 500,
    })

    const responseTime = Date.now() - startTime

    if (response.status === 200 || response.status === 401) {
      // 401 means the server is reachable but authentication may be needed
      return {
        success: true,
        message: 'Plex connection successful',
        responseTime,
      }
    } else {
      return {
        success: false,
        message: `Plex returned status ${response.status}`,
        responseTime,
      }
    }
  } catch (error) {
    const responseTime = Date.now() - startTime
    return {
      success: false,
      message: `Failed to connect to Plex: ${error instanceof Error ? error.message : 'Unknown error'}`,
      responseTime,
    }
  }
}

/**
 * Test Minecraft server connection using the server list ping protocol
 * For simplicity, we'll try a basic TCP connection check via HTTP endpoint if available,
 * or use a simple timeout-based TCP check
 */
export async function testMinecraftConnection(
  hostname: string,
  port: number
): Promise<ServiceTestResult> {
  const startTime = Date.now()
  try {
    // Basic TCP connection test - try to establish a connection
    // Note: This is a simplified check. Full Minecraft server list ping would require
    // a specialized library. For now, we'll try a simple HTTP check if there's a web interface,
    // otherwise we'll use a basic connectivity test.
    const net = await import('node:net')
    const socket = new net.Socket()

    const connectionPromise = new Promise<boolean>((resolve) => {
      socket.setTimeout(5000)
      socket.once('connect', () => {
        socket.destroy()
        resolve(true)
      })
      socket.once('timeout', () => {
        socket.destroy()
        resolve(false)
      })
      socket.once('error', () => {
        resolve(false)
      })
      socket.connect(port, hostname)
    })

    const connected = await connectionPromise
    const responseTime = Date.now() - startTime

    if (connected) {
      return {
        success: true,
        message: 'Minecraft server connection successful',
        responseTime,
      }
    } else {
      return {
        success: false,
        message: 'Failed to connect to Minecraft server (timeout or connection refused)',
        responseTime,
      }
    }
  } catch (error) {
    const responseTime = Date.now() - startTime
    return {
      success: false,
      message: `Failed to connect to Minecraft: ${error instanceof Error ? error.message : 'Unknown error'}`,
      responseTime,
    }
  }
}

/**
 * Test NAS/TrueNAS connection via API endpoint
 */
export async function testNASConnection(
  hostname: string,
  port: number,
  apiKey?: string
): Promise<ServiceTestResult> {
  const startTime = Date.now()
  try {
    const protocol = port === 443 ? 'https' : 'http'
    const url = `${protocol}://${hostname}:${port}/api/v2.0/system/info`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
    }

    const response = await axios.get(url, {
      timeout: 5000,
      headers,
      validateStatus: (status) => status < 500,
    })

    const responseTime = Date.now() - startTime

    if (response.status === 200) {
      return {
        success: true,
        message: 'NAS connection successful',
        responseTime,
      }
    } else if (response.status === 401) {
      // Server is reachable but authentication is required/incorrect
      return {
        success: true,
        message: 'NAS connection successful (authentication may be required)',
        responseTime,
      }
    } else {
      return {
        success: false,
        message: `NAS returned status ${response.status}`,
        responseTime,
      }
    }
  } catch (error) {
    const responseTime = Date.now() - startTime
    // If it's a connection error, the server might not be a TrueNAS server
    // Try a basic HTTP check on root path
    try {
      const protocol = port === 443 ? 'https' : 'http'
      const rootUrl = `${protocol}://${hostname}:${port}/`
      const _rootResponse = await axios.get(rootUrl, {
        timeout: 3000,
        validateStatus: () => true, // Accept any status for basic connectivity
      })
      return {
        success: true,
        message: 'NAS connection successful (basic connectivity confirmed)',
        responseTime: Date.now() - startTime,
      }
    } catch {
      return {
        success: false,
        message: `Failed to connect to NAS: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime,
      }
    }
  }
}

/**
 * Test service connection based on service type
 */
export async function testServiceConnection(
  service: 'pi-hole' | 'plex' | 'minecraft' | 'nas',
  hostname: string,
  port: number,
  apiKey?: string
): Promise<ServiceTestResult> {
  switch (service) {
    case 'pi-hole':
      return testPiHoleConnection(hostname, port, apiKey)
    case 'plex':
      return testPlexConnection(hostname, port, apiKey)
    case 'minecraft':
      return testMinecraftConnection(hostname, port)
    case 'nas':
      return testNASConnection(hostname, port, apiKey)
    default:
      return {
        success: false,
        message: `Unknown service type: ${service}`,
      }
  }
}