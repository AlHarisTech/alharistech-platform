import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./health/health.module";
import { CRBLModule } from "./crbl/crbl.module";
import { AuthModule } from "./modules/auth/auth.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CRBLModule,
    HealthModule,
    AuthModule,
  ],
})
export class AppModule {}
