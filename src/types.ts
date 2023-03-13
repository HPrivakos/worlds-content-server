import type { IFetchComponent } from '@well-known-components/http-server'
import type {
  IConfigComponent,
  ILoggerComponent,
  IHttpServerComponent,
  IBaseComponent,
  IMetricsComponent
} from '@well-known-components/interfaces'
import { metricDeclarations } from './metrics'
import { IContentStorageComponent } from '@dcl/catalyst-storage'
import { HTTPProvider } from 'eth-connect'
import { ISubgraphComponent } from '@well-known-components/thegraph-component'
import { IStatusComponent } from './adapters/status'
import { AuthChain, Entity, EthAddress } from '@dcl/schemas'

export type GlobalContext = {
  components: BaseComponents
}

export type DeploymentToValidate = {
  entity: Entity
  files: Map<string, Uint8Array>
  authChain: AuthChain
  contentHashesInStorage: Map<string, boolean>
}

export type WorldMetadata = {
  entityId: string
  acl?: AuthChain
}

export type AccessControlList = {
  resource: string
  allowed: EthAddress[]
  timestamp: string
}

export interface Validator {
  validate(deployment: DeploymentToValidate): Promise<ValidationResult>
}

export type ValidationResult = {
  ok: () => boolean
  errors: string[]
}

export type ValidatorComponents = Pick<
  AppComponents,
  'config' | 'namePermissionChecker' | 'ethereumProvider' | 'limitsManager' | 'storage' | 'worldsManager'
>

export type Validation = (
  components: ValidatorComponents,
  deployment: DeploymentToValidate
) => ValidationResult | Promise<ValidationResult>

export type IWorldNamePermissionChecker = {
  checkPermission(ethAddress: EthAddress, worldName: string): Promise<boolean>
}

export type ContentStatus = {
  commitHash: string
  worldsCount: number
  details?: string[]
}

export type WorldStatus = { worldName: string; users: number }

export type CommsStatus = {
  adapterType: string
  statusUrl: string
  commitHash?: string
  users: number
  rooms: number
  details?: WorldStatus[]
}

export type StatusResponse = {
  content: ContentStatus
  comms: CommsStatus
}

export type ICommsAdapter = {
  connectionString(ethAddress: EthAddress, roomId: string): Promise<string>
  status(): Promise<CommsStatus>
}

export type ILimitsManager = {
  getAllowSdk6For(worldName: string): Promise<boolean>
  getMaxAllowedParcelsFor(worldName: string): Promise<number>
  getMaxAllowedSizeInMbFor(worldName: string): Promise<number>
}

export type IWorldsManager = {
  getDeployedWorldsNames(): Promise<string[]>
  getDeployedWorldsCount(): Promise<number>
  getMetadataForWorld(worldName: string): Promise<WorldMetadata | undefined>
  getEntityIdForWorld(worldName: string): Promise<string | undefined>
  getEntityForWorld(worldName: string): Promise<Entity | undefined>
  storeAcl(worldName: string, acl: AuthChain): Promise<void>
}

// components used in every environment
export type BaseComponents = {
  commsAdapter: ICommsAdapter
  config: IConfigComponent
  namePermissionChecker: IWorldNamePermissionChecker
  logs: ILoggerComponent
  server: IHttpServerComponent<GlobalContext>
  fetch: IFetchComponent
  metrics: IMetricsComponent<keyof typeof metricDeclarations>
  ethereumProvider: HTTPProvider
  storage: IContentStorageComponent
  marketplaceSubGraph: ISubgraphComponent
  limitsManager: ILimitsManager
  status: IStatusComponent
  sns: SnsComponent
  validator: Validator
  worldsManager: IWorldsManager
  ensSubGraph: ISubgraphComponent
}

export type SnsComponent = { arn?: string }

// components used in runtime
export type AppComponents = BaseComponents & {
  statusChecks: IBaseComponent
}

// components used in tests
export type TestComponents = BaseComponents & {
  // A fetch component that only hits the test server
  localFetch: IFetchComponent
}

// this type simplifies the typings of http handlers
export type HandlerContextWithPath<
  ComponentNames extends keyof AppComponents,
  Path extends string = any
> = IHttpServerComponent.PathAwareContext<
  IHttpServerComponent.DefaultContext<{
    components: Pick<AppComponents, ComponentNames>
  }>,
  Path
>

export type Context<Path extends string = any> = IHttpServerComponent.PathAwareContext<GlobalContext, Path>
