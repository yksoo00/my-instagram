import { useEffect, useRef, useState } from 'react'
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from 'react-konva'
import Konva from 'konva'
import {
  CANVAS_WIDTH,
  RATIOS,
  TITLE_PADDING,
  coverScale,
  gridInset,
  sourceSize,
  zoomRange,
  useEditor,
} from './store'

import { useCustomFonts } from './fontStore'
import { OpenImage } from './Fields'
import { Icon } from './Icon'
import { photoNodeRef, stageRef } from './stage'
import { layoutTitle } from './titleLayout'

const ZOOM_STEP = 1.05
const FOOTER_BOTTOM = 40
const NUMBERING_TOP = 40

let measureContext: CanvasRenderingContext2D | null = null

function measureWith(font: string): (text: string) => number {
  measureContext ??= document.createElement('canvas').getContext('2d')
  const context = measureContext
  if (!context) return () => 0
  return (text) => {
    context.font = font
    return context.measureText(text).width
  }
}

function Photo() {
  const image = useEditor((state) => state.image)
  const { brightness, contrast } = useEditor((state) => state.adjust)
  const moveImage = useEditor((state) => state.moveImage)
  const setPhotoSelected = useEditor((state) => state.setPhotoSelected)
  const nodeRef = useRef<Konva.Image | null>(null)
  const element = image?.element

  // Konva 필터는 캐시한 그림에만 적용된다. 보정이 0 이면 캐시를 풀어 원본 화질로 그린다.
  useEffect(() => {
    const node = nodeRef.current
    if (!node) return
    if (brightness === 0 && contrast === 0) {
      node.clearCache()
      node.filters([])
    } else {
      node.cache()
      node.filters([Konva.Filters.Brighten, Konva.Filters.Contrast])
      node.brightness(brightness)
      node.contrast(contrast)
    }
    node.getLayer()?.batchDraw()
  }, [element, image?.crop, brightness, contrast])

  if (!image) return null
  const { width, height } = sourceSize(image)
  return (
    <KonvaImage
      ref={(node) => {
        nodeRef.current = node
        photoNodeRef.current = node // 위쪽 손잡이 층(PhotoTransformer)이 이 노드를 잡는다
      }}
      image={image.element}
      // Konva 는 crop 만으로 크기를 줄이지 않으므로 자른 영역 크기를 직접 준다.
      crop={image.crop ?? undefined}
      width={width}
      height={height}
      x={image.x}
      y={image.y}
      scaleX={image.scale * image.stretchX}
      scaleY={image.scale * image.stretchY}
      draggable
      onClick={() => setPhotoSelected(true)}
      onTap={() => setPhotoSelected(true)}
      onDragEnd={(event) => moveImage(event.target.x(), event.target.y())}
    />
  )
}

/**
 * 사진을 눌렀을 때 나오는 크기 손잡이. 모서리는 비율을 유지한 채 키우고,
 * 위·아래·좌·우 변은 그 방향만 늘이거나 줄인다. 저장 그림에는 들어가지 않는다(stage.ts 에서 숨김).
 */
function PhotoTransformer() {
  const selected = useEditor((state) => state.photoSelected)
  const image = useEditor((state) => state.image)
  const transformImage = useEditor((state) => state.transformImage)
  const transformerRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    const transformer = transformerRef.current
    const node = photoNodeRef.current
    if (!transformer) return
    transformer.nodes(selected && node ? [node] : [])
    transformer.getLayer()?.batchDraw()
  }, [selected, image])

  if (!image) return null
  return (
    <Transformer
      ref={transformerRef}
      rotateEnabled={false}
      flipEnabled={false}
      anchorSize={11}
      anchorCornerRadius={2}
      anchorFill="#ffffff"
      anchorStroke="#2f7cf6"
      borderStroke="#2f7cf6"
      // 너무 작게 줄여 사진이 사라지지 않게 한다 (화면 픽셀 기준)
      boundBoxFunc={(oldBox, newBox) =>
        newBox.width < 24 || newBox.height < 24 ? oldBox : newBox
      }
      onTransformEnd={() => {
        const node = photoNodeRef.current
        if (!node) return
        const fx = node.scaleX() / (image.scale * image.stretchX)
        const fy = node.scaleY() / (image.scale * image.stretchY)
        // 모서리로 끌면 두 방향이 같은 배로 변한다 → 전체 배율로, 변으로 끌면 그 방향 늘이기로 반영
        if (Math.abs(fx / fy - 1) < 0.002) {
          transformImage({ x: node.x(), y: node.y(), scale: image.scale * fx, stretchX: image.stretchX, stretchY: image.stretchY })
        } else {
          transformImage({
            x: node.x(),
            y: node.y(),
            scale: image.scale,
            stretchX: image.stretchX * fx,
            stretchY: image.stretchY * fy,
          })
        }
      }}
    />
  )
}

function Footer() {
  const footer = useEditor((state) => state.footer)
  const ratio = useEditor((state) => state.ratio)
  const fontFamily = useEditor((state) => state.title.fontFamily)
  const align = useEditor((state) => state.title.align)
  if (!footer.text.trim()) return null
  return (
    <Text
      text={footer.text}
      x={TITLE_PADDING}
      y={RATIOS[ratio] - footer.fontSize - FOOTER_BOTTOM}
      width={CANVAS_WIDTH - TITLE_PADDING * 2}
      align={align}
      fontFamily={fontFamily}
      fontSize={footer.fontSize}
      fill="#ffffff"
      opacity={0.85}
      shadowColor="#000000"
      shadowBlur={8}
      shadowOpacity={0.6}
      listening={false}
    />
  )
}

