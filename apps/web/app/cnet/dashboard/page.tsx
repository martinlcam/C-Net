import { MetricsCard } from "@/components/MetricsCard"
import { SonarFindingsPanel } from "@/components/SonarFindingsPanel"

export default function DashboardPage() {
  return (
    <div>
      <h1 className="mb-6 font-bold text-2xl text-neutral-100 md:mb-8 md:text-4xl">
        Dashboard Overview
      </h1>

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
