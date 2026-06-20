import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./health/health.module";
import { CRBLModule } from "./crbl/crbl.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CRBLModule,
    HealthModule,
  ],
})
export class AppModule {}
