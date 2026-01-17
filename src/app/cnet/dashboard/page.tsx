import { MetricsCard } from '@/components/MetricsCard'

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-4xl font-bold text-primary-purple-80 mb-8">Dashboard Overview</h1>
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <MetricsCard title="CPU Usage" value={45.2} unit="%" variant="default" />
        <MetricsCard title="Memory Usage" value={62.8} unit="%" variant="warning" />
        <MetricsCard title="Disk Usage" value={38.5} unit="%" variant="success" />
      </div>
      <div className="bg-white rounded-lg border border-neutral-30 p-6">
        <h2 className="text-2xl font-semibold text-primary-purple-70 mb-4">Quick Actions</h2>
        <p className="text-neutral-70">Use the sidebar to navigate to different sections of the dashboard.</p>
      </div>
    </div>
  )
}
