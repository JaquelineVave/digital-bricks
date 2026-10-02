import * as THREE from 'three'
import { areConnectorsCompatible, isVerticalPair } from './connectors'
import {
  CONNECTOR_OCCUPIED_DISTANCE,
  DIRECTION_OPPOSITE_DOT,
  SNAP_DISTANCE,
  SNAP_RELEASE_DISTANCE,
} from './constants'
import type { Brick, BrickConnector, SnapCandidate } from './types'

const _fromWorld = new THREE.Vector3()
const _toWorld = new THREE.Vector3()
const _fromDir = new THREE.Vector3()
const _toDir = new THREE.Vector3()
const _snappedPos = new THREE.Vector3()
const _rotatedFrom = new THREE.Vector3()
const _rotatedTo = new THREE.Vector3()
const _poseFrom = new THREE.Vector3()
const _poseTo = new THREE.Vector3()

export function getConnectorWorldPosition(
  brickPosition: THREE.Vector3,
  brickQuaternion: THREE.Quaternion,
  connector: BrickConnector,
  target: THREE.Vector3,
) {
  return target.copy(connector.position).applyQuaternion(brickQuaternion).add(brickPosition)
}

export function getConnectorWorldDirection(
  brickQuaternion: THREE.Quaternion,
  connector: BrickConnector,
  target: THREE.Vector3,
) {
  return target.copy(connector.direction).applyQuaternion(brickQuaternion)
}

export function connectorKey(brick: Brick, connector: BrickConnector) {
  return `${brick.id}:${connector.id}`
}

export function getOccupiedConnectors(
  bricks: Brick[],
  skipBrickIds?: string | Set<string>,
) {
  const skip =
    typeof skipBrickIds === 'string'
      ? new Set([skipBrickIds])
      : (skipBrickIds ?? new Set<string>())
  const occupied = new Set<string>()

  for (let i = 0; i < bricks.length; i += 1) {
    const a = bricks[i]
    if (skip.has(a.id)) continue

    for (let j = i + 1; j < bricks.length; j += 1) {
      const b = bricks[j]
      if (skip.has(b.id)) continue

      for (const from of a.connectors) {
        getConnectorWorldPosition(a.object.position, a.object.quaternion, from, _fromWorld)
        getConnectorWorldDirection(a.object.quaternion, from, _fromDir)

        for (const to of b.connectors) {
          if (!areConnectorsCompatible(from, to)) continue

          getConnectorWorldDirection(b.object.quaternion, to, _toDir)
          if (_fromDir.dot(_toDir) > DIRECTION_OPPOSITE_DOT) continue

          getConnectorWorldPosition(b.object.position, b.object.quaternion, to, _toWorld)
          if (_fromWorld.distanceTo(_toWorld) > CONNECTOR_OCCUPIED_DISTANCE) continue

          occupied.add(connectorKey(a, from))
          occupied.add(connectorKey(b, to))
        }
      }
    }
  }

  return occupied
}

function snappedPosition(
  dragged: Brick,
  target: Brick,
  fromConnector: BrickConnector,
  toConnector: BrickConnector,
  targetPosition: THREE.Vector3,
) {
  _rotatedTo.copy(toConnector.position).applyQuaternion(target.object.quaternion)
  _rotatedFrom.copy(fromConnector.position).applyQuaternion(dragged.object.quaternion)
  return _snappedPos.copy(targetPosition).add(_rotatedTo).sub(_rotatedFrom)
}

function poseHitsOccupied(
  dragged: Brick,
  snappedPos: THREE.Vector3,
  bricks: Brick[],
  occupied: Set<string>,
) {
  for (const from of dragged.connectors) {
    getConnectorWorldPosition(snappedPos, dragged.object.quaternion, from, _poseFrom)

    for (const other of bricks) {
      if (other.id === dragged.id) continue

      for (const to of other.connectors) {
        if (!areConnectorsCompatible(from, to)) continue
        if (!occupied.has(connectorKey(other, to))) continue

        getConnectorWorldPosition(other.object.position, other.object.quaternion, to, _poseTo)
        if (_poseFrom.distanceTo(_poseTo) <= CONNECTOR_OCCUPIED_DISTANCE) {
          return true
        }
      }
    }
  }

  return false
}

