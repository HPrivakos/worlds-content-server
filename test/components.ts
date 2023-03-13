// This file is the "test-environment" analogous for src/components.ts
// Here we define the test components to be used in the testing environment

import { createLocalFetchCompoment, createRunner } from '@well-known-components/test-helpers'

import { main } from '../src/service'
import { TestComponents } from '../src/types'
import { initComponents as originalInitComponents } from '../src/components'
import { createMockMarketplaceSubGraph } from './mocks/marketplace-subgraph-mock'
import { createMockNamePermissionChecker } from './mocks/dcl-name-checker-mock'
import { createValidator } from '../src/adapters/validator'
import { createFetchComponent } from '../src/adapters/fetch'
import { createMockLimitsManagerComponent } from './mocks/limits-manager-mock'
import { createWorldsManagerComponent } from '../src/adapters/worlds-manager'
import { createMockStatusComponent } from './mocks/status-mock'
import { createInMemoryStorage } from '@dcl/catalyst-storage'
import { createMockCommsAdapterComponent } from './mocks/comms-adapter-mock'

/**
 * Behaves like Jest "describe" function, used to describe a test for a
 * use case, it creates a whole new program and components to run an
 * isolated test.
 *
 * State is persistent within the steps of the test.
 */
export const test = createRunner<TestComponents>({
  main,
  initComponents
})

async function initComponents(): Promise<TestComponents> {
  const components = await originalInitComponents()

  const { config, logs } = components

  const storage = createInMemoryStorage()

  const namePermissionChecker = createMockNamePermissionChecker()

  const fetch = await createFetchComponent()

  const limitsManager = createMockLimitsManagerComponent()

  const commsAdapter = createMockCommsAdapterComponent()

  const worldsManager = await createWorldsManagerComponent({ logs, storage })

  const validator = createValidator({
    config,
    storage,
    namePermissionChecker,
    limitsManager,
    ethereumProvider: components.ethereumProvider,
    worldsManager
  })
  const status = createMockStatusComponent()

  return {
    ...components,
    localFetch: await createLocalFetchCompoment(config),
    marketplaceSubGraph: createMockMarketplaceSubGraph(),
    ensSubGraph: createMockMarketplaceSubGraph(),
    namePermissionChecker: namePermissionChecker,
    commsAdapter,
    fetch,
    limitsManager,
    validator,
    status,
    storage,
    worldsManager
  }
}
