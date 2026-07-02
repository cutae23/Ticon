import { parseGIF, decompressFrames } from "gifuct-js";

/**
 * Draw an SVG string onto a canvas and return its base64 PNG data URL
 */
export function svgToPng(svgString: string, width: number = 512, height: number = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    let safeSvg = svgString.trim();
    if (!safeSvg.includes("xmlns=")) {
      safeSvg = safeSvg.replace("<svg", "<svg xmlns='http://www.w3.org/2000/svg'");
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not create canvas 2D context"));
          return;
        }

        // Draw the image
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      reject(new Error("Failed to render SVG onto canvas"));
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(safeSvg);
  });
}

/**
 * Slice a single sprite sheet image into individual frame data URLs
 */
export function sliceSpriteSheet(
  imageUrl: string,
  cols: number,
  rows: number,
  cropLeft: number = 0,
  cropRight: number = 0,
  cropTop: number = 0,
  cropBottom: number = 0,
  frameShave: number = 0
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const frames: string[] = [];
        
        // Effective width/height after trimming outer margins
        const croppedWidth = img.naturalWidth - cropLeft - cropRight;
        const croppedHeight = img.naturalHeight - cropTop - cropBottom;

        if (croppedWidth <= 0 || croppedHeight <= 0) {
          reject(new Error("제단(Crop) 여백 크기가 원본 이미지 해상도보다 크거나 같습니다. 여백 값을 확인하세요."));
          return;
        }

        const frameWidth = Math.floor(croppedWidth / cols);
        const frameHeight = Math.floor(croppedHeight / rows);

        if (frameWidth <= 0 || frameHeight <= 0) {
          reject(new Error("유효하지 않은 그리드 차원입니다. 행/열 설정을 확인해 주세요."));
          return;
        }

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            // Compute source coordinates on the sheet (taking cropLeft/cropTop into account)
            const srcX = cropLeft + c * frameWidth;
            const srcY = cropTop + r * frameHeight;

            // Apply frame shave (trimming borders from each frame cell)
            const finalWidth = frameWidth - 2 * frameShave;
            const finalHeight = frameHeight - 2 * frameShave;

            if (finalWidth <= 0 || finalHeight <= 0) {
              reject(new Error("개별 프레임 테두리 제단(Shave) 값이 프레임 한계치를 초과했습니다. 값을 낮춰주세요."));
              return;
            }

            const canvas = document.createElement("canvas");
            canvas.width = finalWidth;
            canvas.height = finalHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("캔버스 컨텍스트를 생성할 수 없습니다."));
              return;
            }

            // Copy slice from spritesheet with inner frameShave offset
            ctx.drawImage(
              img,
              srcX + frameShave,
              srcY + frameShave,
              finalWidth,
              finalHeight,
              0,
              0,
              finalWidth,
              finalHeight
            );

            frames.push(canvas.toDataURL("image/png"));
          }
        }
        resolve(frames);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      reject(new Error("스프라이트 시트 이미지를 로드하지 못했습니다."));
    };
    img.src = imageUrl;
  });
}

/**
 * Apply transparency color keying to an image data URL with tolerance
 */
