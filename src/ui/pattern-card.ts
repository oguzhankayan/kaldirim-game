import { LEVELS, CELL_X, CELL_Z, type LevelSpec } from '../game/content';
import { PavingGrid } from '../game/grid';
import { PAVER_SWATCHES, patternDefinition } from '../game/patterns';
import { mapPixels } from './worksite-map';
import './patterns.css';

type Language = 'tr' | 'en';
/** All strings are authored catalogue data, never imported save/user HTML. */
export function patternLegend(language: Language): string {
  return `<div class="pattern-swatches">${PAVER_SWATCHES.map(s => `<span><i style="background:${s.map}"></i>${s.name[language]}</span>`).join('')}</div>`;
}
export function patternCard(spec: LevelSpec, language: Language): string {
  const p = patternDefinition(spec);
  return `<figure class="pattern-card" data-pattern="${p.id}"><canvas data-pattern-level="${spec.id}" aria-label="${p.name[language]}"></canvas><figcaption><strong>${p.name[language]}</strong><p>${p.description[language]}</p>${patternLegend(language)}</figcaption></figure>`;
}

const pictures = new WeakMap<LevelSpec, HTMLCanvasElement>();
export function drawPatternCards(root: HTMLElement): void {
  for (const canvas of root.querySelectorAll<HTMLCanvasElement>('canvas[data-pattern-level]')) {
    const spec = LEVELS.find(s => s.id === canvas.dataset.patternLevel); if (!spec) continue;
    let source = pictures.get(spec);
    if (!source) {
      source = document.createElement('canvas'); source.width = spec.cols; source.height = spec.rows;
      const c = source.getContext('2d'); if (!c) continue;
      const image = c.createImageData(spec.cols, spec.rows); image.data.set(mapPixels(new PavingGrid(spec), 'plan'));
      c.putImageData(image, 0, 0); pictures.set(spec, source);
    }
    // Correct meter-space proportions, rather than stretching every site into a square.
    canvas.width = 600; canvas.height = Math.round(600 * spec.rows * CELL_Z / (spec.cols * CELL_X));
    const c = canvas.getContext('2d'); if (!c) continue;
    c.imageSmoothingEnabled = false; c.drawImage(source, 0, 0, canvas.width, canvas.height);
  }
}
