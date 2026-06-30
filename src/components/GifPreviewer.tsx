import React, { useState, useEffect } from "react";
import { Play, Pause, Download, Settings, RefreshCw, Check, Sparkles, AlertCircle, Lock, Unlock, Type, Palette, MoveVertical, MoveHorizontal, Sliders } from "lucide-react";
import gifshot from "gifshot";
import { FrameInfo, GifSettings } from "../types";

interface GifPreviewerProps {
  frames: FrameInfo[];
  settings: GifSettings;
  onSettingsChange: (settings: GifSettings) => void;
  currentSpriteSheet: string | null;
}

// Custom scaling helper that respects the selected image smoothing setting and draws animated captions
function scaleImageWithSmoothing(
  dataUrl: string,
  targetWidth: number,
  targetHeight: number,
  imageSmoothing: boolean,
  captionText: string,
  captionColor: string,
  captionSize: number,
  captionYPercent: number,
  captionXPercent: number,
  captionEffect: "static" | "bounce" | "fade" | "pop",
  captionStroke: boolean,
  captionFont: string,
  frameIndex: number,
  totalFrames: number
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      // Configure image smoothing on the 2D context
      ctx.imageSmoothingEnabled = imageSmoothing;
      (ctx as any).mozImageSmoothingEnabled = imageSmoothing;
      (ctx as any).webkitImageSmoothingEnabled = imageSmoothing;
      (ctx as any).msImageSmoothingEnabled = imageSmoothing;

      if (imageSmoothing) {
        ctx.imageSmoothingQuality = "high";
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Draw caption text overlay if present
      if (captionText && captionText.trim() !== "") {
        ctx.save();

        let offsetY = 0;
        let scale = 1.0;
        let alpha = 1.0;

        if (totalFrames > 1) {
          const ratio = frameIndex / totalFrames;
          if (captionEffect === "bounce") {
            // Animating offset up/down
            offsetY = Math.sin(ratio * Math.PI * 2) * (targetHeight * 0.04);
          } else if (captionEffect === "fade") {
            // Dynamic transparency
            alpha = 0.4 + 0.6 * Math.sin(ratio * Math.PI);
          } else if (captionEffect === "pop") {
            // Elastic scaling
            scale = 0.9 + 0.2 * Math.sin(ratio * Math.PI * 2);
          }
        }

        ctx.globalAlpha = alpha;

        // Make caption size scale relative to compiled canvas height (normalized to base 256px)
        const computedFontSize = Math.max(8, Math.round(captionSize * (targetHeight / 256)));

        // Setup text styling
        ctx.font = `bold ${computedFontSize}px "${captionFont}", "Noto Sans KR", "Nanum Gothic", "Inter", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const x = targetWidth * (captionXPercent / 100);
        const y = (targetHeight * (captionYPercent / 100)) + offsetY;

        ctx.fillStyle = captionColor;
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(2, Math.round(computedFontSize * 0.15));
        ctx.lineJoin = "round";

        if (scale !== 1.0) {
          ctx.translate(x, y);
          ctx.scale(scale, scale);
          ctx.translate(-x, -y);
        }

        if (captionStroke) {
          ctx.strokeText(captionText, x, y);
        }
        ctx.fillText(captionText, x, y);

        ctx.restore();
      }

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      resolve(dataUrl);
    };
    img.src = dataUrl;
  });
}

export default function GifPreviewer({
  frames,
  settings,
  onSettingsChange,
  currentSpriteSheet,
}: GifPreviewerProps) {
  // Live player states
  const [isPlaying, setIsPlaying] = useState(true);
  const [playerIndex, setPlayerIndex] = useState(0);

  // GIF compile states
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileProgress, setCompileProgress] = useState("");
  const [generatedGif, setGeneratedGif] = useState<string | null>(null);
  const [gifSizeKB, setGifSizeKB] = useState<number | null>(null);
  const [gifDimensions, setGifDimensions] = useState({ w: 0, h: 0 });

  // Aspect ratio lock and original frame size trackers
  const [aspectRatioLocked, setAspectRatioLocked] = useState(true);
  const [scalePreset, setScalePreset] = useState<string>("custom");
  const [originalFrameSize, setOriginalFrameSize] = useState({ w: 0, h: 0 });

  // Get active selected frames
  const activeFrames = frames.filter((f) => f.selected);

  // Load and calculate the exact single frame dimension from original sheet and settings
  useEffect(() => {
    if (!currentSpriteSheet) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const croppedW = img.naturalWidth - settings.cropLeft - settings.cropRight;
      const croppedH = img.naturalHeight - settings.cropTop - settings.cropBottom;
      const singleW = Math.max(1, Math.floor(croppedW / settings.cols) - 2 * settings.frameShave);
      const singleH = Math.max(1, Math.floor(croppedH / settings.rows) - 2 * settings.frameShave);
      
      setOriginalFrameSize((prev) => {
        if (prev.w !== singleW || prev.h !== singleH) {
          // Default to upscaling the sliced frame to a high-quality preset (e.g., 4x or 8x scale)
          let scaleFactor = 4;
          if (singleW * scaleFactor < 256) {
            scaleFactor = 8; // Use 8x for tiny pixel art (e.g. 16px, 32px) to guarantee clear resolution
          }
          
          setScalePreset(String(scaleFactor));
          
          setTimeout(() => {
            onSettingsChange({
              ...settings,
              gifWidth: Math.round(singleW * scaleFactor),
              gifHeight: Math.round(singleH * scaleFactor),
            });
          }, 0);
          
          return { w: singleW, h: singleH };
        }
        return prev;
      });
    };
    img.src = currentSpriteSheet;
  }, [
    currentSpriteSheet,
    settings.cols,
    settings.rows,
    settings.cropLeft,
    settings.cropRight,
    settings.cropTop,
    settings.cropBottom,
    settings.frameShave,
  ]);

  // Keep aspect ratio locked in real time
  useEffect(() => {
    if (aspectRatioLocked && originalFrameSize.w > 0 && originalFrameSize.h > 0) {
      const ratio = originalFrameSize.h / originalFrameSize.w;
      const targetHeight = Math.max(1, Math.round(settings.gifWidth * ratio));
      if (targetHeight !== settings.gifHeight) {
        onSettingsChange({
          ...settings,
          gifHeight: targetHeight,
        });
      }
    }
  }, [originalFrameSize, aspectRatioLocked, settings.gifWidth]);

  // Live player cycle
  useEffect(() => {
    if (!isPlaying || activeFrames.length === 0) return;

    const intervalMs = Math.round(1000 / settings.fps);
    const timer = setInterval(() => {
      setPlayerIndex((prev) => {
        if (activeFrames.length <= 1) return 0;

        if (settings.playMode === "forward") {
          return (prev + 1) % activeFrames.length;
        } else if (settings.playMode === "reverse") {
          return prev <= 0 ? activeFrames.length - 1 : prev - 1;
        } else {
          // Ping-pong mode
          const bounceLength = (activeFrames.length - 1) * 2;
          if (bounceLength <= 0) return 0;
          const nextStep = (prev + 1) % bounceLength;
          return nextStep;
        }
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, activeFrames.length, settings.fps, settings.playMode]);

  // Adjust player index if active frames array size changes
  useEffect(() => {
    if (playerIndex >= activeFrames.length) {
      setPlayerIndex(0);
    }
  }, [activeFrames.length]);

  // Reset generated GIF if key state parameters change
  useEffect(() => {
    setGeneratedGif(null);
    setGifSizeKB(null);
  }, [
    activeFrames.map((f) => f.dataUrl).join(","),
    settings.fps,
    settings.loop,
    settings.gifWidth,
    settings.gifHeight,
    settings.playMode,
  ]);

  // Determine current frame to display in the preview canvas
  const displayFrameIndex = (() => {
    if (activeFrames.length === 0) return -1;
    if (settings.playMode === "pingpong" && activeFrames.length > 1) {
      const bounceLength = (activeFrames.length - 1) * 2;
      const step = playerIndex % bounceLength;
      return step >= activeFrames.length ? bounceLength - step : step;
    }
    return playerIndex % activeFrames.length;
  })();

  const activeDisplayFrame = activeFrames[displayFrameIndex];

  // Helper to calculate base64 data size in KB
  const calculateBase64SizeKB = (base64String: string): number => {
    const padding = (base64String.match(/=/g) || []).length;
    const sizeInBytes = (base64String.length * 3) / 4 - padding;
    return Math.round(sizeInBytes / 1024);
  };

  // Up/Down scaling size modifiers
  const handleWidthChange = (width: number) => {
    setScalePreset("custom");
    const updatedSettings = { ...settings, gifWidth: width };
    if (aspectRatioLocked && originalFrameSize.w > 0) {
      const ratio = originalFrameSize.h / originalFrameSize.w;
      updatedSettings.gifHeight = Math.max(1, Math.round(width * ratio));
    }
    onSettingsChange(updatedSettings);
  };

  const handleHeightChange = (height: number) => {
    setScalePreset("custom");
    const updatedSettings = { ...settings, gifHeight: height };
    if (aspectRatioLocked && originalFrameSize.h > 0) {
      const ratio = originalFrameSize.w / originalFrameSize.h;
      updatedSettings.gifWidth = Math.max(1, Math.round(height * ratio));
    }
    onSettingsChange(updatedSettings);
  };

  const handlePresetChange = (preset: string) => {
    setScalePreset(preset);
    if (preset === "custom" || originalFrameSize.w === 0 || originalFrameSize.h === 0) return;

    const scale = parseFloat(preset);
    if (isNaN(scale)) return;

    onSettingsChange({
      ...settings,
      gifWidth: Math.round(originalFrameSize.w * scale),
      gifHeight: Math.round(originalFrameSize.h * scale),
    });
  };

  // Generate animated GIF with high-quality scaling
  const handleCompileGif = () => {
    if (activeFrames.length === 0) return;

    setIsCompiling(true);
    setCompileProgress(
      settings.imageSmoothing 
        ? "이미지를 고해상도 표준 화질로 보간 가공하는 중..." 
        : "이미지를 깨짐 없는 픽셀 화질로 보정하는 중..."
    );

    // Collect frame URLs in the correct order based on playMode
    let compileFrames: string[] = activeFrames.map((f) => f.dataUrl);

    if (settings.playMode === "reverse") {
      compileFrames = [...compileFrames].reverse();
    } else if (settings.playMode === "pingpong" && compileFrames.length > 1) {
      const reverseSequence = [...compileFrames].slice(1, -1).reverse();
      compileFrames = [...compileFrames, ...reverseSequence];
    }

    const intervalSeconds = 1 / settings.fps;

    setTimeout(async () => {
      try {
        const targetW = settings.gifWidth || 256;
        const targetH = settings.gifHeight || 256;

        // Process frames synchronously or in parallel to guarantee custom smoothness/crispness and draw animated caption overlay
        const sharpFrames = await Promise.all(
          compileFrames.map((url, index) => 
            scaleImageWithSmoothing(
              url, 
              targetW, 
              targetH, 
              settings.imageSmoothing,
              settings.captionText,
              settings.captionColor,
              settings.captionSize,
              settings.captionYPercent,
              settings.captionXPercent,
              settings.captionEffect,
              settings.captionStroke,
              settings.captionFont,
              index,
              compileFrames.length
            )
          )
        );

        setCompileProgress("GIF 파일 생성 및 최적화 중...");

        gifshot.createGIF(
          {
            images: sharpFrames,
            interval: intervalSeconds,
            gifWidth: targetW,
            gifHeight: targetH,
            loopLimit: settings.loop ? 0 : 1, // 0 = infinite loop, 1 = play once
            numWorkers: 2,
            showProgressBar: false,
          },
          (result) => {
            if (!result.error) {
              setGeneratedGif(result.image);
              setGifSizeKB(calculateBase64SizeKB(result.image));
              setGifDimensions({ w: targetW, h: targetH });
              setIsCompiling(false);
            } else {
              console.error("GIF generation error:", result);
              alert("GIF 생성 도중 오류가 발생했습니다: " + result.errorMsg);
              setIsCompiling(false);
            }
          }
        );
      } catch (err: any) {
        console.error("Sharp scale error:", err);
        alert("이미지 보정 과정에서 문제가 생겼습니다: " + err.message);
        setIsCompiling(false);
      }
    }, 300);
  };

  // File Download Handler
  const handleDownloadGif = () => {
    if (!generatedGif) return;

    const link = document.createElement("a");
    link.href = generatedGif;
    link.download = `sprite-animation-${Date.now()}.gif`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateSetting = <K extends keyof GifSettings>(key: K, value: GifSettings[K]) => {
    onSettingsChange({
      ...settings,
      [key]: value,
    });
  };

  const liveCaptionStyle = (() => {
    let offsetY = 0;
    let scale = 1.0;
    let opacity = 1.0;
    
    if (activeFrames.length > 1 && displayFrameIndex >= 0) {
      const ratio = displayFrameIndex / activeFrames.length;
      if (settings.captionEffect === "bounce") {
        offsetY = Math.sin(ratio * Math.PI * 2) * 4; // 4% of container height (4cqh)
      } else if (settings.captionEffect === "fade") {
        opacity = 0.4 + 0.6 * Math.sin(ratio * Math.PI);
      } else if (settings.captionEffect === "pop") {
        scale = 0.9 + 0.2 * Math.sin(ratio * Math.PI * 2);
      }
    }
    
    const offsetYStr = settings.captionEffect === "bounce" ? `${offsetY}cqh` : "0px";
    
    return {
      color: settings.captionColor,
      fontSize: `calc((${settings.captionSize} / 256) * 100cqh)`,
      fontFamily: `"${settings.captionFont}", "Noto Sans KR", "Nanum Gothic", "Inter", sans-serif`,
      top: `${settings.captionYPercent}%`,
      left: `${settings.captionXPercent}%`,
      transform: `translate(-50%, -50%) translate3d(0, ${offsetYStr}, 0) scale(${scale})`,
      opacity: opacity,
      textShadow: settings.captionStroke 
        ? "0.08em 0.08em 0 #000, -0.08em -0.08em 0 #000, 0.08em -0.08em 0 #000, -0.08em 0.08em 0 #000, 0px 0.08em 0 #000, 0.08em 0px 0 #000, 0px -0.08em 0 #000, -0.08em 0px 0 #000"
        : "none",
    };
  })();

  return (
    <div className="space-y-6" id="gif-previewer-panel">
      {/* Real-time Web Player */}
      <div className="bg-[#141414] rounded-2xl border border-white/5 p-5 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Play className="w-4 h-4 text-indigo-400" />
          실시간 애니메이션 미리보기
        </h3>

        {/* Player Screen */}
        <div className="relative border border-white/10 rounded-xl bg-[#090909] aspect-square flex items-center justify-center p-6 checkerboard overflow-hidden">
          {activeDisplayFrame ? (
            <div
              style={{
                aspectRatio: `${settings.gifWidth} / ${settings.gifHeight}`,
                containerType: "both"
              }}
              className="relative max-h-full max-w-full flex items-center justify-center cursor-crosshair select-none"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;
                const xPercent = Math.min(100, Math.max(0, Math.round((clickX / rect.width) * 100)));
                const yPercent = Math.min(100, Math.max(0, Math.round((clickY / rect.height) * 100)));
                updateSetting("captionXPercent", xPercent);
                updateSetting("captionYPercent", yPercent);
              }}
              onTouchStart={(e) => {
                if (e.touches.length > 0) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const touch = e.touches[0];
                  const clickX = touch.clientX - rect.left;
                  const clickY = touch.clientY - rect.top;
                  const xPercent = Math.min(100, Math.max(0, Math.round((clickX / rect.width) * 100)));
                  const yPercent = Math.min(100, Math.max(0, Math.round((clickY / rect.height) * 100)));
                  updateSetting("captionXPercent", xPercent);
                  updateSetting("captionYPercent", yPercent);
                }
              }}
            >
              <img
                src={activeDisplayFrame.dataUrl}
                alt="Live frame animation preview"
                className="max-h-full max-w-full object-contain filter drop-shadow-lg pointer-events-none"
                style={{ imageRendering: !settings.imageSmoothing ? "pixelated" : "auto" }}
                referrerPolicy="no-referrer"
              />
              {settings.captionText && (
                <div
                  style={liveCaptionStyle}
                  className="absolute select-none font-bold text-center pointer-events-none transition-all duration-75 whitespace-nowrap z-10 font-sans"
                >
                  {settings.captionText}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-500/80 mx-auto" />
              <p className="text-xs">선택된 활성 프레임이 없습니다.</p>
              <p className="text-[10px] text-gray-600">프레임 관리 목록에서 하나 이상의 프레임을 선택하세요.</p>
            </div>
          )}

          {/* Absolute Player Status Badge */}
          {activeFrames.length > 0 && (
            <div className="absolute bottom-3 left-3 bg-black/85 border border-white/15 px-2 py-1 rounded-lg text-[9px] font-mono text-gray-300 flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
              <span>
                프레임: {((displayFrameIndex + 1) || 1).toString().padStart(2, "0")} / {activeFrames.length.toString().padStart(2, "0")}
              </span>
            </div>
          )}
        </div>

        {/* Player Controls */}
        {activeFrames.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 bg-white/5 p-2 rounded-xl border border-white/5">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className={`p-2.5 rounded-lg border transition-all ${
                  isPlaying
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20"
                    : "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500 shadow-md"
                }`}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              {/* Scrub Slider */}
              <input
                type="range"
                min="0"
                max={activeFrames.length - 1}
                value={displayFrameIndex}
                onChange={(e) => {
                  setIsPlaying(false);
                  setPlayerIndex(parseInt(e.target.value));
                }}
                className="flex-grow accent-indigo-500 h-1 bg-gray-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Micro playback options */}
            <div className="grid grid-cols-2 gap-4">
              {/* Play Mode */}
              <div className="space-y-1">
                <span className="text-[9px] text-gray-400 font-bold uppercase block">재생 방향</span>
                <select
                  value={settings.playMode}
                  onChange={(e) => updateSetting("playMode", e.target.value as any)}
                  className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="forward">정방향 (Forward)</option>
                  <option value="reverse">역방향 (Reverse)</option>
                  <option value="pingpong">왕복 (Ping-Pong)</option>
                </select>
              </div>

              {/* Play speed */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-gray-400 font-bold uppercase block">재생 속도</span>
                  <span className="text-[10px] text-indigo-400 font-mono font-bold">{settings.fps} FPS</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="60"
                  value={settings.fps}
                  onChange={(e) => updateSetting("fps", parseInt(e.target.value))}
                  className="w-full accent-indigo-500 h-1 bg-gray-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 💬 이모티콘 자막 추가 (Caption Controls) */}
      <div className="bg-[#141414] rounded-2xl border border-white/5 p-5 space-y-5 shadow-xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Type className="w-4 h-4 text-indigo-400" />
          💬 이모티콘 자막 추가 (Add Caption)
        </h3>

        {/* Text Input */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">자막 텍스트 입력</label>
          <input
            type="text"
            value={settings.captionText}
            onChange={(e) => updateSetting("captionText", e.target.value)}
            placeholder="예: 축하해!, 화이팅!, 웅? (입력 시 실시간 반영)"
            maxLength={40}
            className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>

        {settings.captionText && (
          <div className="text-[11px] text-indigo-300 font-medium bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-2.5 rounded-xl flex items-center gap-2 animate-fadeIn">
            <Sparkles className="w-4 h-4 shrink-0 text-indigo-400" />
            <span>💡 <strong>실시간 미리보기 화면을 클릭/터치</strong>하면 자막이 그 위치로 즉시 이동합니다!</span>
          </div>
        )}

        {settings.captionText && (
          <div className="space-y-4 animate-fadeIn">
            {/* Color Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-indigo-400" />
                글씨 색상 선택
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { hex: "#ffffff", label: "화이트" },
                  { hex: "#ffeb3b", label: "옐로우" },
                  { hex: "#ff4081", label: "핑크" },
                  { hex: "#00e5ff", label: "민트" },
                  { hex: "#76ff03", label: "라임" },
                  { hex: "#ff3d00", label: "오렌지" },
                  { hex: "#111111", label: "블랙" },
                ].map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => updateSetting("captionColor", color.hex)}
                    style={{ backgroundColor: color.hex }}
                    title={color.label}
                    className={`w-7 h-7 rounded-full border-2 transition-all relative cursor-pointer ${
                      settings.captionColor === color.hex
                        ? "border-indigo-500 scale-110 shadow-lg ring-1 ring-white/20"
                        : "border-white/10 hover:scale-105"
                    }`}
                  >
                    {settings.captionColor === color.hex && (
                      <Check className={`w-3.5 h-3.5 absolute inset-0 m-auto ${color.hex === "#ffffff" || color.hex === "#ffeb3b" || color.hex === "#00e5ff" || color.hex === "#76ff03" ? "text-black" : "text-white"} stroke-[3px]`} />
                    )}
                  </button>
                ))}
                
                {/* Custom Color Input */}
                <div className="relative flex items-center gap-1.5 bg-white/5 pl-2.5 pr-1.5 py-1 rounded-xl border border-white/10 ml-auto">
                  <span className="text-[10px] text-gray-400 font-mono font-bold">{settings.captionColor.toUpperCase()}</span>
                  <input
                    type="color"
                    value={settings.captionColor}
                    onChange={(e) => updateSetting("captionColor", e.target.value)}
                    className="w-6 h-6 rounded-md bg-transparent border-0 cursor-pointer overflow-hidden p-0"
                  />
                </div>
              </div>
            </div>

            {/* Font Family Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-indigo-400" />
                원하는 글씨체(폰트) 선택
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "Noto Sans KR", name: "본고딕 (기본)" },
                  { id: "Nanum Gothic", name: "나눔고딕 (강조)" },
                  { id: "Nanum Myeongjo", name: "나눔명조 (세리프)" },
                  { id: "Jua", name: "둥근 주아체 (귀여움)" },
                  { id: "Black Han Sans", name: "검은고딕 (울트라볼드)" },
                  { id: "Gamja Flower", name: "감자꽃체 (손글씨)" },
                  { id: "Single Day", name: "싱글데이체 (손글씨)" },
                  { id: "Diphylleia", name: "디필리아 (레트로)" },
                ].map((font) => (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => updateSetting("captionFont", font.id)}
                    style={{ fontFamily: font.id }}
                    className={`px-3 py-2 rounded-xl text-left border text-xs transition-all cursor-pointer truncate ${
                      settings.captionFont === font.id
                        ? "bg-indigo-600/15 border-indigo-500/80 text-white shadow-md shadow-indigo-600/5 ring-1 ring-indigo-500/10"
                        : "bg-white/5 border-white/5 text-gray-300 hover:bg-white/10 hover:border-white/10"
                    }`}
                  >
                    <span className="block text-[11px] font-bold">{font.name}</span>
                    <span className="block text-[10px] opacity-60 mt-0.5">가나다라마바사 abc</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Font size and Stroke toggle */}
            <div className="grid grid-cols-3 gap-3">
              {/* Font Size */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">글씨 크기</label>
                  <span className="text-[10px] text-indigo-400 font-bold font-mono bg-indigo-500/15 px-1.5 py-0.5 rounded">{settings.captionSize} px</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="64"
                  value={settings.captionSize}
                  onChange={(e) => updateSetting("captionSize", parseInt(e.target.value))}
                  className="w-full accent-indigo-500 h-1 bg-gray-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Text Position X */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block flex items-center gap-1">
                    <MoveHorizontal className="w-3.5 h-3.5" />
                    좌우 위치
                  </label>
                  <span className="text-[10px] text-indigo-400 font-bold font-mono bg-indigo-500/15 px-1.5 py-0.5 rounded">{settings.captionXPercent}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="95"
                  value={settings.captionXPercent}
                  onChange={(e) => updateSetting("captionXPercent", parseInt(e.target.value))}
                  className="w-full accent-indigo-500 h-1 bg-gray-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Text Position Y */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block flex items-center gap-1">
                    <MoveVertical className="w-3.5 h-3.5" />
                    상하 위치
                  </label>
                  <span className="text-[10px] text-indigo-400 font-bold font-mono bg-indigo-500/15 px-1.5 py-0.5 rounded">{settings.captionYPercent}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="95"
                  value={settings.captionYPercent}
                  onChange={(e) => updateSetting("captionYPercent", parseInt(e.target.value))}
                  className="w-full accent-indigo-500 h-1 bg-gray-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              {/* Caption Animation Effect */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">자막 애니메이션 효과</label>
                <select
                  value={settings.captionEffect}
                  onChange={(e) => updateSetting("captionEffect", e.target.value as any)}
                  className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  <option value="static">고정 (Static)</option>
                  <option value="bounce">위아래 바운스 (Bounce)</option>
                  <option value="fade">부드러운 페이드 (Fade)</option>
                  <option value="pop">통통 튀는 팝 (Pop)</option>
                </select>
              </div>

              {/* Black Outline Stroke Toggle */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">외곽선 테두리 적용</label>
                <div className="flex items-center justify-between bg-white/5 px-3 py-2 rounded-xl border border-white/5 h-[34px]">
                  <span className="text-[10px] text-gray-300 font-bold">검은색 외곽선</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.captionStroke}
                      onChange={(e) => updateSetting("captionStroke", e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-3.5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>
            </div>

            <p className="text-[9px] text-gray-500 leading-snug">
              💡 <b>자막 효과</b>는 애니메이션 프레임 재생 주기에 맞추어 자연스럽게 움직이거나 깜빡이도록 보정됩니다. GIF 저장 시 고화질로 텍스트가 렌더링됩니다.
            </p>
          </div>
        )}
      </div>

      {/* GIF Export Settings & Compiler */}
      <div className="bg-[#141414] rounded-2xl border border-white/5 p-5 space-y-4 shadow-xl">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-400" />
            내보내기 크기 & 품질 설정
          </h3>
          {originalFrameSize.w > 0 && (
            <span className="text-[9px] font-mono font-bold bg-white/5 text-gray-400 border border-white/5 px-1.5 py-0.5 rounded">
              원본: {originalFrameSize.w}×{originalFrameSize.h}px
            </span>
          )}
        </div>

        {/* Scale Preset Selector */}
        <div className="space-y-1.5">
          <label className="text-[9px] text-gray-400 font-bold uppercase block">해상도 비율 프리셋 (Ratio Preset)</label>
          <select
            value={scalePreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
          >
            <option value="1">100% (원본 1x 배율 - {originalFrameSize.w} × {originalFrameSize.h})</option>
            <option value="2">200% (고화질 2x 배율 - {originalFrameSize.w * 2} × {originalFrameSize.h * 2})</option>
            <option value="4">400% (벡터형 4x 배율 - {originalFrameSize.w * 4} × {originalFrameSize.h * 4})</option>
            <option value="8">800% (초선명 8x 배율 - {originalFrameSize.w * 8} × {originalFrameSize.h * 8})</option>
            <option value="16">1600% (극대 16x 배율 - {originalFrameSize.w * 16} × {originalFrameSize.h * 16})</option>
            <option value="custom">사용자 지정 해상도 (Custom px)</option>
          </select>
        </div>

        {/* Resolution Width / Height inputs */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Export Width */}
            <div className="space-y-1">
              <label className="text-[9px] text-gray-400 font-bold uppercase block">가로 해상도 (Width)</label>
              <div className="relative">
                <input
                  type="number"
                  min="8"
                  max="2048"
                  value={settings.gifWidth}
                  onChange={(e) => handleWidthChange(Math.max(8, parseInt(e.target.value) || 8))}
                  className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg py-1.5 px-3 text-xs text-white text-center font-bold focus:outline-none focus:border-indigo-500"
                />
                <span className="absolute right-2.5 top-2 text-[8px] font-bold text-gray-500 font-mono">PX</span>
              </div>
            </div>

            {/* Export Height */}
            <div className="space-y-1">
              <label className="text-[9px] text-gray-400 font-bold uppercase block">세로 해상도 (Height)</label>
              <div className="relative">
                <input
                  type="number"
                  min="8"
                  max="2048"
                  value={settings.gifHeight}
                  disabled={aspectRatioLocked}
                  onChange={(e) => handleHeightChange(Math.max(8, parseInt(e.target.value) || 8))}
                  className={`w-full border rounded-lg py-1.5 px-3 text-xs text-center font-bold focus:outline-none ${
                    aspectRatioLocked
                      ? "bg-[#141414] border-white/5 text-indigo-400 cursor-not-allowed"
                      : "bg-[#1e1e1e] border-white/10 text-white focus:border-indigo-500"
                  }`}
                />
                <span className="absolute right-2.5 top-2 text-[8px] font-bold text-gray-500 font-mono">PX</span>
              </div>
            </div>
          </div>

          {/* Aspect ratio lock switch */}
          <div className="flex items-center justify-between bg-white/5 p-2 rounded-xl border border-white/5">
            <span className="text-[10px] text-gray-300 font-bold flex items-center gap-1.5">
              {aspectRatioLocked ? <Lock className="w-3.5 h-3.5 text-indigo-400" /> : <Unlock className="w-3.5 h-3.5 text-gray-500" />}
              <span>원본 가로세로 비율 고정 (Keep Proportions)</span>
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={aspectRatioLocked}
                onChange={(e) => setAspectRatioLocked(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4.5 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-3.5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Image Smoothing / Vector option toggle */}
          <div className="flex items-center justify-between bg-white/5 p-2.5 rounded-xl border border-white/5">
            <span className="text-[10px] text-gray-300 font-bold flex flex-col">
              <span>부드러운 이미지 보간 (Image Smoothing)</span>
              <span className="text-[9px] text-gray-500 font-normal mt-0.5">비활성화 시 각진 픽셀/벡터 화질로 출력됩니다.</span>
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.imageSmoothing}
                onChange={(e) => updateSetting("imageSmoothing", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4.5 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-3.5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>

        {/* Dynamic scaling explanation badge */}
        <div className={`rounded-xl p-2.5 flex items-center gap-2 text-[10px] ${
          settings.imageSmoothing 
            ? "bg-blue-500/10 border border-blue-500/20 text-blue-400" 
            : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
        }`}>
          <Sparkles className="w-3.5 h-3.5 shrink-0 animate-pulse" />
          <span>
            {settings.imageSmoothing 
              ? "부드러운 표준 화질 보간(Bilinear Filtering)이 적용되어 이미지가 부드럽고 자연스럽게 렌더링됩니다."
              : "초선명 픽셀/벡터식 보정(Nearest-Neighbor)이 적용되어 확대해도 흐려지지 않고 각진 픽셀 형태로 렌더링됩니다."}
          </span>
        </div>

        {/* Loop setting */}
        <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
          <div>
            <span className="text-xs font-semibold text-white block">무한 루프 적용 (Loop Forever)</span>
            <span className="text-[10px] text-gray-500">체크 해제 시 한 번만 재생됩니다.</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.loop}
              onChange={(e) => updateSetting("loop", e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {/* Compile button */}
        {activeFrames.length > 0 && (
          <div className="space-y-3">
            {!generatedGif ? (
              <button
                type="button"
                onClick={handleCompileGif}
                disabled={isCompiling}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-xs cursor-pointer select-none active:scale-[0.99]"
              >
                {isCompiling ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white/80" />
                    <span>{compileProgress}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>GIF 파일 생성하기 (Compile GIF)</span>
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-3 p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20 animate-fadeIn">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                      <Check className="w-4 h-4 stroke-[3px]" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">GIF 생성 완료!</span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {gifDimensions.w}x{gifDimensions.h}px | {gifSizeKB} KB | {compileFramesCount()}프레임
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCompileGif}
                    className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> 다시 생성
                  </button>
                </div>

                {/* Download Button */}
                <button
                  type="button"
                  onClick={handleDownloadGif}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 text-xs cursor-pointer select-none"
                >
                  <Download className="w-4 h-4" />
                  <span>GIF 애니메이션 다운로드</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  function compileFramesCount() {
    let baseCount = activeFrames.length;
    if (settings.playMode === "pingpong" && baseCount > 1) {
      return baseCount + (baseCount - 2);
    }
    return baseCount;
  }
}
