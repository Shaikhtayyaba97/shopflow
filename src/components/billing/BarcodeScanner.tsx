"use client";

import { useEffect, useRef } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
}

export function BarcodeScanner({ onScan }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    if (videoRef.current) {
      codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
        if (result) {
          onScan(result.getText());
          codeReader.reset();
        }
        if (err && !(err instanceof NotFoundException)) {
          console.error(err);
        }
      });
    }

    return () => {
      codeReader.reset();
    };
  }, [onScan]);

  return <video ref={videoRef} className="w-full rounded-md" />;
}
