import React, { useRef, useState } from "react";
import { Upload, HelpCircle, Sparkles, Sliders, Play, RotateCcw, Crop, Move } from "lucide-react";
import { samples } from "../utils/samples";
import { SpriteSheetSample, GifSettings } from "../types";

interface SpriteSheetSelectorProps {
  settings: GifSettings;
  onSettingsChange: (settings: GifSettings) => void;
  onImageLoaded: (dataUrl: string, file?: File) => void;
  currentImage: string | null;
  isAnimatedGifSource?: boolean;
}

export default function SpriteSheetSelector({
  settings,
  onSettingsChange,
  onImageLoaded,
  currentImage,
  isAnimatedGifSource = false,
}: SpriteSheetSelectorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === "string") {
        onImageLoaded(event.target.result, file);
      }
    };
    reader.readAsDataURL(file);
  };

  const selectSample = (sample: SpriteSheetSample) => {
    onImageLoaded(sample.imageUrl);
    onSettingsChange({
      ...settings,
      cols: sample.cols,
      rows: sample.rows,
      fps: sample.fps,
    });
  };

  const updateSetting = <K extends keyof GifSettings>(key: K, value: GifSettings[K]) => {
    onSettingsChange({
      ...settings,
      [key]: value,
    });
  };

  const handleAutoDetectBackground = () => {
    if (!currentImage) return;
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      
      // Sample the corners of the sheet to detect the background color
      const points = [
        [2, 2],
        [img.naturalWidth - 3, 2],
        [2, img.naturalHeight - 3],
        [img.naturalWidth - 3, img.naturalHeight - 3]
      ];
      
      const colors: { [key: string]: number } = {};
      
      points.forEach(([x, y]) => {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const r = pixel[0];
        const g = pixel[1];
        const b = pixel[2];
        const a = pixel[3];
        
        // Skip transparent points
        if (a < 50) return;
        
        const toHex = (c: number) => {
          const hex = c.toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        };
        const hex = "#" + toHex(r) + toHex(g) + toHex(b);
        colors[hex] = (colors[hex] || 0) + 1;
      });
      
      // Find the most frequent color, defaulting to white
      let detectedColor = "#ffffff";
      let maxCount = 0;
      
      Object.keys(colors).forEach((hex) => {
        if (colors[hex] > maxCount) {
          maxCount = colors[hex];
          detectedColor = hex;
        }
      });
      
      onSettingsChange({
        ...settings,
        transparencyEnabled: true,
        transparentColor: detectedColor,
        transparencyTolerance: 15
      });
      
      alert(`스프라이트 시트 배경색(${detectedColor})을 성공적으로 감지했습니다! 이제 배경이 깔끔하게 지워져 카톡의 흰둥이 토끼 이모티콘처럼 투명한 배경의 움짤로 다운로드할 수 있습니다.`);
    };
    img.src = currentImage;
  };

  return (
    <div className="space-y-6" id="spritesheet-selector-panel">
      {/* 1. Sprite Sheet Upload / Sample Selection */}
      <div className="bg-[#141414] rounded-2xl border border-white/5 p-5 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Upload className="w-4 h-4 text-indigo-400" />
          스프라이트 시트 입력
        </h3>

        {/* Upload Box */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-indigo-500 bg-indigo-500/10 scale-[1.01]"
              : "border-white/10 hover:border-white/25 bg-[#181818] hover:bg-[#1e1e1e]"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="w-10 h-10 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-3">
            <Upload className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-white">클릭하거나 이미지/GIF 파일을 여기로 드래그하세요</p>
          <p className="text-[10px] text-gray-500 mt-1">PNG, JPG, WEBP, GIF (정적 시트 격자 및 움직이는 움짤 모두 지원)</p>
        </div>

        {/* Dynamic Samples selection */}
        <div className="space-y-2">
          <p className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">샘플 6x6 스프라이트 시트 선택</p>
          <div className="grid grid-cols-3 gap-2">
            {samples.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => selectSample(sample)}
                className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all ${
                  currentImage === sample.imageUrl
                    ? "bg-indigo-600/15 border-indigo-500/40"
                    : "bg-[#181818] border-white/5 hover:border-white/10 hover:bg-[#1e1e1e]"
                }`}
              >
                <div className="w-full aspect-square bg-[#0f0f0f] rounded-lg border border-white/5 flex items-center justify-center p-1 overflow-hidden relative group">
                  <img
                    src={sample.imageUrl}
                    alt={sample.name}
                    className="max-h-full max-w-full object-contain filter drop-shadow"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                  </div>
                </div>
                <span className="text-[10px] text-gray-300 font-bold mt-1.5 truncate w-full">
                  {sample.name.split(" ")[0]}
                </span>
                <span className="text-[8px] text-gray-500 font-mono block">
                  {sample.cols}x{sample.rows} ({sample.cols * sample.rows}장)
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Slicing Grid Configuration */}
      <div className="bg-[#141414] rounded-2xl border border-white/5 p-5 space-y-4 shadow-xl relative overflow-hidden">
        {isAnimatedGifSource && (
          <div className="absolute inset-0 bg-[#0d0d0d]/90 backdrop-blur-md z-20 flex flex-col items-center justify-center p-4 text-center animate-fade-in">
            <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse mb-1.5" />
            <p className="text-xs font-bold text-white">움짤 GIF 분석 활성화됨</p>
            <p className="text-[9px] text-gray-400 mt-1 max-w-[220px] leading-relaxed">
              업로드한 GIF에서 모든 프레임이 자동으로 추출되었습니다. 격자(Grid) 설정 없이 그대로 배경 제거 및 필터를 적용할 수 있습니다.
            </p>
          </div>
        )}
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-400" />
          격자 및 슬라이싱 옵션
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-400 font-bold tracking-wider uppercase block">가로 열 (Columns)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="30"
                value={settings.cols}
                onChange={(e) => updateSetting("cols", Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-xs text-white text-center focus:outline-none focus:border-indigo-500 font-bold"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-400 font-bold tracking-wider uppercase block">세로 행 (Rows)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="30"
                value={settings.rows}
                onChange={(e) => updateSetting("rows", Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-xs text-white text-center focus:outline-none focus:border-indigo-500 font-bold"
              />
            </div>
          </div>
        </div>

        <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-center justify-between text-xs text-gray-300">
          <span>총 분할 프레임 수:</span>
          <span className="font-mono text-indigo-400 font-bold bg-indigo-500/15 px-2 py-0.5 rounded-full">
            {settings.cols * settings.rows} 프레임
          </span>
        </div>
      </div>

      {/* 2.5. Sprite Sheet & Frame Crop (제단 및 여백 자르기) */}
      <div className="bg-[#141414] rounded-2xl border border-white/5 p-5 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Crop className="w-4 h-4 text-indigo-400" />
          시트 주변 제단 (Crop / Trim)
        </h3>

        {/* Outer margin cropping */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">시트 외곽 여백 자르기 (Sheet Margins)</span>
            <button
              type="button"
              onClick={() => {
                onSettingsChange({
                  ...settings,
                  cropLeft: 0,
                  cropRight: 0,
                  cropTop: 0,
                  cropBottom: 0,
                });
              }}
              className="text-[9px] text-indigo-400 hover:underline font-semibold"
            >
              여백 초기화
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] text-gray-500 font-bold uppercase block">위쪽 제단 (Top px)</label>
              <input
                type="number"
                min="0"
                max="500"
                value={settings.cropTop}
                onChange={(e) => updateSetting("cropTop", Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg py-1.5 px-2 text-xs text-white text-center focus:outline-none focus:border-indigo-500 font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-gray-500 font-bold uppercase block">아래쪽 제단 (Bottom px)</label>
              <input
                type="number"
                min="0"
                max="500"
                value={settings.cropBottom}
                onChange={(e) => updateSetting("cropBottom", Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg py-1.5 px-2 text-xs text-white text-center focus:outline-none focus:border-indigo-500 font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-gray-500 font-bold uppercase block">왼쪽 제단 (Left px)</label>
              <input
                type="number"
                min="0"
                max="500"
                value={settings.cropLeft}
                onChange={(e) => updateSetting("cropLeft", Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg py-1.5 px-2 text-xs text-white text-center focus:outline-none focus:border-indigo-500 font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-gray-500 font-bold uppercase block">오른쪽 제단 (Right px)</label>
              <input
                type="number"
                min="0"
                max="500"
                value={settings.cropRight}
                onChange={(e) => updateSetting("cropRight", Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg py-1.5 px-2 text-xs text-white text-center focus:outline-none focus:border-indigo-500 font-bold"
              />
            </div>
          </div>
        </div>

        {/* Frame level shaving */}
        <div className="space-y-2 pt-3 border-t border-white/5">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">개별 프레임 테두리 제단 (Frame Shave)</label>
            <span className="text-[10px] text-indigo-400 font-mono font-bold">{settings.frameShave} px</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.frameShave}
            onChange={(e) => updateSetting("frameShave", parseInt(e.target.value) || 0)}
            className="w-full accent-indigo-500 h-1 bg-gray-800 rounded-lg cursor-pointer"
          />
          <span className="text-[9px] text-gray-500 block leading-tight">
            💡 격자 분할된 개별 프레임의 사방 테두리를 동일한 두께만큼 잘라내어 불필요한 마진이나 검은 실선을 깨끗하게 정리합니다.
          </span>
        </div>
      </div>

      {/* 3. Transparency & Color Keying */}
      <div className="bg-[#141414] rounded-2xl border border-white/5 p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            배경 투명화 (크로마키)
          </h3>
          <div className="flex items-center gap-2">
            {currentImage && (
              <button
                type="button"
                onClick={handleAutoDetectBackground}
                className="text-[10px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-md transition-all active:scale-95 cursor-pointer flex items-center gap-1 font-bold"
              >
                <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" />
                카톡 투명화 자동 설정
              </button>
            )}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.transparencyEnabled}
                onChange={(e) => updateSetting("transparencyEnabled", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>

        {settings.transparencyEnabled && (
          <div className="space-y-4 pt-2 border-t border-white/5 animate-fadeIn">
            <div className="grid grid-cols-12 gap-3 items-center">
              <div className="col-span-5 space-y-1">
                <label className="text-[9px] text-gray-400 font-bold uppercase block">투명화할 색상</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.transparentColor}
                    onChange={(e) => updateSetting("transparentColor", e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-white/10 overflow-hidden"
                  />
                  <input
                    type="text"
                    value={settings.transparentColor}
                    onChange={(e) => updateSetting("transparentColor", e.target.value)}
                    className="w-20 bg-[#1e1e1e] border border-white/10 rounded-lg py-1 px-2 text-[11px] text-white font-mono uppercase focus:outline-none"
                  />
                </div>
              </div>

              <div className="col-span-7 space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] text-gray-400 font-bold uppercase block">색상 오차 범위 (Tolerance)</label>
                  <span className="text-[10px] text-indigo-400 font-mono font-bold">{settings.transparencyTolerance}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="80"
                  value={settings.transparencyTolerance}
                  onChange={(e) => updateSetting("transparencyTolerance", parseInt(e.target.value))}
                  className="w-full accent-indigo-500 h-1 bg-gray-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-between bg-white/5 p-2.5 rounded-xl border border-white/5">
              <div className="space-y-0.5">
                <span className="text-[10px] text-gray-300 font-bold block">외곽 배경만 제거 (인물 보호)</span>
                <span className="text-[9px] text-gray-500 block leading-normal">
                  외곽 테두리 영역만 투명화하여 캐릭터 내부의 흰색/동일 색상 영역이 투명해지는 것을 방지합니다.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={settings.transparencyFloodFill}
                  onChange={(e) => updateSetting("transparencyFloodFill", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4.5 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-3.5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="text-[10px] text-gray-400 bg-white/5 p-2.5 rounded-lg leading-relaxed border border-white/5">
              💡 투명 알파 채널이 없는 단색 배경(예: 흰색, 검은색, 녹색 등) 스프라이트 시트의 해당 배경 색상을 완벽하게 제거하여 정밀하게 애니메이션을 합성합니다.
            </div>
          </div>
        )}
      </div>

      {/* 4. 이모티콘 선 굵기 보정 (Line Boldness & Thickness) */}
      <div className="bg-[#141414] rounded-2xl border border-white/5 p-5 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-400" />
          이모티콘 선 굵기 보정 (Line Boldness)
        </h3>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">이모티콘 외곽선/그림 굵기</label>
            <span className="text-xs text-indigo-400 font-mono font-bold bg-indigo-500/15 px-2 py-0.5 rounded-full">
              {settings.lineBoldness === 0 ? "보정 없음 (원본)" : `+${settings.lineBoldness} px 굵게`}
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="5"
            step="1"
            value={settings.lineBoldness}
            onChange={(e) => updateSetting("lineBoldness", parseInt(e.target.value) || 0)}
            className="w-full accent-indigo-500 h-1 bg-gray-800 rounded-lg cursor-pointer"
          />

          <span className="text-[9px] text-gray-500 block leading-tight">
            💡 투명화 과정에서 이모티콘의 어두운 테두리선이 깨지거나 얇아질 때, 선을 더 두껍게 메우고 외곽선을 매끄럽게 복원하여 깨끗하고 선명한 라인을 만들어줍니다.
          </span>
        </div>
      </div>

      {/* 5. 캐릭터 흔들림 보정 (Center Stabilization) */}
      <div className="bg-[#141414] rounded-2xl border border-white/5 p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Move className="w-4 h-4 text-indigo-400" />
            중앙 흔들림 보정 (Stabilization)
          </h3>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.stabilizeFrames || false}
              onChange={(e) => updateSetting("stabilizeFrames", e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] text-gray-400 leading-relaxed">
            프레임마다 캐릭터가 미세하게 위아래, 좌우로 흔들려 재생될 때, 캐릭터의 시각적 무게중심(Centroid)을 프레임의 정중앙에 자동으로 정렬해 줍니다.
          </p>
          <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg p-2 text-[9px] leading-snug">
            ✔️ 투명 배경 캐릭터에서 가장 잘 작동합니다. 재생 시 캐릭터가 덜덜 흔들리는 슬라이스 오차 현상을 완벽하게 보정합니다.
          </div>
        </div>
      </div>
    </div>
  );
}
