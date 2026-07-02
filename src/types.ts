export interface FrameInfo {
  id: number;
  dataUrl: string;       // Base64 PNG data URL after applying transparency color keying (if active)
  originalDataUrl: string; // Original base64 PNG data URL from direct slice
  selected: boolean;
}

export interface SpriteSheetSample {
  id: string;
  name: string;
  description: string;
  imageUrl: string;      // Base64 sprite sheet
  cols: number;
  rows: number;
  fps: number;
}

export interface GifSettings {
  cols: number;
  rows: number;
  fps: number;
  playMode: "forward" | "reverse" | "pingpong";
  gifWidth: number;
  gifHeight: number;
  loop: boolean;
  transparencyEnabled: boolean;
  transparencyFloodFill: boolean; // Protect character interior white pixels by only removing connected background pixels
  transparentColor: string; // Hex color e.g., "#00ff00"
  transparencyTolerance: number; // 0 to 100
  cropLeft: number;
  cropRight: number;
  cropTop: number;
  cropBottom: number;
  frameShave: number;
  lineBoldness: number; // 0 to 5, default 0 (line thickening/boldness adjustment)
  imageSmoothing: boolean; // whether to apply image smoothing (true) or vector/nearest-neighbor pixelated scaling (false)
  stabilizeFrames: boolean; // whether to align centroid of frames to center to correct wobbling
  captionText: string;
  captionColor: string;
  captionSize: number;
  captionYPercent: number;
  captionXPercent: number;
  captionEffect: "static" | "bounce" | "fade" | "pop";
  captionStroke: boolean;
  captionFont: string;
}

