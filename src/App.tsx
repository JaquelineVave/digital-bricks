import { useMemo, useState } from 'react'
import { BrickTray } from './BrickTray'
import { Scene } from './Scene'
import { DEFAULT_PIECE_COLOR, getBrickDefinition } from './bricks/catalog'
import type { BrickDefinition } from './bricks/types'
import './App.css'

function App() {
  const [heldId, setHeldId] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState(DEFAULT_PIECE_COLOR)

  const heldDefinition = useMemo(() => {
    const definition = heldId ? getBrickDefinition(heldId) : null
    if (!definition) return null
    return { ...definition, color: selectedColor }
  }, [heldId, selectedColor])

  const handleSelect = (definition: BrickDefinition) => {
    setHeldId((current) => (current === definition.id ? null : definition.id))
  }

  return (
    <main className="app">
      <BrickTray
        selectedId={heldId}
        selectedColor={selectedColor}
        onSelect={handleSelect}
        onColorChange={setSelectedColor}
      />
      <Scene heldDefinition={heldDefinition} onHoldChange={setHeldId} />
      <p className="hint">
        Choose a piece to place · Drag placed bricks · Click a placed piece, then Delete · Shift-drag to
        unsnap · Drag empty space to look around
      </p>
    </main>
  )
}

export default App
