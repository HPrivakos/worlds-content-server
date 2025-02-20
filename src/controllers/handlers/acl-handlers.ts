import { IHttpServerComponent } from '@well-known-components/interfaces'
import { AccessControlList, HandlerContextWithPath } from '../../types'
import { AuthChain, EthAddress } from '@dcl/schemas'

export async function getAclHandler(
  ctx: HandlerContextWithPath<'namePermissionChecker' | 'worldsManager', '/acl/:world_name'>
): Promise<IHttpServerComponent.IResponse> {
  const { namePermissionChecker, worldsManager } = ctx.components

  const worldName = ctx.params.world_name

  const worldMetadata = await worldsManager.getMetadataForWorld(worldName)
  if (!worldMetadata || !worldMetadata.acl) {
    return {
      status: 200,
      body: {
        resource: worldName,
        allowed: [],
        timestamp: ''
      } as AccessControlList
    }
  }

  // Check that the ACL was signed by the wallet that currently owns the world, or else return empty
  const ethAddress = worldMetadata.acl[0].payload
  const permission = await namePermissionChecker.checkPermission(ethAddress, worldName)
  const acl: AccessControlList = !permission
    ? {
        resource: worldName,
        allowed: [],
        timestamp: ''
      }
    : // Get the last element of the auth chain. The payload must contain the AccessControlList
      JSON.parse(worldMetadata.acl.slice(-1).pop()!.payload)

  return {
    status: 200,
    body: acl
  }
}

export async function postAclHandler(
  ctx: HandlerContextWithPath<'namePermissionChecker' | 'worldsManager', '/acl/:world_name'>
): Promise<IHttpServerComponent.IResponse> {
  const { namePermissionChecker, worldsManager } = ctx.components

  const worldName = ctx.params.world_name

  const authChain = (await ctx.request.json()) as AuthChain
  if (!AuthChain.validate(authChain)) {
    return {
      status: 400,
      body: {
        message: `Invalid payload received. Need to be a valid AuthChain.`
      }
    }
  }

  const permission = await namePermissionChecker.checkPermission(authChain[0].payload, worldName)
  if (!permission) {
    return {
      status: 403,
      body: {
        message: `Your wallet does not own "${worldName}", you can not set access control lists for it.`
      }
    }
  }

  const acl = JSON.parse(authChain[authChain.length - 1].payload)
  if (acl.resource !== worldName) {
    return {
      status: 400,
      body: {
        message: `Provided acl is for world "${acl.resource}" but you are trying to set acl for world ${worldName}.`
      }
    }
  }

  if (
    !acl.allowed ||
    !Array.isArray(acl.allowed) ||
    !acl.allowed.every((address: string) => EthAddress.validate(address))
  ) {
    return {
      status: 400,
      body: {
        message: `Provided acl is invalid. allowed is missing or not an array of addresses.`
      }
    }
  }

  if (acl.allowed.map((address: EthAddress) => address.toLowerCase()).includes(authChain[0].payload.toLowerCase())) {
    return {
      status: 400,
      body: {
        message: `You are trying to give permission to yourself. You own "${worldName}", so you already have permission to deploy scenes, no need to include yourself in the ACL.`
      }
    }
  }

  if (!acl.timestamp || !Date.parse(acl.timestamp)) {
    return {
      status: 400,
      body: {
        message: `Invalid ACL, timestamp is missing or has an invalid date.`
      }
    }
  }

  const ts = Date.parse(acl.timestamp)
  if (Math.abs(ts - Date.now()) > 120_000) {
    return {
      status: 400,
      body: {
        message: `Timestamp is not recent. Please sign a new ACL change request.`
      }
    }
  }

  const worldMetadata = await worldsManager.getMetadataForWorld(worldName)
  if (worldMetadata && worldMetadata.acl) {
    const oldAcl = JSON.parse(worldMetadata.acl.slice(-1).pop()!.payload) as AccessControlList
    if (oldAcl.timestamp && ts < Date.parse(oldAcl.timestamp)) {
      return {
        status: 400,
        body: {
          message: 'There is a newer ACL stored. Please sign a new ACL change request.'
        }
      }
    }
  }

  await worldsManager.storeAcl(worldName, authChain)

  return {
    status: 200,
    body: acl
  }
}
