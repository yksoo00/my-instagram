import { Phrases } from './Phrases'
import { ZOOM_MAX, ZOOM_MIN, exportPng } from './stage'
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

      <section>
        <h2>사진</h2>
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
        <p className="hint">사진을 끌어 옮기고, 휠로 확대·축소합니다.</p>
      </section>

      <section>
        <h2>비율</h2>
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
      </section>

      <section>
        <h2>하단 그라데이션</h2>
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
      </section>

      <section>
        <h2>제목</h2>
        <textarea
          rows={3}
          value={title.text}
          onChange={(event) => setTitle({ text: event.target.value })}
        />
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
      </section>

      <Phrases />

      <button type="button" className="primary" disabled={!image} onClick={exportPng}>
        PNG 저장
      </button>
    </aside>
  )
}
