"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/stories/button/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/stories/card/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/stories/dialog/dialog"
import { Badge } from "@/stories/badge/badge"
import { LoadingSpinner } from "@/stories/loading-spinner/loading-spinner"

interface ServiceCredential {
  id: string
  service: "pi-hole" | "plex" | "minecraft" | "nas"
  hostname: string
  port: number
  createdAt: string
}

interface CredentialFormData {
  service: "pi-hole" | "plex" | "minecraft" | "nas" | ""
  hostname: string
  port: string
  apiKey: string
}

const SERVICE_LABELS: Record<string, string> = {
  "pi-hole": "Pi-hole",
  plex: "Plex",
  minecraft: "Minecraft",
  nas: "NAS/TrueNAS",
}

const DEFAULT_PORTS: Record<string, number> = {
  "pi-hole": 80,
  plex: 32400,
  minecraft: 25565,
  nas: 443,
}

export default function IntegrationsPage() {
  const [credentials, setCredentials] = useState<ServiceCredential[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null)
  const [formData, setFormData] = useState<CredentialFormData>({
    service: "",
    hostname: "",
    port: "",
    apiKey: "",
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const fetchCredentials = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/services/credentials")
      if (!response.ok) {
        throw new Error("Failed to fetch credentials")
      }
      const data = await response.json()
      setCredentials(data.data || [])
    } catch (error) {
      console.error("Error fetching credentials:", error)
      alert("Failed to load credentials. Please refresh the page.")
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch credentials on mount
  useEffect(() => {
    fetchCredentials()
  }, [fetchCredentials])

  const handleServiceChange = (service: "pi-hole" | "plex" | "minecraft" | "nas" | "") => {
    setFormData({
      ...formData,
      service,
      port: service ? String(DEFAULT_PORTS[service] || "") : "",
    })
    setFormErrors({ ...formErrors, service: "" })
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.service) {
      errors.service = "Service type is required"
    }

    if (!formData.hostname.trim()) {
      errors.hostname = "Hostname is required"
    }

    if (!formData.port) {
      errors.port = "Port is required"
    } else {
      const portNum = parseInt(formData.port, 10)
      if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
        errors.port = "Port must be between 1 and 65535"
      }
    }

    // API key is required for all services except Minecraft
    if (formData.service && formData.service !== "minecraft" && !formData.apiKey.trim()) {
      errors.apiKey = "API key is required for this service type"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      setSubmitting(true)
      const payload = {
        service: formData.service,
        hostname: formData.hostname.trim(),
        port: parseInt(formData.port, 10),
        apiKey: formData.apiKey.trim() || undefined,
      }

      const url = editingId ? `/api/services/credentials/${editingId}` : "/api/services/credentials"
      const method = editingId ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save credential")
      }

      // Reset form and close dialog
      setFormData({ service: "", hostname: "", port: "", apiKey: "" })
      setEditingId(null)
      setIsDialogOpen(false)
      setFormErrors({})
      setTestResult(null)

      // Refresh credentials list
      await fetchCredentials()
    } catch (error) {
      console.error("Error saving credential:", error)
      alert(error instanceof Error ? error.message : "Failed to save credential")
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (credential: ServiceCredential) => {
    setFormData({
      service: credential.service,
      hostname: credential.hostname,
      port: String(credential.port),
      apiKey: "", // Don't populate API key for security
    })
    setEditingId(credential.id)
    setIsDialogOpen(true)
    setFormErrors({})
    setTestResult(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this credential?")) {
      return
    }

    try {
      const response = await fetch(`/api/services/credentials/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete credential")
      }

      await fetchCredentials()
    } catch (error) {
      console.error("Error deleting credential:", error)
      alert("Failed to delete credential")
    }
  }

  const handleTestConnection = async (credentialId: string) => {
    try {
      setTestingId(credentialId)
      setTestResult(null)

      const response = await fetch("/api/services/credentials/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialId }),
      })

      const data = await response.json()

      if (response.ok) {
        setTestResult({
          success: data.success,
          message: data.message,
        })
      } else {
        setTestResult({
          success: false,
          message: data.error || "Connection test failed",
        })
      }
    } catch (error) {
      console.error("Error testing connection:", error)
      setTestResult({
        success: false,
        message: "Failed to test connection",
      })
    } finally {
      setTestingId(null)
    }
  }

  const openAddDialog = () => {
    setFormData({ service: "", hostname: "", port: "", apiKey: "" })
    setEditingId(null)
    setIsDialogOpen(true)
    setFormErrors({})
    setTestResult(null)
  }

  const groupedCredentials = credentials.reduce<Record<string, ServiceCredential[]>>(
    (acc, cred) => {
      const existing = acc[cred.service] ?? []
      acc[cred.service] = [...existing, cred]
      return acc
    },
    {}
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary-purple-60">Service Integrations</h1>
          <p className="mt-2 text-neutral-70">
            Manage credentials for Pi-hole, Plex, Minecraft, and NAS services
          </p>
        </div>
        <Button onClick={openAddDialog}>Add Service</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : credentials.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-neutral-70 mb-4">No service credentials configured yet.</p>
            <Button onClick={openAddDialog}>Add Your First Service</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {["pi-hole", "plex", "minecraft", "nas"].map((service) => {
            const serviceCreds = groupedCredentials[service] || []
            if (serviceCreds.length === 0) {
              return null
            }

            return (
              <Card key={service}>
                <CardHeader>
                  <CardTitle>{SERVICE_LABELS[service]}</CardTitle>
                  <CardDescription>
                    Credentials for {SERVICE_LABELS[service]} service
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {serviceCreds.map((cred) => (
                      <div
                        key={cred.id}
                        className="flex items-center justify-between p-4 border border-neutral-30 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-neutral-100">{cred.hostname}</span>
                            <Badge variant="outline">Port {cred.port}</Badge>
                          </div>
                          {testResult && testingId === cred.id && (
                            <div
                              className={`text-sm mt-1 ${
                                testResult.success ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {testResult.message}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestConnection(cred.id)}
                            disabled={testingId === cred.id}
                          >
                            {testingId === cred.id ? (
                              <>
                                <LoadingSpinner size="sm" className="mr-2" />
                                Testing...
                              </>
                            ) : (
                              "Test"
                            )}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleEdit(cred)}>
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(cred.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Service Credential" : "Add Service Credential"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the service credential details below."
                : "Configure a new service integration by providing connection details."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="service" className="block text-sm font-medium text-neutral-100 mb-1">
                Service Type <span className="text-red-500">*</span>
              </label>
              <select
                id="service"
                value={formData.service}
                onChange={(e) =>
                  handleServiceChange(
                    e.target.value as "pi-hole" | "plex" | "minecraft" | "nas" | ""
                  )
                }
                disabled={!!editingId}
                className="w-full px-3 py-2 border border-neutral-30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-purple-40"
              >
                <option value="">Select a service...</option>
                <option value="pi-hole">Pi-hole</option>
                <option value="plex">Plex</option>
                <option value="minecraft">Minecraft</option>
                <option value="nas">NAS/TrueNAS</option>
              </select>
              {formErrors.service && (
                <p className="mt-1 text-sm text-red-600">{formErrors.service}</p>
              )}
            </div>

            <div>
              <label htmlFor="hostname" className="block text-sm font-medium text-neutral-100 mb-1">
                Hostname or IP <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="hostname"
                value={formData.hostname}
                onChange={(e) => {
                  setFormData({ ...formData, hostname: e.target.value })
                  setFormErrors({ ...formErrors, hostname: "" })
                }}
                placeholder="pi-hole.local or 192.168.1.100"
                className="w-full px-3 py-2 border border-neutral-30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-purple-40"
              />
              {formErrors.hostname && (
                <p className="mt-1 text-sm text-red-600">{formErrors.hostname}</p>
              )}
            </div>

            <div>
              <label htmlFor="port" className="block text-sm font-medium text-neutral-100 mb-1">
                Port <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="port"
                value={formData.port}
                onChange={(e) => {
                  setFormData({ ...formData, port: e.target.value })
                  setFormErrors({ ...formErrors, port: "" })
                }}
                placeholder="80, 32400, 25565, etc."
                min="1"
                max="65535"
                className="w-full px-3 py-2 border border-neutral-30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-purple-40"
              />
              {formErrors.port && <p className="mt-1 text-sm text-red-600">{formErrors.port}</p>}
            </div>

            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-neutral-100 mb-1">
                API Key{" "}
                {formData.service && formData.service !== "minecraft" && (
                  <span className="text-red-500">*</span>
                )}
              </label>
              <input
                type="password"
                id="apiKey"
                value={formData.apiKey}
                onChange={(e) => {
                  setFormData({ ...formData, apiKey: e.target.value })
                  setFormErrors({ ...formErrors, apiKey: "" })
                }}
                placeholder={formData.service === "minecraft" ? "Optional" : "Enter API key"}
                className="w-full px-3 py-2 border border-neutral-30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-purple-40"
              />
              {formErrors.apiKey && (
                <p className="mt-1 text-sm text-red-600">{formErrors.apiKey}</p>
              )}
              {editingId && (
                <p className="mt-1 text-xs text-neutral-70">
                  Leave blank to keep existing API key. Enter a new value to update it.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false)
                  setFormData({ service: "", hostname: "", port: "", apiKey: "" })
                  setEditingId(null)
                  setFormErrors({})
                  setTestResult(null)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Saving...
                  </>
                ) : editingId ? (
                  "Update"
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
