import { createDotEnvConfigComponent } from '@well-known-components/env-config-provider'
import { createServerComponent, createStatusCheckComponent } from '@well-known-components/http-server'
import { createLogComponent } from '@well-known-components/logger'
import { createFetchComponent } from './adapters/fetch'
import { createMetricsComponent } from '@well-known-components/metrics'
import { createSubgraphComponent } from '@well-known-components/thegraph-component'
import { AppComponents, GlobalContext, ICommsAdapter, IWorldNamePermissionChecker, SnsComponent } from './types'
import { metricDeclarations } from './metrics'
import { metricDeclarations as theGraphMetricDeclarations } from '@well-known-components/thegraph-component'
import { HTTPProvider } from 'eth-connect'
import {
  createAwsS3BasedFileSystemContentStorage,
  createFolderBasedFileSystemContentStorage,
  createFsComponent
} from '@dcl/catalyst-storage'
import { createStatusComponent } from './adapters/status'
import { createValidator } from './adapters/validator'
import { createDclNameChecker, createOnChainDclNameChecker } from './adapters/dcl-name-checker'
import { createENSNameChecker } from './adapters/ens-checker'
import { createLimitsManagerComponent } from './adapters/limits-manager'
import { createWorldsManagerComponent } from './adapters/worlds-manager'
import { createCommsAdapterComponent } from './adapters/comms-adapter'

async function determineNameValidator(
  components: Pick<AppComponents, 'config' | 'ethereumProvider' | 'logs' | 'marketplaceSubGraph' | 'ensSubGraph'>
) {
  const nameValidatorStrategy = await components.config.requireString('NAME_VALIDATOR')
  switch (nameValidatorStrategy) {
    case 'ENS_CHECKER':
      return createENSNameChecker(components)
    case 'DCL_NAME_CHECKER':
      return createDclNameChecker(components)
    case 'ON_CHAIN_DCL_NAME_CHECKER':
      return await createOnChainDclNameChecker(components)

    // Add more name validator strategies as needed here
  }
  throw Error(`Invalid nameValidatorStrategy selected: ${nameValidatorStrategy}`)
}

// Initialize all the components of the app
export async function initComponents(): Promise<AppComponents> {
  const config = await createDotEnvConfigComponent({ path: ['.env.default', '.env'] })
  const logs = await createLogComponent({ config })

  const logger = logs.getLogger('components')
  const secret = await config.getString('AUTH_SECRET')
  if (!secret) {
    logger.warn('No secret defined, deployed worlds will not be returned.')
  }

  const server = await createServerComponent<GlobalContext>({ config, logs }, { cors: {} })
  const statusChecks = await createStatusCheckComponent({ server, config })
  const fetch = await createFetchComponent()
  const metrics = await createMetricsComponent(
    { ...metricDeclarations, ...theGraphMetricDeclarations },
    { server, config }
  )

  const commsAdapter: ICommsAdapter = await createCommsAdapterComponent({ config, fetch, logs })

  const rpcUrl = await config.requireString('RPC_URL')
  const ethereumProvider = new HTTPProvider(rpcUrl, fetch)

  const storageFolder = (await config.getString('STORAGE_FOLDER')) || 'contents'

  const bucket = await config.getString('BUCKET')
  const fs = createFsComponent()

  const storage = bucket
    ? await createAwsS3BasedFileSystemContentStorage({ fs, config }, bucket)
    : await createFolderBasedFileSystemContentStorage({ fs }, storageFolder)

  const subGraphUrl = await config.requireString('MARKETPLACE_SUBGRAPH_URL')
  const marketplaceSubGraph = await createSubgraphComponent({ config, logs, metrics, fetch }, subGraphUrl)
  const ensSubGraph = await createSubgraphComponent({ config, logs, metrics, fetch }, subGraphUrl)

  const snsArn = await config.getString('SNS_ARN')

  const status = await createStatusComponent({ logs, fetch, config })

  const sns: SnsComponent = {
    arn: snsArn
  }

  const namePermissionChecker: IWorldNamePermissionChecker = await determineNameValidator({
    config,
    ethereumProvider,
    logs,
    marketplaceSubGraph,
    ensSubGraph
  })

  const limitsManager = await createLimitsManagerComponent({ config, fetch, logs })

  const worldsManager = await createWorldsManagerComponent({ logs, storage })

  const validator = createValidator({
    config,
    namePermissionChecker,
    ethereumProvider,
    limitsManager,
    storage,
    worldsManager
  })

  return {
    commsAdapter,
    config,
    namePermissionChecker,
    logs,
    server,
    statusChecks,
    fetch,
    metrics,
    ethereumProvider,
    storage,
    marketplaceSubGraph,
    limitsManager,
    sns,
    status,
    validator,
    worldsManager,
    ensSubGraph
  }
}
