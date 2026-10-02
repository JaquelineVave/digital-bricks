import * as THREE from 'three'
import type { SnapCandidate } from './types'

function makeMaterial(color: string, opacity: number) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
  return material
}

export function createSnapIndicator() {
  const group = new THREE.Group()
  group.visible = false
  group.renderOrder = 1000

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 32),
    makeMaterial('#38bdf8', 0.35),
  )
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.62, 40),
    makeMaterial('#ffffff', 0.95),
  )
  const inner = new THREE.Mesh(
    new THREE.RingGeometry(0.22, 0.34, 32),
    makeMaterial('#7dd3fc', 0.9),
  )

  // Geometry lies in XY. Lay it flat on XZ so it reads as a ring on the brick.
  disc.rotation.x = -Math.PI / 2
  ring.rotation.x = -Math.PI / 2
  inner.rotation.x = -Math.PI / 2

  group.add(disc)
  group.add(ring)
  group.add(inner)
  return group
}

export function updateSnapIndicator(
  indicator: THREE.Group,
  candidate: SnapCandidate | null,
) {
  if (!candidate) {
    indicator.visible = false
    return
  }

  indicator.visible = true
  indicator.position.copy(candidate.toWorld)
  indicator.position.addScaledVector(candidate.toDirection, 0.22)
}
