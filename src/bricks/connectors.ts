import * as THREE from 'three'
import { UNIT } from './constants'
import type { BrickConnector, ConnectorLayoutOptions, ConnectorRole } from './types'

export function cellCenters(count: number): number[] {
  return Array.from({ length: count }, (_, index) => (index + 0.5 - count / 2) * UNIT)
}

export function areConnectorsCompatible(
  a: BrickConnector,
  b: BrickConnector,
): boolean {
  if (a.role === 'stud' && b.role === 'socket') return true
  if (a.role === 'socket' && b.role === 'stud') return true
  if (a.role === 'side' && b.role === 'side') return true
  return false
}

export function isVerticalPair(a: ConnectorRole, b: ConnectorRole): boolean {
  return (
    (a === 'stud' && b === 'socket') ||
    (a === 'socket' && b === 'stud')
  )
}

export function buildConnectors(
  widthUnits: number,
  depthUnits: number,
  height: number,
  options: ConnectorLayoutOptions = {},
): BrickConnector[] {
  const includeStuds = options.includeStuds ?? true
  const includeSockets = options.includeSockets ?? true
  const includeSides = options.includeSides ?? true
  const connectors: BrickConnector[] = []
  const xs = cellCenters(widthUnits)
  const zs = cellCenters(depthUnits)
  const halfWidth = (widthUnits * UNIT) / 2
  const halfDepth = (depthUnits * UNIT) / 2

  xs.forEach((x, xIndex) => {
    zs.forEach((z, zIndex) => {
      if (includeStuds) {
        connectors.push({
          id: `stud-${xIndex}-${zIndex}`,
          role: 'stud',
          position: new THREE.Vector3(x, height / 2, z),
          direction: new THREE.Vector3(0, 1, 0),
        })
      }
      if (includeSockets) {
        connectors.push({
          id: `socket-${xIndex}-${zIndex}`,
          role: 'socket',
          position: new THREE.Vector3(x, -height / 2, z),
          direction: new THREE.Vector3(0, -1, 0),
        })
      }
    })
  })

  if (!includeSides) return connectors

  zs.forEach((z, zIndex) => {
    connectors.push({
      id: `side-px-${zIndex}`,
      role: 'side',
      position: new THREE.Vector3(halfWidth, 0, z),
      direction: new THREE.Vector3(1, 0, 0),
    })
    connectors.push({
      id: `side-nx-${zIndex}`,
      role: 'side',
      position: new THREE.Vector3(-halfWidth, 0, z),
      direction: new THREE.Vector3(-1, 0, 0),
    })
  })

  xs.forEach((x, xIndex) => {
    connectors.push({
      id: `side-pz-${xIndex}`,
      role: 'side',
      position: new THREE.Vector3(x, 0, halfDepth),
      direction: new THREE.Vector3(0, 0, 1),
    })
    connectors.push({
      id: `side-nz-${xIndex}`,
      role: 'side',
      position: new THREE.Vector3(x, 0, -halfDepth),
      direction: new THREE.Vector3(0, 0, -1),
    })
  })

  return connectors
}
