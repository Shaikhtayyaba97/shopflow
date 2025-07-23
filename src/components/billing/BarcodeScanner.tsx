
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
    
    if (videoRef.current) {
      codeReader.decodeFromVideoElement(videoRef.current, (result, err) => {
        if (result) {
            onScan(result.getText());
        }
        if (err && !(err instanceof NotFoundException)) {
            console.error('Barcode scanning error:', err);
        }
      }).catch(err => {
          // Don't log "Video stream has ended" error, it's expected on dialog close.
          if(err.message.includes("Video stream has ended")) return;
          console.error("DecodeFromVideoDevice error", err)
      });
    }
    
    return () => {
        codeReader.reset();
    };
  }, [onScan, videoRef]);

  // The video element is now controlled by the parent component (BillingClient)
  return null;
}
