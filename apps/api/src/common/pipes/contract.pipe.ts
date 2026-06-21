import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Logger,
  Scope,
  Inject,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { FastifyRequest } from "fastify";
import { SchemaRegistry } from "../../crbl/schema-registry.service";
import { markValidated } from "../../crbl/contract-assertion";

@Injectable({ scope: Scope.REQUEST })
export class ContractPipe implements PipeTransform {
  private readonly logger = new Logger(ContractPipe.name);

  constructor(
    private readonly schemaRegistry: SchemaRegistry,
    @Inject(REQUEST) private readonly request: FastifyRequest,
  ) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== "body") {
      return value;
    }

    if (!this.hasSchemaRegistryReady()) {
      return value;
    }

    if (value === undefined || value === null || typeof value !== "object") {
      return value;
    }

    const path = this.extractPath();
    const method = this.extractMethod();

    const validator = this.schemaRegistry.getRequestValidator(path, method);
    if (!validator) {
      this.logger.debug(`No request validator for ${method} ${path}, passing through`);
      return value;
    }

    const valid = validator(value);
    if (!valid) {
      const details = (validator.errors || []).map((err) => ({
        field: err.instancePath || "root",
        code: "INVALID",
        message: err.message || "validation failed",
      }));

      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "فشل التحقق من صحة الطلب",
          message_en: "Request validation failed",
          statusCode: 422,
          details,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    this.logger.debug(`Validation passed for ${method} ${path}`);
    return markValidated(value);
  }

  private hasSchemaRegistryReady(): boolean {
    return this.schemaRegistry.isReady();
  }

  private extractPath(): string {
    // Priority 1: Fastify route pattern (e.g. /customers/:id) — convert :param → {param}
    const routeOpts = (this.request as unknown as Record<string, unknown>).routeOptions as
      | { url?: string }
      | undefined;
    if (routeOpts?.url) {
      return this.fastifyToOpenApiPath(routeOpts.url);
    }

    // Fallback: literal URL (works only for static routes without params)
    const url = this.request.url || this.request.raw?.url || "/";
    const parsed = url.split("?")[0];
    return parsed.replace(/\/+$/, "") || "/";
  }

  private fastifyToOpenApiPath(fastifyPath: string): string {
    return fastifyPath.replace(/:([^/]+)/g, "{$1}");
  }

  private extractMethod(): string {
    return (this.request.method || "POST").toUpperCase();
  }
}
