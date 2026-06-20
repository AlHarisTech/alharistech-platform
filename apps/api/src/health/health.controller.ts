import { Controller, Get } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";

@Controller("health")
export class HealthController {
  @Get()
  @Public()
  check() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "0.4.0",
    };
  }
}
