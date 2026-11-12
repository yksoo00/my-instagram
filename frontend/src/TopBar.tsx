import { Icon } from './Icon'
import { OpenImage } from './Fields'
import { exportImage } from './stage'
import { CANVAS_WIDTH, RATIOS, useEditor } from './store'

export function TopBar() {
  const ratio = useEditor((state) => state.ratio)
  const hasImage = useEditor((state) => !!state.image)
  const canUndo = useEditor((state) => state.past.length > 0)
  const canRedo = useEditor((state) => state.future.length > 0)
  const showGuide = useEditor((state) => state.showGuide)
  const { undo, redo, setShowGuide } = useEditor.getState()

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">Ig</span>
        <span className="brand-name">MY INSTAGRAM STUDIO</span>
      </div>

      <div className="topbar-group">
        <OpenImage>열기</OpenImage>
      </div>

      <div className="topbar-group">
        <button type="button" className="icon-button" disabled={!canUndo} onClick={undo} title="되돌리기 (Ctrl+Z)">
          <Icon name="undo" />
        </button>
        <button type="button" className="icon-button" disabled={!canRedo} onClick={redo} title="다시 실행 (Ctrl+Y)">
          <Icon name="redo" />
        </button>
      </div>

      <button
        type="button"
        className={`icon-button ${showGuide ? 'active' : ''}`}
        aria-pressed={showGuide}
        onClick={() => setShowGuide(!showGuide)}
        title="프로필 격자 안전 영역 (저장에는 안 나옴)"
      >
        <Icon name="grid" />
      </button>

      <span className="spacer" />
      <span className="size-readout">
        {ratio} · {CANVAS_WIDTH}×{RATIOS[ratio]}px
      </span>

      <button type="button" className="button" disabled={!hasImage} onClick={() => exportImage('jpg')}>
        <Icon name="download" />
        JPG
      </button>
      <button type="button" className="button primary" disabled={!hasImage} onClick={() => exportImage('png')}>
        <Icon name="download" />
        PNG 저장
      </button>
    </header>
  )
}
