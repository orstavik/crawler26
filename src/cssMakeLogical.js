const nonLogical = {
  'horizontal-tb': { "Top": "BlockStart", "Left": "InlineStart", "Right": "InlineEnd", "Bottom": "BlockEnd", },
  'vertical-rl': { "Top": "InlineStart", "Left": "BlockEnd", "Right": "BlockStart", "Bottom": "InlineEnd", },
  'vertical-lr': { "Top": "InlineStart", "Left": "BlockStart", "Right": "BlockEnd", "Bottom": "InlineEnd", },
  'sideways-lr': { "Top": "InlineEnd", "Left": "BlockStart", "Right": "BlockEnd", "Bottom": "InlineStart", },
  'rtl horizontal-tb': { "Top": "BlockStart", "Left": "InlineEnd", "Right": "InlineStart", "Bottom": "BlockEnd" },
  'rtl vertical-rl': { "Top": "InlineEnd", "Left": "BlockEnd", "Right": "BlockStart", "Bottom": "InlineStart" },
  'rtl vertical-lr': { "Top": "InlineEnd", "Left": "BlockStart", "Right": "BlockEnd", "Bottom": "InlineStart" },
  'rtl sideways-lr': { "Top": "InlineStart", "Left": "BlockStart", "Right": "BlockEnd", "Bottom": "InlineEnd" },
};
const nonLogicalRadius = {
  'sideways-lr': { "TopLeft": "StartStart", "TopRight": "EndStart", "BottomLeft": "StartEnd", "BottomRight": "EndEnd" },
  'horizontal-tb': { "TopLeft": "StartStart", "TopRight": "StartEnd", "BottomLeft": "EndStart", "BottomRight": "EndEnd", },
  'vertical-rl': { "TopLeft": "EndStart", "TopRight": "StartStart", "BottomLeft": "EndEnd", "BottomRight": "StartEnd", },
  'vertical-lr': { "TopLeft": "StartStart", "TopRight": "EndStart", "BottomLeft": "StartEnd", "BottomRight": "EndEnd", },
  'rtl horizontal-tb': { "TopLeft": "StartEnd", "TopRight": "StartStart", "BottomLeft": "EndEnd", "BottomRight": "EndStart" },
  'rtl vertical-rl': { "TopLeft": "EndEnd", "TopRight": "StartEnd", "BottomLeft": "EndStart", "BottomRight": "StartStart" },
  'rtl vertical-lr': { "TopLeft": "StartEnd", "TopRight": "EndEnd", "BottomLeft": "StartStart", "BottomRight": "EndStart" },
  'rtl sideways-lr': { "TopLeft": "StartEnd", "TopRight": "EndEnd", "BottomLeft": "StartStart", "BottomRight": "EndStart", },
};

const PhysicalToLogical = {}, PhysicalToLogicalValues = {};
for (const [writingMode, table] of Object.entries(nonLogical)) {
  const res = PhysicalToLogical[writingMode] = {};
  const res2 = PhysicalToLogicalValues[writingMode] = {};
  for (const [physical, logical] of Object.entries(table)) {
    res[physical.toLowerCase()] = "inset" + logical;
    res2[physical.toLowerCase()] = logical.replace(/([A-Z])/g, "-$1").slice(1).toLowerCase();
    for (const prefix of ["border", "margin", "padding", "scrollMargin", "scrollPadding"])
      res[prefix + physical] = prefix + logical;
    for (const suffix of ["Color", "Style", "Width"])
      res["border" + physical + suffix] = "border" + logical + suffix;
  }
  for (const [physical, logical] of Object.entries(nonLogicalRadius[writingMode]))
    res["border" + physical + "Radius"] = "border" + logical + "Radius";
};

function makeLogicalValue(k, v, valueMap) {
  return !(typeof v === "string") ? v :
    (k === "textAlign") ? v.replace(/\b(left|right)\b/gi, m => valueMap[m.toLowerCase()].replace("inline-", "")) :
      (k === "float" || k === "clear") ? v.replace(/\b(left|right)\b/gi, m => valueMap[m.toLowerCase()]) :
        (k === "captionSide") ? v.replace(/\b(top|bottom)\b/gi, m => valueMap[m.toLowerCase()]) :
          v;
}

function toLogicalProp(styles, writingMode = "horizontal-tb") {
  if (!styles) return styles;
  writingMode = writingMode.replace("sideways-rl", "vertical-rl");
  const map = PhysicalToLogical[writingMode];
  const valueMap = PhysicalToLogicalValues[writingMode];
  const res = {};
  for (let [k, v] of Object.entries(styles))
    res[map[k] ?? k] = makeLogicalValue(k, v, valueMap);
  return res;
}

export function makeLogical(mapWithElementsSortedTopDownToStyles) {
  const cache = new Map();
  for (let el of mapWithElementsSortedTopDownToStyles.keys()) {
    const parent = cache.get(el.parentElement);
    const writingMode = mapWithElementsSortedTopDownToStyles.get(el)?.writingMode ?? parent?.writingMode ?? "horizontal-tb";
    const direction = el.dir || mapWithElementsSortedTopDownToStyles.get(el)?.direction ?? parent?.direction ?? "ltr";
    const key = direction === "rtl" ? "rtl " + writingMode : writingMode;
    cache.set(el, { writingMode, direction, key });
  }
  return new Map([...mapWithElementsSortedTopDownToStyles.entries()].map(([el, styles]) =>
    [el, toLogicalProp(styles, cache.get(el).key)]));
}