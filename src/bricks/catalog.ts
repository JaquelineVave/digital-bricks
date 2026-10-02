import { BRICK_HEIGHT, BRICK_PLATE_HEIGHT } from './constants'
import type { BrickDefinition, PieceCategory } from './types'

export const PIECE_CATEGORIES: { id: PieceCategory; label: string }[] = [
  { id: 'structure', label: 'Structure' },
  { id: 'people', label: 'People' },
  { id: 'nature', label: 'Nature' },
  { id: 'symbols', label: 'Symbols' },
]

export const PIECE_COLORS = [
  { id: 'rot', name: 'Rot', hex: '#f14c08' },
  { id: 'violett', name: 'Violett', hex: '#6d14c8' },
  { id: 'gelb', name: 'Gelb', hex: '#f2cc29' },
  { id: 'gruen', name: 'Grün', hex: '#c0d904' },
  { id: 'hellblau', name: 'Hellblau', hex: '#73c1f2' },
  { id: 'blauviolett', name: 'Blauviolett', hex: '#682ef4' },
  { id: 'hintergrund', name: 'Hintergrund', hex: '#dae8e8' },
  { id: 'schwarz', name: 'Schwarz', hex: '#101820' },
] as const

export const DEFAULT_PIECE_COLOR = PIECE_COLORS[0].hex

const socketOnly = {
  includeStuds: false,
  includeSockets: true,
  includeSides: false,
} as const

function brick(
  id: string,
  name: string,
  widthUnits: number,
  depthUnits: number,
): BrickDefinition {
  return {
    id,
    name,
    category: 'structure',
    kind: 'brick',
    widthUnits,
    depthUnits,
    height: BRICK_HEIGHT,
    visualType: 'brick',
    color: DEFAULT_PIECE_COLOR,
    structural: true,
  }
}

function plate(
  id: string,
  name: string,
  widthUnits: number,
  depthUnits: number,
): BrickDefinition {
  return {
    id,
    name,
    category: 'structure',
    kind: 'plate',
    widthUnits,
    depthUnits,
    height: BRICK_PLATE_HEIGHT,
    visualType: 'plate',
    color: DEFAULT_PIECE_COLOR,
    structural: true,
  }
}

export const BRICK_LIBRARY: BrickDefinition[] = [
  brick('brick-1x1', '1×1', 1, 1),
  brick('brick-1x2', '1×2', 2, 1),
  brick('brick-1x3', '1×3', 3, 1),
  brick('brick-1x4', '1×4', 4, 1),
  brick('brick-2x2', '2×2', 2, 2),
  brick('brick-2x3', '2×3', 3, 2),
  brick('brick-2x4', '2×4', 4, 2),
  brick('brick-2x6', '2×6', 6, 2),
  plate('plate-1x1', '1×1 Plate', 1, 1),
  plate('plate-1x2', '1×2 Plate', 2, 1),
  plate('plate-2x2', '2×2 Plate', 2, 2),
  plate('plate-2x4', '2×4 Plate', 4, 2),
  plate('plate-6x6', 'Large plate', 6, 6),
  {
    id: 'door-2x1',
    name: 'Door',
    category: 'structure',
    kind: 'door',
    widthUnits: 2,
    depthUnits: 1,
    height: BRICK_HEIGHT * 3,
    visualType: 'brick',
    color: '#f2cc29',
    structural: true,
  },
  {
    id: 'window-2x2',
    name: 'Window',
    category: 'structure',
    kind: 'window',
    widthUnits: 2,
    depthUnits: 2,
    height: BRICK_HEIGHT * 2,
    visualType: 'brick',
    color: '#73c1f2',
    structural: true,
  },
  {
    id: 'person-idle',
    name: 'Person',
    category: 'people',
    kind: 'figure',
    widthUnits: 1,
    depthUnits: 1,
    height: 2.2,
    visualType: 'brick',
    color: '#682ef4',
    structural: false,
    connectors: socketOnly,
  },
  {
    id: 'person-arms-up',
    name: 'Arms up',
    category: 'people',
    kind: 'figure',
    widthUnits: 1,
    depthUnits: 1,
    height: 2.2,
    visualType: 'brick',
    color: '#c0d904',
    structural: false,
    connectors: socketOnly,
  },
  {
    id: 'person-arms-down',
    name: 'Arms down',
    category: 'people',
    kind: 'figure',
    widthUnits: 1,
    depthUnits: 1,
    height: 2.2,
    visualType: 'brick',
    color: '#f14c08',
    structural: false,
    connectors: socketOnly,
  },
  {
    id: 'tree',
    name: 'Tree',
    category: 'nature',
    kind: 'tree',
    widthUnits: 2,
    depthUnits: 2,
    height: 3.2,
    visualType: 'brick',
    color: '#c0d904',
    structural: false,
    connectors: socketOnly,
  },
  {
    id: 'flower',
    name: 'Flower',
    category: 'nature',
    kind: 'flower',
    widthUnits: 2,
    depthUnits: 2,
    height: 3.4,
    visualType: 'brick',
    color: '#6d14c8',
    structural: false,
    connectors: socketOnly,
  },
  {
    id: 'flag',
    name: 'Flag',
    category: 'symbols',
    kind: 'flag',
    widthUnits: 2,
    depthUnits: 1,
    height: 4.6,
    visualType: 'brick',
    color: '#f14c08',
    structural: false,
    connectors: socketOnly,
  },
]

export function getBrickDefinition(id: string) {
  return BRICK_LIBRARY.find((definition) => definition.id === id) ?? null
}

export function getPiecesByCategory(category: PieceCategory) {
  return BRICK_LIBRARY.filter((definition) => definition.category === category)
}

