import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { SchemaRegistry } from "../../crbl/schema-registry.service";

@Injectable()
export class ContractInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ContractInterceptor.name);

  constructor(private readonly schemaRegistry: SchemaRegistry) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const path = this.extractRoutePattern(request);
    const method = (request.method || "GET").toUpperCase();

    return next.handle().pipe(
      map((data) => {
        const contentType = response.getHeader?.("content-type") || "";
        const statusCode = response.statusCode || 200;

        if (this.shouldSkip(data, contentType, statusCode)) {
          return data;
        }

        const validator = this.schemaRegistry.getResponseValidator(
          path,
          method,
          statusCode,
        );

        if (!validator) {
          return data;
        }

        const start = Date.now();
        const valid = validator(data);

        if (!valid) {
          const ajvErrors = (validator.errors ?? []).map((e) =>
            e.message ?? "validation failed"
          );
          const mode = process.env.CONTRACT_RESPONSE_MODE || "lenient";
          this.logValidationErrors(path, method, statusCode, ajvErrors);

          if (mode === "strict") {
            throw new HttpException(
              {
                error: {
                  code: "CONTRACT_VIOLATION",
                  message: "انتهاك العقد - الاستجابة لا تتطابق مع المواصفات",
                  message_en: "Contract violation - response does not match specification",
                  statusCode: 500,
                  details: ajvErrors.map((msg) => ({
                    field: "response",
                    code: "MISMATCH",
                    message: msg,
                  })),
                },
                meta: {
                  timestamp: new Date().toISOString(),
                  requestId: response.request?.id,
                  route: `${method} ${path}`,
                },
              },
              500,
            );
          }
        }

        const elapsed = Date.now() - start;
        if (elapsed > 5) {
          this.logger.debug(
            `Response validation for ${method} ${path} took ${elapsed}ms`,
          );
        }

        return data;
      }),
    );
  }

  private shouldSkip(
    data: any,
    contentType: string,
    statusCode: number,
  ): boolean {
    if (data === undefined || data === null) return true;
    if (statusCode === 204) return true;
    if (statusCode >= 301 && statusCode <= 308) return true;
    if (
      typeof contentType === "string" &&
      (contentType.includes("application/octet-stream") ||
        contentType.includes("multipart") ||
        contentType.includes("text/event-stream"))
    ) {
      return true;
    }
    return false;
  }

  private extractRoutePattern(request: any): string {
    // Priority 1: Fastify route pattern — convert :param → {param}
    const routeOpts = request.routeOptions as { url?: string } | undefined;
    if (routeOpts?.url) {
      return routeOpts.url.replace(/:([^/]+)/g, "{$1}");
    }
    // Fallback: literal URL
    const url = request.url || request.raw?.url || "";
    const parsed = url.split("?")[0];
    return parsed.replace(/\/+$/, "") || "/";
  }

  private logValidationErrors(
    path: string,
    method: string,
    statusCode: number,
    errors: string[],
  ): void {
    const mode = process.env.CONTRACT_RESPONSE_MODE || "lenient";
    if (mode === "strict") {
      this.logger.error(
        `CONTRACT_VIOLATION ${method} ${path} (status ${statusCode}): ` +
          `${errors.length} error(s)`,
      );
      for (const e of errors) {
        this.logger.error(`  - ${e}`);
      }
    } else {
      this.logger.warn(
        `Response contract warning for ${method} ${path} (status ${statusCode}): ` +
          `${errors.length} error(s)`,
      );
      for (const e of errors) {
        this.logger.warn(`  - ${e}`);
      }
    }
  }
}
