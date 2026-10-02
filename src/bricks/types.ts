import type { Group, Quaternion, Vector3 } from 'three'

export type ConnectorRole = 'stud' | 'socket' | 'side'

export interface BrickConnector {
  id: string
  role: ConnectorRole
  position: Vector3
  direction: Vector3
}

export interface ConnectorLayoutOptions {
  includeStuds?: boolean
  includeSockets?: boolean
  includeSides?: boolean
}

export type BrickVisualType = 'brick' | 'plate'

export type PieceCategory = 'structure' | 'people' | 'nature' | 'symbols'

export type PieceKind =
  | 'brick'
  | 'plate'
  | 'figure'
  | 'tree'
  | 'flower'
  | 'flag'
  | 'door'
  | 'window'

export interface BrickDefinition {
  id: string
  name: string
  category: PieceCategory
  kind: PieceKind
  widthUnits: number
  depthUnits: number
  height: number
  visualType: BrickVisualType
  color: string
  structural: boolean
  connectors?: ConnectorLayoutOptions
}

export interface Brick {
  id: string
  definitionId: string
  object: Group
  widthUnits: number
  depthUnits: number
  height: number
  connectors: BrickConnector[]
  draggable: boolean
  structural: boolean
}

export interface SnapCandidate {
  dragged: Brick
  target: Brick
  fromConnector: BrickConnector
  toConnector: BrickConnector
  position: Vector3
  quaternion: Quaternion
  fromWorld: Vector3
  toWorld: Vector3
  fromDirection: Vector3
  toDirection: Vector3
  distance: number
}
