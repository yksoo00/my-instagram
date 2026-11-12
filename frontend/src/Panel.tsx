import { Phrases } from './Phrases'
import { Section } from './Section'
import { ZOOM_MAX, ZOOM_MIN, exportImage } from './stage'
import { Templates } from './Templates'
import {
  CANVAS_WIDTH,
  FONTS,
  RATIOS,
  coverScale,
  loadImageFile,
  useEditor,
} from './store'
import type { RatioKey, TitleAlign } from './store'

const ALIGNS: { value: TitleAlign; label: string }[] = [
  { value: 'left', label: '왼쪽' },
  { value: 'center', label: '가운데' },
  { value: 'right', label: '오른쪽' },
]

export function Panel() {
  const {
    ratio,
    image,
    gradient,
    title,
    error,
    setRatio,
    zoomImage,
    fitImage,
    setGradient,
    setTitle,
    undo,
    redo,
    adjust,
    footer,
    showGuide,
    setAdjust,
    setFooter,
    setShowGuide,
  } = useEditor()
  const canUndo = useEditor((state) => state.past.length > 0)
  const canRedo = useEditor((state) => state.future.length > 0)

  const cover = image ? coverScale(image.element, ratio) : 1
  const zoom = image ? image.scale / cover : 1

  return (
    <aside className="panel">
      <h1>MY INSTAGRAM STUDIO</h1>

      <div className="segmented">
        <button type="button" disabled={!canUndo} onClick={undo}>
          되돌리기
        </button>
        <button type="button" disabled={!canRedo} onClick={redo}>
          다시 실행
        </button>
      </div>

      <Section title="사진" defaultOpen>
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) loadImageFile(file)
            event.target.value = ''
          }}
        />
        {error && <p className="error">{error}</p>}
        <label>
          확대 {zoom.toFixed(2)}배
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.01}
            value={zoom}
            disabled={!image}
            onChange={(event) =>
              zoomImage(
                Number(event.target.value) * cover,
                CANVAS_WIDTH / 2,
                RATIOS[ratio] / 2,
              )
            }
          />
        </label>
        <button type="button" disabled={!image} onClick={fitImage}>
          화면에 맞춤
        </button>
        <label>
          밝기 {Math.round(adjust.brightness * 100)}
          <input
            type="range"
            min={-0.5}
            max={0.5}
            step={0.01}
            value={adjust.brightness}
            disabled={!image}
            onChange={(event) => setAdjust({ brightness: Number(event.target.value) })}
          />
        </label>
        <label>
          대비 {adjust.contrast}
          <input
            type="range"
            min={-50}
            max={50}
            step={1}
            value={adjust.contrast}
            disabled={!image}
            onChange={(event) => setAdjust({ contrast: Number(event.target.value) })}
          />
        </label>
        <p className="hint">사진을 끌어 옮기고, 휠로 확대·축소합니다.</p>
      </Section>

      <Section title="비율" defaultOpen>
        <div className="segmented">
          {(Object.keys(RATIOS) as RatioKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className={key === ratio ? 'active' : ''}
              onClick={() => setRatio(key)}
            >
              {key}
            </button>
          ))}
        </div>
      </Section>

      <Section title="하단 그라데이션">
        <label>
          높이 {Math.round(gradient.height * 100)}%
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={gradient.height}
            onChange={(event) => setGradient({ height: Number(event.target.value) })}
          />
        </label>
        <label>
          농도 {Math.round(gradient.opacity * 100)}%
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={gradient.opacity}
            onChange={(event) => setGradient({ opacity: Number(event.target.value) })}
          />
        </label>
      </Section>

      <Section title="제목" defaultOpen>
        <textarea
          rows={3}
          value={title.text}
          onChange={(event) => setTitle({ text: event.target.value })}
        />
        <p className="hint">*단어*처럼 별표로 감싸면 강조 색으로 칠합니다.</p>
        <label>
          글꼴
          <select
            value={title.fontFamily}
            onChange={(event) => setTitle({ fontFamily: event.target.value })}
          >
            {FONTS.map((font) => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          크기 {title.fontSize}px
          <input
            type="range"
            min={30}
            max={200}
            step={1}
            value={title.fontSize}
            onChange={(event) => setTitle({ fontSize: Number(event.target.value) })}
          />
        </label>
        <label>
          줄 간격 {title.lineHeight.toFixed(2)}
          <input
            type="range"
            min={0.8}
            max={2}
            step={0.05}
            value={title.lineHeight}
            onChange={(event) => setTitle({ lineHeight: Number(event.target.value) })}
          />
        </label>
        <label>
          자간 {title.letterSpacing}px
          <input
            type="range"
            min={-10}
            max={30}
            step={1}
            value={title.letterSpacing}
            onChange={(event) => setTitle({ letterSpacing: Number(event.target.value) })}
          />
        </label>
        <label>
          외곽선 {title.strokeWidth}px
          <input
            type="range"
            min={0}
            max={24}
            step={1}
            value={title.strokeWidth}
            onChange={(event) => setTitle({ strokeWidth: Number(event.target.value) })}
          />
        </label>
        <div className="row">
          <label className="inline">
            외곽선 색
            <input
              type="color"
              value={title.strokeColor}
              onChange={(event) => setTitle({ strokeColor: event.target.value })}
            />
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={title.shadow}
              onChange={(event) => setTitle({ shadow: event.target.checked })}
            />
            그림자
          </label>
        </div>
        <div className="row">
          <label className="inline">
            색상
            <input
              type="color"
              value={title.color}
              onChange={(event) => setTitle({ color: event.target.value })}
            />
          </label>
          <label className="inline">
            강조 색
            <input
              type="color"
              value={title.accentColor}
              onChange={(event) => setTitle({ accentColor: event.target.value })}
            />
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={title.bold}
              onChange={(event) => setTitle({ bold: event.target.checked })}
            />
            굵게
          </label>
        </div>
        <div className="segmented">
          {ALIGNS.map((align) => (
            <button
              key={align.value}
              type="button"
              className={align.value === title.align ? 'active' : ''}
              onClick={() => setTitle({ align: align.value })}
            >
              {align.label}
            </button>
          ))}
        </div>
        <p className="hint">제목을 위아래로 끌어 위치를 정합니다.</p>
      </Section>

      <Phrases />

      <Templates />

      <Section title="계정명·출처">
        <input
          type="text"
          value={footer.text}
          maxLength={100}
          placeholder="예: @내계정 · 사진 출처"
          onChange={(event) => setFooter({ text: event.target.value })}
        />
        <label>
          크기 {footer.fontSize}px
          <input
            type="range"
            min={16}
            max={80}
            step={1}
            value={footer.fontSize}
            onChange={(event) => setFooter({ fontSize: Number(event.target.value) })}
          />
        </label>
        <p className="hint">하단에 작게 들어갑니다. 정렬은 제목을 따릅니다.</p>
      </Section>

      <label className="inline">
        <input
          type="checkbox"
          checked={showGuide}
          onChange={(event) => setShowGuide(event.target.checked)}
        />
        프로필 격자 안전 영역 표시 (저장에는 안 나옴)
      </label>

      <div className="segmented">
        <button type="button" className="primary" disabled={!image} onClick={() => exportImage('png')}>
          PNG 저장
        </button>
        <button type="button" className="primary" disabled={!image} onClick={() => exportImage('jpg')}>
          JPG 저장
        </button>
      </div>
    </aside>
  )
}
