
"use client";

import { useEffect, RefObject } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  videoRef: RefObject<HTMLVideoElement>;
}

export function BarcodeScanner({ onScan, videoRef }: BarcodeScannerProps) {
  
  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    
    // Ensure we have a video element before trying to decode.
    if (videoRef.current) {
      // It's important to start decoding from the video element that is already streaming.
      // The parent component is now responsible for getting the stream and attaching it.
      codeReader.decodeFromVideoElement(videoRef.current, (result, err) => {
        if (result) {
            // Once a barcode is successfully scanned, call the onScan callback.
            onScan(result.getText());
        }
        if (err && !(err instanceof NotFoundException)) {
            // Log errors to the console, but ignore NotFoundException which happens continuously
            // when no barcode is in view.
            console.error('Barcode scanning error:', err);
        }
      }).catch(err => {
          // This catch block handles errors during the initialization of the scanner.
          // We can ignore the "Video stream has ended" error which is expected on dialog close.
          if (err.message && !err.message.includes("Video stream has ended")) {
             console.error("Error setting up barcode scanner:", err);
          }
      });
    }
    
    // The cleanup function is crucial. It runs when the component unmounts (dialog closes).
    // `reset()` gracefully stops the scanner and releases the camera.
    return () => {
        codeReader.reset();
    };
  }, [onScan, videoRef]);

  // This component doesn't render any visible elements itself. It just contains the logic
  // for operating on the video element provided by the parent.
  return null;
}
