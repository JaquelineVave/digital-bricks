import * as THREE from 'three'
import { CONNECTOR_OCCUPIED_DISTANCE, DIRECTION_OPPOSITE_DOT } from './constants'
import { areConnectorsCompatible } from './connectors'
import { getConnectorWorldDirection, getConnectorWorldPosition } from './snap'
import type { Brick, ConnectorRole, SnapCandidate } from './types'

export interface BrickConnection {
  id: string
  brickAId: string
  brickBId: string
  connectorAId: string
  connectorBId: string
  roleA: ConnectorRole
  roleB: ConnectorRole
}

const _fromWorld = new THREE.Vector3()
const _toWorld = new THREE.Vector3()
const _fromDir = new THREE.Vector3()
const _toDir = new THREE.Vector3()

function connectionId(
  brickAId: string,
  connectorAId: string,
  brickBId: string,
  connectorBId: string,
) {
  const left = `${brickAId}:${connectorAId}`
  const right = `${brickBId}:${connectorBId}`
  return left < right ? `${left}|${right}` : `${right}|${left}`
}

function makeConnection(
  brickAId: string,
  brickBId: string,
  connectorAId: string,
  connectorBId: string,
  roleA: ConnectorRole,
  roleB: ConnectorRole,
): BrickConnection {
  return {
    id: connectionId(brickAId, connectorAId, brickBId, connectorBId),
    brickAId,
    brickBId,
    connectorAId,
    connectorBId,
    roleA,
    roleB,
  }
}

/** One-time seed for bricks that are already snapped when the scene starts. */
export function findAlignedConnections(bricks: Brick[]): BrickConnection[] {
  const links: BrickConnection[] = []
  const seen = new Set<string>()

  for (let i = 0; i < bricks.length; i += 1) {
    const a = bricks[i]
    if (!a.draggable) continue

    for (let j = i + 1; j < bricks.length; j += 1) {
      const b = bricks[j]
      if (!b.draggable) continue

      for (const from of a.connectors) {
        getConnectorWorldPosition(a.object.position, a.object.quaternion, from, _fromWorld)
        getConnectorWorldDirection(a.object.quaternion, from, _fromDir)

        for (const to of b.connectors) {
          if (!areConnectorsCompatible(from, to)) continue
          getConnectorWorldDirection(b.object.quaternion, to, _toDir)
          if (_fromDir.dot(_toDir) > DIRECTION_OPPOSITE_DOT) continue
          getConnectorWorldPosition(b.object.position, b.object.quaternion, to, _toWorld)
          if (_fromWorld.distanceTo(_toWorld) > CONNECTOR_OCCUPIED_DISTANCE) continue

          const connection = makeConnection(
            a.id,
            b.id,
            from.id,
            to.id,
            from.role,
            to.role,
          )
          if (seen.has(connection.id)) continue
          seen.add(connection.id)
          links.push(connection)
        }
      }
    }
  }

  return links
}

function otherBrickId(connection: BrickConnection, brickId: string) {
  return connection.brickAId === brickId ? connection.brickBId : connection.brickAId
}

export class ConnectionGraph {
  private connections = new Map<string, BrickConnection>()
  private byBrick = new Map<string, BrickConnection[]>()

  add(connection: BrickConnection) {
    if (this.connections.has(connection.id)) return
    this.connections.set(connection.id, connection)
    this.addIndex(connection.brickAId, connection)
    this.addIndex(connection.brickBId, connection)
  }

  addFromSnap(snap: SnapCandidate) {
    if (!snap.target.draggable) return
    this.add(
      makeConnection(
        snap.dragged.id,
        snap.target.id,
        snap.fromConnector.id,
        snap.toConnector.id,
        snap.fromConnector.role,
        snap.toConnector.role,
      ),
    )
  }

  remove(connectionId: string) {
    const connection = this.connections.get(connectionId)
    if (!connection) return
    this.connections.delete(connectionId)
    this.removeIndex(connection.brickAId, connectionId)
    this.removeIndex(connection.brickBId, connectionId)
  }

  /** Detach one brick; other bricks keep any connections they still have to each other. */
  removeConnectionsFor(brickId: string) {
    this.linksFor(brickId).forEach((connection) => this.remove(connection.id))
  }

  seedAligned(bricks: Brick[]) {
    findAlignedConnections(bricks).forEach((connection) => this.add(connection))
  }

  list() {
    return [...this.connections.values()]
  }

  linksFor(brickId: string) {
    return this.byBrick.get(brickId) ?? []
  }

  getConnectedComponent(brickId: string) {
    const ids = new Set<string>([brickId])
    const queue = [brickId]
    while (queue.length > 0) {
      const current = queue.shift()!
      for (const connection of this.linksFor(current)) {
        const other = otherBrickId(connection, current)
        if (ids.has(other)) continue
        ids.add(other)
        queue.push(other)
      }
    }
    return ids
  }

  private addIndex(brickId: string, connection: BrickConnection) {
    const list = this.byBrick.get(brickId)
    if (list) list.push(connection)
    else this.byBrick.set(brickId, [connection])
  }

  private removeIndex(brickId: string, connectionId: string) {
    const list = this.byBrick.get(brickId)
    if (!list) return
    const next = list.filter((connection) => connection.id !== connectionId)
    if (next.length > 0) this.byBrick.set(brickId, next)
    else this.byBrick.delete(brickId)
  }
}

export interface RigidMemberPose {
  brickId: string
  localPosition: THREE.Vector3
  localQuaternion: THREE.Quaternion
}

export function snapshotRigidPoses(root: Brick, members: Brick[]): RigidMemberPose[] {
  const inverseRoot = root.object.quaternion.clone().invert()
  return members.map((member) => {
    const localPosition = member.object.position.clone().sub(root.object.position)
    localPosition.applyQuaternion(inverseRoot)
    return {
      brickId: member.id,
      localPosition,
      localQuaternion: inverseRoot.clone().multiply(member.object.quaternion),
    }
  })
}

export function applyRigidPoses(
  root: Brick,
  members: Brick[],
  poses: RigidMemberPose[],
) {
  const byId = new Map(members.map((brick) => [brick.id, brick]))
  for (const pose of poses) {
    if (pose.brickId === root.id) continue
    const brick = byId.get(pose.brickId)
    if (!brick) continue
    brick.object.position
      .copy(pose.localPosition)
      .applyQuaternion(root.object.quaternion)
      .add(root.object.position)
    brick.object.quaternion.copy(root.object.quaternion).multiply(pose.localQuaternion)
  }
}
