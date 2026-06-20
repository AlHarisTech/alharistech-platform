import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { SchemaRegistry } from "../../crbl/schema-registry.service";

@Injectable()
export class ContractPipe implements PipeTransform {
  private readonly logger = new Logger(ContractPipe.name);

  constructor(private readonly schemaRegistry: SchemaRegistry) {}

  transform(value: any, metadata: ArgumentMetadata) {
    const { metatype } = metadata;

    if (!metatype || !this.canValidate(metatype)) {
      return value;
    }

    if (metadata.type === "custom") {
      return value;
    }

    if (value === undefined || value === null) {
      return value;
    }

    const schema = this.resolveSchema(metadata);
    if (!schema) {
      this.logger.debug(`No schema found for ${String(metatype.name)}, passing through`);
      return value;
    }

    const validator = this.schemaRegistry.getRequestValidator(
      this.extractPath(metadata),
      this.extractMethod(metadata),
    );

    if (!validator) {
      this.logger.debug(`No request validator for ${String(metatype.name)}, passing through`);
      return value;
    }

    const result = validator(value);

    if (!result.valid) {
      const details = (result.errors || []).map((err) => {
        const parts = err.split(":");
        const field = parts[0]?.trim() || "root";
        const message = parts.slice(1).join(":").trim() || err;
        return {
          field,
          code: "INVALID",
          message,
        };
      });

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

    return value;
  }

  private canValidate(metatype: any): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private resolveSchema(metadata: ArgumentMetadata): any {
    return undefined;
  }

  private extractPath(metadata: ArgumentMetadata): string {
    return "/";
  }

  private extractMethod(metadata: ArgumentMetadata): string {
    return "POST";
  }
}
