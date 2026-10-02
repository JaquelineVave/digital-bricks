import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  PLATE_SNAP_DISTANCE,
  SNAP_DISTANCE,
  SNAP_RELEASE_DISTANCE,
  UNIT,
} from './bricks/constants'
import { createBrickFromDefinition, createPlate } from './bricks/createBrick'
import {
  applyRigidPoses,
  ConnectionGraph,
  snapshotRigidPoses,
  type RigidMemberPose,
} from './bricks/connections'
import { findBestSnap, getOccupiedConnectors, snapOntoBrick } from './bricks/snap'
import { createSnapIndicator, updateSnapIndicator } from './bricks/snapIndicator'
import type { Brick, BrickDefinition, SnapCandidate } from './bricks/types'

const PLATE_SIZE = 20
const PLATE_THICKNESS = 0.35

interface SceneProps {
  heldDefinition?: BrickDefinition | null
  onHoldChange?: (definitionId: string | null) => void
}

function findTaggedObject(object: THREE.Object3D | null, key: string) {
  let current = object
  while (current) {
    if (current.userData[key]) return current
    current = current.parent
  }
  return null
}

function setPointerFromEvent(
  event: PointerEvent,
  canvas: HTMLCanvasElement,
  pointer: THREE.Vector2,
) {
  const rect = canvas.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
}

function clampToPlate(brick: Brick, x: number, z: number) {
  const { width, depth } = brickFootprint(brick)
  const half = (PLATE_SIZE * UNIT) / 2
  return {
    x: THREE.MathUtils.clamp(x, -half + width / 2, half - width / 2),
    z: THREE.MathUtils.clamp(z, -half + depth / 2, half - depth / 2),
  }
}

function clampGroupToPlate(members: Brick[]) {
  if (members.length === 0) return
  const half = (PLATE_SIZE * UNIT) / 2
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const brick of members) {
    const { width, depth } = brickFootprint(brick)
    minX = Math.min(minX, brick.object.position.x - width / 2)
    maxX = Math.max(maxX, brick.object.position.x + width / 2)
    minZ = Math.min(minZ, brick.object.position.z - depth / 2)
    maxZ = Math.max(maxZ, brick.object.position.z + depth / 2)
  }
  let shiftX = 0
  let shiftZ = 0
  if (minX < -half) shiftX = -half - minX
  else if (maxX > half) shiftX = half - maxX
  if (minZ < -half) shiftZ = -half - minZ
  else if (maxZ > half) shiftZ = half - maxZ
  if (shiftX === 0 && shiftZ === 0) return
  for (const brick of members) {
    brick.object.position.x += shiftX
    brick.object.position.z += shiftZ
  }
}

function brickFootprint(brick: Brick) {
  const yaw = new THREE.Euler().setFromQuaternion(brick.object.quaternion, 'YXZ').y
  const quarter = ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4
  const swapped = quarter % 2 === 1
  return {
    width: (swapped ? brick.depthUnits : brick.widthUnits) * UNIT,
    depth: (swapped ? brick.widthUnits : brick.depthUnits) * UNIT,
  }
}

function footprintsOverlap(
  a: Brick,
  aX: number,
  aZ: number,
  b: Brick,
  padding = 0,
) {
  const aSize = brickFootprint(a)
  const bSize = brickFootprint(b)
  const aHalfW = aSize.width / 2 + padding
  const aHalfD = aSize.depth / 2 + padding
  const bHalfW = bSize.width / 2 + padding
  const bHalfD = bSize.depth / 2 + padding
  const overlapX =
    Math.min(aX + aHalfW, b.object.position.x + bHalfW) -
    Math.max(aX - aHalfW, b.object.position.x - bHalfW)
  const overlapZ =
    Math.min(aZ + aHalfD, b.object.position.z + bHalfD) -
    Math.max(aZ - aHalfD, b.object.position.z - bHalfD)
  return overlapX > 0.05 && overlapZ > 0.05
}

function hitWorldNormal(hit: THREE.Intersection, target: THREE.Vector3) {
  if (!hit.face) return target.set(0, 1, 0)
  target.copy(hit.face.normal)
  hit.object.updateWorldMatrix(true, false)
  target.transformDirection(hit.object.matrixWorld)
  return target.normalize()
}

