import type { ReactNode } from 'react'

/** 접었다 폈다 하는 패널 묶음. 열림 상태는 브라우저가 details 안에서 들고 있다. */
export function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details className="section" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="section-body">{children}</div>
    </details>
  )
}
