import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable } from "rxjs";

/**
 * CRBL ContractInterceptor — validates response against OpenAPI response schema.
 * Currently PASS-THROUGH. Will be activated in Sprint 0.5.1.
 * See: packages/contracts/spec/contract-interceptor.md
 */
@Injectable()
export class ContractInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // TODO Sprint 0.5.1: Validate response body against OpenAPI response schema
    return next.handle();
  }
}
