import L from "leaflet";
import type { MapPatternDefinition } from "../patterns/patternRegistry";
import { getAllPatternDefinitions } from "../patterns/patternRegistry";

let patternContainer: SVGSVGElement | null = null;

function getOrCreatePatternContainer(map: L.Map): SVGSVGElement {
  const pane = map.getPane("overlayPane");

  if (!pane) {
    throw new Error("Leaflet overlay pane is unavailable.");
  }

  let svg = pane.querySelector<SVGSVGElement>("svg.nexus-map-pattern-defs");

  if (svg) {
    patternContainer = svg;
    return svg;
  }

  svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("nexus-map-pattern-defs");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.style.pointerEvents = "none";
  pane.appendChild(svg);
  patternContainer = svg;
  return svg;
}

function appendPattern(definition: MapPatternDefinition, defs: SVGDefsElement): void {
  const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
  pattern.setAttribute("id", `pattern-${definition.id}`);
  pattern.setAttribute("patternUnits", "userSpaceOnUse");
  pattern.setAttribute("width", String(definition.spacing));
  pattern.setAttribute("height", String(definition.spacing));

  if (definition.rotation) {
    pattern.setAttribute("patternTransform", `rotate(${definition.rotation})`);
  }

  switch (definition.type) {
    case "dots": {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", String(definition.spacing / 2));
      circle.setAttribute("cy", String(definition.spacing / 2));
      circle.setAttribute("r", "1");
      circle.setAttribute("fill", definition.stroke ?? "#000");
      circle.setAttribute("opacity", String(definition.opacity));
      pattern.appendChild(circle);
      break;
    }
    case "lines":
    case "crosshatch": {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", "0");
      line.setAttribute("y1", "0");
      line.setAttribute("x2", String(definition.spacing));
      line.setAttribute("y2", String(definition.spacing));
      line.setAttribute("stroke", definition.stroke ?? "#000");
      line.setAttribute("stroke-width", "1");
      line.setAttribute("opacity", String(definition.opacity));
      pattern.appendChild(line);

      if (definition.type === "crosshatch") {
        const cross = line.cloneNode() as SVGLineElement;
        cross.setAttribute("x2", "0");
        cross.setAttribute("y2", String(definition.spacing));
        pattern.appendChild(cross);
      }
      break;
    }
    case "symbols": {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String(definition.spacing / 2));
      text.setAttribute("y", String(definition.spacing / 2));
      text.setAttribute("font-size", "6");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", definition.stroke ?? "#000");
      text.setAttribute("opacity", String(definition.opacity));
      text.textContent = "×";
      pattern.appendChild(text);
      break;
    }
    default: {
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("width", String(definition.spacing));
      rect.setAttribute("height", String(definition.spacing));
      rect.setAttribute("fill", definition.stroke ?? "#000");
      rect.setAttribute("opacity", String(definition.opacity * 0.5));
      pattern.appendChild(rect);
    }
  }

  defs.appendChild(pattern);
}

export function ensurePatternDefinitions(map: L.Map): void {
  const svg = getOrCreatePatternContainer(map);
  let defs = svg.querySelector("defs");

  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svg.appendChild(defs);
  }

  defs.innerHTML = "";

  for (const pattern of getAllPatternDefinitions()) {
    appendPattern(pattern, defs);
  }
}

export function patternFillUrl(patternId: string): string {
  return `url(#pattern-${patternId})`;
}

export function clearPatternDefinitions(): void {
  patternContainer?.querySelector("defs")?.replaceChildren();
  patternContainer = null;
}
