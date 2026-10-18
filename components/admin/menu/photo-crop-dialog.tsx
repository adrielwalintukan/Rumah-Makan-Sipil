"use client";

import * as React from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  renderImageToCanvas,
  type CropTransform,
} from "@/lib/image-compression";

export interface PhotoCropDialogProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  onApply: (blob: Blob, previewUrl: string) => void;
}

export function PhotoCropDialog({
  isOpen,
  onClose,
  file,
  onApply,
}: PhotoCropDialogProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [imageElement, setImageElement] =
    React.useState<HTMLImageElement | null>(null);
  const [transform, setTransform] = React.useState<CropTransform>({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [isApplying, setIsApplying] = React.useState(false);

  // Status drag pointer
  const isDraggingRef = React.useRef(false);
  const dragStartRef = React.useRef({
    x: 0,
    y: 0,
    initialOffsetX: 0,
    initialOffsetY: 0,
  });

  // Muat gambar saat file berubah atau dialog dibuka
  React.useEffect(() => {
    if (!file || !isOpen) {
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      setImageElement(img);
      setTransform({ zoom: 1, offsetX: 0, offsetY: 0 });
    };

    img.onerror = () => {
      setImageElement(null);
    };

    img.src = objectUrl;

    return () => {
      URL.revokeObjectURL(objectUrl);
      setImageElement(null);
    };
  }, [file, isOpen]);

  // Gambar ulang ke canvas setiap kali gambar atau transform berubah
  React.useEffect(() => {
    if (!canvasRef.current || !imageElement) return;
    renderImageToCanvas(canvasRef.current, imageElement, transform, "#FFFFFF");
  }, [imageElement, transform]);

  // Pointer drag events untuk geser posisi
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    canvasRef.current.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialOffsetX: transform.offsetX,
      initialOffsetY: transform.offsetY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const clientWidth = canvas.clientWidth || 300;
    const scaleRatio = 1200 / clientWidth;

    const dx = (e.clientX - dragStartRef.current.x) * scaleRatio;
    const dy = (e.clientY - dragStartRef.current.y) * scaleRatio;

    setTransform((prev) => ({
      ...prev,
      offsetX: Math.round(dragStartRef.current.initialOffsetX + dx),
      offsetY: Math.round(dragStartRef.current.initialOffsetY + dy),
    }));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    try {
      canvasRef.current.releasePointerCapture(e.pointerId);
    } catch {
      // Abaikan jika pointer capture sudah dilepas
    }
    isDraggingRef.current = false;
  };

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      setTransform((prev) => ({ ...prev, zoom: val }));
    }
  };

  const handleZoomStep = (delta: number) => {
    setTransform((prev) => {
      const nextZoom = Math.min(2.5, Math.max(0.4, Number((prev.zoom + delta).toFixed(2))));
      return { ...prev, zoom: nextZoom };
    });
  };

  const handleReset = () => {
    setTransform({ zoom: 1, offsetX: 0, offsetY: 0 });
  };

  const handleApply = async () => {
    if (!canvasRef.current || isApplying) return;
    setIsApplying(true);

    try {
      const canvas = canvasRef.current;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("Gagal mengonversi canvas ke format WebP."));
          },
          "image/webp",
          0.8
        );
      });

      const previewUrl = URL.createObjectURL(blob);
      onApply(blob, previewUrl);
      onClose();
    } catch (err) {
      console.error("Gagal menerapkan foto:", err);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-md w-full p-5 sm:p-6"
        data-testid="photo-crop-dialog"
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-ink-900">
            Sesuaikan Posisi & Ukuran Foto
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-600">
            Geser foto langsung di kotak pratinjau untuk memindahkan posisi.
            Gunakan penggeser zoom untuk memperbesar atau memperkecil agar produk
            tampil pas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Kotak Kanvas Pratinjau Interaktif 4:3 */}
          <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border-2 border-dashed border-border-warm-300 bg-white shadow-inner flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={1200}
              height={900}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="w-full h-full object-contain cursor-grab active:cursor-grabbing touch-none select-none"
              aria-label="Kanvas penyesuaian foto menu 4 banding 3"
              tabIndex={0}
            />

            {/* Indikator geser mengambang di pojok pratinjau */}
            <div className="absolute bottom-2 left-2 pointer-events-none bg-ink-900/70 text-white text-[11px] font-medium px-2 py-0.5 rounded-md backdrop-blur-xs">
              Sentuh & geser posisi
            </div>
          </div>

          {/* Kontrol Zoom & Reset */}
          <div className="space-y-2 bg-surface-warm-50 p-3 rounded-lg border border-border-warm-200">
            <div className="flex items-center justify-between text-xs font-semibold text-ink-800">
              <label htmlFor="photo-zoom-slider">Skala / Zoom</label>
              <span className="text-ink-600 font-mono">
                {Math.round(transform.zoom * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleZoomStep(-0.1)}
                className="size-11 min-h-[44px] min-w-[44px] p-0 flex items-center justify-center shrink-0"
                aria-label="Perkecil zoom foto"
              >
                <Minus className="size-4 text-ink-700" aria-hidden />
              </Button>

              <input
                id="photo-zoom-slider"
                type="range"
                min="0.4"
                max="2.5"
                step="0.02"
                value={transform.zoom}
                onChange={handleZoomChange}
                className="w-full h-2 bg-border-warm-300 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                aria-label="Penggeser skala zoom foto"
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleZoomStep(0.1)}
                className="size-11 min-h-[44px] min-w-[44px] p-0 flex items-center justify-center shrink-0"
                aria-label="Perbesar zoom foto"
              >
                <Plus className="size-4 text-ink-700" aria-hidden />
              </Button>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-xs text-ink-600 hover:text-ink-900 min-h-[44px] px-3 gap-1.5"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                <span>Pusatkan Semula</span>
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isApplying}
            className="w-full sm:w-auto min-h-[44px]"
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleApply}
            disabled={!imageElement || isApplying}
            className="w-full sm:w-auto min-h-[44px] font-semibold"
          >
            {isApplying ? "Menerapkan..." : "Terapkan Foto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
