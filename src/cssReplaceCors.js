async function replaceCorsStylesheet(sheet) {
  try {
    const res = await fetch(`https://offcors.2js-no.workers.dev/?url=${sheet.href}`);
    if (!res.ok)
      throw new Error(res.status + " " + res.statusText);

    const newStyle = document.createElement('style');
    newStyle.textContent = await res.text();
    newStyle.setAttribute('data-original-href', sheet.href);

    const owner = sheet.ownerNode;
    if (owner) {
      if (owner.media) newStyle.media = owner.media;
      owner.replaceWith(newStyle);
    } else {
      document.head.appendChild(newStyle);
    }
    sheet.disabled = true;
  } catch (fetchErr) {
    return fetchErr;
  }
}

async function patchCorsStylesheets() {
  const allSheets = Array.from(document.styleSheets);
  const corsSheets = allSheets.filter(
    sheet => { try { return !sheet.cssRules; } catch (err) { return err.name === 'SecurityError' && sheet.href; } });
  for (const sheet of corsSheets)
    await replaceCorsStylesheet(sheet);
}

function tst() {
  (async () => {
    debugger;
    await patchCorsStylesheets();
  })();
}

export { patchCorsStylesheets };
