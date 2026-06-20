import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/**
 * CRBL ContractGuard — validates requests against OpenAPI contracts.
 * Currently PASS-THROUGH. Will be activated in Sprint 0.5.1.
 * See: packages/contracts/spec/contract-guard.md
 */
@Injectable()
export class ContractGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // TODO Sprint 0.5.1: Load OpenAPI spec, compile AJV validator, validate request
    return true;
  }
}
