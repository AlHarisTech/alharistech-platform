export const CRBL_CONFIG = 'CRBL_CONFIG';

export interface CrblConfig {
  mode: 'strict' | 'lenient';
  schemaDir: string;
  eventsSchemaPath: string;
  policySchemaPath: string;
  redisEnabled: boolean;
  redisKeyPrefix: string;
  hotReloadEnabled: boolean;
}

export const DEFAULT_CRBL_CONFIG: CrblConfig = {
  mode: 'strict',
  schemaDir: 'specs/contracts/openapi',
  eventsSchemaPath: 'specs/contracts/events/event-schemas.yaml',
  policySchemaPath: 'specs/contracts/policy/access-control.yaml',
  redisEnabled: false,
  redisKeyPrefix: 'crbl:',
  hotReloadEnabled: true,
};
