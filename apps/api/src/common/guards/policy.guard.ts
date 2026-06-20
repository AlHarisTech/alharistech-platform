import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/**
 * CRBL PolicyGuard — evaluates RBAC policies from access-control.yaml.
 * Currently PASS-THROUGH. Will be activated in Sprint 0.5.1.
 * See: packages/contracts/spec/policy-guard.md
 */
@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // TODO Sprint 0.5.1: Extract user from JWT, evaluate policy rules, enforce RBAC
    return true;
  }
}
