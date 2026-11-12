// Konva Text 는 한 덩어리에 색 하나만 칠할 수 있어서, 강조 색을 쓰려고 줄바꿈과 위치를 직접 계산한다.
// 결과 조각마다 Text 노드를 하나씩 그린다.

export const EMPHASIS_MARK = '*'

export interface TitleSegment {
  text: string
  emphasis: boolean
  x: number
  y: number
}

export interface TitleLayoutOptions {
  maxWidth: number
  fontSize: number
  lineHeight: number
  letterSpacing: number
  align: 'left' | 'center' | 'right'
  /** 현재 글꼴로 그린 문자열의 폭 (자간 제외) */
  measure: (text: string) => number
}

interface Char {
  ch: string
  emphasis: boolean
}

const ALIGN_FACTOR = { left: 0, center: 0.5, right: 1 }

/** 별표는 강조를 켜고 끄는 표시라서 글자로 남기지 않는다. 줄이 바뀌어도 강조는 이어진다. */
function parse(text: string): Char[][] {
  const paragraphs: Char[][] = [[]]
  let emphasis = false
  for (const ch of text) {
    if (ch === EMPHASIS_MARK) emphasis = !emphasis
    else if (ch === '\n') paragraphs.push([])
    else paragraphs[paragraphs.length - 1].push({ ch, emphasis })
  }
  return paragraphs
}

function toText(chars: Char[]): string {
  return chars.map((char) => char.ch).join('')
}

/** 공백 덩어리와 낱말 덩어리로 나눈다. */
function tokenize(chars: Char[]): Char[][] {
  const tokens: Char[][] = []
  for (const char of chars) {
    const last = tokens[tokens.length - 1]
    if (last && (last[0].ch === ' ') === (char.ch === ' ')) last.push(char)
    else tokens.push([char])
  }
  return tokens
}

function trimEnd(chars: Char[]): Char[] {
  let end = chars.length
  while (end > 0 && chars[end - 1].ch === ' ') end--
  return chars.slice(0, end)
}

export function layoutTitle(
  text: string,
  options: TitleLayoutOptions,
): { segments: TitleSegment[]; height: number } {
  const { maxWidth, fontSize, lineHeight, letterSpacing, align, measure } = options
  const widthOf = (chars: Char[]) =>
    chars.length === 0 ? 0 : measure(toText(chars)) + letterSpacing * chars.length

  const lines: Char[][] = []

  // 낱말 하나가 한 줄보다 길면 글자 단위로 끊는다. 꽉 찬 줄은 넣고 남은 줄을 돌려준다.
  const breakLong = (chars: Char[]): Char[] => {
    let line: Char[] = []
    for (const char of chars) {
      if (line.length > 0 && widthOf([...line, char]) > maxWidth) {
        lines.push(line)
        line = []
      }
      line.push(char)
    }
    return line
  }

  for (const paragraph of parse(text)) {
    let line: Char[] = []
    for (const token of tokenize(paragraph)) {
      if (widthOf([...line, ...token]) <= maxWidth) {
        line.push(...token)
        continue
      }
      // 줄 끝에서 넘치는 공백은 버린다. 다음 줄이 공백으로 시작하지 않게.
      if (token[0].ch === ' ') continue
      if (line.length > 0) lines.push(trimEnd(line))
      line = breakLong(token)
    }
    lines.push(trimEnd(line))
  }

  const segments: TitleSegment[] = []
  lines.forEach((line, index) => {
    const offset = (maxWidth - widthOf(line)) * ALIGN_FACTOR[align]
    const y = index * fontSize * lineHeight
    let start = 0
    while (start < line.length) {
      let end = start
      while (end < line.length && line[end].emphasis === line[start].emphasis) end++
      segments.push({
        text: toText(line.slice(start, end)),
        emphasis: line[start].emphasis,
        x: offset + widthOf(line.slice(0, start)),
        y,
      })
      start = end
    }
  })

  return { segments, height: lines.length * fontSize * lineHeight }
}
