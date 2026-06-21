import type { MetricsSnapshot } from './event-metrics.service';
import type { TraceSnapshot } from './trace.types';
import type { EventRuntimeHealth } from './runtime-health.types';

export interface DashboardData {
  metrics: MetricsSnapshot;
  trace: TraceSnapshot;
  health: EventRuntimeHealth;
}
