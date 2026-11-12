import { useEffect, useRef, useState } from 'react'
import { Canvas } from './Canvas'
import { useCustomFonts } from './fontStore'
import { Filmstrip } from './Filmstrip'
import { Panel } from './Panel'
import { TopBar } from './TopBar'
import { loadImageFile, useEditor } from './store'

function App() {
  const [dragging, setDragging] = useState(false)
  // 자식 요소를 지날 때마다 enter/leave 가 번갈아 와서 깜빡이므로 횟수로 센다.
  const dragDepth = useRef(0)

  // 내 글꼴을 브라우저에 등록한다. 프로젝트·템플릿이 쓰는 글꼴이 처음부터 보이도록 앱을 열 때 한 번.
  useEffect(() => {
    void useCustomFonts.getState().load()
  }, [])

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const file = event.clipboardData?.files[0]
      if (file) loadImageFile(file)
    }
    // 입력칸 안에서도 편집기 되돌리기로 통일한다. 브라우저 기본 되돌리기는 상태와 어긋난다.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      const key = event.key.toLowerCase()
      if (key !== 'z' && key !== 'y') return
      event.preventDefault()
      const { undo, redo } = useEditor.getState()
      if (key === 'y' || event.shiftKey) redo()
      else undo()
    }
    const handleDragEnter = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return
      dragDepth.current += 1
      setDragging(true)
    }
    const handleDragLeave = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setDragging(false)
    }
    const handleDragOver = (event: DragEvent) => event.preventDefault()
    const handleDrop = (event: DragEvent) => {
      event.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      const file = event.dataTransfer?.files[0]
      if (file) loadImageFile(file)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('paste', handlePaste)
    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('paste', handlePaste)
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('drop', handleDrop)
    }
  }, [])

  return (
    <div className="app">
      <TopBar />
      <main className="workspace">
        <Canvas />
        {dragging && <div className="drop-overlay">사진을 여기에 놓으세요</div>}
      </main>
      <Filmstrip />
      <Panel />
    </div>
  )
}

export default App
