import { PipeTransform, Injectable, ArgumentMetadata } from "@nestjs/common";

/**
 * CRBL ContractPipe — validates DTOs against Zod schemas generated from OpenAPI.
 * Currently PASS-THROUGH. Will be activated in Sprint 0.5.1.
 * See: packages/contracts/spec/contract-pipe.md
 */
@Injectable()
export class ContractPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    // TODO Sprint 0.5.1: Load Zod schema, validate value, return transformed DTO
    return value;
  }
}
