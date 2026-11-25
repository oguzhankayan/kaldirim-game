export const CELL_X = 0.32;
export const CELL_Z = 0.24;
export const PATCH = 10;
/** Odd courses move half a stone sideways so each head drops into the pocket of the course next to it. */
export const paverCourseShift = (row: number): number => (row & 1) === 0 ? 0 : CELL_X / 2;
export interface LocalText { tr: string; en: string }
export type Theme = 'street' | 'square' | 'park' | 'coast' | 'oldtown';
export interface LevelSpec {
  id: string; name: LocalText; description: LocalText; cols: number; rows: number;
  theme: Theme; pay: number; sky: string; sun: number; seed: number;
}
export const LEVELS: readonly LevelSpec[] = [
  { id: 'sahil', name: { tr: 'Sahil Sokağı', en: 'Seaside Street' }, description: { tr: 'Bir taşla başla. Sokağın tamamı seni bekliyor.', en: 'Start with one stone. A whole street awaits.' }, cols: 100, rows: 100, theme: 'street', pay: 4, sky: '#a3cbd2', sun: 1, seed: 1041 },
  { id: 'pazar', name: { tr: 'Pazar Meydanı', en: 'Market Square' }, description: { tr: 'Eski çeşmenin çevresinde yeni bir meydan.', en: 'Build a new square around the old fountain.' }, cols: 120, rows: 120, theme: 'square', pay: 5, sky: '#bfd5da', sun: 0.9, seed: 2053 },
  { id: 'cinar', name: { tr: 'Çınar Parkı', en: 'Plane Tree Park' }, description: { tr: 'Ağaçlara dokunmadan, büyük bir işi tamamla.', en: 'Keep the tree islands intact as the park takes shape.' }, cols: 140, rows: 140, theme: 'park', pay: 6, sky: '#b1ced2', sun: 1.1, seed: 3079 },
  { id: 'kiyi', name: { tr: 'Kıyı Yolu', en: 'Coastal Walk' }, description: { tr: 'Deniz boyunca uzanan, bitirmeye değer bir yol.', en: 'A long walk by the sea, waiting for your last stone.' }, cols: 120, rows: 200, theme: 'coast', pay: 7, sky: '#dfc7ae', sun: 0.55, seed: 4093 },
  { id: 'mahalle', name: { tr: 'Eski Mahalle', en: 'Old Neighborhood' }, description: { tr: 'En büyük işin. Bütün meydan senin eserin olacak.', en: 'Your largest job. Make the whole neighborhood yours.' }, cols: 180, rows: 180, theme: 'oldtown', pay: 8, sky: '#a8c9d6', sun: 0.8, seed: 5021 },
];
export interface ToolSpec { id: string; name: LocalText; description: LocalText; cost: number; width: number; depth: number; dwell: number; capacity: number; reach: number }
export const TOOLS: readonly ToolSpec[] = [
  { id: 'hand', name: { tr: 'El İşçiliği', en: 'By Hand' }, description: { tr: 'Bir taş, doğru hedef, sakin bir hareket.', en: 'One stone, a deliberate placement.' }, cost: 0, width: 1, depth: 1, dwell: .48, capacity: 16, reach: 2.7 },
  { id: 'clamp', name: { tr: 'Mekanik Kıskaç', en: 'Mechanical Clamp' }, description: { tr: 'Tek harekette 6 taşı yerleştir.', en: 'Place six stones in one motion.' }, cost: 240, width: 3, depth: 2, dwell: .65, capacity: 72, reach: 3.4 },
  { id: 'row', name: { tr: 'Sıra Aparatı', en: 'Row Layer' }, description: { tr: '18 taşlık sıralarla işin ölçeğini büyüt.', en: 'Cover eighteen stones with each placement.' }, cost: 2200, width: 6, depth: 3, dwell: .8, capacity: 216, reach: 4.4 },
  { id: 'machine', name: { tr: 'K-48 Döşeme Makinesi', en: 'K-48 Paving Machine' }, description: { tr: '48 taşlık çalışma alanı. Büyük işler için.', en: 'Forty-eight stones at once. Built for large jobs.' }, cost: 10000, width: 8, depth: 6, dwell: 1, capacity: 576, reach: 5.8 },
];
export type UpgradeId = 'capacity' | 'speed' | 'logistics' | 'reach' | 'precision';
export interface UpgradeSpec { id: UpgradeId; name: LocalText; description: LocalText; costs: readonly number[] }
export const UPGRADES: readonly UpgradeSpec[] = [
  { id: 'capacity', name: { tr: 'Taşıma Kapasitesi', en: 'Carrying Capacity' }, description: { tr: 'Her kademede temel kapasiteye %80 ekle.', en: 'Add 80% of base capacity per level.' }, costs: [48, 240, 900, 2800] },
  { id: 'speed', name: { tr: 'Çalışma Hızı', en: 'Working Speed' }, description: { tr: 'Her kademede yerleştirme süresini %15 azalt.', en: 'Reduce placement time by 15% per level.' }, costs: [120, 600, 2000, 5000] },
  { id: 'logistics', name: { tr: 'Mobil İkmal', en: 'Mobile Supplies' }, description: { tr: 'İlk kademe her yerde ikmal açar. Sonrakiler ikmali hızlandırır.', en: 'Refill anywhere from level one; later levels speed up refills.' }, costs: [180, 720, 2400, 4800] },
  { id: 'reach', name: { tr: 'Çalışma Erişimi', en: 'Working Reach' }, description: { tr: 'Her kademede erişime 55 cm ekle.', en: 'Extend working reach by 55 cm per level.' }, costs: [160, 800, 2600] },
  { id: 'precision', name: { tr: 'Geniş Döşeme Başlığı', en: 'Wider Paving Head' }, description: { tr: 'Sıra aparatı ve K-48 alanını her kademede 2 sütun / 1 sıra büyüt.', en: 'Add two columns and one row to the Row Layer and K-48 per level.' }, costs: [600, 2400, 6000] },
];
export const ACHIEVEMENTS: readonly { id: string; name: LocalText; description: LocalText }[] = [
  { id: 'first', name: { tr: 'İlk Taş', en: 'First Stone' }, description: { tr: 'İlk taşını yerleştir.', en: 'Place your first stone.' } },
  { id: 'hundred', name: { tr: 'Elin Alıştı', en: 'Getting the Hang of It' }, description: { tr: 'Toplam 100 taş döşe.', en: 'Lay 100 stones in total.' } },
  { id: 'tidy', name: { tr: 'Düzgün İşçilik', en: 'Neat Work' }, description: { tr: '50 tam çalışma alanını art arda tamamla.', en: 'Complete 50 full footprints in a row.' } },
  { id: 'machine', name: { tr: 'Büyük İşler', en: 'Heavy Duty' }, description: { tr: 'K-48 kirala.', en: 'Lease the K-48.' } },
  { id: 'first-job', name: { tr: 'İş Tamam', en: 'Job Done' }, description: { tr: 'İlk şantiyeyi bitir.', en: 'Complete your first job.' } },
  { id: 'master', name: { tr: 'Mahallenin Ustası', en: 'Master of the Neighborhood' }, description: { tr: 'Beş büyük işi tamamla.', en: 'Complete all five large jobs.' } },
];

/** Deterministic PRNG shared by synthesized audio and authored content. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s += 0x6d2b79f5; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
