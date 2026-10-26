import { ProxmoxOverview } from "@/components/proxmox/ProxmoxOverview"
import { SonarFindingsPanel } from "@/components/SonarFindingsPanel"

export default function DashboardPage() {
  return (
    <div>
      <h1 className="mb-6 font-bold text-2xl text-neutral-100 md:mb-8 md:text-4xl">
        Dashboard Overview
      </h1>

      <div className="mb-8">
        <ProxmoxOverview />
      </div>

      <SonarFindingsPanel />
    </div>
  )
}
