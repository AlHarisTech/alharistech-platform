import { Controller, Get, Post, Body, HttpCode, NotFoundException } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { SchemaRegistry } from '../../crbl/schema-registry.service';
import { EventMetricsService } from './event-metrics.service';
import { EventTracerService } from './event-tracer.service';
import { RuntimeHealthService } from './runtime-health.service';
import { EventBus } from '../bus/event-bus';
import type { DomainEvent } from '../contracts/domain-event';
import type { EventReceipt } from '../bus/event-receipt';
import type { DashboardData } from './dashboard.dto';

interface TestPublishDto {
  type: string;
  version?: number;
  payload?: Record<string, unknown>;
  id?: string;
}

@Controller('events')
export class DashboardController {
  constructor(
    private readonly metrics: EventMetricsService,
    private readonly tracer: EventTracerService,
    private readonly health: RuntimeHealthService,
    private readonly eventBus: EventBus,
    private readonly schemaRegistry: SchemaRegistry,
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
  @Public()
  getHealth() {
    return this.health.getHealth();
  }

  @Get('schema/stats')
  @Public()
  getSchemaStats() {
    return this.schemaRegistry.getStats();
  }

  @Get('dashboard')
  @Public()
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

  @Post('test/publish')
  async testPublish(@Body() dto: TestPublishDto): Promise<EventReceipt> {
    if (process.env.RUNTIME_TEST_MODE !== 'true') {
      throw new NotFoundException();
    }
    const event: DomainEvent<unknown> = {
      id: dto.id ?? crypto.randomUUID(),
      type: dto.type,
      version: dto.version ?? 1,
      occurredAt: new Date().toISOString(),
      correlationId: crypto.randomUUID(),
      payload: dto.payload ?? {},
    };
    return this.eventBus.publish(event);
  }
}
