import { useEffect, useRef } from 'react'
import { Toggle } from './Fields'
import { Icon } from './Icon'
import { exportAll } from './stage'
import { CANVAS_WIDTH, RATIOS, useEditor } from './store'
import type { RatioKey, SlideData } from './store'

const THUMB_WIDTH = 54

function Thumb({ slide, ratio }: { slide: SlideData; ratio: RatioKey }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const height = Math.round((THUMB_WIDTH * RATIOS[ratio]) / CANVAS_WIDTH)
  const { image } = slide

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    context.fillStyle = '#000'
    context.fillRect(0, 0, THUMB_WIDTH, height)
    if (!image) return
    // 편집 좌표(1080 폭)를 썸네일 크기로 줄여 같은 구도로 그린다.
    const k = THUMB_WIDTH / CANVAS_WIDTH
    const { element } = image
    context.drawImage(
      element,
      image.x * k,
      image.y * k,
      element.naturalWidth * image.scale * k,
      element.naturalHeight * image.scale * k,
    )
  }, [image, height])

  return <canvas ref={canvasRef} width={THUMB_WIDTH} height={height} />
}

export function Filmstrip() {
  const ratio = useEditor((state) => state.ratio)
  const activeSlide = useEditor((state) => state.activeSlide)
  const numbering = useEditor((state) => state.numbering)
  // 지금 장은 최상위 필드가 최신이라, 장 목록에 그 값을 합쳐 쓴다.
  const slides = useEditor((state) => state.slides)
  const liveImage = useEditor((state) => state.image)
  const liveAdjust = useEditor((state) => state.adjust)
  const liveText = useEditor((state) => state.title.text)
  const { addSlide, selectSlide, removeSlide, setNumbering } = useEditor.getState()
  const shown = slides.map((slide, index) =>
    index === activeSlide ? { image: liveImage, adjust: liveAdjust, text: liveText } : slide,
  )
  const hasAnyImage = shown.some((slide) => slide.image)

  return (
    <footer className="filmstrip">
      <div className="filmstrip-cards">
        {shown.map((slide, index) => (
          <button
            key={index}
            type="button"
            className={`slide-card ${index === activeSlide ? 'active' : ''}`}
            onClick={() => selectSlide(index)}
            title={slide.text.replace(/\*/g, '') || `${index + 1}번 장`}
          >
            <Thumb slide={slide} ratio={ratio} />
            <span className="slide-number">{index + 1}</span>
          </button>
        ))}
        <button type="button" className="slide-add" onClick={addSlide} title="장 추가">
          <Icon name="plus" size={18} />
        </button>
      </div>

      <div className="filmstrip-tools">
        <Toggle checked={numbering} onChange={setNumbering}>
          번호 표시
        </Toggle>
        <button
          type="button"
          className="button"
          disabled={slides.length <= 1}
          onClick={() => removeSlide(activeSlide)}
        >
          <Icon name="trash" />
          장 삭제
        </button>
        <button type="button" className="button" disabled={!hasAnyImage} onClick={() => void exportAll('png')}>
          <Icon name="download" />
          전체 PNG
        </button>
        <button type="button" className="button" disabled={!hasAnyImage} onClick={() => void exportAll('jpg')}>
          <Icon name="download" />
          전체 JPG
        </button>
      </div>
    </footer>
  )
}
