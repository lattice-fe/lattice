# Postmortem: markdown preview links did nothing on click

## Symptom

Clicking a link in a rendered `.md` preview did nothing. The **exact same link**
in an `.html` preview worked. No error, no navigation, no console output — just
dead. (~3 weeks to track down.)

## Why it was so hard to catch

Every "obvious" check passed:

- **The code was correct.** The `<a>` had the right `onClick`, `href`, everything
  wired to `onOpenPath`.
- **The path logic was correct.** `../calibrate_pstar.py` resolved to
  `D:/dev/.../calibrate_pstar.py`, backslashes and all.
- **Synthetic clicks "worked."** Every `dispatchEvent(new MouseEvent('click'))`
  test fired the handler and opened a tab — so every automated test lied and said
  it was fine.

That last point is the trap: a scripted click and a real click take different
paths through the browser.

## Root cause: the link node is swapped mid-click

A real click is `mousedown` → `mouseup`, and the browser only synthesizes a
**`click`** if *both landed on the same DOM node*.

Instrumenting a real (trusted) click showed:

- `mousedown` → fired on `<a>` ✓
- `mouseup` → fired on `<a>` ✓
- `click` → **never fired**
- MutationObserver during the click: the `<a>` was **removed and a new `<a>`
  added** — *between* the press and the release.

mousedown hit the old node, a re-render replaced it, mouseup hit the new node,
and the browser decided "those aren't the same element, no click." The handler
was never the problem — **the click event was never born.**

## Why the node was being recreated

```tsx
<ReactMarkdown components={{ ...mdAssetComponents(entry.path, onOpenPath), code, table }}>
```

That `components` object — and the `code`/`table` functions inside it — was
**built fresh on every render**. React identifies a component by its *function
reference*. A new function each render = "different component type" = React
**unmounts and remounts** that element's DOM node instead of reusing it. A
re-render fires on `mousedown` (focus shifts into the preview), and that single
re-render swaps the `<a>` out from under the click.

- **`.html` worked** because it renders in an `<iframe>` — a separate document,
  immune to the parent's React re-rendering. (Its links also route through the
  iframe link-interceptor.)
- **It had been broken forever** because `mdAssetComponents` always returned
  fresh function instances.

## The fix

Make the component identities **stable** so React reuses the DOM node:

```tsx
const onOpenPathRef = useRef(onOpenPath);
onOpenPathRef.current = onOpenPath;               // stays current...

const previewComponents = useMemo(() => ({        // ...without rebuilding the memo
  ...mdAssetComponents(entry.path, (p) => onOpenPathRef.current?.(p)),
  table: …,
  code: …,
}), [entry.path]);
```

`useMemo` keyed on `entry.path` → the same function objects every render → React
keeps the `<a>` node alive → mousedown and mouseup land on the same node →
**`click` fires.**

Routing `onOpenPath` through a ref keeps it current without invalidating the
memo (App passes a fresh arrow each render, which would otherwise defeat the
whole thing).

_Fixed in `app/src/components/TextEditor.tsx`._

## How it was finally diagnosed

The breakthrough was using a **real, trusted click** (CDP-dispatched via the
browser automation) instead of a synthetic `dispatchEvent`, plus three probes
running together:

1. capture-phase `mousedown` / `mouseup` / `click` listeners on `document`
2. a `MutationObserver` on the preview subtree
3. a stable tag on the `<a>` node to detect replacement

That combination showed mousedown+mouseup with no click, and the `<a>`
remove/add mutation in the same window — which pointed straight at
component-identity instability.

## Lesson & lingering note

**Never build a react-markdown `components` object inline.** Unstable component
identity silently remounts nodes, and any interaction that spans
mousedown→mouseup (clicks, drags) can vanish.

Two other spots still build components inline — `FileCard` (grid peek) and the
hover-preview strategy (`lib/preview/strategies.tsx`) — but neither is a click
target, so they're harmless today. Worth memoizing if they ever become
interactive.
