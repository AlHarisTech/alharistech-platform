import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  // CRBL: Global guards registered here (pass-through until Sprint 0.5.1)
  // CRBL: Global interceptors registered here
  // CRBL: Global pipes registered here

  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"] });

  const port = process.env.PORT || 4000;
  await app.listen(port, "0.0.0.0");
  console.log(`API running on http://localhost:${port}`);
}

bootstrap();
