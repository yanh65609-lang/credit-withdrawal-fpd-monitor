const verticalGap = 2;
const lastPlacements = new WeakMap();

function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function placeTrendLabels(points, width, height) {
  const groups = new Map();
  for (const point of points) {
    const group = groups.get(point.x) ?? [];
    group.push(point);
    groups.set(point.x, group);
  }
  const occupied = [];
  const placements = new Map();

  // Give recent dates first choice of space, and keep each label on its own side
  // of neighboring points for the same date.
  for (const [x, series] of [...groups].sort(([a], [b]) => b - a)) {
    const ordered = [...series].sort((a, b) => a.y - b.y);
    for (const [index, point] of ordered.entries()) {
      const halfWidth = point.width / 2 + 3;
      const center = Math.min(Math.max(x, halfWidth + 2), width - halfWidth - 2);
      const upper = ordered[index - 1]?.y;
      const lower = ordered[index + 1]?.y;
      const above = point.y - (upper ?? 0);
      const below = (lower ?? height - 30) - point.y;
      const sides = above >= below ? [-1, 1] : [1, -1];

      for (const side of sides) {
        const baseline = point.y + (side < 0 ? -9 : 19);
        const rect = { left: center - halfWidth, right: center + halfWidth, top: baseline - 12, bottom: baseline + 4 };
        const crossesPoint = side < 0
          ? upper != null && rect.top <= upper + verticalGap
          : lower != null && rect.bottom >= lower - verticalGap;
        if (crossesPoint || rect.left < 0 || rect.top < 2 || rect.bottom > height - 29
            || occupied.some(box => overlaps(rect, box))) continue;
        placements.set(point.key, { x: center, y: baseline, endY: side < 0 ? rect.bottom : rect.top });
        occupied.push(rect);
        break;
      }
    }
  }
  return placements;
}

export function alignTrendLabels(frame) {
  for (const svg of frame.querySelectorAll("svg.recharts-surface")) {
    const width = svg.viewBox.baseVal.width || svg.clientWidth;
    const height = svg.viewBox.baseVal.height || svg.clientHeight;
    if (width <= 0 || height <= 0) continue;
    const seriesColors = [...svg.querySelectorAll(".recharts-line-curve")].map(path => path.getAttribute("stroke"));
    const labels = [...svg.querySelectorAll("text[data-value-label][data-ax][data-ay]")];
    const signature = [width, height, ...labels.map(label => `${label.dataset.ax},${label.dataset.ay},${label.textContent}`)].join("|");
    let layout = lastPlacements.get(svg);
    if (layout?.signature !== signature || labels.some((label, index) => label !== layout.points[index]?.key)) {
      const points = labels.map(label => ({
        key: label,
        x: Number(label.dataset.ax),
        y: Number(label.dataset.ay),
        width: label.getComputedTextLength(),
      }));
      layout = { signature, points, positions: placeTrendLabels(points, width, height) };
      lastPlacements.set(svg, layout);
    }

    for (const point of layout.points) {
      const text = point.key;
      const leader = text.previousElementSibling;
      const position = layout.positions.get(text);
      text.style.visibility = position ? "visible" : "hidden";
      if (leader?.localName === "line") leader.style.visibility = position ? "visible" : "hidden";
      if (!position) continue;
      const stroke = seriesColors[Number(text.dataset.series)];
      if (stroke && !stroke.startsWith("url(")) {
        text.style.fill = `color-mix(in srgb, ${stroke} 65%, var(--text))`;
        if (leader?.localName === "line") {
          leader.style.stroke = stroke;
          leader.style.strokeDasharray = "none";
        }
      }
      setAttribute(text, "x", position.x);
      setAttribute(text, "y", position.y);
      if (leader?.localName !== "line") continue;
      setAttribute(leader, "x1", point.x);
      setAttribute(leader, "y1", point.y);
      setAttribute(leader, "x2", position.x);
      setAttribute(leader, "y2", position.endY);
    }
  }
}

function setAttribute(node, name, value) {
  const next = String(value);
  if (node.getAttribute(name) !== next) node.setAttribute(name, next);
}
