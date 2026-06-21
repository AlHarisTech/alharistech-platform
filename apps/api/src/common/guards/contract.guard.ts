import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PATH_METADATA } from '@nestjs/common/constants';
import { FastifyRequest } from 'fastify';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SchemaRegistry } from '../../crbl/schema-registry.service';

@Injectable()
export class ContractGuard implements CanActivate {
  private readonly logger = new Logger(ContractGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly schemaRegistry: SchemaRegistry,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const rawMethod = request.method;
    const method = rawMethod.toUpperCase();
    const routePath = this.resolveRoutePath(context, request);
    const startTime = performance.now();

    try {
      const validator = this.schemaRegistry.getRequestValidator(routePath, method);
      if (!validator) {
        this.logger.warn(`No contract schema for ${method} ${routePath} — denying (fail-closed)`);
        throw new HttpException(
          {
            error: {
              code: 'SCHEMA_NOT_FOUND',
              message: 'لم يتم العثور على مخطط التحقق لهذا المسار',
              message_en: 'Validation schema not found for this route',
              statusCode: HttpStatus.NOT_FOUND,
            },
            meta: this.buildMeta(request),
          },
          HttpStatus.NOT_FOUND,
        );
      }

      const req = request as unknown as Record<string, unknown>;
      const envelope = {
        body: req.body ?? {},
        query: req.query ?? {},
        params: req.params ?? {},
      };

      const valid = validator(envelope);
      const elapsed = performance.now() - startTime;

      if (!valid) {
        this.logger.warn(`Validation failed for ${method} ${routePath} (${elapsed.toFixed(2)}ms)`);
        const details = (validator.errors || []).map((err) => ({
          field: err.instancePath || '(root)',
          message: err.message || 'validation failed',
          code: 'VALIDATION_ERROR',
        }));
        throw new HttpException(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'بيانات الطلب غير صالحة',
              message_en: 'Invalid request data',
              statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
              details,
            },
            meta: this.buildMeta(request),
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      this.logger.debug(`Validation passed for ${method} ${routePath} (${elapsed.toFixed(2)}ms)`);
      return true;
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      this.logger.error(
        `Unexpected error during validation for ${method} ${routePath}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new HttpException(
        {
          error: {
            code: 'VALIDATOR_ERROR',
            message: 'حدث خطأ داخلي أثناء التحقق من صحة الطلب',
            message_en: 'Internal validation error',
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          },
          meta: this.buildMeta(request),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private resolveRoutePath(context: ExecutionContext, request: FastifyRequest): string {
    const nestPath = this.reflector.get<string>(PATH_METADATA, context.getHandler());
    if (nestPath) {
      const normalized = nestPath.startsWith('/') ? nestPath : `/${nestPath}`;
      return this.toOpenApiPath(normalized);
    }
    const routeOpts = (request as unknown as Record<string, unknown>).routeOptions as
      | { url?: string }
      | undefined;
    if (routeOpts?.url) {
      return this.toOpenApiPath(routeOpts.url);
    }
    return new URL(request.url, 'http://localhost').pathname;
  }

  private toOpenApiPath(path: string): string {
    return path.replace(/:([^/]+)/g, '{$1}');
  }

  private buildMeta(request: FastifyRequest): Record<string, unknown> {
    return {
      timestamp: new Date().toISOString(),
      requestId: (request as unknown as Record<string, unknown>).id ?? this.generateRequestId(),
    };
  }

  private generateRequestId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}