export function applyTransparency(
  originalDataUrl: string,
  targetColorHex: string,
  tolerance: number,
  floodFill: boolean = true
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(originalDataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const w = canvas.width;
        const h = canvas.height;

        // Clean target hex color format
        const cleanHex = targetColorHex.startsWith("#") ? targetColorHex.slice(1) : targetColorHex;
        if (cleanHex.length !== 6) {
          resolve(originalDataUrl);
          return;
        }

        // Convert target color to RGB
        const rTarget = parseInt(cleanHex.slice(0, 2), 16);
        const gTarget = parseInt(cleanHex.slice(2, 4), 16);
        const bTarget = parseInt(cleanHex.slice(4, 6), 16);

        // Map tolerance 0-100 to maximum Euclidean distance in RGB color space
        // Max color distance = sqrt(255^2 + 255^2 + 255^2) ≈ 441.67
        const threshold = (tolerance / 100) * 442;

        const matchesTarget = (idx: number): boolean => {
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];
          if (a === 0) return true; // Already transparent

          const distance = Math.sqrt(
            (r - rTarget) ** 2 +
            (g - gTarget) ** 2 +
            (b - bTarget) ** 2
          );
          return distance <= threshold;
        };

        if (!floodFill) {
          // Global Chroma-key (replaces all matching pixels everywhere)
          for (let i = 0; i < data.length; i += 4) {
            if (matchesTarget(i)) {
              data[i + 3] = 0; // Fully transparent alpha
            }
          }
        } else {
          // Connected Border Flood Fill: protect enclosed shapes like a white bunny inside outlines
          const visited = new Uint8Array(w * h);
          const queue = new Int32Array(w * h);
          let head = 0;
          let tail = 0;

          // Seed coordinates from absolute edges (3 layers of edge pixels to guarantee capturing background even with borders)
          const layers = [0, 1, 2];
          for (const offset of layers) {
            if (offset >= w || offset >= h) continue;

            // Top and bottom edges
            for (let x = offset; x < w - offset; x++) {
              // Top rows
              const idxTop = offset * w + x;
              if (!visited[idxTop] && matchesTarget(idxTop * 4)) {
                visited[idxTop] = 1;
                queue[tail++] = idxTop;
              }
              // Bottom rows
              const idxBottom = (h - 1 - offset) * w + x;
              if (!visited[idxBottom] && matchesTarget(idxBottom * 4)) {
                visited[idxBottom] = 1;
                queue[tail++] = idxBottom;
              }
            }

            // Left and right edges
            for (let y = offset; y < h - offset; y++) {
              // Left columns
              const idxLeft = y * w + offset;
              if (!visited[idxLeft] && matchesTarget(idxLeft * 4)) {
                visited[idxLeft] = 1;
                queue[tail++] = idxLeft;
              }
              // Right columns
              const idxRight = y * w + (w - 1 - offset);
              if (!visited[idxRight] && matchesTarget(idxRight * 4)) {
                visited[idxRight] = 1;
                queue[tail++] = idxRight;
              }
            }
          }

          // BFS traversal
          while (head < tail) {
            const currIdx = queue[head++];
            const cx = currIdx % w;
            const cy = Math.floor(currIdx / w);

            // Make the current matched background pixel fully transparent
            data[currIdx * 4 + 3] = 0;

            // Check 4-way neighbors
            // 1. Up
            if (cy > 0) {
              const nidx = currIdx - w;
              if (!visited[nidx] && matchesTarget(nidx * 4)) {
                visited[nidx] = 1;
                queue[tail++] = nidx;
              }
            }
            // 2. Down
            if (cy < h - 1) {
              const nidx = currIdx + w;
              if (!visited[nidx] && matchesTarget(nidx * 4)) {
                visited[nidx] = 1;
                queue[tail++] = nidx;
              }
            }
            // 3. Left
            if (cx > 0) {
              const nidx = currIdx - 1;
              if (!visited[nidx] && matchesTarget(nidx * 4)) {
                visited[nidx] = 1;
                queue[tail++] = nidx;
              }
            }
            // 4. Right
            if (cx < w - 1) {
              const nidx = currIdx + 1;
              if (!visited[nidx] && matchesTarget(nidx * 4)) {
                visited[nidx] = 1;
                queue[tail++] = nidx;
              }
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        resolve(originalDataUrl);
      }
    };
    img.onerror = () => resolve(originalDataUrl);
    img.src = originalDataUrl;
  });
}

/**
 * Thicken/Bolden dark lines (outlines) of an image with transparent background.
 * Uses pixel-level nearest-neighbor dilation of dark pixels to heal broken borders.
 */
