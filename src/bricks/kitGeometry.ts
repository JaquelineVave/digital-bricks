import * as THREE from 'three'
import { UNIT } from './constants'
import type { BrickDefinition } from './types'

function mix(color: string, toward: string, amount: number) {
  return `#${new THREE.Color(color).lerp(new THREE.Color(toward), amount).getHexString()}`
}

function mat(color: string, roughness = 0.45, extras?: Partial<THREE.MeshStandardMaterialParameters>) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.04,
    ...extras,
  })
}

function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
) {
  const item = new THREE.Mesh(geometry, material)
  item.position.set(x, y, z)
  item.castShadow = true
  item.receiveShadow = true
  parent.add(item)
  return item
}

export function addKitVisual(object: THREE.Group, definition: BrickDefinition) {
  const bottom = -definition.height / 2

  if (definition.kind === 'figure') addFigure(object, definition, bottom)
  else if (definition.kind === 'tree') addTree(object, definition.color, bottom)
  else if (definition.kind === 'flower') addFlower(object, definition.color, bottom)
  else if (definition.kind === 'flag') addFlag(object, definition.color, bottom)
}

export function addDoorVisual(object: THREE.Group, definition: BrickDefinition) {
  const bottom = -definition.height / 2
  const top = definition.height / 2
  const wood = mat(definition.color, 0.48)
  const frame = mat(mix(definition.color, '#dae8e8', 0.45), 0.4)
  const handle = mat(mix(definition.color, '#101820', 0.35), 0.3)

  const frameDepth = definition.depthUnits * UNIT * 0.92
  mesh(object, new THREE.BoxGeometry(0.18, definition.height, frameDepth), frame, -0.91, 0, 0)
  mesh(object, new THREE.BoxGeometry(0.18, definition.height, frameDepth), frame, 0.91, 0, 0)
  mesh(object, new THREE.BoxGeometry(2, 0.22, frameDepth), frame, 0, top - 0.11, 0)
  mesh(object, new THREE.BoxGeometry(2, 0.12, frameDepth), frame, 0, bottom + 0.06, 0)
  mesh(object, new THREE.BoxGeometry(1.52, definition.height - 0.42, 0.1), wood, -0.04, 0.02, 0.12)
  mesh(object, new THREE.SphereGeometry(0.07, 10, 8), handle, 0.52, 0.05, 0.22)
}

export function addWindowVisual(object: THREE.Group, definition: BrickDefinition) {
  const frame = mat(definition.color, 0.38)
  const pane = mat('#73c1f2', 0.18, { transparent: true, opacity: 0.45 })
  const depth = definition.depthUnits * UNIT * 0.55

  mesh(object, new THREE.BoxGeometry(2, 0.16, depth), frame, 0, definition.height / 2 - 0.08, 0)
  mesh(object, new THREE.BoxGeometry(2, 0.16, depth), frame, 0, -definition.height / 2 + 0.08, 0)
  mesh(object, new THREE.BoxGeometry(0.16, definition.height, depth), frame, -0.92, 0, 0)
  mesh(object, new THREE.BoxGeometry(0.16, definition.height, depth), frame, 0.92, 0, 0)
  mesh(object, new THREE.BoxGeometry(2, 0.1, depth), frame, 0, 0, 0)
  mesh(object, new THREE.BoxGeometry(0.1, definition.height, depth), frame, 0, 0, 0)
  mesh(object, new THREE.BoxGeometry(0.78, 0.95, 0.06), pane, -0.42, 0.52, 0.02)
  mesh(object, new THREE.BoxGeometry(0.78, 0.95, 0.06), pane, 0.42, 0.52, 0.02)
  mesh(object, new THREE.BoxGeometry(0.78, 0.95, 0.06), pane, -0.42, -0.52, 0.02)
  mesh(object, new THREE.BoxGeometry(0.78, 0.95, 0.06), pane, 0.42, -0.52, 0.02)
}

