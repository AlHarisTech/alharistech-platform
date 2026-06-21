import { Controller, Get, Inject } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import { EventRuntimeHealthService } from "../events/health/event-runtime.health";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(EventRuntimeHealthService)
    private readonly eventRuntimeHealth?: EventRuntimeHealthService,
  ) {}

  @Get()
  @Public()
  check() {
    const eventRuntime = this.eventRuntimeHealth?.check();

    return {
      status: eventRuntime?.status === "healthy" ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "0.4.0",
      eventRuntime,
    };
  }
}
