import { NestFactory, Reflector } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { ContractGuard } from "./common/guards/contract.guard";
import { PolicyGuard } from "./common/guards/policy.guard";
import { ContractInterceptor } from "./common/interceptors/contract.interceptor";
import { SchemaRegistry } from "./crbl/schema-registry.service";
import { AuthService } from "./modules/auth/auth.service";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  const schemaRegistry = app.get(SchemaRegistry);
  const authService = app.get(AuthService);
  const reflector = app.get(Reflector);

  app.useGlobalGuards(
    new JwtAuthGuard(reflector, authService),
    new ContractGuard(reflector, schemaRegistry),
    new PolicyGuard(reflector),
  );
  app.useGlobalInterceptors(new ContractInterceptor(schemaRegistry));

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
  });

  const port = process.env.PORT || 4000;
  await app.listen(port, "0.0.0.0");
  console.log(`API running on http://localhost:${port}`);
}

bootstrap();