function isTopSurfaceHit(hit: THREE.Intersection, brick: Brick) {
  if (hit.object.userData.isStud) return true
  const top = brick.object.position.y + brick.height / 2
  if (hit.point.y >= top - 0.4) return true
  const normal = hitWorldNormal(hit, new THREE.Vector3())
  return normal.y > 0.35
}

function collectMeshes(root: THREE.Object3D, target: THREE.Object3D[]) {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) target.push(object)
  })
}

function setBrickPreview(brick: Brick, preview: boolean) {
  brick.object.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => {
      if (!('opacity' in material)) return
      material.transparent = preview
      material.opacity = preview ? 0.7 : 1
      material.depthWrite = !preview
    })
  })
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.geometry.dispose()
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((material) => material.dispose())
  })
}

export function Scene({ heldDefinition = null, onHoldChange }: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onHoldChangeRef = useRef(onHoldChange)
  onHoldChangeRef.current = onHoldChange
  const heldDefinitionRef = useRef(heldDefinition)
  heldDefinitionRef.current = heldDefinition
  const apiRef = useRef<{
    startPlacing: (definition: BrickDefinition) => void
    cancelPlacing: () => void
  }>({
    startPlacing: () => undefined,
    cancelPlacing: () => undefined,
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#dce8f2')

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      200,
    )
    camera.position.set(30, 26, 36)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.shadowMap.enabled = true
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.target.set(0, 1, 0)
    controls.maxPolarAngle = Math.PI / 2.05
    controls.minDistance = 12
    controls.maxDistance = 80

    scene.add(new THREE.AmbientLight('#ffffff', 0.55))

    const sun = new THREE.DirectionalLight('#ffffff', 1.15)
    sun.position.set(12, 20, 10)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    scene.add(sun)

    const fill = new THREE.DirectionalLight('#c9ddff', 0.35)
    fill.position.set(-10, 8, -6)
    scene.add(fill)

    const plate = createPlate(PLATE_SIZE, PLATE_THICKNESS, '#2f9e44')
    scene.add(plate.object)

    const movableBricks: Brick[] = []
    const allBricks: Brick[] = [plate]
    const brickMeshes: THREE.Object3D[] = []
    const surfaceMeshes: THREE.Object3D[] = []
    collectMeshes(plate.object, surfaceMeshes)

    const connectionGraph = new ConnectionGraph()

    const snapIndicator = createSnapIndicator()
    scene.add(snapIndicator)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const dragPoint = new THREE.Vector3()
    const dragOffset = new THREE.Vector3()
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const freePosition = new THREE.Vector3()

    let draggedBrick: Brick | null = null
    let heldBrick: Brick | null = null
    let selectedBrick: Brick | null = null
    let movingBricks: Brick[] = []
    let movingPoses: RigidMemberPose[] = []
    let activeSnap: SnapCandidate | null = null
    let detaching = false
    let lastPointer: PointerEvent | null = null

    const activeBrick = () => draggedBrick ?? heldBrick

    const brickFromObject = (object: THREE.Object3D | null) => {
      const brickObject = findTaggedObject(object, 'isBrick')
      if (!brickObject) return null
      return (
        movableBricks.find((brick) => brick.id === brickObject.userData.brickId) ??
        null
      )
    }

    const ownerFromObject = (object: THREE.Object3D | null) => {
      const tagged =
        findTaggedObject(object, 'isBrick') ?? findTaggedObject(object, 'isPlate')
      if (!tagged) return null
      return allBricks.find((brick) => brick.id === tagged.userData.brickId) ?? null
    }

    const movingIds = () => new Set(movingBricks.map((brick) => brick.id))

    const liftGroupAbovePlate = () => {
      let minBottom = Infinity
      for (const brick of movingBricks) {
        minBottom = Math.min(minBottom, brick.object.position.y - brick.height / 2)
      }
      const lift = PLATE_THICKNESS - minBottom
      if (lift <= 0.0001) return
      for (const brick of movingBricks) {
        brick.object.position.y += lift
      }
    }

    const settleGroup = (root: Brick) => {
      applyRigidPoses(root, movingBricks, movingPoses)
      liftGroupAbovePlate()
    }

    const meshesExcludingMoving = () => {
      const excluded = new Set<THREE.Object3D>(
        movingBricks.map((brick) => brick.object),
      )
      const current = activeBrick()
      if (current) excluded.add(current.object)
      if (excluded.size === 0) return surfaceMeshes
      return surfaceMeshes.filter((mesh) => {
        let node: THREE.Object3D | null = mesh
        while (node) {
          if (excluded.has(node)) return false
          node = node.parent
        }
        return true
      })
    }

    const getHoverHit = (event: PointerEvent) => {
      setPointerFromEvent(event, renderer.domElement, pointer)
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(meshesExcludingMoving(), false)
      const hit = hits[0] ?? null
      return {
        hit,
        owner: hit ? ownerFromObject(hit.object) : null,
      }
    }

    const intersectDragPlane = (event: PointerEvent) => {
      setPointerFromEvent(event, renderer.domElement, pointer)
      raycaster.setFromCamera(pointer, camera)
      return raycaster.ray.intersectPlane(dragPlane, dragPoint)
    }

    const applyDrag = (event: PointerEvent) => {
      const dragged = activeBrick()
      if (!dragged || !intersectDragPlane(event)) return

      const clamped = clampToPlate(
        dragged,
        dragPoint.x - dragOffset.x,
        dragPoint.z - dragOffset.z,
      )
      const plateY = PLATE_THICKNESS + dragged.height / 2
      const occupied = getOccupiedConnectors(allBricks, movingIds())
      const { hit, owner } = getHoverHit(event)

      const placeOnBrick = (target: Brick, x: number, z: number) => {
        if (movingIds().has(target.id)) return false
        const stacked =
          snapOntoBrick(dragged, x, z, target, occupied) ??
          snapOntoBrick(dragged, x, z, target, new Set())
        if (!stacked) return false
        activeSnap = stacked
        dragged.object.position.copy(stacked.position)
        settleGroup(dragged)
        updateSnapIndicator(snapIndicator, stacked)
        return true
      }

      const placeOnPlate = (x: number, z: number) => {
        const platePos = clampToPlate(dragged, x, z)
        const blocked = movableBricks.some(
          (brick) =>
            !movingIds().has(brick.id) &&
            footprintsOverlap(dragged, platePos.x, platePos.z, brick),
        )
        if (blocked) return false
        freePosition.set(platePos.x, plateY, platePos.z)
        const plateSnap = findBestSnap(
          dragged,
          freePosition,
          [plate],
          occupied,
          activeSnap?.target.id === 'plate' ? activeSnap : null,
          plateY,
          PLATE_SNAP_DISTANCE,
          PLATE_SNAP_DISTANCE,
          allBricks.filter((brick) => !movingIds().has(brick.id)),
        )
        activeSnap = plateSnap
        dragged.object.position.copy(plateSnap?.position ?? freePosition)
        settleGroup(dragged)
        updateSnapIndicator(snapIndicator, null)
        return true
      }

      if (owner && owner.id !== 'plate' && hit && isTopSurfaceHit(hit, owner)) {
        if (placeOnBrick(owner, clamped.x, clamped.z)) return
      }

      if (!owner || owner.id === 'plate') {
        const plateX = hit?.point.x ?? clamped.x
        const plateZ = hit?.point.z ?? clamped.z
        if (placeOnPlate(plateX, plateZ)) return
      }

      if (owner && owner.id !== 'plate') {
        if (placeOnBrick(owner, clamped.x, clamped.z)) return
        freePosition.set(clamped.x, owner.object.position.y, clamped.z)
        const sideSnap = findBestSnap(
          dragged,
          freePosition,
          [owner],
          occupied,
          activeSnap?.target.id === 'plate' ? null : activeSnap,
          plateY,
          SNAP_DISTANCE,
          SNAP_RELEASE_DISTANCE,
          allBricks.filter((brick) => !movingIds().has(brick.id)),
        )
        if (sideSnap) {
          activeSnap = sideSnap
          dragged.object.position.copy(sideSnap.position)
          settleGroup(dragged)
          updateSnapIndicator(snapIndicator, sideSnap)
          return
        }
      }

      if (!placeOnPlate(clamped.x, clamped.z)) {
        activeSnap = null
        dragged.object.position.set(clamped.x, plateY, clamped.z)
        settleGroup(dragged)
        updateSnapIndicator(snapIndicator, null)
      }
    }

    const discardHeldBrick = () => {
      if (!heldBrick) return
      scene.remove(heldBrick.object)
      disposeObject(heldBrick.object)
      heldBrick = null
      movingBricks = []
      movingPoses = []
      activeSnap = null
      updateSnapIndicator(snapIndicator, null)
      controls.enabled = !draggedBrick
      onHoldChangeRef.current?.(null)
    }

    const commitHeldBrick = () => {
      if (!heldBrick) return
      setBrickPreview(heldBrick, false)
      movableBricks.push(heldBrick)
      allBricks.push(heldBrick)
      collectMeshes(heldBrick.object, brickMeshes)
      collectMeshes(heldBrick.object, surfaceMeshes)
      if (activeSnap?.target.draggable) {
        connectionGraph.addFromSnap(activeSnap)
      }
      heldBrick = null
      movingBricks = []
      movingPoses = []
      activeSnap = null
      updateSnapIndicator(snapIndicator, null)
      controls.enabled = true
      renderer.domElement.style.cursor = ''
      onHoldChangeRef.current?.(null)
    }

    const deleteSelectedBrick = () => {
      if (heldBrick) return
      const brick = selectedBrick
      if (!brick?.draggable) return

      if (draggedBrick) {
        draggedBrick = null
        movingBricks = []
        movingPoses = []
        activeSnap = null
        detaching = false
        controls.enabled = true
        renderer.domElement.style.cursor = ''
      }

      connectionGraph.removeConnectionsFor(brick.id)

      const owned = new Set<THREE.Object3D>()
      brick.object.traverse((object) => owned.add(object))
      const dropMeshes = (list: THREE.Object3D[]) => {
        for (let index = list.length - 1; index >= 0; index -= 1) {
          if (owned.has(list[index])) list.splice(index, 1)
        }
      }
      dropMeshes(brickMeshes)
      dropMeshes(surfaceMeshes)

      const dropBrick = (list: Brick[]) => {
        const index = list.findIndex((entry) => entry.id === brick.id)
        if (index >= 0) list.splice(index, 1)
      }
      dropBrick(movableBricks)
      dropBrick(allBricks)

      scene.remove(brick.object)
      disposeObject(brick.object)
      selectedBrick = null
      updateSnapIndicator(snapIndicator, null)
    }

    const startPlacing = (definition: BrickDefinition) => {
      if (draggedBrick) return
      const keptRotation = heldBrick?.object.quaternion.clone() ?? null
      selectedBrick = null
      discardHeldBrick()
      const brick = createBrickFromDefinition(definition)
      if (keptRotation) brick.object.quaternion.copy(keptRotation)
      brick.object.position.set(0, PLATE_THICKNESS + brick.height / 2, 0)
      setBrickPreview(brick, true)
      scene.add(brick.object)
      heldBrick = brick
      movingBricks = [brick]
      movingPoses = snapshotRigidPoses(brick, movingBricks)
      activeSnap = null
      dragOffset.set(0, 0, 0)
      dragPlane.constant = -(PLATE_THICKNESS + brick.height / 2)
      controls.enabled = false
      renderer.domElement.style.cursor = 'copy'
      onHoldChangeRef.current?.(definition.id)
      if (lastPointer) applyDrag(lastPointer)
    }

    const cancelPlacing = () => {
      discardHeldBrick()
      renderer.domElement.style.cursor = ''
    }

    apiRef.current.startPlacing = startPlacing
    apiRef.current.cancelPlacing = cancelPlacing
    if (heldDefinitionRef.current) startPlacing(heldDefinitionRef.current)

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      lastPointer = event

      if (heldBrick) {
        event.stopImmediatePropagation()
        applyDrag(event)
        commitHeldBrick()
        return
      }

      setPointerFromEvent(event, renderer.domElement, pointer)
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(brickMeshes, false)
      const brick = brickFromObject(hits[0]?.object ?? null)
      if (!brick) {
        selectedBrick = null
        return
      }

      selectedBrick = brick
      draggedBrick = brick
      detaching = event.shiftKey
      const groupIds = detaching
        ? new Set([brick.id])
        : connectionGraph.getConnectedComponent(brick.id)
      movingBricks = movableBricks.filter((member) => groupIds.has(member.id))
      movingPoses = snapshotRigidPoses(brick, movingBricks)
      activeSnap = null
      controls.enabled = false
      renderer.domElement.style.cursor = 'grabbing'
      try {
        renderer.domElement.setPointerCapture(event.pointerId)
      } catch {
        // Some synthetic events cannot capture a pointer.
      }

      dragPlane.constant = -brick.object.position.y
      if (intersectDragPlane(event)) {
        dragOffset.copy(dragPoint).sub(brick.object.position)
      } else {
        dragOffset.set(0, 0, 0)
      }
      applyDrag(event)
    }

    const onPointerMove = (event: PointerEvent) => {
      lastPointer = event
      if (heldBrick) {
        applyDrag(event)
        renderer.domElement.style.cursor = 'copy'
        return
      }

      if (!draggedBrick) {
        setPointerFromEvent(event, renderer.domElement, pointer)
        raycaster.setFromCamera(pointer, camera)
        const hoverHits = raycaster.intersectObjects(brickMeshes, false)
        renderer.domElement.style.cursor = hoverHits.length > 0 ? 'grab' : ''
        return
      }

      applyDrag(event)
    }

    const onPointerUp = (event: PointerEvent) => {
      lastPointer = event
      if (!draggedBrick) return
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        try {
          renderer.domElement.releasePointerCapture(event.pointerId)
        } catch {
          // Ignore if the pointer was never captured.
        }
      }
      applyDrag(event)
      if (detaching) {
        connectionGraph.removeConnectionsFor(draggedBrick.id)
      }
      if (activeSnap?.target.draggable) {
        connectionGraph.addFromSnap(activeSnap)
      }
      draggedBrick = null
      movingBricks = []
      movingPoses = []
      activeSnap = null
      detaching = false
      updateSnapIndicator(snapIndicator, null)
      controls.enabled = true
      onPointerMove(event)
    }

    const rotateSelectedBrick = () => {
      if (draggedBrick) return

      if (heldBrick) {
        heldBrick.object.rotateY(Math.PI / 2)
        movingBricks = [heldBrick]
        movingPoses = snapshotRigidPoses(heldBrick, movingBricks)
        if (lastPointer) applyDrag(lastPointer)
        else {
          const clamped = clampToPlate(
            heldBrick,
            heldBrick.object.position.x,
            heldBrick.object.position.z,
          )
          heldBrick.object.position.x = clamped.x
          heldBrick.object.position.z = clamped.z
        }
        return
      }

      const brick = selectedBrick
      if (!brick?.draggable) return
      const groupIds = connectionGraph.getConnectedComponent(brick.id)
      const members = movableBricks.filter((member) => groupIds.has(member.id))
      const poses = snapshotRigidPoses(brick, members)
      brick.object.rotateY(Math.PI / 2)
      applyRigidPoses(brick, members, poses)
      clampGroupToPlate(members)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancelPlacing()
        return
      }
      if (event.code === 'KeyR' && !event.repeat) {
        event.preventDefault()
        rotateSelectedBrick()
        return
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      if (heldBrick) return
      event.preventDefault()
      deleteSelectedBrick()
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown, true)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('pointercancel', onPointerUp)
    window.addEventListener('keydown', onKeyDown, true)

    let frameId = 0

    const animate = () => {
      controls.update()
      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }
    animate()

    const handleResize = () => {
      const { clientWidth, clientHeight } = container
      camera.aspect = clientWidth / clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(clientWidth, clientHeight)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      apiRef.current.startPlacing = () => undefined
      apiRef.current.cancelPlacing = () => undefined
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', onKeyDown, true)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown, true)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointercancel', onPointerUp)
      controls.dispose()
      renderer.dispose()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material]
          materials.forEach((material) => material.dispose())
        }
      })
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  useEffect(() => {
    if (heldDefinition) apiRef.current.startPlacing(heldDefinition)
    else apiRef.current.cancelPlacing()
  }, [heldDefinition])

  return <div className="scene" ref={containerRef} />
}
