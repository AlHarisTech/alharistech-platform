import { Module, Global } from '@nestjs/common';
import { SchemaRegistry } from './schema-registry.service';
import { ContractGuard } from '../common/guards/contract.guard';
import { PolicyGuard } from '../common/guards/policy.guard';
import { ContractInterceptor } from '../common/interceptors/contract.interceptor';
import { ContractPipe } from '../common/pipes/contract.pipe';

@Global()
@Module({
  providers: [
    SchemaRegistry,
    ContractGuard,
    PolicyGuard,
    ContractInterceptor,
    ContractPipe,
  ],
  exports: [
    SchemaRegistry,
    ContractGuard,
    PolicyGuard,
    ContractInterceptor,
    ContractPipe,
  ],
})
export class CRBLModule {}
