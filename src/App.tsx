import React, { useState, useEffect } from "react";
import { Sparkles, RefreshCw, Layers, Settings, HelpCircle, FileImage, Trash2 } from "lucide-react";
import SpriteSheetSelector from "./components/SpriteSheetSelector";
import SpriteSlicerGrid from "./components/SpriteSlicerGrid";
import GifPreviewer from "./components/GifPreviewer";
import { FrameInfo, GifSettings } from "./types";
import { sliceSpriteSheet, applyTransparency, adjustLineBoldness, stabilizeFrameCenter, extractGifFrames } from "./utils/imageUtils";
import { sampleCoin } from "./utils/samples";

export default function App() {
  // 1. Initial configuration settings
  const [settings, setSettings] = useState<GifSettings>({
    cols: 6,
    rows: 6,
    fps: 20,
    playMode: "forward",
    gifWidth: 256,
    gifHeight: 256,
    loop: true,
    transparencyEnabled: false,
    transparencyFloodFill: false,
    transparentColor: "#000000",
    transparencyTolerance: 15,
    cropLeft: 0,
    cropRight: 0,
    cropTop: 0,
    cropBottom: 0,
    frameShave: 0,
    lineBoldness: 0,
    imageSmoothing: true,
    stabilizeFrames: false,
    captionText: "",
    captionColor: "#ffffff",
    captionSize: 28,
    captionYPercent: 80,
    captionXPercent: 50,
    captionEffect: "static",
    captionStroke: true,
    captionFont: "Noto Sans KR",
  });

  // 2. Active Sprite Sheet Image (Default to rotating gold coin sample)
  const [currentSpriteSheet, setCurrentSpriteSheet] = useState<string | null>(sampleCoin);

  // 2.5. Animated GIF Source tracking
  const [isAnimatedGifSource, setIsAnimatedGifSource] = useState(false);
  const [extractedGifFrames, setExtractedGifFrames] = useState<{ dataUrl: string; delay: number }[]>([]);

  // 3. Sliced/Decoded Frames list
  const [frames, setFrames] = useState<FrameInfo[]>([]);
  const [isSlicing, setIsSlicing] = useState(false);
  const [sliceError, setSliceError] = useState<string | null>(null);

  // File loading handler supporting both static images and animated GIFs
  const handleImageLoaded = async (dataUrl: string, file?: File) => {
    if (file && (file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif"))) {
      try {
        setIsSlicing(true);
        setSliceError(null);
        
        const arrayBuffer = await file.arrayBuffer();
        const decodedFrames = await extractGifFrames(arrayBuffer);
        
        if (decodedFrames.length > 1) {
          setIsAnimatedGifSource(true);
          setExtractedGifFrames(decodedFrames);
          setCurrentSpriteSheet(dataUrl);
          
          // Match play delay of the GIF automatically
          const firstDelay = decodedFrames[0].delay;
          const calculatedFps = firstDelay > 0 ? Math.round(1000 / firstDelay) : 10;
          setSettings((prev) => ({
            ...prev,
            fps: calculatedFps,
          }));
          return;
        }
      } catch (err: any) {
        console.warn("Decoding as animated GIF failed, fallback to spritesheet mode:", err);
      }
    }
    
    // Normal non-animated image or fallback
    setIsAnimatedGifSource(false);
    setExtractedGifFrames([]);
    setCurrentSpriteSheet(dataUrl);
  };

  // 4. Reactive Slicing / Frame Processing Effect
  useEffect(() => {
    if (!currentSpriteSheet) {
      setFrames([]);
      return;
    }

    let isCancelled = false;
    setIsSlicing(true);
    setSliceError(null);

    const runPipeline = async (baseFrames: FrameInfo[]) => {
      // Apply processing pipeline (Chroma-key transparency + Centering stabilization + Line Boldness adjustment)
      const processedFrames = await Promise.all(
        baseFrames.map(async (f) => {
          let activeUrl = f.originalDataUrl;

          // 1. Transparency keying
          if (settings.transparencyEnabled) {
            activeUrl = await applyTransparency(
              activeUrl,
              settings.transparentColor,
              settings.transparencyTolerance,
              settings.transparencyFloodFill
            );
          }

          // 2. Character Center/Shaking Stabilization
          if (settings.stabilizeFrames) {
            activeUrl = await stabilizeFrameCenter(activeUrl);
          }

          // 3. Line Boldness / Thickening adjustment
          if (settings.lineBoldness > 0) {
            activeUrl = await adjustLineBoldness(
              activeUrl,
              settings.lineBoldness
            );
          }

          return { ...f, dataUrl: activeUrl };
        })
      );

      if (!isCancelled) {
        setFrames(processedFrames);
        setIsSlicing(false);
      }
    };

    if (isAnimatedGifSource && extractedGifFrames.length > 0) {
      const baseFrames: FrameInfo[] = extractedGifFrames.map((f, index) => ({
        id: index,
        dataUrl: f.dataUrl,
        originalDataUrl: f.dataUrl,
        selected: true,
      }));
      runPipeline(baseFrames);
    } else {
      // High performance slicing
      sliceSpriteSheet(
        currentSpriteSheet,
        settings.cols,
        settings.rows,
        settings.cropLeft,
        settings.cropRight,
        settings.cropTop,
        settings.cropBottom,
        settings.frameShave
      )
        .then(async (slicedUrls) => {
          if (isCancelled) return;

          const baseFrames: FrameInfo[] = slicedUrls.map((url, index) => ({
            id: index,
            dataUrl: url,
            originalDataUrl: url,
            selected: true,
          }));

          await runPipeline(baseFrames);
        })
        .catch((err) => {
          if (!isCancelled) {
            console.error("Spritesheet processing error:", err);
            setSliceError(err.message || "스프라이트 시트 분석 도중 오류가 발생했습니다. 격자 수를 변경해 보거나 올바른 이미지 파일인지 확인하세요.");
            setFrames([]);
            setIsSlicing(false);
          }
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [
    currentSpriteSheet,
    isAnimatedGifSource,
    extractedGifFrames,
    settings.cols,
    settings.rows,
    settings.transparencyEnabled,
    settings.transparencyFloodFill,
    settings.transparentColor,
    settings.transparencyTolerance,
    settings.cropLeft,
    settings.cropRight,
    settings.cropTop,
    settings.cropBottom,
    settings.frameShave,
    settings.lineBoldness,
    settings.stabilizeFrames,
  ]);

  // Frame toggle handler
  const handleToggleFrame = (id: number) => {
    setFrames((prev) =>
      prev.map((f) => (f.id === id ? { ...f, selected: !f.selected } : f))
    );
  };

  // Frame batch selectors
  const handleSelectAllFrames = (select: boolean) => {
    setFrames((prev) => prev.map((f) => ({ ...f, selected: select })));
  };

  const handleInvertFrames = () => {
    setFrames((prev) => prev.map((f) => ({ ...f, selected: !f.selected })));
  };

  const handleResetProject = () => {
    setIsAnimatedGifSource(false);
    setExtractedGifFrames([]);
    setCurrentSpriteSheet(sampleCoin);
    setSettings({
      cols: 6,
      rows: 6,
      fps: 20,
      playMode: "forward",
      gifWidth: 256,
      gifHeight: 256,
      loop: true,
      transparencyEnabled: false,
      transparencyFloodFill: false,
      transparentColor: "#000000",
      transparencyTolerance: 15,
      cropLeft: 0,
      cropRight: 0,
      cropTop: 0,
      cropBottom: 0,
      frameShave: 0,
      lineBoldness: 0,
      imageSmoothing: true,
      stabilizeFrames: false,
      captionText: "",
      captionColor: "#ffffff",
      captionSize: 28,
      captionYPercent: 80,
      captionXPercent: 50,
      captionEffect: "static",
      captionStroke: true,
      captionFont: "Noto Sans KR",
    });
    setSliceError(null);
  };

  return (
    <div className="min-h-screen w-full bg-[#0d0d0d] text-[#ececec] flex flex-col font-sans" id="app-root">
      {/* Universal Header Bar */}
      <header className="flex items-center justify-between px-6 py-4 bg-[#141414] border-b border-white/5 text-white sticky top-0 z-30 backdrop-blur-md bg-opacity-95 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-600/15">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight block">스프라이트 시트 ➜ GIF 변환기</span>
            <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider block -mt-0.5">
              Sprite Sheet to Animated GIF Slicer
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleResetProject}
          className="text-xs text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-xl border border-white/10 transition-all flex items-center gap-1.5 active:scale-[0.98]"
          id="btn-reset-project"
        >
          <RotateCcwIcon className="w-3.5 h-3.5" />
          <span>초기화 (Reset)</span>
        </button>
      </header>

      {/* Main Core Body Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {sliceError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-start gap-3">
            <AlertCircleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">에러 발생</p>
              <p className="text-xs text-gray-300 mt-1">{sliceError}</p>
            </div>
          </div>
        )}

        {/* 3-Column Bento Grid Layout for Ultimate Screen Efficiency */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Column 1: Config Sidebar (Upload, Sizing, Colors) */}
          <div className="lg:col-span-4 space-y-6">
            <SpriteSheetSelector
              settings={settings}
              onSettingsChange={setSettings}
              onImageLoaded={handleImageLoaded}
              currentImage={currentSpriteSheet}
              isAnimatedGifSource={isAnimatedGifSource}
            />
          </div>

          {/* Column 2: Central Slicer Grid (Original Image, Slices, Selecting Slices) */}
          <div className="lg:col-span-5 space-y-6">
            {isSlicing ? (
              <div className="bg-[#141414] rounded-2xl border border-white/5 p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-xl">
                <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {isAnimatedGifSource ? "움짤 GIF 프레임 가공 중..." : "스프라이트 시트 슬라이싱 중..."}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {isAnimatedGifSource 
                      ? "움짤의 각 프레임에서 배경색 제거 및 보정 처리를 적용하고 있습니다." 
                      : `이미지를 ${settings.cols} × ${settings.rows} 격자로 고속 분할하고 있습니다.`}
                  </p>
                </div>
              </div>
            ) : (
              <SpriteSlicerGrid
                currentImage={currentSpriteSheet}
                settings={settings}
                frames={frames}
                onToggleFrame={handleToggleFrame}
                onSelectAllFrames={handleSelectAllFrames}
                onInvertFrames={handleInvertFrames}
              />
            )}
          </div>

          {/* Column 3: Live Player & Exporter (Play controls, Compile, Download) */}
          <div className="lg:col-span-3 space-y-6 lg:sticky lg:top-24">
            <GifPreviewer
              frames={frames}
              settings={settings}
              onSettingsChange={setSettings}
              currentSpriteSheet={currentSpriteSheet}
            />
          </div>

        </div>

        {/* Quick Help Guide Banner */}
        <div className="bg-[#141414] rounded-2xl border border-white/5 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl shrink-0 mt-0.5 md:mt-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">어떻게 사용하나요? (Simple Guide)</h4>
              <p className="text-xs text-gray-400 mt-1">
                1. <strong>6x6 스프라이트 시트</strong>(혹은 다른 규격의 격자 이미지)를 드래그 앤 드롭해 불러옵니다.<br />
                2. 원본 이미지의 가로/세로 프레임 수에 맞게 <strong>행과 열 설정을 매칭</strong>합니다.<br />
                3. 아래 목록에서 재생할 프레임을 활성화하고, 재생 속도(FPS)와 배경 투명도를 적절히 맞춘 후 <strong>"GIF 파일 생성하기"</strong>를 클릭합니다!
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-gray-500 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5 shrink-0 self-start md:self-auto">
            Powered by HTML Canvas & Gifshot
          </span>
        </div>
      </main>
    </div>
  );
}

// Inline fallback icons to ensure zero import issues
function RotateCcwIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function AlertCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}
