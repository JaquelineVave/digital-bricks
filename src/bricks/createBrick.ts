import * as THREE from 'three'
import { BRICK_HEIGHT, STUD_HEIGHT, STUD_RADIUS, UNIT } from './constants'
import { buildConnectors } from './connectors'
import { addDoorVisual, addKitVisual, addWindowVisual } from './kitGeometry'
import type { Brick, BrickDefinition } from './types'

function createStuds(
  widthUnits: number,
  depthUnits: number,
  color: THREE.ColorRepresentation,
) {
  const group = new THREE.Group()
  const geometry = new THREE.CylinderGeometry(STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 16)
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.05,
  })

  for (let x = 0; x < widthUnits; x += 1) {
    for (let z = 0; z < depthUnits; z += 1) {
      const stud = new THREE.Mesh(geometry, material)
      stud.position.set(
        (x + 0.5 - widthUnits / 2) * UNIT,
        STUD_HEIGHT / 2,
        (z + 0.5 - depthUnits / 2) * UNIT,
      )
      stud.castShadow = true
      stud.userData.isStud = true
      group.add(stud)
    }
  }

  return group
}

let brickCount = 0

export function createBrick(
  widthUnits: number,
  depthUnits: number,
  color: THREE.ColorRepresentation,
  height = BRICK_HEIGHT,
): Brick {
  const object = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    metalness: 0.05,
  })

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(widthUnits * UNIT, height, depthUnits * UNIT),
    material,
  )
  body.castShadow = true
  body.receiveShadow = true
  object.add(body)

  const studs = createStuds(widthUnits, depthUnits, color)
  studs.position.y = height / 2
  object.add(studs)

  brickCount += 1
  const id = `brick-${brickCount}`
  object.userData.isBrick = true
  object.userData.brickId = id
  object.userData.widthUnits = widthUnits
  object.userData.depthUnits = depthUnits

  return {
    id,
    definitionId: 'custom',
    object,
    widthUnits,
    depthUnits,
    height,
    draggable: true,
    structural: true,
    connectors: buildConnectors(widthUnits, depthUnits, height),
  }
}

export function createBrickFromDefinition(definition: BrickDefinition): Brick {
  if (
    definition.kind === 'brick' ||
    definition.kind === 'plate' ||
    definition.kind === 'door' ||
    definition.kind === 'window'
  ) {
    const brick = createBrick(
      definition.widthUnits,
      definition.depthUnits,
      definition.color,
      definition.height,
    )
    brick.definitionId = definition.id
    brick.structural = definition.structural
    if (definition.kind === 'door') applyCustomBody(brick.object, () => addDoorVisual(brick.object, definition))
    if (definition.kind === 'window') applyCustomBody(brick.object, () => addWindowVisual(brick.object, definition))
    if (definition.connectors) {
      brick.connectors = buildConnectors(
        definition.widthUnits,
        definition.depthUnits,
        definition.height,
        definition.connectors,
      )
    }
    return brick
  }

  return createKitPiece(definition)
}

function applyCustomBody(object: THREE.Group, addVisual: () => void) {
  const body = object.children.find(
    (child) => child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry,
  )
  if (body instanceof THREE.Mesh) {
    object.remove(body)
    body.geometry.dispose()
    const material = body.material
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose())
    else material.dispose()
  }
  addVisual()
}

function createKitPiece(definition: BrickDefinition): Brick {
  const object = new THREE.Group()
  addKitVisual(object, definition)

  brickCount += 1
  const id = `brick-${brickCount}`
  object.userData.isBrick = true
  object.userData.brickId = id
  object.userData.widthUnits = definition.widthUnits
  object.userData.depthUnits = definition.depthUnits

  return {
    id,
    definitionId: definition.id,
    object,
    widthUnits: definition.widthUnits,
    depthUnits: definition.depthUnits,
    height: definition.height,
    draggable: true,
    structural: definition.structural,
    connectors: buildConnectors(
      definition.widthUnits,
      definition.depthUnits,
      definition.height,
      definition.connectors ?? {
        includeStuds: false,
        includeSockets: true,
        includeSides: false,
      },
    ),
  }
}

export function createPlate(
  sizeUnits: number,
  thickness: number,
  color: THREE.ColorRepresentation,
): Brick {
  const object = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.02,
  })

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(sizeUnits * UNIT, thickness, sizeUnits * UNIT),
    material,
  )
  base.receiveShadow = true
  object.add(base)

  const studs = createStuds(sizeUnits, sizeUnits, color)
  studs.position.y = thickness / 2
  object.add(studs)

  object.position.y = thickness / 2
  object.userData.isPlate = true
  object.userData.brickId = 'plate'

  return {
    id: 'plate',
    definitionId: 'base-plate',
    object,
    widthUnits: sizeUnits,
    depthUnits: sizeUnits,
    height: thickness,
    draggable: false,
    structural: true,
    connectors: buildConnectors(sizeUnits, sizeUnits, thickness, {
      includeStuds: true,
      includeSockets: false,
      includeSides: false,
    }),
  }
}