function Numbering() {
  const numbering = useEditor((state) => state.numbering)
  const total = useEditor((state) => state.slides.length)
  const active = useEditor((state) => state.activeSlide)
  const fontFamily = useEditor((state) => state.title.fontFamily)
  if (!numbering) return null
  return (
    <Text
      text={`${active + 1}/${total}`}
      x={TITLE_PADDING}
      y={NUMBERING_TOP}
      width={CANVAS_WIDTH - TITLE_PADDING * 2}
      align="right"
      fontFamily={fontFamily}
      fontStyle="bold"
      fontSize={36}
      fill="#ffffff"
      opacity={0.9}
      shadowColor="#000000"
      shadowBlur={8}
      shadowOpacity={0.6}
      listening={false}
    />
  )
}

function Title({ displayScale }: { displayScale: number }) {
  const title = useEditor((state) => state.title)
  const setTitle = useEditor((state) => state.setTitle)
  const [loadedFonts, setLoadedFonts] = useState(0)
  // 내 글꼴이 등록되면(check 는 모르는 글꼴에 true 를 주므로 위 효과가 못 잡는다) 다시 그린다.
  const customFontsVersion = useCustomFonts((state) => state.version)

  const fontStyle = title.bold ? 'bold' : 'normal'
  const font = `${fontStyle} ${title.fontSize}px "${title.fontFamily}"`
  // 웹폰트는 쓰는 글자의 파일만 그때그때 받는다. 받기 전에 잰 폭은 틀리므로 다 받으면 다시 그린다.
  const fontRequest = `${fontStyle} 16px "${title.fontFamily}"`
  useEffect(() => {
    if (document.fonts.check(fontRequest, title.text)) return
    let cancelled = false
    void document.fonts.load(fontRequest, title.text).then(() => {
      if (!cancelled) setLoadedFonts((count) => count + 1)
    })
    return () => {
      cancelled = true
    }
  }, [fontRequest, title.text])

  const { segments } = layoutTitle(title.text, {
    maxWidth: CANVAS_WIDTH - TITLE_PADDING * 2,
    fontSize: title.fontSize,
    lineHeight: title.lineHeight,
    letterSpacing: title.letterSpacing,
    align: title.align,
    measure: measureWith(font),
  })

  return (
    <Group
      // 글꼴이 도착하면 Konva 가 기억해 둔 글자 폭도 버려야 해서 통째로 다시 만든다.
      key={`${loadedFonts}-${customFontsVersion}`}
      x={TITLE_PADDING}
      y={title.y}
      draggable
      // 제목은 위아래로만 옮긴다. dragBoundFunc 는 화면 좌표라서 배율을 곱한다.
      dragBoundFunc={(position) => ({ x: TITLE_PADDING * displayScale, y: position.y })}
      onDragEnd={(event) => setTitle({ y: event.target.y() })}
    >
      {segments.map((segment, index) => (
        <Text
          key={index}
          text={segment.text}
          x={segment.x}
          y={segment.y}
          fontFamily={title.fontFamily}
          fontSize={title.fontSize}
          fontStyle={fontStyle}
          fill={segment.emphasis ? title.accentColor : title.color}
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
        />
      ))}
    </Group>
  )
}

export function Canvas() {
  const { ratio, image, gradient, zoomImage, showGuide, setPhotoSelected } = useEditor()
  const inset = gridInset(ratio)
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
    const cover = coverScale(image, ratio)
    const next = image.scale * (event.evt.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP)
    const range = zoomRange(image, ratio)
    const clamped = Math.min(cover * range.max, Math.max(cover * range.min, next))
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
            onMouseDown={(event) => {
              // 사진이나 손잡이가 아닌 곳을 누르면 선택을 푼다
              const target = event.target
              const onPhoto =
                target === photoNodeRef.current || target.getParent() instanceof Konva.Transformer
              if (!onPhoto) setPhotoSelected(false)
            }}
          >
            <Layer>
              <Rect width={CANVAS_WIDTH} height={height} fill="#000000" listening={false} />
              <Photo />
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
              <Footer />
              <Numbering />
              <Title displayScale={displayScale} />
            </Layer>
            {/* 손잡이는 제목·그라데이션에 가려지지 않게 맨 위 층에 둔다 */}
            <Layer>
              <PhotoTransformer />
            </Layer>
          </Stage>
          {showGuide && (
            // Stage 밖의 덮개라서 저장 결과에는 들어가지 않는다.
            <div
              className="grid-guide"
              style={{
                left: inset.x * displayScale,
                right: inset.x * displayScale,
                top: inset.y * displayScale,
                bottom: inset.y * displayScale,
              }}
            />
          )}
          {!image && (
            <div className="canvas-empty">
              <Icon name="upload" size={36} />
              <p>사진을 끌어다 놓거나 Ctrl+V 로 붙여넣으세요</p>
              <OpenImage className="primary">사진 열기</OpenImage>
              <small>JPG · PNG</small>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
