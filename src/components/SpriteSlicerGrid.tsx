import React, { useState, useEffect, useRef } from "react";
import { Grid, Eye, EyeOff, CheckSquare, Square, Check, RefreshCw } from "lucide-react";
import { FrameInfo, GifSettings } from "../types";

interface SpriteSlicerGridProps {
  currentImage: string | null;
  settings: GifSettings;
  frames: FrameInfo[];
  onToggleFrame: (id: number) => void;
  onSelectAllFrames: (select: boolean) => void;
  onInvertFrames: () => void;
}

export default function SpriteSlicerGrid({
  currentImage,
  settings,
  frames,
  onToggleFrame,
  onSelectAllFrames,
  onInvertFrames,
}: SpriteSlicerGridProps) {
  const [showGridOverlay, setShowGridOverlay] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  // Get image natural dimensions for display ratio and grid computation
  useEffect(() => {
    if (!currentImage) return;
    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = currentImage;
  }, [currentImage]);

  const { cols, rows } = settings;
  const activeFramesCount = frames.filter((f) => f.selected).length;

  return (
    <div className="space-y-6" id="sprite-slicer-workspace">
      {/* Sprite sheet preview with Grid lines overlay */}
      <div className="bg-[#141414] rounded-2xl border border-white/5 p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Grid className="w-4 h-4 text-indigo-400" />
              원본 스프라이트 시트 및 슬라이스 영역
            </h3>
            {imageSize.width > 0 && (
              <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                해상도: {imageSize.width} × {imageSize.height}px | 제단 후 프레임 크기:{" "}
                {Math.max(0, Math.floor((imageSize.width - settings.cropLeft - settings.cropRight) / cols) - 2 * settings.frameShave)} ×{" "}
                {Math.max(0, Math.floor((imageSize.height - settings.cropTop - settings.cropBottom) / rows) - 2 * settings.frameShave)}px
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowGridOverlay(!showGridOverlay)}
            className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all font-semibold ${
              showGridOverlay
                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
            }`}
          >
            {showGridOverlay ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>격자 켜짐</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>격자 꺼짐</span>
              </>
            )}
          </button>
        </div>

        {currentImage ? (
          <div className="relative border border-white/15 rounded-xl bg-[#090909] overflow-hidden flex items-center justify-center p-4">
            <div className="relative max-w-full max-h-[420px] select-none" ref={containerRef}>
              <img
                src={currentImage}
                alt="Original Spritesheet"
                className="max-h-[380px] w-auto object-contain block filter drop-shadow-md"
                style={{ imageRendering: "pixelated" }}
                referrerPolicy="no-referrer"
              />

              {/* Grid overlay lines with crop support */}
              {showGridOverlay && imageSize.width > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  {/* Shaded out cropped regions */}
                  {settings.cropTop > 0 && (
                    <div 
                      className="absolute left-0 right-0 top-0 bg-red-500/25 border-b-2 border-red-500/60" 
                      style={{ height: `${(settings.cropTop / imageSize.height) * 100}%` }}
                    />
                  )}
                  {settings.cropBottom > 0 && (
                    <div 
                      className="absolute left-0 right-0 bottom-0 bg-red-500/25 border-t-2 border-red-500/60" 
                      style={{ height: `${(settings.cropBottom / imageSize.height) * 100}%` }}
                    />
                  )}
                  {settings.cropLeft > 0 && (
                    <div 
                      className="absolute top-0 bottom-0 left-0 bg-red-500/25 border-r-2 border-red-500/60" 
                      style={{
                        width: `${(settings.cropLeft / imageSize.width) * 100}%`,
                        top: `${(settings.cropTop / imageSize.height) * 100}%`,
                        bottom: `${(settings.cropBottom / imageSize.height) * 100}%`
                      }}
                    />
                  )}
                  {settings.cropRight > 0 && (
                    <div 
                      className="absolute top-0 bottom-0 right-0 bg-red-500/25 border-l-2 border-red-500/60" 
                      style={{
                        width: `${(settings.cropRight / imageSize.width) * 100}%`,
                        top: `${(settings.cropTop / imageSize.height) * 100}%`,
                        bottom: `${(settings.cropBottom / imageSize.height) * 100}%`
                      }}
                    />
                  )}

                  {/* Active Grid Area */}
                  <div
                    className="absolute border-2 border-indigo-400"
                    style={{
                      left: `${(settings.cropLeft / imageSize.width) * 100}%`,
                      right: `${(settings.cropRight / imageSize.width) * 100}%`,
                      top: `${(settings.cropTop / imageSize.height) * 100}%`,
                      bottom: `${(settings.cropBottom / imageSize.height) * 100}%`
                    }}
                  >
                    {/* Vertical lines */}
                    {Array.from({ length: cols - 1 }).map((_, i) => {
                      const leftPercent = ((i + 1) / cols) * 100;
                      return (
                        <div
                          key={`v-${i}`}
                          className="absolute top-0 bottom-0 border-l-2 border-dashed border-indigo-400"
                          style={{ left: `${leftPercent}%` }}
                        />
                      );
                    })}
                    {/* Horizontal lines */}
                    {Array.from({ length: rows - 1 }).map((_, i) => {
                      const topPercent = ((i + 1) / rows) * 100;
                      return (
                        <div
                          key={`h-${i}`}
                          className="absolute left-0 right-0 border-t-2 border-dashed border-indigo-400"
                          style={{ top: `${topPercent}%` }}
                        />
                      );
                    })}

                    {/* Grid cell indices labels */}
                    <div className="absolute inset-0 grid" style={{
                      gridTemplateColumns: `repeat(${cols}, 1fr)`,
                      gridTemplateRows: `repeat(${rows}, 1fr)`
                    }}>
                      {Array.from({ length: cols * rows }).map((_, i) => (
                        <div
                          key={`label-${i}`}
                          className="flex items-start justify-start p-1"
                        >
                          <span className="text-[8px] font-mono font-bold bg-black/85 text-indigo-400 px-1 py-0.5 rounded border border-white/5 scale-[0.85] transform origin-top-left">
                            {(i + 1).toString().padStart(2, "0")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-white/5 rounded-xl bg-[#1c1c1c]/30 h-48 flex flex-col items-center justify-center text-center p-4">
            <p className="text-sm text-gray-500">스프라이트 시트가 여기에 표시됩니다.</p>
            <p className="text-xs text-gray-600 mt-1">파일을 업로드하거나 하단 샘플을 선택하세요.</p>
          </div>
        )}
      </div>

      {/* Frame Slices & Selection */}
      <div className="bg-[#141414] rounded-2xl border border-white/5 p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-indigo-400" />
              프레임 세부 선택 및 관리
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              GIF 애니메이션에 포함할 프레임을 클릭해 선택하거나 제외하세요. (활성: {activeFramesCount}/{frames.length})
            </p>
          </div>

          {/* Slices actions */}
          <div className="flex gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onSelectAllFrames(true)}
              className="text-[10px] bg-white/5 hover:bg-white/10 text-gray-300 font-bold px-2 py-1.5 rounded-lg border border-white/15 transition-all"
            >
              전체 선택
            </button>
            <button
              type="button"
              onClick={() => onSelectAllFrames(false)}
              className="text-[10px] bg-white/5 hover:bg-white/10 text-gray-300 font-bold px-2 py-1.5 rounded-lg border border-white/15 transition-all"
            >
              선택 해제
            </button>
            <button
              type="button"
              onClick={onInvertFrames}
              className="text-[10px] bg-white/5 hover:bg-white/10 text-gray-300 font-bold px-2 py-1.5 rounded-lg border border-white/15 transition-all"
            >
              반전 선택
            </button>
          </div>
        </div>

        {frames.length > 0 ? (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
            {frames.map((frame, index) => (
              <div
                key={frame.id}
                onClick={() => onToggleFrame(frame.id)}
                className={`relative rounded-xl border p-1.5 transition-all cursor-pointer group flex flex-col gap-1.5 ${
                  frame.selected
                    ? "bg-indigo-600/10 border-indigo-500/40 shadow-md scale-[1.01]"
                    : "bg-[#181818] border-white/5 hover:border-white/10 opacity-40 hover:opacity-75"
                }`}
              >
                {/* Frame Preview Image */}
                <div className="aspect-square bg-[#0c0c0c] rounded-lg border border-white/5 flex items-center justify-center p-1 relative overflow-hidden checkerboard">
                  <img
                    src={frame.dataUrl}
                    alt={`Frame ${frame.id + 1}`}
                    className="max-h-full max-w-full object-contain filter"
                    style={{ imageRendering: "pixelated" }}
                    referrerPolicy="no-referrer"
                  />

                  {/* Absolute Selection Badge */}
                  <div className={`absolute top-1 right-1 w-4.5 h-4.5 rounded-full flex items-center justify-center border transition-all ${
                    frame.selected
                      ? "bg-indigo-600 border-indigo-400 text-white"
                      : "bg-black/50 border-white/20 text-transparent"
                  }`}>
                    <Check className="w-2.5 h-2.5 stroke-[3px]" />
                  </div>
                </div>

                {/* Info Text */}
                <div className="text-center">
                  <span className="text-[10px] font-mono font-bold text-gray-400 block group-hover:text-white transition-colors">
                    #{(index + 1).toString().padStart(2, "0")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-white/5 rounded-xl bg-[#1c1c1c]/30 h-28 flex items-center justify-center text-center">
            <p className="text-xs text-gray-500">스프라이트를 분할하여 프레임 목록이 여기에 나열됩니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
