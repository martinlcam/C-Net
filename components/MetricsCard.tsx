import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/stories/card/card'
import { Badge } from '@/stories/badge/badge'

interface MetricsCardProps {
  title: string
  value: number
  unit?: string
  subtitle?: string
  variant?: 'default' | 'success' | 'warning' | 'destructive'
}

export function MetricsCard({ title, value, unit = '', subtitle, variant = 'default' }: MetricsCardProps) {
  const variantColors = {
    default: 'text-primary-purple-60',
    success: 'text-accent-green-70',
    warning: 'text-yellow-600',
    destructive: 'text-accent-red-70',
  }

  const badgeVariant =
    variant === 'success'
      ? 'success'
      : variant === 'warning'
        ? 'warning'
        : variant === 'destructive'
          ? 'destructive'
          : 'default'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-primary-purple-70">{title}</CardTitle>
          {variant !== 'default' ? <Badge variant={badgeVariant}>{variant}</Badge> : null}
        </div>
        {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <div className={`text-4xl font-bold ${variantColors[variant]}`}>
          {value.toFixed(1)}
          {unit ? <span className="text-2xl text-neutral-70 ml-2">{unit}</span> : null}
        </div>
      </CardContent>
    </Card>
  )
}
