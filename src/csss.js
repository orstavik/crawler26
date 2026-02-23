
'use strict'
const REM = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16

const toLen = (pxStr) => {
  const px = parseFloat(pxStr) || 0
  if (!px) return '0'
  if (typeof pxStr === 'string' && pxStr.includes('%')) return pxStr.trim()
  for (const base of [REM, 16]) {
    const rem = px / base
    const candidates = [Math.round(rem), Math.round(rem * 4) / 4, Math.round(rem * 2) / 2]
    for (const v of candidates) {
      if (Math.abs(v - rem) < 0.01 && v > 0 && String(v).split('.')[1]?.length <= 2) return v + 'rem'
    }
  }
  return (Math.abs(px - Math.round(px)) < 0.05 ? Math.round(px) : px.toFixed(3).replace(/\.?0+$/, "")) + 'px'
}
const toColor = rgb => {
  if (!rgb || /^(currentcolor|transparent|rgba\(0, 0, 0, 0\))$/.test(rgb)) return null
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (!m) return null
  const [r, g, b, a] = m.slice(1, 5).map((v, i) => i < 3 ? +v : v ? parseFloat(v) : 1)
  if (a === 0) return null
  return a < 1 ? `#rgba(${r},${g},${b},${a})` : `#${[r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')}`
}
const spaceToComma = val =>
  val && val !== 'none'
    ? val
      .split(/\s*,\s*/)
      .map(shadow =>
        shadow
          .trim()
          .split(/\s+/)
          .map(v => v.includes('px') ? toLen(v) : v.includes('rgb') ? toColor(v) : v)
          .filter(Boolean)
          .join(',')
      )
      .filter(Boolean)
      .join(',')
    : ''

// const spaceToComma = val =>
//   val && val !== 'none'
//     ? val
//       // Split by commas NOT inside parentheses
//       .split(/,\s*(?![^(]*\))/)
//       .map(shadow =>
//         shadow
//           .trim()
//           .split(/\s+/)
//           .map(v => v.includes('px') ? toLen(v) : v.includes('rgb') ? toColor(v) : v)
//           .filter(Boolean)
//           .join(',')
//       )
//       .filter(Boolean)
//       .join(',') // join layers back with commas
//     : '';

