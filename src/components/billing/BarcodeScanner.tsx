
"use client";

import { useEffect, RefObject } from 'react';
import { BrowserMultiFormatReader, NotFoundException, DecodeHintType } from '@zxing/library';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  videoRef: RefObject<HTMLVideoElement>;
}

export function BarcodeScanner({ onScan, videoRef }: BarcodeScannerProps) {
  
  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    let isMounted = true;

    const startScanner = async () => {
        if (videoRef.current && isMounted) {
            try {
                // The video stream is already being managed by the parent component.
                // We just need to start decoding from the element.
                await codeReader.decodeFromVideoElement(videoRef.current, (result, err) => {
                    if (result) {
                        onScan(result.getText());
                        // No need to reset here, parent component handles closing the dialog
                        // which unmounts this component and triggers the cleanup.
                    }
                    if (err && !(err instanceof NotFoundException)) {
                        console.error('Barcode scanning error:', err);
                    }
                });
            } catch(err: any) {
                // This catch handles errors during scanner initialization.
                if (err.message && !err.message.includes("Video stream has ended")) {
                   console.error("Error setting up barcode scanner:", err);
                }
            }
        }
    }
    
    startScanner();
    
    // The cleanup function is crucial. It runs when the component unmounts.
    return () => {
        isMounted = false;
        codeReader.reset();
    };
  }, [onScan, videoRef]);

  // This component doesn't render any visible elements itself.
  return null;
}
