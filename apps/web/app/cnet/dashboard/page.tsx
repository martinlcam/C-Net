import { MetricsCard } from "@/components/MetricsCard"
import { SonarFindingsPanel } from "@/components/SonarFindingsPanel"

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-4xl font-bold text-neutral-100 mb-8">Dashboard Overview</h1>

      <div className="mb-8">
        <SonarFindingsPanel />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <MetricsCard title="CPU Usage" value={45.2} unit="%" variant="default" />
        <MetricsCard title="Memory Usage" value={62.8} unit="%" variant="warning" />
        <MetricsCard title="Disk Usage" value={38.5} unit="%" variant="success" />
      </div>
    </div>
  )
}
