import { createConfigComponent } from '@well-known-components/env-config-provider'
import { Variables } from '@well-known-components/thegraph-component/dist/types'
import { createDclNameChecker, createOnChainDclNameChecker } from '../../src/adapters/dcl-name-checker'
import { createLogComponent } from '@well-known-components/logger'
import { IConfigComponent, ILoggerComponent } from '@well-known-components/interfaces'
import { getIdentity } from '../utils'
import { createHttpProviderMock } from '../mocks/http-provider-mock'
import { createENSNameChecker } from '../../src/adapters/ens-checker'

describe('dcl name checker: TheGraph', function () {
  let logs: ILoggerComponent

  beforeEach(async () => {
    logs = await createLogComponent({
      config: createConfigComponent({
        LOG_LEVEL: 'DEBUG'
      })
    })
  })

  it('when permission asked for invalid name returns false', async () => {
    const dclNameChecker = createDclNameChecker({
      logs,
      marketplaceSubGraph: {
        query: async (_query: string, _variables?: Variables, _remainingAttempts?: number): Promise<any> => ({
          names: []
        })
      }
    })

    await expect(dclNameChecker.checkPermission('0xb', '')).resolves.toBeFalsy()
  })

  it('when no names returned from TheGraph returns false', async () => {
    const dclNameChecker = createDclNameChecker({
      logs,
      marketplaceSubGraph: {
        query: async (_query: string, _variables?: Variables, _remainingAttempts?: number): Promise<any> => ({
          nfts: []
        })
      }
    })

    await expect(dclNameChecker.checkPermission('0xb', 'my-super-name.dcl.eth')).resolves.toBeFalsy()
  })

  it('when requested name is returned from TheGraph returns true', async () => {
    const dclNameChecker = createDclNameChecker({
      logs,
      marketplaceSubGraph: {
        query: async (_query: string, _variables?: Variables, _remainingAttempts?: number): Promise<any> => ({
          nfts: [
            {
              name: 'my-super-name',
              owner: {
                id: '0xb'
              }
            }
          ]
        })
      }
    })

    await expect(dclNameChecker.checkPermission('0xb', 'my-super-name.dcl.eth')).resolves.toBeTruthy()
  })
})

describe('dcl name checker: on-chain', function () {
  let logs: ILoggerComponent
  let config: IConfigComponent

  beforeEach(async () => {
    config = createConfigComponent({
      NETWORK_ID: '1',
      LOG_LEVEL: 'DEBUG'
    })
    logs = await createLogComponent({ config })
  })

  it.each(['', 'name'])('when permission asked for invalid name returns false', async (name) => {
    const dclNameChecker = await createOnChainDclNameChecker({
      config,
      logs,
      ethereumProvider: createHttpProviderMock()
    })

    await expect(dclNameChecker.checkPermission('0xb', name)).resolves.toBeFalsy()
  })

  it('when on chain validation returns false', async () => {
    const dclNameChecker = await createOnChainDclNameChecker({
      config,
      logs,
      ethereumProvider: createHttpProviderMock({
        jsonrpc: '2.0',
        id: 1,
        result: '0x0000000000000000000000000000000000000000000000000000000000000000'
      })
    })

    const identity = await getIdentity()
    const address = identity.authChain.authChain[0].payload
    await expect(dclNameChecker.checkPermission(address, 'my-super-name.dcl.eth')).resolves.toBeFalsy()
  })

  it('when on chain validation returns true', async () => {
    const dclNameChecker = await createOnChainDclNameChecker({
      config,
      logs,
      ethereumProvider: createHttpProviderMock({
        jsonrpc: '2.0',
        id: 1,
        result: '0x0000000000000000000000000000000000000000000000000000000000000001'
      })
    })

    const identity = await getIdentity()
    const address = identity.authChain.authChain[0].payload
    await expect(dclNameChecker.checkPermission(address, 'my-super-name.dcl.eth')).resolves.toBeTruthy()
  })
})

describe('ENS name checker: TheGraph', function () {
  let logs: ILoggerComponent

  beforeEach(async () => {
    logs = await createLogComponent({
      config: createConfigComponent({
        LOG_LEVEL: 'DEBUG'
      })
    })
  })

  it('when permission asked for invalid name returns false', async () => {
    const ensNameChecker = createENSNameChecker({
      logs,
      ensSubGraph: {
        query: async (_query: string, _variables?: Variables, _remainingAttempts?: number): Promise<any> => ({
          domains: []
        })
      }
    })

    await expect(ensNameChecker.checkPermission('0xb', '')).resolves.toBeFalsy()
  })

  it('when no names returned from TheGraph returns false', async () => {
    const ensNameChecker = createENSNameChecker({
      logs,
      ensSubGraph: {
        query: async (_query: string, _variables?: Variables, _remainingAttempts?: number): Promise<any> => ({
          domains: []
        })
      }
    })

    await expect(ensNameChecker.checkPermission('0xb', 'dcl.eth')).resolves.toBeFalsy()
  })

  it('when requested name is returned from TheGraph returns true', async () => {
    const dclNameChecker = createENSNameChecker({
      logs,
      ensSubGraph: {
        query: async (_query: string, _variables?: Variables, _remainingAttempts?: number): Promise<any> => ({
          domains: [
            {
              name: 'dcl.eth',
              resolvedAddress: {
                id: '0xf47917b108ca4b820ccea2587546fbb9f7564b56'
              }
            }
          ]
        })
      }
    })

    await expect(
      dclNameChecker.checkPermission('0xf47917b108ca4b820ccea2587546fbb9f7564b56', 'dcl.eth')
    ).resolves.toBeTruthy()
  })
})
