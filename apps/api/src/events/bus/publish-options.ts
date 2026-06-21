export interface PublishOptions {
  priority?: number;
  lifo?: boolean;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
  jobId?: string;
}

export interface ScheduleOptions extends PublishOptions {
  delayMs: number;
}
