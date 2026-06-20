import { Injectable, OnModuleInit, Logger, Inject, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import Ajv, { ValidateFunction } from 'ajv';
import { CRBL_CONFIG, CrblConfig, DEFAULT_CRBL_CONFIG } from './crbl.constants';

type ParsedYaml = Record<string, unknown>;

interface OpenApiOperation {
  method: string;
  path: string;
  domain: string;
  operationId?: string;
  requestBodySchema?: Record<string, unknown>;
  responseSchemas: Map<number, Record<string, unknown>>;
  parameters?: Array<Record<string, unknown>>;
  security?: Array<Record<string, unknown>>;
}

interface EventSchemaEntry {
  name: string;
  domain: string;
  event: string;
  version: string;
  schema: Record<string, unknown>;
  transport: { type: string; channel: string };
  retention: string;
}

interface SchemaStats {
  openapiSpecs: number;
  endpoints: number;
  eventSchemas: number;
  policyRules: number;
  requestValidators: number;
  responseValidators: number;
  eventValidators: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastLoadTime: string;
  domains: string[];
  errors: string[];
}

@Injectable()
export class SchemaRegistry implements OnModuleInit {
  private readonly logger = new Logger(SchemaRegistry.name);

  private readonly requestValidators = new Map<string, ValidateFunction>();
  private readonly responseValidators = new Map<string, ValidateFunction>();
  private readonly eventValidators = new Map<string, ValidateFunction>();
  private readonly openapiOperations = new Map<string, OpenApiOperation>();
  private readonly eventSchemas = new Map<string, EventSchemaEntry>();
  private policyRules: Array<Record<string, unknown>> = [];
  private openapiSpecs: Map<string, ParsedYaml> = new Map();

  private ajv: Ajv;
  private ready = false;
  private lastLoadTime = '';
  private loadErrors: string[] = [];
  private watcher: fs.FSWatcher | null = null;

  private readonly config: CrblConfig;

  constructor(@Optional() @Inject(CRBL_CONFIG) config?: Partial<CrblConfig>) {
    this.config = { ...DEFAULT_CRBL_CONFIG, ...config };
    this.ajv = this.createAjvInstance();
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.loadAllSchemas();
      this.ready = true;
      this.lastLoadTime = new Date().toISOString();
      this.logger.log(
        `SchemaRegistry loaded: ${this.openapiSpecs.size} OpenAPI specs, ` +
          `${this.openapiOperations.size} endpoints, ` +
          `${this.eventSchemas.size} event schemas, ` +
          `${this.policyRules.length} policy rules`,
      );

      if (this.config.hotReloadEnabled) {
        this.enableHotReload();
      }
    } catch (error) {
      this.ready = false;
      const message = error instanceof Error ? error.message : String(error);
      this.loadErrors.push(message);
      this.logger.fatal(`SchemaRegistry failed to load — CRBL entering circuit-open state: ${message}`);
    }
  }

  onModuleDestroy(): void {
    this.disableHotReload();
  }

  getRequestValidator(pathPattern: string, method: string): ValidateFunction | undefined {
    const key = `${method.toUpperCase()}:${pathPattern}`;
    const cached = this.requestValidators.get(key);
    if (cached) return cached;

    const operation = this.openapiOperations.get(key);
    if (!operation) return undefined;

    const validator = this.compileRequestValidator(operation);
    if (validator) {
      this.requestValidators.set(key, validator);
    }
    return validator;
  }

  getResponseValidator(
    pathPattern: string,
    method: string,
    statusCode: number,
  ): ValidateFunction | undefined {
    const key = `${method.toUpperCase()}:${pathPattern}:${statusCode}`;
    const cached = this.responseValidators.get(key);
    if (cached) return cached;

    const operation = this.openapiOperations.get(`${method.toUpperCase()}:${pathPattern}`);
    if (!operation) return undefined;

    const responseSchema = operation.responseSchemas.get(statusCode);
    if (!responseSchema) return undefined;

    const validator = this.compileSchema(responseSchema);
    if (validator) {
      this.responseValidators.set(key, validator);
    }
    return validator;
  }

  getEventSchema(eventName: string): string | undefined {
    return this.eventSchemas.get(eventName)?.version;
  }

  getEventValidator(eventName: string): ValidateFunction | undefined {
    const cached = this.eventValidators.get(eventName);
    if (cached) return cached;

    const eventEntry = this.eventSchemas.get(eventName);
    if (!eventEntry) return undefined;

    const validator = this.compileSchema(eventEntry.schema);
    if (validator) {
      this.eventValidators.set(eventName, validator);
    }
    return validator;
  }

  getPolicyRules(): Array<Record<string, unknown>> {
    return this.policyRules;
  }

  isReady(): boolean {
    return this.ready;
  }

  getStats(): SchemaStats {
    const domains = Array.from(this.openapiSpecs.keys());
    return {
      openapiSpecs: this.openapiSpecs.size,
      endpoints: this.openapiOperations.size,
      eventSchemas: this.eventSchemas.size,
      policyRules: this.policyRules.length,
      requestValidators: this.requestValidators.size,
      responseValidators: this.responseValidators.size,
      eventValidators: this.eventValidators.size,
      status: this.ready ? 'healthy' : 'unhealthy',
      lastLoadTime: this.lastLoadTime,
      domains,
      errors: [...this.loadErrors],
    };
  }

  async reload(): Promise<void> {
    this.logger.log('Reloading all schemas...');
    this.loadErrors = [];

    const backupRequestValidators = new Map(this.requestValidators);
    const backupResponseValidators = new Map(this.responseValidators);
    const backupEventValidators = new Map(this.eventValidators);
    const backupOperations = new Map(this.openapiOperations);
    const backupEventSchemas = new Map(this.eventSchemas);
    const backupPolicyRules = [...this.policyRules];
    const backupSpecs = new Map(this.openapiSpecs);

    try {
      this.requestValidators.clear();
      this.responseValidators.clear();
      this.eventValidators.clear();
      this.openapiOperations.clear();
      this.eventSchemas.clear();
      this.policyRules = [];
      this.openapiSpecs = new Map();
      this.ajv = this.createAjvInstance();

      await this.loadAllSchemas();
      this.ready = true;
      this.lastLoadTime = new Date().toISOString();
      this.logger.log('All schemas reloaded successfully');
    } catch (error) {
      this.requestValidators.clear();
      this.responseValidators.clear();
      this.eventValidators.clear();
      this.openapiOperations.clear();
      this.eventSchemas.clear();
      this.openapiSpecs = new Map();

      for (const [k, v] of backupRequestValidators) this.requestValidators.set(k, v);
      for (const [k, v] of backupResponseValidators) this.responseValidators.set(k, v);
      for (const [k, v] of backupEventValidators) this.eventValidators.set(k, v);
      for (const [k, v] of backupOperations) this.openapiOperations.set(k, v);
      for (const [k, v] of backupEventSchemas) this.eventSchemas.set(k, v);
      this.policyRules = backupPolicyRules;
      this.openapiSpecs = backupSpecs;

      const message = error instanceof Error ? error.message : String(error);
      this.loadErrors.push(message);
      this.logger.error(`Schema reload failed, keeping previous validators: ${message}`);
    }
  }

  private createAjvInstance(): Ajv {
    const ajv = new Ajv({
      strict: false,
      allErrors: true,
      coerceTypes: false,
      removeAdditional: 'all',
    });

    this.registerFormats(ajv);
    return ajv;
  }

  private registerFormats(ajv: Ajv): void {
    ajv.addFormat('uuid', {
      type: 'string',
      validate: (x: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x),
    });

    ajv.addFormat('email', {
      type: 'string',
      validate: (x: string) =>
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
          x,
        ),
    });

    ajv.addFormat('date-time', {
      type: 'string',
      validate: (x: string) => !isNaN(Date.parse(x)),
    });

    ajv.addFormat('date', {
      type: 'string',
      validate: (x: string) => /^\d{4}-\d{2}-\d{2}$/.test(x) && !isNaN(Date.parse(x)),
    });

    ajv.addFormat('uri', {
      type: 'string',
      validate: (x: string) => {
        try {
          new URL(x);
          return true;
        } catch {
          return false;
        }
      },
    });

    ajv.addFormat('password', {
      type: 'string',
      validate: () => true,
    });
  }

  private async loadAllSchemas(): Promise<void> {
    await this.loadOpenApiSpecs();
    await this.loadEventSchemas();
    await this.loadPolicyRules();
  }

  private async loadOpenApiSpecs(): Promise<void> {
    const schemaDir = path.resolve(process.cwd(), this.config.schemaDir);

    if (!fs.existsSync(schemaDir)) {
      throw new Error(`OpenAPI schema directory not found: ${schemaDir}`);
    }

    const files = fs
      .readdirSync(schemaDir)
      .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

    if (files.length === 0) {
      throw new Error(`No OpenAPI YAML files found in: ${schemaDir}`);
    }

    for (const file of files) {
      const filePath = path.join(schemaDir, file);
      const domain = file.replace(/-api\.(yaml|yml)$/, '');
      await this.loadOpenApiSpec(domain, filePath);
    }

    this.logger.log(`Loaded ${files.length} OpenAPI specs from ${schemaDir}`);
  }

  private async loadOpenApiSpec(domain: string, filePath: string): Promise<void> {
    const yamlContent = fs.readFileSync(filePath, 'utf8');
    const rawSpec = this.parseYaml(yamlContent);

    if (!rawSpec || typeof rawSpec !== 'object') {
      throw new Error(`Failed to parse OpenAPI spec: ${filePath}`);
    }

    const spec = rawSpec as ParsedYaml;
    this.openapiSpecs.set(domain, spec);

    const paths = (spec.paths ?? {}) as Record<string, Record<string, unknown>>;
    let endpointCount = 0;

    for (const [pathPattern, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      for (const [method, operation] of Object.entries(pathItem as Record<string, unknown>)) {
        if (!this.isHttpMethod(method)) continue;

        const op = operation as Record<string, unknown>;
        if (!op) continue;

        const resolvedOp = this.resolveRefsRecursive(op, spec) as Record<string, unknown>;

        const key = `${method.toUpperCase()}:${pathPattern}`;
        this.openapiOperations.set(key, {
          method: method.toUpperCase(),
          path: pathPattern,
          domain,
          operationId: resolvedOp.operationId as string | undefined,
          requestBodySchema: this.extractRequestBodySchema(resolvedOp, spec),
          responseSchemas: this.extractResponseSchemas(resolvedOp, spec),
          parameters: resolvedOp.parameters as Array<Record<string, unknown>> | undefined,
          security: resolvedOp.security as Array<Record<string, unknown>> | undefined,
        });

        endpointCount++;
      }
    }

    if (endpointCount === 0) {
      this.logger.warn(`OpenAPI spec ${filePath} has no paths with HTTP methods`);
    }
  }

  private extractRequestBodySchema(
    operation: Record<string, unknown>,
    rootSpec: ParsedYaml,
  ): Record<string, unknown> | undefined {
    const requestBody = operation.requestBody as Record<string, unknown> | undefined;
    if (!requestBody) return undefined;

    const content = requestBody.content as Record<string, { schema?: unknown }> | undefined;
    if (!content) return undefined;

    const jsonContent = content['application/json'];
    if (!jsonContent?.schema) return undefined;

    const schema = jsonContent.schema as Record<string, unknown>;
    if (schema.$ref) {
      return this.resolveRef(schema.$ref as string, rootSpec);
    }

    return this.resolveRefsRecursive(structuredClone(schema), rootSpec) as Record<string, unknown>;
  }

  private extractResponseSchemas(
    operation: Record<string, unknown>,
    rootSpec: ParsedYaml,
  ): Map<number, Record<string, unknown>> {
    const schemas = new Map<number, Record<string, unknown>>();
    const responses = (operation.responses ?? {}) as Record<string, Record<string, unknown>>;

    for (const [statusStr, response] of Object.entries(responses)) {
      const statusCode = parseInt(statusStr, 10);
      if (isNaN(statusCode)) continue;

      const content = response?.content as Record<string, { schema?: unknown }> | undefined;
      const jsonContent = content?.['application/json'];
      if (!jsonContent?.schema) continue;

      const schema = jsonContent.schema as Record<string, unknown>;
      const resolved =
        schema.$ref !== undefined
          ? this.resolveRef(schema.$ref as string, rootSpec)
          : (this.resolveRefsRecursive(structuredClone(schema), rootSpec) as Record<
              string,
              unknown
            >);

      if (resolved) {
        schemas.set(statusCode, resolved);
      }
    }

    return schemas;
  }

  private compileRequestValidator(
    operation: OpenApiOperation,
  ): ValidateFunction | undefined {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    if (operation.requestBodySchema) {
      properties.body = operation.requestBodySchema;
      required.push('body');
    }

    if (operation.parameters && operation.parameters.length > 0) {
      const queryProperties: Record<string, unknown> = {};
      const queryRequired: string[] = [];
      const pathProperties: Record<string, unknown> = {};
      const pathRequired: string[] = [];

      for (const param of operation.parameters) {
        const paramIn = param.in as string;
        const paramName = param.name as string;
        const paramSchema = (param.schema as Record<string, unknown>) ?? { type: 'string' };
        const isRequired = param.required === true;

        if (paramIn === 'query') {
          queryProperties[paramName] = paramSchema;
          if (isRequired) queryRequired.push(paramName);
        } else if (paramIn === 'path') {
          pathProperties[paramName] = paramSchema;
          if (isRequired) pathRequired.push(paramName);
        }
      }

      if (Object.keys(queryProperties).length > 0) {
        properties.query = {
          type: 'object',
          properties: queryProperties,
          required: queryRequired.length > 0 ? queryRequired : undefined,
          additionalProperties: false,
        };
      }

      if (Object.keys(pathProperties).length > 0) {
        properties.params = {
          type: 'object',
          properties: pathProperties,
          required: pathRequired.length > 0 ? pathRequired : undefined,
          additionalProperties: false,
        };
      }
    }

    if (Object.keys(properties).length === 0) {
      return undefined;
    }

    const compositeSchema: Record<string, unknown> = {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };

    return this.compileSchema(compositeSchema);
  }

  private compileSchema(schema: Record<string, unknown>): ValidateFunction | undefined {
    try {
      const sanitized = this.sanitizeSchemaForAjv(structuredClone(schema));
      return this.ajv.compile(sanitized as Record<string, unknown>);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`AJV compilation failed: ${message}`);
      return undefined;
    }
  }

  private sanitizeSchemaForAjv(schema: unknown): Record<string, unknown> {
    if (schema === null || schema === undefined) return {};
    if (typeof schema !== 'object') return {};

    if (Array.isArray(schema)) {
      const result: Record<string, unknown> = {};
      for (let i = 0; i < schema.length; i++) {
        result[String(i)] = this.sanitizeSchemaForAjv(schema[i]);
      }
      return result;
    }

    const sanitized: Record<string, unknown> = {};
    const skipKeys = new Set(['nullable', 'discriminator', 'xml', 'example', 'externalDocs', 'deprecated']);

    for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
      if (skipKeys.has(key)) continue;
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeSchemaForAjv(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private resolveRef(ref: string, rootSpec: ParsedYaml): Record<string, unknown> {
    if (!ref.startsWith('#/')) {
      this.logger.warn(`External $ref not supported: ${ref}`);
      return {};
    }

    const pathParts = ref.replace('#/', '').split('/');
    let current: unknown = rootSpec;

    for (const part of pathParts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        this.logger.warn(`Unresolvable $ref: ${ref}`);
        return {};
      }
      current = (current as Record<string, unknown>)[part];
    }

    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return {};
    }

    const clone = structuredClone(current as Record<string, unknown>);
    return this.resolveRefsRecursive(clone, rootSpec) as Record<string, unknown>;
  }

  private resolveRefsRecursive(
    obj: unknown,
    rootSpec: ParsedYaml,
    visitedRefs = new Set<string>(),
  ): unknown {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => this.resolveRefsRecursive(item, rootSpec, visitedRefs));
    }

    const record = obj as Record<string, unknown>;

    if ('$ref' in record && typeof record.$ref === 'string') {
      const ref = record.$ref;
      if (visitedRefs.has(ref)) {
        this.logger.warn(`Circular $ref detected: ${ref}`);
        return { $ref: ref };
      }
      visitedRefs.add(ref);
      const resolved = this.resolveRef(ref, rootSpec);
      visitedRefs.delete(ref);
      return resolved;
    }

    const result: Record<string, unknown> = {};
    const skipKeys = new Set(['nullable', 'discriminator', 'xml', 'example', 'externalDocs', 'deprecated']);

    for (const [key, value] of Object.entries(record)) {
      if (skipKeys.has(key)) continue;
      result[key] = this.resolveRefsRecursive(value, rootSpec, visitedRefs);
    }

    return result;
  }

  private isHttpMethod(method: string): boolean {
    const httpMethods = new Set([
      'get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace',
    ]);
    return httpMethods.has(method.toLowerCase());
  }

  private async loadEventSchemas(): Promise<void> {
    const eventsPath = path.resolve(process.cwd(), this.config.eventsSchemaPath);

    if (!fs.existsSync(eventsPath)) {
      throw new Error(`Event schemas file not found: ${eventsPath}`);
    }

    const yamlContent = fs.readFileSync(eventsPath, 'utf8');
    const parsed = this.parseYaml(yamlContent);

    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`Failed to parse event schemas: ${eventsPath}`);
    }

    const events = (parsed as Record<string, unknown>).events as
      | Record<string, Record<string, unknown>>
      | undefined;

    if (!events) {
      throw new Error(`No 'events' key found in event-schemas.yaml`);
    }

    for (const [eventName, eventData] of Object.entries(events)) {
      if (!eventData || typeof eventData !== 'object') {
        this.logger.warn(`Skipping invalid event entry: ${eventName}`);
        continue;
      }

      const schema = eventData.schema as Record<string, unknown> | undefined;
      if (!schema) {
        this.logger.warn(`Event '${eventName}' has no schema, skipping`);
        continue;
      }

      this.eventSchemas.set(eventName, {
        name: eventName,
        domain: (eventData.domain as string) ?? '',
        event: (eventData.event as string) ?? '',
        version: (eventData.version as string) ?? '1.0',
        schema,
        transport: (eventData.transport as EventSchemaEntry['transport']) ?? {
          type: 'async',
          channel: '',
        },
        retention: (eventData.retention as string) ?? '',
      });

      const validator = this.compileSchema(schema);
      if (validator) {
        this.eventValidators.set(eventName, validator);
      }
    }

    this.logger.log(`Loaded ${this.eventSchemas.size} event schemas`);
  }

  private async loadPolicyRules(): Promise<void> {
    const policyPath = path.resolve(process.cwd(), this.config.policySchemaPath);

    if (!fs.existsSync(policyPath)) {
      throw new Error(`Policy schema file not found: ${policyPath}`);
    }

    const yamlContent = fs.readFileSync(policyPath, 'utf8');
    const parsed = this.parseYaml(yamlContent);

    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`Failed to parse policy file: ${policyPath}`);
    }

    const policies = (parsed as Record<string, unknown>).policies;
    if (!Array.isArray(policies)) {
      throw new Error(`No 'policies' array found in access-control.yaml`);
    }

    this.policyRules = policies;
    this.logger.log(`Loaded ${this.policyRules.length} policy rules`);
  }

  private enableHotReload(): void {
    const watchPaths = [
      path.resolve(process.cwd(), this.config.schemaDir),
      path.resolve(process.cwd(), this.config.eventsSchemaPath),
      path.resolve(process.cwd(), this.config.policySchemaPath),
    ];

    for (const watchPath of watchPaths) {
      if (!fs.existsSync(watchPath)) continue;

      try {
        const watcher = fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
          if (!filename) return;
          this.logger.log(`Contract file changed: ${filename}, reloading schemas...`);
          this.reload().catch((err) => {
            this.logger.error(`Hot-reload failed: ${err instanceof Error ? err.message : String(err)}`);
          });
        });

        watcher.on('error', (err) => {
          this.logger.warn(`File watcher error on ${watchPath}: ${err.message}`);
        });

        if (!this.watcher) {
          this.watcher = watcher;
        }
      } catch {
        this.logger.debug(`Cannot watch ${watchPath} (may be a file or not exist)`);
      }
    }

    if (this.watcher) {
      this.logger.log('Hot-reload enabled — watching contract files for changes');
    }
  }

  private disableHotReload(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.logger.log('Hot-reload disabled');
    }
  }

  private parseYaml(content: string): ParsedYaml | null {
    try {
      const yaml = require('js-yaml');
      return yaml.load(content) as ParsedYaml;
    } catch {
      this.logger.error('js-yaml is not installed. Run: pnpm add js-yaml @types/js-yaml --filter @aht/api');
      return null;
    }
  }
}
