import { Global, Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { EventMetricsService } from './event-metrics.service';
import { EventTracerService } from './event-tracer.service';
import { RuntimeHealthService } from './runtime-health.service';

@Global()
@Module({
  controllers: [DashboardController],
  providers: [
    EventMetricsService,
    EventTracerService,
    RuntimeHealthService,
  ],
  exports: [
    EventMetricsService,
    EventTracerService,
    RuntimeHealthService,
  ],
})
export class ObservabilityModule {}
