
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
    let timeout: NodeJS.Timeout;

    if (videoRef.current) {
        // A small delay to ensure the video stream is ready
        timeout = setTimeout(() => {
            if(videoRef.current) {
                codeReader.decodeFromVideoElement(videoRef.current, (result, err) => {
                    if (result) {
                        onScan(result.getText());
                        codeReader.reset();
                    }
                    if (err && !(err instanceof NotFoundException)) {
                        console.error('Barcode scanning error:', err);
                    }
                }).catch(err => console.error("DecodeFromVideoDevice error", err));
            }
        }, 500);
    }
    
    return () => {
        clearTimeout(timeout);
        codeReader.reset();
    };
  }, [onScan, videoRef]);

  // The video element is now controlled by the parent component (BillingClient)
  return null;
}
