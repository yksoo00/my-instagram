import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { analyzeReference, readPixels } from './reference'
import { Section } from './Section'
import { RATIOS, CANVAS_WIDTH, useEditor } from './store'
import type { ReferenceStyle } from './store'

const ALIGN_LABEL = { left: '왼쪽', center: '가운데', right: '오른쪽' } as const

interface Analysis {
  style: ReferenceStyle
  previewUrl: string
}

export function ReferenceImport() {
  const applyReference = useEditor((state) => state.applyReference)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [applied, setApplied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 미리보기 주소는 새로 고르거나 닫을 때 풀어 준다.
  useEffect(() => {
    return () => {
      if (analysis) URL.revokeObjectURL(analysis.previewUrl)
    }
  }, [analysis])

  const pick = (file: File) => {
    setApplied(false)
    setError(null)
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setAnalysis(null)
      setError('JPG 또는 PNG 파일만 분석할 수 있습니다.')
      return
    }
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      try {
        setAnalysis({ style: analyzeReference(readPixels(image)), previewUrl: url })
      } catch (e) {
        URL.revokeObjectURL(url)
        setAnalysis(null)
        setError(e instanceof Error ? e.message : '이미지를 분석하지 못했습니다.')
      }
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      setAnalysis(null)
      setError('이미지를 읽지 못했습니다.')
    }
    image.src = url
  }

  const style = analysis?.style

  return (
    <Section title="참고 이미지로 스타일 가져오기">
      <p className="hint">
        마음에 든 게시물 이미지를 올리면 비율, 하단 그라데이션, 제목의 위치·크기·정렬·색을
        밝기 분포로 읽어 옵니다. 내 사진이 바뀌는 것은 아니고 디자인 값만 적용됩니다.
      </p>
      <label className="button">
        <input
          type="file"
          accept="image/jpeg,image/png"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) pick(file)
            event.target.value = ''
          }}
        />
        <Icon name="image" />
        참고 이미지 고르기
      </label>

      {analysis && style && (
        <div className="reference-result">
          <img src={analysis.previewUrl} alt="참고 이미지" />
          <ul>
            <li>
              비율 {style.ratio} ({CANVAS_WIDTH}×{RATIOS[style.ratio]})
            </li>
            <li>
              하단 그라데이션{' '}
              {style.gradient.height === 0
                ? '없음'
                : `높이 ${Math.round(style.gradient.height * 100)}% · 농도 ${Math.round(style.gradient.opacity * 100)}%`}
            </li>
            {style.title ? (
              <>
                <li>
                  제목 {style.title.lineCount}줄 · 크기 {style.title.fontSize}px ·{' '}
                  {ALIGN_LABEL[style.title.align]} 정렬
                </li>
                <li>
                  글자색 <span className="swatch" style={{ background: style.title.color }} />{' '}
                  {style.title.color}
                  {style.title.accentColor && (
                    <>
                      {' '}
                      · 강조색{' '}
                      <span className="swatch" style={{ background: style.title.accentColor }} />{' '}
                      {style.title.accentColor}
                    </>
                  )}
                </li>
              </>
            ) : (
              <li>제목 글자를 찾지 못했습니다. 비율과 그라데이션만 적용됩니다.</li>
            )}
          </ul>
          <button
            type="button"
            className="primary"
            onClick={() => {
              applyReference(style)
              setApplied(true)
            }}
          >
            이 스타일 적용
          </button>
          {applied && (
            <p className="hint">
              적용했습니다. 되돌리기(Ctrl+Z)로 취소할 수 있고, 마음에 들면 아래 "템플릿"에서
              저장하세요. 글꼴 종류와 외곽선·그림자는 직접 골라야 합니다.
            </p>
          )}
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </Section>
  )
}
