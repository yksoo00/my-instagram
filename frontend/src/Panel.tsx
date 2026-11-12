import { useState } from 'react'
import { CropDialog } from './CropDialog'
import { CustomFonts } from './CustomFonts'
import { ColorField, Field, Slider, Toggle } from './Fields'
import { FontPicker } from './FontPicker'
import { ReferenceImport } from './ReferenceImport'
import { Phrases } from './Phrases'
import { Projects } from './Projects'
import { Section } from './Section'
import { ZOOM_MAX, ZOOM_MIN } from './stage'
import { Templates } from './Templates'
import { CANVAS_WIDTH, RATIOS, coverScale, useEditor } from './store'
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
    adjust,
    footer,
    setAdjust,
    setFooter,
  } = useEditor()

  const [cropping, setCropping] = useState(false)
  const cover = image ? coverScale(image, ratio) : 1
  const zoom = image ? image.scale / cover : 1

  return (
    <aside className="panel">
      <Section title="사진" defaultOpen>
        {error && <p className="error">{error}</p>}
        <Slider
          label="확대"
          display={`${zoom.toFixed(2)}배`}
          value={zoom}
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.01}
          disabled={!image}
          onChange={(value) => zoomImage(value * cover, CANVAS_WIDTH / 2, RATIOS[ratio] / 2)}
        />
        <Slider
          label="밝기"
          display={String(Math.round(adjust.brightness * 100))}
          value={adjust.brightness}
          min={-0.5}
          max={0.5}
          step={0.01}
          disabled={!image}
          onChange={(brightness) => setAdjust({ brightness })}
        />
        <Slider
          label="대비"
          display={String(adjust.contrast)}
          value={adjust.contrast}
          min={-50}
          max={50}
          step={1}
          disabled={!image}
          onChange={(contrast) => setAdjust({ contrast })}
        />
        <div className="segmented">
          <button type="button" disabled={!image} onClick={fitImage}>
            화면에 맞춤
          </button>
          <button type="button" disabled={!image} onClick={() => setCropping(true)}>
            자르기{image?.crop ? ' (적용됨)' : ''}
          </button>
        </div>
        {cropping && <CropDialog onClose={() => setCropping(false)} />}
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

      <Section title="제목" defaultOpen>
        <textarea
          rows={3}
          value={title.text}
          onChange={(event) => setTitle({ text: event.target.value })}
        />
        <p className="hint">*단어*처럼 별표로 감싸면 강조 색으로 칠합니다.</p>
        <Field label="글꼴">
          <FontPicker
            value={title.fontFamily}
            onChange={(fontFamily) => setTitle({ fontFamily })}
          />
        </Field>
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
        <Slider
          label="크기"
          display={`${title.fontSize}px`}
          value={title.fontSize}
          min={30}
          max={200}
          step={1}
          onChange={(fontSize) => setTitle({ fontSize })}
        />
        <Slider
          label="줄 간격"
          display={title.lineHeight.toFixed(2)}
          value={title.lineHeight}
          min={0.8}
          max={2}
          step={0.05}
          onChange={(lineHeight) => setTitle({ lineHeight })}
        />
        <Slider
          label="자간"
          display={`${title.letterSpacing}px`}
          value={title.letterSpacing}
          min={-10}
          max={30}
          step={1}
          onChange={(letterSpacing) => setTitle({ letterSpacing })}
        />
        <Slider
          label="외곽선"
          display={`${title.strokeWidth}px`}
          value={title.strokeWidth}
          min={0}
          max={24}
          step={1}
          onChange={(strokeWidth) => setTitle({ strokeWidth })}
        />
        <div className="color-row">
          <ColorField label="글자" value={title.color} onChange={(color) => setTitle({ color })} />
          <ColorField
            label="강조"
            value={title.accentColor}
            onChange={(accentColor) => setTitle({ accentColor })}
          />
          <ColorField
            label="외곽선"
            value={title.strokeColor}
            onChange={(strokeColor) => setTitle({ strokeColor })}
          />
        </div>
        <Toggle checked={title.bold} onChange={(bold) => setTitle({ bold })}>
          굵게
        </Toggle>
        <Toggle checked={title.shadow} onChange={(shadow) => setTitle({ shadow })}>
          그림자
        </Toggle>
        <p className="hint">제목을 위아래로 끌어 위치를 정합니다.</p>
      </Section>

      <CustomFonts />

      <ReferenceImport />

      <Section title="하단 그라데이션">
        <Slider
          label="높이"
          display={`${Math.round(gradient.height * 100)}%`}
          value={gradient.height}
          min={0}
          max={1}
          step={0.01}
          onChange={(height) => setGradient({ height })}
        />
        <Slider
          label="농도"
          display={`${Math.round(gradient.opacity * 100)}%`}
          value={gradient.opacity}
          min={0}
          max={1}
          step={0.01}
          onChange={(opacity) => setGradient({ opacity })}
        />
      </Section>

      <Section title="계정명·출처">
        <input
          type="text"
          value={footer.text}
          maxLength={100}
          placeholder="예: @내계정 · 사진 출처"
          onChange={(event) => setFooter({ text: event.target.value })}
        />
        <Slider
          label="크기"
          display={`${footer.fontSize}px`}
          value={footer.fontSize}
          min={16}
          max={80}
          step={1}
          onChange={(fontSize) => setFooter({ fontSize })}
        />
        <p className="hint">하단에 작게 들어갑니다. 정렬은 제목을 따릅니다.</p>
      </Section>

      <Phrases />

      <Templates />

      <Projects />
    </aside>
  )
}
