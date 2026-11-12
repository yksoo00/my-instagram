import { useEffect, useRef, useState } from 'react'
import { Image as KonvaImage, Layer, Rect, Stage, Text } from 'react-konva'
import type Konva from 'konva'
import {
  CANVAS_WIDTH,
  RATIOS,
  TITLE_PADDING,
  coverScale,
  useEditor,
} from './store'

import { ZOOM_MAX, ZOOM_MIN, stageRef } from './stage'

const ZOOM_STEP = 1.05

export function Canvas() {
  const { ratio, image, gradient, title, moveImage, zoomImage, setTitle } = useEditor()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [area, setArea] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const observer = new ResizeObserver(([entry]) => {
      setArea({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [])

  const height = RATIOS[ratio]
  const displayScale = Math.min(area.width / CANVAS_WIDTH, area.height / height)
  const gradientHeight = height * gradient.height

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault()
    const pointer = event.target.getStage()?.getPointerPosition()
    if (!image || !pointer) return
    const cover = coverScale(image.element, ratio)
    const next = image.scale * (event.evt.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP)
    const clamped = Math.min(cover * ZOOM_MAX, Math.max(cover * ZOOM_MIN, next))
    zoomImage(clamped, pointer.x / displayScale, pointer.y / displayScale)
  }

  return (
    <div className="canvas-area" ref={wrapperRef}>
      {displayScale > 0 && (
        <div className="canvas-frame">
          <Stage
            ref={(stage) => {
              stageRef.current = stage
            }}
            width={CANVAS_WIDTH * displayScale}
            height={height * displayScale}
            scaleX={displayScale}
            scaleY={displayScale}
            onWheel={handleWheel}
          >
            <Layer>
              <Rect width={CANVAS_WIDTH} height={height} fill="#000000" listening={false} />
              {image && (
                <KonvaImage
                  image={image.element}
                  x={image.x}
                  y={image.y}
                  scaleX={image.scale}
                  scaleY={image.scale}
                  draggable
                  onDragEnd={(event) => moveImage(event.target.x(), event.target.y())}
                />
              )}
              <Rect
                y={height - gradientHeight}
                width={CANVAS_WIDTH}
                height={gradientHeight}
                fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                fillLinearGradientEndPoint={{ x: 0, y: gradientHeight }}
                fillLinearGradientColorStops={[
                  0,
                  'rgba(0,0,0,0)',
                  0.6,
                  `rgba(0,0,0,${gradient.opacity * 0.85})`,
                  1,
                  `rgba(0,0,0,${gradient.opacity})`,
                ]}
                listening={false}
              />
              <Text
                text={title.text}
                x={TITLE_PADDING}
                y={title.y}
                width={CANVAS_WIDTH - TITLE_PADDING * 2}
                fontFamily={title.fontFamily}
                fontSize={title.fontSize}
                fontStyle={title.bold ? 'bold' : 'normal'}
                fill={title.color}
                align={title.align}
                lineHeight={title.lineHeight}
                letterSpacing={title.letterSpacing}
                stroke={title.strokeColor}
                strokeWidth={title.strokeWidth}
                strokeEnabled={title.strokeWidth > 0}
                // 외곽선을 먼저 그리고 글자를 덮어야 획이 글자를 파먹지 않는다.
                fillAfterStrokeEnabled
                lineJoin="round"
                shadowEnabled={title.shadow}
                shadowColor="#000000"
                shadowBlur={16}
                shadowOffsetY={4}
                shadowOpacity={0.6}
                draggable
                // 제목은 위아래로만 옮긴다. dragBoundFunc 는 화면 좌표라서 배율을 곱한다.
                dragBoundFunc={(position) => ({
                  x: TITLE_PADDING * displayScale,
                  y: position.y,
                })}
                onDragEnd={(event) => setTitle({ y: event.target.y() })}
              />
            </Layer>
          </Stage>
          {!image && (
            <p className="canvas-empty">
              사진을 끌어다 놓거나 Ctrl+V 로 붙여넣으세요
            </p>
          )}
        </div>
      )}
    </div>
  )
}
