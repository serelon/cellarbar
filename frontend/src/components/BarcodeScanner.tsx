import Quagga from '@ericblade/quagga2';
import type { QuaggaJSResultObject } from '@ericblade/quagga2';
import { useEffect, useRef, useCallback } from 'react';

interface Props {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const detectedRef = useRef(false);

  const handleDetected = useCallback((result: QuaggaJSResultObject) => {
    if (detectedRef.current) return;
    const code = result.codeResult?.code;
    if (code) {
      detectedRef.current = true;
      Quagga.stop();
      onDetected(code);
    }
  }, [onDetected]);

  useEffect(() => {
    if (!scannerRef.current) return;
    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          target: scannerRef.current,
          constraints: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        decoder: {
          readers: ['ean_reader', 'upc_reader', 'upc_e_reader'],
        },
      },
      (err) => {
        if (err) { console.error('Barcode scanner error:', err); return; }
        Quagga.start();
      },
    );
    Quagga.onDetected(handleDetected);
    return () => {
      Quagga.offDetected(handleDetected);
      Quagga.stop();
    };
  }, [handleDetected]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center">
      <div className="text-white text-sm mb-2">Point camera at barcode</div>
      <div ref={scannerRef} className="w-full max-w-md aspect-video rounded-lg overflow-hidden" />
      <button
        onClick={onClose}
        className="mt-4 px-6 py-2 bg-white rounded-lg font-medium"
      >
        Cancel
      </button>
    </div>
  );
}