function horizontalDistance(a: THREE.Vector3, b: THREE.Vector3) {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

function pairDistance(
  from: BrickConnector,
  to: BrickConnector,
  fromWorld: THREE.Vector3,
  toWorld: THREE.Vector3,
) {
  if (isVerticalPair(from.role, to.role)) {
    return horizontalDistance(fromWorld, toWorld)
  }
  return fromWorld.distanceTo(toWorld)
}

function isBetterSnap(candidate: SnapCandidate, current: SnapCandidate) {
  const candidateVertical = isVerticalPair(
    candidate.fromConnector.role,
    candidate.toConnector.role,
  )
  const currentVertical = isVerticalPair(
    current.fromConnector.role,
    current.toConnector.role,
  )

  if (candidateVertical && currentVertical) {
    const heightGap = candidate.toWorld.y - current.toWorld.y
    if (heightGap > 0.25) return true
    if (heightGap < -0.25) return false
    return candidate.distance < current.distance
  }

  if (candidateVertical && !currentVertical && candidate.position.y > current.position.y + 0.2) {
    return true
  }
  if (!candidateVertical && currentVertical && current.position.y > candidate.position.y + 0.2) {
    return false
  }

  return candidate.distance < current.distance
}

function makeCandidate(
  dragged: Brick,
  target: Brick,
  fromConnector: BrickConnector,
  toConnector: BrickConnector,
  distance: number,
): SnapCandidate {
  return {
    dragged,
    target,
    fromConnector,
    toConnector,
    position: _snappedPos.clone(),
    quaternion: dragged.object.quaternion.clone(),
    fromWorld: _fromWorld.clone(),
    toWorld: _toWorld.clone(),
    fromDirection: _fromDir.clone(),
    toDirection: _toDir.clone(),
    distance,
  }
}

export function findBestSnap(
  dragged: Brick,
  freePosition: THREE.Vector3,
  bricks: Brick[],
  occupied: Set<string>,
  activeSnap: SnapCandidate | null,
  minCenterY = Number.NEGATIVE_INFINITY,
  maxDistance = SNAP_DISTANCE,
  maxReleaseDistance = SNAP_RELEASE_DISTANCE,
  occupancyBricks?: Brick[],
): SnapCandidate | null {
  let best: SnapCandidate | null = null
  const blockers = occupancyBricks ?? bricks

  for (const from of dragged.connectors) {
    getConnectorWorldPosition(freePosition, dragged.object.quaternion, from, _fromWorld)
    getConnectorWorldDirection(dragged.object.quaternion, from, _fromDir)

    for (const target of bricks) {
      if (target.id === dragged.id) continue

      for (const to of target.connectors) {
        if (!areConnectorsCompatible(from, to)) continue
        if (isVerticalPair(from.role, to.role) && from.role !== 'socket') continue
        if (occupied.has(connectorKey(target, to))) continue

        getConnectorWorldDirection(target.object.quaternion, to, _toDir)
        if (_fromDir.dot(_toDir) > DIRECTION_OPPOSITE_DOT) continue

        getConnectorWorldPosition(
          target.object.position,
          target.object.quaternion,
          to,
          _toWorld,
        )

        const distance = pairDistance(from, to, _fromWorld, _toWorld)
        const isActive =
          activeSnap?.fromConnector.id === from.id &&
          activeSnap.toConnector.id === to.id &&
          activeSnap.target.id === target.id
        const vertical = isVerticalPair(from.role, to.role)
        const limit = isActive
          ? maxReleaseDistance
          : vertical
            ? Math.max(maxDistance, 0.7)
            : maxDistance
        if (distance > limit) continue

        snappedPosition(dragged, target, from, to, target.object.position)
        if (_snappedPos.y < minCenterY - 0.001) continue
        if (poseHitsOccupied(dragged, _snappedPos, blockers, occupied)) continue

        const candidate = makeCandidate(dragged, target, from, to, distance)
        if (!best || isBetterSnap(candidate, best)) {
          best = candidate
        }
      }
    }
  }

  return best
}

export function snapOntoBrick(
  dragged: Brick,
  x: number,
  z: number,
  target: Brick,
  occupied: Set<string>,
): SnapCandidate | null {
  const sitY = target.object.position.y + target.height / 2 + dragged.height / 2
  const freePosition = new THREE.Vector3(x, sitY, z)
  let best: SnapCandidate | null = null

  for (const from of dragged.connectors) {
    if (from.role !== 'socket') continue
    getConnectorWorldPosition(freePosition, dragged.object.quaternion, from, _fromWorld)
    getConnectorWorldDirection(dragged.object.quaternion, from, _fromDir)

    for (const to of target.connectors) {
      if (to.role !== 'stud') continue
      if (occupied.has(connectorKey(target, to))) continue

      getConnectorWorldDirection(target.object.quaternion, to, _toDir)
      if (_fromDir.dot(_toDir) > DIRECTION_OPPOSITE_DOT) continue

      getConnectorWorldPosition(
        target.object.position,
        target.object.quaternion,
        to,
        _toWorld,
      )

      const distance = horizontalDistance(_fromWorld, _toWorld)
      snappedPosition(dragged, target, from, to, target.object.position)
      const candidate = makeCandidate(dragged, target, from, to, distance)
      if (!best || candidate.distance < best.distance) {
        best = candidate
      }
    }
  }

  return best
}
