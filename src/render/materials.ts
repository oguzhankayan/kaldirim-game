import * as T from 'three';
export function rng(seed: number): () => number { let s = seed >>> 0; return () => { s += 0x6d2b79f5; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export type MaterialName = 'stone' | 'sand' | 'cream' | 'terra' | 'wood' | 'glass' | 'metal' | 'orange' | 'green' | 'leaf' | 'asphalt' | 'white' | 'rubber' | 'fabric' | 'skin' | 'blue' | 'water' | 'soil';
const palette: Record<MaterialName, [string, number, number]> = {
  stone: ['#a8a69c', .91, 0], sand: ['#c4b296', .98, 0], cream: ['#daceb5', .94, 0], terra: ['#ad6750', .9, 0], wood: ['#8b6547', .88, 0], glass: ['#43606b', .2, .35], metal: ['#3c4544', .48, .6], orange: ['#d69737', .66, .18], green: ['#4d6653', .84, .04], leaf: ['#57704b', .95, 0], asphalt: ['#62655f', .98, 0], white: ['#e4ddc7', .87, 0], rubber: ['#303733', .95, 0], fabric: ['#bd8564', .95, 0], skin: ['#bda988', .88, 0], blue: ['#73959c', .9, 0], water: ['#668f97', .22, .18], soil: ['#756953', 1, 0],
};
export class Materials {
  private anisotropy = 1;
  setAnisotropy(value: number): void {
    this.anisotropy = Math.max(1, Math.min(8, Math.floor(value)));
    for (const texture of this.textures) { texture.anisotropy = this.anisotropy; texture.needsUpdate = true; }
  }
  private library = new Map<MaterialName, T.MeshStandardMaterial>();
  private textures: T.Texture[] = [];
  private labels: T.Material[] = [];
  private labelCache = new Map<string, T.MeshStandardMaterial>();
  get(name: MaterialName): T.MeshStandardMaterial {
    const existing = this.library.get(name); if (existing) return existing;
    const [hex, roughness, metalness] = palette[name], color = new T.Color(hex).convertLinearToSRGB();
    const size = name === 'stone' ? 512 : 256, pixels = new Uint8Array(size * size * 4), bump = new Uint8Array(size * size * 4);
    const random = rng(Object.keys(palette).indexOf(name) * 733 + 17);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const amplitude = name === 'stone' || name === 'sand' || name === 'asphalt' ? .075 : name === 'wood' ? .035 : .018;
      let noise = (random() - .5) * amplitude + Math.sin(x * .15) * Math.sin(y * .18) * amplitude * .1;
      if (name === 'wood') noise += Math.sin(y * .35 + Math.sin(x * .08) * 2) * .028;
      if (name === 'fabric') noise += ((x % 4 === 0 ? 1 : 0) + (y % 4 === 0 ? 1 : 0)) * .008;
      const grain = name === 'stone' || name === 'sand' || name === 'asphalt' ? (random() > .985 ? -.035 : 0) : 0;
      pixels[i] = Math.max(0, Math.min(255, (color.r + noise + grain) * 255));
      pixels[i + 1] = Math.max(0, Math.min(255, (color.g + noise + grain) * 255));
      pixels[i + 2] = Math.max(0, Math.min(255, (color.b + noise + grain) * 255)); pixels[i + 3] = 255;
      bump[i] = bump[i + 1] = bump[i + 2] = Math.round((.5 + noise + grain) * 255); bump[i + 3] = 255;
    }
    const texture = new T.DataTexture(pixels, size, size, T.RGBAFormat);
    texture.anisotropy = this.anisotropy; texture.colorSpace = T.SRGBColorSpace; texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.magFilter = T.LinearFilter; texture.minFilter = T.LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.needsUpdate = true;
    const bumpTexture = new T.DataTexture(bump, size, size, T.RGBAFormat);
    bumpTexture.anisotropy = this.anisotropy; bumpTexture.wrapS = bumpTexture.wrapT = T.RepeatWrapping; bumpTexture.magFilter = T.LinearFilter; bumpTexture.minFilter = T.LinearMipmapLinearFilter; bumpTexture.generateMipmaps = true; bumpTexture.needsUpdate = true;
    // Extruded pavers use meter-space UVs: preserve texel density on close-up faces.
    if (name === 'stone') { texture.repeat.set(3, 4); bumpTexture.repeat.set(3, 4); }
    const material = new T.MeshStandardMaterial({ map: texture, bumpMap: bumpTexture, bumpScale: name === 'sand' ? .006 : name === 'stone' ? .003 : .0015, roughness, metalness });
    this.textures.push(texture, bumpTexture); this.library.set(name, material); return material;
  }
  label(text: string, background = '#314c40', foreground = '#f2e5c8'): T.MeshStandardMaterial {
    const key = JSON.stringify([text, background, foreground]);
    const cached = this.labelCache.get(key); if (cached) return cached;
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const c = canvas.getContext('2d')!; c.fillStyle = background; c.fillRect(0, 0, 512, 128);
    c.strokeStyle = foreground; c.lineWidth = 3; c.strokeRect(10, 10, 492, 108);
    c.fillStyle = foreground; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 42px sans-serif'; c.fillText(text, 256, 67, 470);
    const map = new T.CanvasTexture(canvas); map.anisotropy = this.anisotropy; map.colorSpace = T.SRGBColorSpace;
    const material = new T.MeshStandardMaterial({ map, roughness: .86 }); this.textures.push(map); this.labels.push(material); this.labelCache.set(key, material); return material;
  }
  dispose(): void { for (const m of this.library.values()) m.dispose(); for (const m of this.labels) m.dispose(); for (const t of this.textures) t.dispose(); this.library.clear(); this.labelCache.clear(); this.labels.length = this.textures.length = 0; }
}
