export type Mode = 'auto' | 'single' | 'change' | 'fusion';
export type Modality = 'Optical' | 'Multispectral' | 'SAR' | 'Unknown';
export interface ImageInput {
  id: string;
  name: string;
  size: number;
  format: string;
  width: number;
  height: number;
  bands: number;
  crs: string | null;
  resolution: number[] | null;
  bounds: number[] | null;
  date: string | null;
  sensor: string | null;
  modality: Modality;
  preview: string;
  demo?: boolean;
  registration?: boolean;
}
export interface Check {
  name: string;
  status: 'pass' | 'warning' | 'fail';
  detail: string;
}
export interface Validation {
  mode: Mode;
  ready: boolean;
  checks: Check[];
  warnings: string[];
}
export interface Evidence {
  id: string;
  label: string;
  kind: 'built' | 'water' | 'vegetation' | 'change';
  points: number[][];
  area: number;
}
export interface Analysis {
  id: string;
  createdAt: string;
  query: string;
  mode: Mode;
  task: string;
  images: ImageInput[];
  answer: string;
  confidence: number | null;
  breakdown: { label: string; value: number }[];
  tools: string[];
  steps: string[];
  parameters: { tileSize: number; overlap: number; threshold: number };
  duration: number;
  status: 'complete' | 'abstained';
  evidence: Evidence[];
  metrics: { label: string; value: string }[];
  limitations: string[];
  demo: boolean;
}
export const MODE_LABELS: Record<Mode, string> = {
  auto: 'Auto detect',
  single: 'Single image',
  change: 'Bi-temporal pair',
  fusion: 'Optical + SAR pair',
};
export const SUGGESTIONS: Record<string, string[]> = {
  single: [
    'Describe this scene',
    'Identify major land-cover classes',
    'Is there a water body?',
    'Highlight built-up regions',
  ],
  change: [
    'Has the built-up area increased, and where did most of the change occur?',
    'What changed?',
    'Where did vegetation decrease?',
    'Highlight the changed regions',
  ],
  fusion: [
    'Use both images to identify water-covered and built-up regions.',
    'Identify water-covered regions using both sensors',
    'What additional information does SAR provide?',
  ],
};
