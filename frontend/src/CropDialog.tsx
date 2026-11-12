import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { clampBox, fullBox, toCropRect } from './cropBox'
import type { Box, Handle } from './cropBox'
import { useEditor } from './store'

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const MAX_DISPLAY = { width: 760, height: 520 }

/** 사진에서 남길 영역을 끌어서 고르는 창. 원본 파일은 그대로 두고 보이는 부분만 정한다. */
export function CropDialog({ onClose }: { onClose: () => void }) {
  const image = useEditor((state) => state.image)
  const setCrop = useEditor((state) => state.setCrop)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ handle: Handle | 'move'; start: Box; x: number; y: number } | null>(null)

  const natural = image
    ? { width: image.element.naturalWidth, height: image.element.naturalHeight }
    : { width: 1, height: 1 }
  const [box, setBox] = useState<Box>(() =>
    image?.crop
      ? {
          left: image.crop.x / natural.width,
          top: image.crop.y / natural.height,
          right: (image.crop.x + image.crop.width) / natural.width,
          bottom: (image.crop.y + image.crop.height) / natural.height,
        }
      : fullBox(),
  )

  // 작업 영역 크기에 맞춰 원본 전체를 줄여서 그린다.
  const shrink = Math.min(MAX_DISPLAY.width / natural.width, MAX_DISPLAY.height / natural.height, 1)
  const display = { width: Math.round(natural.width * shrink), height: Math.round(natural.height * shrink) }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    canvas.getContext('2d')?.drawImage(image.element, 0, 0, display.width, display.height)
  }, [image, display.width, display.height])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!image) return null

  const begin = (handle: Handle | 'move') => (event: ReactPointerEvent) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { handle, start: box, x: event.clientX, y: event.clientY }
  }
  const move = (event: ReactPointerEvent) => {
    const active = drag.current
    const frame = frameRef.current
    if (!active || !frame) return
    const rect = frame.getBoundingClientRect()
    const dx = (event.clientX - active.x) / rect.width
    const dy = (event.clientY - active.y) / rect.height
    setBox(clampBox(active.start, active.handle, dx, dy, natural))
  }
  const end = () => {
    drag.current = null
  }

  const cropped = toCropRect(box, natural)
  const percent = (value: number) => `${value * 100}%`

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="사진 자르기">
      <div className="modal">
        <h2>사진 자르기</h2>
        <p className="hint">
          네모 안쪽이 남습니다. 모서리·변을 끌어 크기를, 안쪽을 끌어 위치를 정하세요. 원본은
          그대로라서 언제든 다시 자를 수 있습니다.
        </p>
        <div className="crop-stage" style={{ width: display.width, height: display.height }}>
          <canvas ref={canvasRef} width={display.width} height={display.height} />
          <div ref={frameRef} className="crop-frame">
            {/* 자를 바깥 영역을 어둡게 덮는다 */}
            <div className="crop-shade" style={{ left: 0, top: 0, right: 0, height: percent(box.top) }} />
            <div className="crop-shade" style={{ left: 0, bottom: 0, right: 0, height: percent(1 - box.bottom) }} />
            <div className="crop-shade" style={{ left: 0, top: percent(box.top), width: percent(box.left), height: percent(box.bottom - box.top) }} />
            <div className="crop-shade" style={{ right: 0, top: percent(box.top), width: percent(1 - box.right), height: percent(box.bottom - box.top) }} />
            <div
              className="crop-box"
              style={{
                left: percent(box.left),
                top: percent(box.top),
                width: percent(box.right - box.left),
                height: percent(box.bottom - box.top),
              }}
              onPointerDown={begin('move')}
              onPointerMove={move}
              onPointerUp={end}
            >
              {HANDLES.map((handle) => (
                <span
                  key={handle}
                  className={`crop-handle crop-handle-${handle}`}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    begin(handle)(event)
                  }}
                  onPointerMove={move}
                  onPointerUp={end}
                />
              ))}
            </div>
          </div>
        </div>
        <p className="hint">
          남는 크기 {cropped.width}×{cropped.height}px (원본 {natural.width}×{natural.height}px)
        </p>
        <div className="modal-actions">
          <button type="button" onClick={() => setBox(fullBox())}>
            전체 선택
          </button>
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              const full = cropped.width === natural.width && cropped.height === natural.height
              setCrop(full ? null : cropped)
              onClose()
            }}
          >
            적용
          </button>
        </div>
      </div>
    </div>
  )
}
