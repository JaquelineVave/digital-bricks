import { useState } from 'react'
import { BRICK_LIBRARY, PIECE_CATEGORIES, PIECE_COLORS, getPiecesByCategory } from './bricks/catalog'
import type { BrickDefinition, PieceCategory } from './bricks/types'

interface BrickTrayProps {
  selectedId: string | null
  selectedColor: string
  onSelect: (definition: BrickDefinition) => void
  onColorChange: (color: string) => void
}

export function BrickTray({
  selectedId,
  selectedColor,
  onSelect,
  onColorChange,
}: BrickTrayProps) {
  const selectedPiece = BRICK_LIBRARY.find((piece) => piece.id === selectedId)
  const [category, setCategory] = useState<PieceCategory>(
    selectedPiece?.category ?? 'structure',
  )
  const pieces = getPiecesByCategory(category)

  return (
    <aside className="tray" aria-label="Piece library">
      <p className="tray-title">Pieces</p>
      <div className="tray-cats">
        {PIECE_CATEGORIES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={category === entry.id ? 'tray-cat selected' : 'tray-cat'}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setCategory(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className="tray-colors" aria-label="Piece colors">
        {PIECE_COLORS.map((swatch) => (
          <button
            key={swatch.id}
            type="button"
            title={swatch.name}
            className={selectedColor === swatch.hex ? 'tray-color selected' : 'tray-color'}
            style={{ background: swatch.hex }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onColorChange(swatch.hex)}
          />
        ))}
      </div>
      <div className="tray-list">
        {pieces.map((definition) => {
          const selected = selectedId === definition.id
          return (
            <button
              key={definition.id}
              type="button"
              className={selected ? 'tray-item selected' : 'tray-item'}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onSelect(definition)}
            >
              <span
                className={`tray-swatch tray-swatch-${definition.kind}`}
                style={{ background: selectedColor }}
              />
              <span className="tray-name">{definition.name}</span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