export function adjustLineBoldness(
  originalDataUrl: string,
  boldness: number // 0 (none) to 5
): Promise<string> {
  if (boldness <= 0) return Promise.resolve(originalDataUrl);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(originalDataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, w, h);
        const srcData = new Uint8ClampedArray(imgData.data);
        const dstData = imgData.data;

        // Helper to check if a pixel in srcData is "dark" (potential outline)
        // We define dark as R, G, B with low luminance and Alpha > 50
        const isDarkPixel = (x: number, y: number): boolean => {
          if (x < 0 || x >= w || y < 0 || y >= h) return false;
          const idx = (y * w + x) * 4;
          const r = srcData[idx];
          const g = srcData[idx + 1];
          const b = srcData[idx + 2];
          const a = srcData[idx + 3];
          if (a < 50) return false;
          
          // Compute luminance
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          return luminance < 140; // threshold for dark outline/drawing pixels
        };

        // Scan pixels
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            
            // If already a dark pixel, keep it as is
            if (isDarkPixel(x, y)) {
              continue;
            }

            // Look in neighbors up to 'boldness' distance
            let foundDark = false;
            let nearestR = 0, nearestG = 0, nearestB = 0, nearestA = 255;
            let minDistanceSq = Infinity;

            for (let dy = -boldness; dy <= boldness; dy++) {
              for (let dx = -boldness; dx <= boldness; dx++) {
                if (dx === 0 && dy === 0) continue;
                // Manhattan/Chebyshev distance constraint
                if (Math.abs(dx) + Math.abs(dy) > boldness) continue;

                const nx = x + dx;
                const ny = y + dy;
                if (isDarkPixel(nx, ny)) {
                  const distSq = dx * dx + dy * dy;
                  if (distSq < minDistanceSq) {
                    minDistanceSq = distSq;
                    const nidx = (ny * w + nx) * 4;
                    nearestR = srcData[nidx];
                    nearestG = srcData[nidx + 1];
                    nearestB = srcData[nidx + 2];
                    nearestA = srcData[nidx + 3];
                    foundDark = true;
                  }
                }
              }
            }

            if (foundDark) {
              // Thicken the line by painting this pixel with the dark neighbor's color
              dstData[idx] = nearestR;
              dstData[idx + 1] = nearestG;
              dstData[idx + 2] = nearestB;
              dstData[idx + 3] = Math.max(dstData[idx + 3], nearestA);
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        resolve(originalDataUrl);
      }
    };
    img.onerror = () => resolve(originalDataUrl);
    img.src = originalDataUrl;
  });
}

/**
 * Aligns the visual center of mass (centroid of non-transparent pixels)
 * of the image to the exact center of the frame, correcting wobbling or shaking.
 */
export function stabilizeFrameCenter(originalDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(originalDataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        let sumX = 0;
        let sumY = 0;
        let count = 0;

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const alpha = data[(y * w + x) * 4 + 3];
            if (alpha > 20) { // non-transparent threshold
              sumX += x;
              sumY += y;
              count++;
            }
          }
        }

        if (count === 0) {
          // Empty frame, return as is
          resolve(originalDataUrl);
          return;
        }

        const centroidX = sumX / count;
        const centroidY = sumY / count;

        const dx = Math.round(w / 2 - centroidX);
        const dy = Math.round(h / 2 - centroidY);

        if (dx === 0 && dy === 0) {
          resolve(originalDataUrl);
          return;
        }

        // Redraw shifted on clean canvas
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, dx, dy);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        resolve(originalDataUrl);
      }
    };
    img.onerror = () => resolve(originalDataUrl);
    img.src = originalDataUrl;
  });
}

/**
 * Extract frames from an animated GIF ArrayBuffer and return data URLs with delays
 */
export function extractGifFrames(arrayBuffer: ArrayBuffer): Promise<{ dataUrl: string; delay: number }[]> {
  return new Promise((resolve, reject) => {
    try {
      const gif = parseGIF(arrayBuffer);
      const decompressedFrames = decompressFrames(gif, true);
      
      const width = gif.lsd.width;
      const height = gif.lsd.height;
      
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Could not create 2D canvas context");
      }
      
      const frames: { dataUrl: string; delay: number }[] = [];
      
      // Keep track of the canvas state for accumulation
      // We will draw each frame's patch
      decompressedFrames.forEach((frame: any) => {
        const { dims, patch, delay, disposalType } = frame;
        
        // disposalType 2: restore to background color (clear current frame)
        if (disposalType === 2) {
          ctx.clearRect(0, 0, width, height);
        }
        
        // Create patch image
        const patchCanvas = document.createElement("canvas");
        patchCanvas.width = dims.width;
        patchCanvas.height = dims.height;
        const patchCtx = patchCanvas.getContext("2d");
        if (patchCtx) {
          const patchData = patchCtx.createImageData(dims.width, dims.height);
          patchData.data.set(patch);
          patchCtx.putImageData(patchData, 0, 0);
          
          ctx.drawImage(patchCanvas, dims.left, dims.top);
        }
        
        // Store frame as a PNG dataURL
        frames.push({
          dataUrl: canvas.toDataURL("image/png"),
          delay: delay || 100,
        });
      });
      
      resolve(frames);
    } catch (err) {
      reject(err);
    }
  });
}



