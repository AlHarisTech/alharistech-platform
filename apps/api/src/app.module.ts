import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./health/health.module";
// CRBL modules will be imported here in Sprint 0.5.1

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
  ],
})
export class AppModule {}
