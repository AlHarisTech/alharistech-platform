import { NestFactory, Reflector } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";
import { ContractGuard } from "./common/guards/contract.guard";
import { PolicyGuard } from "./common/guards/policy.guard";
import { ContractInterceptor } from "./common/interceptors/contract.interceptor";
import { ContractPipe } from "./common/pipes/contract.pipe";
import { SchemaRegistry } from "./crbl/schema-registry.service";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  const schemaRegistry = app.get(SchemaRegistry);
  const reflector = app.get(Reflector);

  app.useGlobalGuards(
    new ContractGuard(reflector),
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
