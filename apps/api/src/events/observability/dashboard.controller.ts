import { Controller, Get, Post, HttpCode } from '@nestjs/common';
import { EventMetricsService } from './event-metrics.service';
import { EventTracerService } from './event-tracer.service';
import { RuntimeHealthService } from './runtime-health.service';
import type { DashboardData } from './dashboard.dto';

@Controller('events')
export class DashboardController {
  constructor(
    private readonly metrics: EventMetricsService,
    private readonly tracer: EventTracerService,
    private readonly health: RuntimeHealthService,
  ) {}

  @Get('metrics')
  getMetrics() {
    return this.metrics.snapshot();
  }

  @Get('trace')
  getTrace() {
    return this.tracer.snapshot();
  }

  @Get('health')
  getHealth() {
    return this.health.getHealth();
  }

  @Get('dashboard')
  async getDashboard(): Promise<DashboardData> {
    const [metrics, trace, health] = await Promise.all([
      this.metrics.snapshot(),
      this.tracer.snapshot(),
      this.health.getHealth(),
    ]);

    return { metrics, trace, health };
  }

  @Post('metrics/reset')
  @HttpCode(204)
  resetMetrics(): void {
    this.metrics.reset();
  }

  @Post('trace/clear')
  @HttpCode(204)
  clearTrace(): void {
    this.tracer.clear();
  }
}
