import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface AvatarCropDialogProps {
  open: boolean;
  file: File | null;
  onCancel: () => void;
  onConfirm: (croppedBlob: Blob) => void;
}

/**
 * Square (1:1) avatar cropper. User can pan (drag) and zoom (slider/wheel) the
 * source image inside a circular preview. On confirm, exports a 512x512 JPEG.
 */
export function AvatarCropDialog({ open, file, onCancel, onConfirm }: AvatarCropDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1); // multiplier on the "cover" base scale
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // px, in display space
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  const VIEW = 320; // square viewport size in CSS px

  useEffect(() => {
    if (!file) {
      setImgUrl(null);
      setImgSize(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const img = new Image();
    img.onload = () => {
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!file) return null;

  // Base "cover" scale so the smaller image dimension fills the square viewport
  const baseScale = imgSize ? Math.max(VIEW / imgSize.w, VIEW / imgSize.h) : 1;
  const scale = baseScale * zoom;
  const dispW = imgSize ? imgSize.w * scale : 0;
  const dispH = imgSize ? imgSize.h * scale : 0;

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
  const clampOffset = (x: number, y: number) => {
    const maxX = Math.max(0, (dispW - VIEW) / 2);
    const maxY = Math.max(0, (dispH - VIEW) / 2);
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(clampOffset(dragRef.current.ox + dx, dragRef.current.oy + dy));
  };
  const handlePointerUp = () => {
    dragRef.current = null;
  };
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const next = clamp(zoom + (e.deltaY < 0 ? 0.1 : -0.1), 1, 4);
    setZoom(next);
    setOffset((o) => clampOffset(o.x, o.y));
  };
  const handleZoomChange = (v: number[]) => {
    setZoom(v[0]);
    setOffset((o) => clampOffset(o.x, o.y));
  };

  const handleConfirm = async () => {
    if (!imgUrl || !imgSize) return;
    const OUT = 512;
    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Convert display-space transform to source-image crop rect
      // Display: image is centered in VIEW with offset, scaled by `scale`
      const srcVisible = VIEW / scale; // size (in source px) of one viewport edge
      const cx = imgSize.w / 2 - offset.x / scale;
      const cy = imgSize.h / 2 - offset.y / scale;
      const sx = cx - srcVisible / 2;
      const sy = cy - srcVisible / 2;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, OUT, OUT);
      ctx.drawImage(img, sx, sy, srcVisible, srcVisible, 0, 0, OUT, OUT);
      canvas.toBlob(
        (blob) => {
          if (blob) onConfirm(blob);
        },
        'image/jpeg',
        0.92,
      );
    };
    img.src = imgUrl;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reposition profile picture</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            className="relative overflow-hidden rounded-full bg-muted touch-none select-none cursor-grab active:cursor-grabbing"
            style={{ width: VIEW, height: VIEW }}
          >
            {imgUrl && imgSize && (
              <img
                src={imgUrl}
                alt="Crop preview"
                draggable={false}
                style={{
                  position: 'absolute',
                  width: dispW,
                  height: dispH,
                  left: (VIEW - dispW) / 2 + offset.x,
                  top: (VIEW - dispH) / 2 + offset.y,
                  maxWidth: 'none',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
          <div className="w-full px-2">
            <p className="text-xs text-muted-foreground mb-2">Drag to reposition · Use slider to zoom</p>
            <Slider value={[zoom]} min={1} max={4} step={0.01} onValueChange={handleZoomChange} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleConfirm}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