const REVERSE = {
  Grid: ({
    display,
    gridTemplateColumns,
    gridTemplateRows,
    gap
  }) => {
    if (!(display === 'grid' || display === 'inline-grid')) return
    let args = []
    if (gridTemplateColumns && gridTemplateColumns !== 'none') args.push(`cols(${spaceToComma(gridTemplateColumns)})`)
    if (gridTemplateRows && gridTemplateRows !== 'none') args.push(`rows(${spaceToComma(gridTemplateRows)})`)
    if (gap && gap !== 'normal' && parseFloat(gap) > 0) args.push(`gap(${toLen(gap)})`)
    return args.length ? `$Grid(${args.join(',')})` : '$Grid()'
  },
  Flex: ({
    display,
    flexDirection,
    flexWrap,
    gap,
    alignItems,
    justifyContent,
  }) => {
    if (!(display === 'flex' || display === 'inline-flex'))
      return
    let args = []
    if (flexDirection !== 'row') args.push(flexDirection.replace(/-([a-z])/g, (g) => g[1].toUpperCase()))
    if (flexWrap === 'wrap') args.push('wrap')
    if (gap && gap !== 'normal' && parseFloat(gap) > 0) args.push(`gap(${toLen(gap)})`)
    if (alignItems && alignItems !== 'normal' && alignItems !== 'stretch') {
      const mapped = alignItems.replace('flex-', '').replace('space-', '')
      args.push(`items${mapped.charAt(0).toUpperCase() + mapped.slice(1)}`)
    }
    if (justifyContent && justifyContent !== 'normal' && justifyContent !== 'flex-start') {
      const mapped = justifyContent.replace('flex-', '').replace('space-', '')
      args.push(`content${mapped.charAt(0).toUpperCase() + mapped.slice(1)}`)
    }
    return `$Flex(${args.join(',')})`
  },
  Display: ({ display }) => {
    const d = display
    if (d === 'inline-block') return '$IBlock()'
    if (d === 'none') return '$hide'
    return null
  },
  flexItem: ({
    flexGrow,
    flexShrink,
    flexBasis,
    alignSelf
  }) => {
    let args = []
    if (flexGrow !== '0') args.push(`grow(${flexGrow})`)
    if (flexShrink !== '1') args.push(`shrink(${flexShrink})`)
    if (flexBasis !== 'auto') args.push(`basis(${toLen(flexBasis)})`)
    if (alignSelf !== 'auto' && alignSelf !== 'stretch') {
      const mapped = alignSelf.replace('flex-', '')
      args.push(`self${mapped.charAt(0).toUpperCase() + mapped.slice(1)}`)
    }
    return args.length ? `$flexItem(${args.join(',')})` : null
  },
  gridItem: ({
    gridColumnStart,
    gridColumnEnd,
    gridRowStart,
    gridRowEnd,
    justifySelf
  }) => {
    let args = []
    if (gridColumnStart !== 'auto' || gridColumnEnd !== 'auto')
      args.push(`column(${gridColumnStart === 'auto' ? '_' : gridColumnStart},${gridColumnEnd === 'auto' ? '_' : gridColumnEnd})`)
    if (gridRowStart !== 'auto' || gridRowEnd !== 'auto')
      args.push(`row(${gridRowStart === 'auto' ? '_' : gridRowStart},${gridRowEnd === 'auto' ? '_' : gridRowEnd})`)
    if (justifySelf !== 'auto' && justifySelf !== 'stretch')
      args.push(`self${justifySelf.charAt(0).toUpperCase() + justifySelf.slice(1)}`)
    return args.length ? `$gridItem(${args.join(',')})` : null
  },
  blockItem: ({
    margin,
    width, height, float,
    // minWidth, minHeight, maxWidth, maxHeight : todo
  }) => {
    let args = []
    const m = margin.split(' ').map(toLen)
    args.push(`margin(${m.join(',')})`)
    args.push(`size(${toLen(width)},${toLen(height)})`)
    //todo : complex quering for size
    if (float === 'left' || float === 'inline-start') args.push('floatStart')
    else if (float === 'right' || float === 'inline-end') args.push('floatEnd')
    return args.length ? `$blockItem(${args.join(',')})` : null
  },

  Paragraph: ({
    textAlign,
    lineHeight,
    fontSize,
    whiteSpace
  }) => {
    let args = []
    if (textAlign !== 'start' && textAlign !== 'left')
      args.push(textAlign === 'center' ? 'center' : textAlign)
    if (lineHeight !== 'normal') {
      const lh = parseFloat(lineHeight) / parseFloat(fontSize)
      if (!isNaN(lh)) args.push(lh.toFixed(2).replace(/\.?0+$/, ""))
    }
    if (whiteSpace !== 'normal')
      args.push(whiteSpace.replace(/-([a-z])/g, g => g[1].toUpperCase()))
    return args.length ? `$paragraph(${args.join(',')})` : null
  },
  Border: ({
    borderWidth,
    borderStyle,
    borderColor,
    borderTopLeftRadius, borderTopRightRadius, borderBottomRightRadius, borderBottomLeftRadius
  }) => {
    const w = borderWidth.split(' ').map(toLen)
    const st = borderStyle.split(' ')
    const c = borderColor.split(' ').map(toColor)
    const r = [borderTopLeftRadius, borderTopRightRadius, borderBottomRightRadius, borderBottomLeftRadius].map(toLen)
    if (w.every(v => v === '0') && r.every(v => v === '0')) return null
    let args = []
    if (w.some(v => v !== '0')) args.push(w.every(v => v === w[0]) ? w[0] : w.join(','))
    if (st.some(v => v !== 'none')) args.push(st.every(v => v === st[0]) ? st[0] : st.join(','))
    if (c.some(v => v)) args.push(c.every(v => v === c[0]) ? c[0] : c.filter(Boolean).join(','))
    if (r.some(v => v !== '0')) args.push(r.every(v => v === r[0]) ? `r(${r[0]})` : `r(${r.join(',')})`)
    return args.length ? `$border(${args.join(',')})` : null
  },
  Block: ({
    paddingTop, paddingRight, paddingBottom, paddingLeft,
    overflowX, overflowY
  }) => {
    const p = [paddingTop, paddingRight, paddingBottom, paddingLeft].map(toLen)
    let args = []
    if (p.some(v => v !== '0')) {
      if (p.every(v => v === p[0])) args.push(`padding(${p[0]})`)
      else if (p[0] === p[2] && p[1] === p[3]) args.push(`padding(${p[0]},${p[1]})`)
      else args.push(`padding(${p.join(',')})`)
    }
    if (overflowX !== 'visible' || overflowY !== 'visible') {
      if (overflowX === overflowY) args.push(`overflow${overflowX[0].toUpperCase() + overflowX.slice(1)}`)
      else args.push(`overflowBlockInline(${overflowY[0].toUpperCase() + overflowY.slice(1)},${overflowX[0].toUpperCase() + overflowX.slice(1)})`)
    }
    return args.length ? `$block(${args.join(',')})` : null
  },
  Bg: ({ backgroundColor }) => {
    const c = toColor(backgroundColor)
    return (c && c !== '#rgba(0,0,0,0)') ? `$bgColor(${c})` : null
  },
  Color: ({ color }) => {
    const c = toColor(color)
    if (!c || c === '#000000' || c === '#black') return null
    return `$color(${c})`
  },
  Font: ({ fontFamily, fontSize, fontWeight, fontStyle }) => {
    let args = []
    const ff = fontFamily.split(',')[0].trim().replace(/"/g, '').replace(/\s+/g, '+')
    if (ff && !ff.includes('serif')) args.push(ff)
    args.push(toLen(fontSize))
    if (fontWeight !== '400' && fontWeight !== 'normal') args.push(fontWeight === '700' ? 'bold' : fontWeight)
    if (fontStyle === 'italic') args.push('i')
    return args.length ? `$font(${args.join(',')})` : null
  },
  Position: ({ position, top, left, right, bottom, zIndex }) => {
    if (position === 'static') return null

    let args = []
    if (top !== 'auto' || left !== 'auto') {
      args.push('leftTop')
      args.push(toLen(left === 'auto' ? '0' : left))
      args.push(toLen(top === 'auto' ? '0' : top))
    } else if (right !== 'auto' || bottom !== 'auto') {
      args.push('rightBottom')
      args.push(toLen(right === 'auto' ? '0' : right))
      args.push(toLen(bottom === 'auto' ? '0' : bottom))
    }

    let res = `$${position}(${args.join(',')})`
    if (zIndex !== 'auto') res += `$zIndex(${zIndex})`
    return res
  },
  TextShadow: ({ textShadow }) => textShadow.split(/,\s*(?![^(]*\))/).map(s => s.trim() && spaceToComma(s) ? `$textShadow(${spaceToComma(s)})` : undefined).filter(Boolean).join(',') || null,
  BoxShadow: ({ boxShadow }) => boxShadow.split(/,\s*(?![^(]*\))/).map(s => s.trim() && spaceToComma(s) ? `$boxShadow(${spaceToComma(s)})` : undefined).filter(Boolean).join(',') || null,
  Transform: ({ transform }) => {
    if (!transform || transform === 'none') return
    const converted = spaceToComma(transform)
    return converted ? `$transform(${converted})` : undefined
  }
}

function main () {
  const all = [document.body, ...document.body.querySelectorAll('*:not(script,style,meta,link,head,title,br)')]
  const elSnap = all.map(el => ({ el, cs: getComputedStyle(el) }))
  const shortsAdded = new Set()
  for (const snap of elSnap) {
    for (const [name, fn] of Object.entries(REVERSE)) {
      const result = fn(snap.cs)
      if (result) {
        shortsAdded.add(result)
        snap.el.classList.add(result)
      }
    }
  }
  console.log(`Done. Found ${shortsAdded.size} shorts.`)
  let csssStyle = document.getElementById('csss_omg')
  if (!csssStyle) {
    csssStyle = document.createElement('style')
    csssStyle.id = 'csss_omg'
    document.head.appendChild(csssStyle)
  } else {
    csssStyle.textContent = ''
    if (csssStyle.shorts) csssStyle.shorts = new Set()
  }
  document.querySelectorAll('style:not(#csss_omg), link[rel="stylesheet"]').forEach(e => e.remove())
  if (!document.querySelector('script[src*="auto.js"]')) {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/gh/orstavik/csss@26.01.28.19/src/auto.js?style=%23csss_omg&interval=400'
    s.type = 'module'
    document.head.appendChild(s)
  }
}
window.minifyCSS = main
