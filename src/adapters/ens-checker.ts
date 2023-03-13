import { AppComponents, IWorldNamePermissionChecker } from '../types'
import { EthAddress } from '@dcl/schemas'
import LRU from 'lru-cache'

type NamesResponse = {
  domains: { name: string; resolvedAddress: { id: string } }[]
}

export const createENSNameChecker = (
  components: Pick<AppComponents, 'logs' | 'ensSubGraph'>
): IWorldNamePermissionChecker => {
  const logger = components.logs.getLogger('check-permissions')
  logger.info('Using TheGraph ENSNameChecker')

  const cache = new LRU<string, string | undefined>({
    max: 100,
    ttl: 5 * 60 * 1000, // cache for 5 minutes
    fetchMethod: async (worldName: string): Promise<string | undefined> => {
      const result = await components.ensSubGraph.query<NamesResponse>(
        `
        query FetchOwnerForENSName($worldName: String) {
          domains(where: {name: $worldName}) {
            name
            resolvedAddress {
              id
            }
          }
        }`,
        {
          worldName: worldName.toLowerCase()
        }
      )

      const owner = result.domains.length ? result.domains[0].resolvedAddress.id.toLowerCase() : undefined
      logger.info(`Fetched owner of world ${worldName}: ${owner}`)
      return owner
    }
  })

  const checkPermission = async (ethAddress: EthAddress, worldName: string): Promise<boolean> => {
    if (worldName.length === 0) {
      return false
    }

    const owner = await cache.fetch(worldName)
    return !!owner && owner === ethAddress.toLowerCase()
  }

  return {
    checkPermission
  }
}