function addFigure(object: THREE.Group, definition: BrickDefinition, bottom: number) {
  const skin = mat('#f3d1b0', 0.52)
  const shirt = mat(definition.color, 0.38)
  const pants = mat('#101820', 0.48)
  const shoes = mat('#101820', 0.4)

  mesh(object, new THREE.CylinderGeometry(0.09, 0.1, 0.16, 8), shoes, -0.13, bottom + 0.08, 0.02)
  mesh(object, new THREE.CylinderGeometry(0.09, 0.1, 0.16, 8), shoes, 0.13, bottom + 0.08, 0.02)
  mesh(object, new THREE.CylinderGeometry(0.08, 0.09, 0.58, 8), pants, -0.13, bottom + 0.46, 0)
  mesh(object, new THREE.CylinderGeometry(0.08, 0.09, 0.58, 8), pants, 0.13, bottom + 0.46, 0)
  mesh(object, new THREE.BoxGeometry(0.42, 0.62, 0.28), shirt, 0, bottom + 1.05, 0)
  mesh(object, new THREE.CylinderGeometry(0.08, 0.09, 0.12, 8), skin, 0, bottom + 1.4, 0)
  const head = mesh(object, new THREE.SphereGeometry(0.2, 16, 12), skin, 0, bottom + 1.62, 0)
  head.scale.set(1, 1.05, 0.95)

  const shoulderY = bottom + 1.28
  const pose = definition.id

  if (pose === 'person-arms-up') {
    const left = mesh(object, new THREE.CylinderGeometry(0.065, 0.075, 0.62, 8), shirt, -0.22, shoulderY + 0.28, 0)
    left.rotation.z = 0.38
    const right = mesh(object, new THREE.CylinderGeometry(0.065, 0.075, 0.62, 8), shirt, 0.22, shoulderY + 0.28, 0)
    right.rotation.z = -0.38
    mesh(object, new THREE.SphereGeometry(0.075, 8, 8), skin, -0.34, shoulderY + 0.56, 0)
    mesh(object, new THREE.SphereGeometry(0.075, 8, 8), skin, 0.34, shoulderY + 0.56, 0)
    return
  }

  if (pose === 'person-arms-down') {
    mesh(object, new THREE.CylinderGeometry(0.065, 0.075, 0.62, 8), shirt, -0.3, shoulderY - 0.22, 0)
    mesh(object, new THREE.CylinderGeometry(0.065, 0.075, 0.62, 8), shirt, 0.3, shoulderY - 0.22, 0)
    mesh(object, new THREE.SphereGeometry(0.075, 8, 8), skin, -0.3, shoulderY - 0.54, 0)
    mesh(object, new THREE.SphereGeometry(0.075, 8, 8), skin, 0.3, shoulderY - 0.54, 0)
    return
  }

  mesh(object, new THREE.CylinderGeometry(0.065, 0.075, 0.55, 8), shirt, -0.28, shoulderY - 0.18, 0)
  mesh(object, new THREE.CylinderGeometry(0.065, 0.075, 0.55, 8), shirt, 0.28, shoulderY - 0.18, 0)
  mesh(object, new THREE.SphereGeometry(0.075, 8, 8), skin, -0.28, shoulderY - 0.46, 0)
  mesh(object, new THREE.SphereGeometry(0.075, 8, 8), skin, 0.28, shoulderY - 0.46, 0)
}

function addTree(object: THREE.Group, color: string, bottom: number) {
  const bark = mat(mix(color, '#101820', 0.45), 0.72)
  mesh(object, new THREE.CylinderGeometry(0.11, 0.18, 0.9, 8), bark, 0, bottom + 0.45, 0)
  const lower = mesh(object, new THREE.ConeGeometry(0.95, 1.15, 7), mat(mix(color, '#101820', 0.18), 0.55), 0.04, bottom + 1.28, -0.04)
  lower.rotation.y = 0.3
  const middle = mesh(object, new THREE.ConeGeometry(0.72, 1.0, 7), mat(color, 0.5), -0.06, bottom + 1.85, 0.05)
  middle.rotation.y = 0.7
  mesh(object, new THREE.ConeGeometry(0.48, 0.82, 7), mat(mix(color, '#dae8e8', 0.22), 0.48), 0.05, bottom + 2.42, -0.03)
}

function addFlower(object: THREE.Group, color: string, bottom: number) {
  mesh(object, new THREE.CylinderGeometry(0.08, 0.11, 2.15, 8), mat(mix(color, '#c0d904', 0.55), 0.5), 0, bottom + 1.08, 0)

  const leafA = mesh(object, new THREE.SphereGeometry(0.42, 8, 6), mat(mix(color, '#c0d904', 0.4), 0.45), 0.42, bottom + 0.72, 0.06)
  leafA.scale.set(1.55, 0.22, 0.8)
  leafA.rotation.z = -0.45
  const leafB = mesh(object, new THREE.SphereGeometry(0.36, 8, 6), mat(mix(color, '#c0d904', 0.28), 0.45), -0.38, bottom + 0.95, -0.08)
  leafB.scale.set(1.45, 0.2, 0.75)
  leafB.rotation.z = 0.5

  const bloomY = bottom + 2.35
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2
    const petal = mesh(
      object,
      new THREE.SphereGeometry(0.4, 10, 8),
      mat(color, 0.35),
      Math.cos(angle) * 0.48,
      bloomY,
      Math.sin(angle) * 0.48,
    )
    petal.scale.set(0.8, 0.32, 1.25)
    petal.lookAt(0, bloomY, 0)
  }
  mesh(object, new THREE.SphereGeometry(0.28, 12, 10), mat(mix(color, '#f2cc29', 0.55), 0.32), 0, bloomY + 0.06, 0)
}

function addFlag(object: THREE.Group, color: string, bottom: number) {
  const metal = mat('#101820', 0.32)
  mesh(object, new THREE.CylinderGeometry(0.12, 0.16, 0.16, 10), metal, 0, bottom + 0.08, 0)
  mesh(object, new THREE.CylinderGeometry(0.055, 0.07, 4.3, 10), metal, 0, bottom + 2.23, 0)
  mesh(object, new THREE.SphereGeometry(0.1, 10, 8), metal, 0, bottom + 4.42, 0)

  const banner = mesh(object, new THREE.BoxGeometry(1.9, 1.1, 0.08), mat(color, 0.38), 1.02, bottom + 3.55, 0)
  banner.rotation.y = -0.1
  const tip = mesh(object, new THREE.BoxGeometry(0.34, 1.1, 0.08), mat(mix(color, '#101820', 0.22), 0.4), 1.98, bottom + 3.55, -0.08)
  tip.rotation.y = -0.16
}
