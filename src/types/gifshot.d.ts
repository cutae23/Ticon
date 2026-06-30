declare module "gifshot" {
  interface GIFOptions {
    images: string[];
    interval?: number;
    numFrames?: number;
    gifWidth?: number;
    gifHeight?: number;
    filter?: string;
    intervalMultiplier?: number;
    video?: string[];
    webcam?: any;
    cameraStream?: any;
    keepCameraOn?: boolean;
    sampleInterval?: number;
    numWorkers?: number;
    fontSize?: string;
    fontColor?: string;
    fontFamily?: string;
    text?: string;
    showProgressBar?: boolean;
    progressBarBackgroundColor?: string;
    progressBarForegroundColor?: string;
    watermark?: string;
    watermarkHeight?: number;
    watermarkWidth?: number;
    watermarkXCoordinate?: number;
    watermarkYCoordinate?: number;
    loopLimit?: number;
  }

  interface GIFResult {
    error: boolean;
    errorCode: string;
    errorMsg: string;
    image: string;
  }

  function createGIF(
    options: GIFOptions,
    callback: (result: GIFResult) => void
  ): void;

  function isSupported(): boolean;
  function isWebcamSupported(): boolean;
}
