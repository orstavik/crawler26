(function () {
  'use strict';
  const REM = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

  const toLen = (pxStr) => {
    const px = parseFloat(pxStr) || 0;
    if (!px) return '0';
    if (typeof pxStr === 'string' && pxStr.includes('%')) return pxStr.trim();
    for (const base of [REM, 16]) {
      const rem = px / base;
      const candidates = [Math.round(rem), Math.round(rem * 4) / 4, Math.round(rem * 2) / 2];
      for (const v of candidates) {
        if (Math.abs(v - rem) < 0.01 && v > 0 && String(v).split('.')[1]?.length <= 2) return v + 'rem';
      }
    }
    return (Math.abs(px - Math.round(px)) < 0.05 ? Math.round(px) : px.toFixed(3).replace(/\.?0+$/, "")) + 'px';
  };

  const toColor = (rgb) => {
    if (!rgb || rgb === 'currentcolor' || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return null;
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!m) return null;
    const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
    const aStr = m[4];
    const a = aStr ? parseFloat(aStr) : 1;
    if (a === 0) return null;
    if (a < 1) return `#rgba(${r},${g},${b},${a})`;
    const hex = [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
    return '#' + hex;
  };

  const spaceToComma = (val) => {
    if (!val || val === 'none') return '';
    return val.trim().split(/\s+/).map(v => {
      if (v.includes('px')) return toLen(v);
      if (v.includes('rgb')) return toColor(v);
      return v;
    }).filter(Boolean).join(',');
  };

  const REVERSE = {
    Grid: ({
      display,
      gridTemplateColumns,
      gridTemplateRows,
      rowGap,
      columnGap,
      // gap,//todo do this instead!
    }) => {
      if (!(display === 'grid' || display === 'inline-grid'))
        return;
      let args = [];
      const gtc = gridTemplateColumns;
      if (gtc && gtc !== 'none') args.push(`cols(${spaceToComma(gtc)})`);
      const gtr = gridTemplateRows;
      if (gtr && gtr !== 'none') args.push(`rows(${spaceToComma(gtr)})`);
      const rg = rowGap, cg = columnGap;
      if (rg && rg !== 'normal' && parseFloat(rg) > 0) {
        const rgLen = toLen(rg);
        const cgLen = cg && cg !== 'normal' ? toLen(cg) : null;
        args.push(cgLen && cgLen !== rgLen ? `gap(${rgLen},${cgLen})` : `gap(${rgLen})`);
      }
      return args.length ? `$Grid(${args.join(',')})` : '$Grid()';
    },
    Flex: ({
      display,
      flexDirection,
      flexWrap,
      rowGap,
      columnGap,
      alignItems,
      justifyContent,
    }) => {
      if (!(display === 'flex' || display === 'inline-flex'))
        return;
      let args = [];
      if (flexDirection !== 'row') args.push(flexDirection.replace(/-([a-z])/g, (g) => g[1].toUpperCase()));
      if (flexWrap === 'wrap') args.push('wrap');
      const rg = rowGap, cg = columnGap;
      if (rg && rg !== 'normal' && parseFloat(rg) > 0) {
        const rgLen = toLen(rg);
        const cgLen = cg && cg !== 'normal' ? toLen(cg) : null;
        args.push(cgLen && cgLen !== rgLen ? `gap(${rgLen},${cgLen})` : `gap(${rgLen})`);
      }
      const ai = alignItems;
      if (ai && ai !== 'normal' && ai !== 'stretch') {
        const mapped = ai.replace('flex-', '').replace('space-', '');
        args.push(`items${mapped.charAt(0).toUpperCase() + mapped.slice(1)}`);
      }
      const jc = justifyContent;
      if (jc && jc !== 'normal' && jc !== 'flex-start') {
        const mapped = jc.replace('flex-', '').replace('space-', '');
        args.push(`content${mapped.charAt(0).toUpperCase() + mapped.slice(1)}`);
      }
      return `$Flex(${args.join(',')})`;
    },
    Display: ({ display }) => {
      const d = display;
      if (d === 'inline-block') return '$IBlock()';
      if (d === 'none') return '$hide';
      return null;
    },

    flexItem: (cs) => {
      let args = [];
      if (cs.flexGrow !== '0') args.push(`grow(${cs.flexGrow})`);
      if (cs.flexShrink !== '1') args.push(`shrink(${cs.flexShrink})`);
      if (cs.flexBasis !== 'auto') args.push(`basis(${toLen(cs.flexBasis)})`);
      const as = cs.alignSelf;
      if (as !== 'auto' && as !== 'stretch') {
        const mapped = as.replace('flex-', '');
        args.push(`self${mapped.charAt(0).toUpperCase() + mapped.slice(1)}`);
      }
      return args.length ? `$flexItem(${args.join(',')})` : null;
    },

    gridItem: (cs) => {
      let args = [];
      const cS = cs.gridColumnStart, cE = cs.gridColumnEnd;
      if (cS !== 'auto' || cE !== 'auto') args.push(`column(${cS === 'auto' ? '_' : cS},${cE === 'auto' ? '_' : cE})`);
      const rS = cs.gridRowStart, rE = cs.gridRowEnd;
      if (rS !== 'auto' || rE !== 'auto') args.push(`row(${rS === 'auto' ? '_' : rS},${rE === 'auto' ? '_' : rE})`);
      const js = cs.justifySelf;
      if (js !== 'auto' && js !== 'stretch') args.push(`self${js.charAt(0).toUpperCase() + js.slice(1)}`);
      return args.length ? `$gridItem(${args.join(',')})` : null;
    },

    blockItem: (cs) => {
      let args = [];
      const m = ['Top', 'Right', 'Bottom', 'Left'].map(s => toLen(cs[`margin${s}`]));
      if (m.some(v => v !== '0')) {
        if (m.every(v => v === m[0])) args.push(`margin(${m[0]})`);
        else if (m[0] === m[2] && m[1] === m[3]) args.push(`margin(${m[0]},${m[1]})`);
        else args.push(`margin(${m.join(',')})`);
      }
      const w = cs.width, h = cs.height;
      const parentWidth = el.parentElement ? parseFloat(getComputedStyle(el.parentElement).width) : window.innerWidth;
      const isImg = el.tagName === 'IMG' || el.tagName === 'SVG';
      if (el.style.width || isImg || (parseFloat(w) > 0 && parseFloat(w) < parentWidth * 0.98)) args.push(`inlineSize(${toLen(w)})`);
      if (el.style.height || isImg || (parseFloat(h) > 0 && parseFloat(h) < 1000)) args.push(`blockSize(${toLen(h)})`);
      if (cs.maxWidth !== 'none') args.push(`inlineSize(_,_,${toLen(cs.maxWidth)})`);
      if (cs.float === 'left' || cs.float === 'inline-start') args.push('floatStart');
      else if (cs.float === 'right' || cs.float === 'inline-end') args.push('floatEnd');

      return args.length ? `$blockItem(${args.join(',')})` : null;
    },

    Paragraph: (cs) => {
      let args = [];
      if (cs.textAlign !== 'start' && cs.textAlign !== 'left') args.push(cs.textAlign === 'center' ? 'center' : cs.textAlign);
      if (cs.lineHeight !== 'normal') {
        const lh = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
        if (!isNaN(lh)) args.push(lh.toFixed(2).replace(/\.?0+$/, ""));
      }
      if (cs.whiteSpace !== 'normal') args.push(cs.whiteSpace.replace(/-([a-z])/g, (g) => g[1].toUpperCase()));
      return args.length ? `$paragraph(${args.join(',')})` : null;
    },

    Border: (cs) => {
      const sides = ['Top', 'Right', 'Bottom', 'Left'];
      const w = sides.map(s => toLen(cs[`border${s}Width`]));
      const st = sides.map(s => cs[`border${s}Style`]);
      const c = sides.map(s => toColor(cs[`border${s}Color`]));
      const r = ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map(s => toLen(cs[`border${s}Radius`]));
      if (w.every(v => v === '0') && r.every(v => v === '0')) return null;
      let args = [];
      if (w.some(v => v !== '0')) args.push(w.every(v => v === w[0]) ? w[0] : w.join(','));
      if (st.some(v => v !== 'none')) args.push(st.every(v => v === st[0]) ? st[0] : st.join(','));
      if (c.some(v => v)) args.push(c.every(v => v === c[0]) ? c[0] : c.filter(Boolean).join(','));
      if (r.some(v => v !== '0')) args.push(r.every(v => v === r[0]) ? `r(${r[0]})` : `r(${r.join(',')})`);
      return args.length ? `$border(${args.join(',')})` : null;
    },

    Block: (cs) => {
      const p = ['Top', 'Right', 'Bottom', 'Left'].map(s => toLen(cs[`padding${s}`]));
      let args = [];
      if (p.some(v => v !== '0')) {
        if (p.every(v => v === p[0])) args.push(`padding(${p[0]})`);
        else if (p[0] === p[2] && p[1] === p[3]) args.push(`padding(${p[0]},${p[1]})`);
        else args.push(`padding(${p.join(',')})`);
      }
      const ox = cs.overflowX, oy = cs.overflowY;
      if (ox !== 'visible' || oy !== 'visible') {
        if (ox === oy) args.push(`overflow${ox[0].toUpperCase() + ox.slice(1)}`);
        else args.push(`overflowBlockInline(${oy[0].toUpperCase() + oy.slice(1)},${ox[0].toUpperCase() + ox.slice(1)})`);
      }
      return args.length ? `$block(${args.join(',')})` : null;
    },

    Bg: (cs) => {
      const c = toColor(cs.backgroundColor);
      return (c && c !== '#rgba(0,0,0,0)') ? `$bgColor(${c})` : null;
    },

    Color: (cs) => {
      const c = toColor(cs.color);
      if (!c || c === '#000000' || c === '#black') return null;
      return `$color(${c})`;
    },

    Font: (cs) => {
      let args = [];
      const ff = cs.fontFamily.split(',')[0].trim().replace(/"/g, '').replace(/\s+/g, '+');
      if (ff && !ff.includes('serif')) args.push(ff);
      args.push(toLen(cs.fontSize));
      if (cs.fontWeight !== '400' && cs.fontWeight !== 'normal') args.push(cs.fontWeight === '700' ? 'bold' : cs.fontWeight);
      if (cs.fontStyle === 'italic') args.push('i');
      return args.length ? `$font(${args.join(',')})` : null;
    },

    Position: (cs) => {
      const pos = cs.position;
      if (pos === 'static') return null;
      let args = [];
      const t = cs.top, l = cs.left, r = cs.right, b = cs.bottom;
      if (t !== 'auto' || l !== 'auto') {
        args.push('leftTop');
        args.push(toLen(l === 'auto' ? '0' : l));
        args.push(toLen(t === 'auto' ? '0' : t));
      } else if (r !== 'auto' || b !== 'auto') {
        args.push('rightBottom');
        args.push(toLen(r === 'auto' ? '0' : r));
        args.push(toLen(b === 'auto' ? '0' : b));
      }
      let res = `$${pos}(${args.join(',')})`;
      if (cs.zIndex !== 'auto') res += `$zIndex(${cs.zIndex})`;
      return res;
    },

    TextShadow: ({ textShadow }) => textShadow ? `$textShadow(${spaceToComma(textShadow)})` : undefined,

    BoxShadow: ({ boxShadow }) => boxShadow ? `$boxShadow(${spaceToComma(boxShadow)})` : undefined,

    Transform: ({ transform: t }) => {
      if (!t) return null;
      if (t.startsWith('matrix')) return null;
      return `$transform(${spaceToComma(t)})`;
    }
  };

  function main() {
    console.log('🚀 CSSS Transformation Starting...');
    const all = [document.body, ...document.body.querySelectorAll('*:not(script,style,meta,link,head,title,br)')];
    const elSnap = all.map(el => ({ el, cs: getComputedStyle(el) }));
    const shortsAdded = new Set();
    for (let { el, cs } of elSnap) {
      for (let SHORT in REVERSE) {
        const csss = REVERSE[SHORT](cs);
        if (csss) {
          shortsAdded.add(csss);
          el.classList.add(csss);
        }
      }
    }
    console.log(`✅ Done. Found ${shortsAdded.size} shorts.`);
    const s = document.createElement('script');
    document.querySelectorAll('style:not(#csss_omg), link[rel="stylesheet"]').forEach(e => e.remove());
    s.src = 'https://cdn.jsdelivr.net/gh/orstavik/csss@26.01.28.19/src/auto.js?style=%23csss_omg&interval=400';
    s.type = 'module';
    document.head.appendChild(s);
  }

  main();
})();