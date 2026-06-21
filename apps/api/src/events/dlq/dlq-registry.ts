import { Injectable, Logger } from '@nestjs/common';

export interface DlqRule {
  eventTypePattern: RegExp;
  maxPoisonCount: number;
  enabled: boolean;
}

@Injectable()
export class DlqRegistry {
  private readonly logger = new Logger(DlqRegistry.name);
  private readonly rules: DlqRule[] = [];
  private defaultMaxPoisonCount = 3;

  registerRule(rule: DlqRule): void {
    this.rules.push(rule);
    this.logger.debug(`DLQ rule registered: ${rule.eventTypePattern} (maxPoison=${rule.maxPoisonCount})`);
  }

  getMaxPoisonCount(eventType: string): number {
    for (const rule of this.rules) {
      if (rule.enabled && rule.eventTypePattern.test(eventType)) {
        return rule.maxPoisonCount;
      }
    }
    return this.defaultMaxPoisonCount;
  }

  setDefaultMaxPoisonCount(count: number): void {
    this.defaultMaxPoisonCount = count;
  }

  getRules(): DlqRule[] {
    return [...this.rules];
  }
}
