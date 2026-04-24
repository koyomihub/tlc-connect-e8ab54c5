import { useRef, useState, useEffect, MouseEvent } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PostImageCarouselProps {
  images: string[];
  alt?: string;
  maxHeightClass?: string;
  /** If provided, overrides the default open-viewer-on-click behavior. */
  onImageClick?: (index: number) => void;
  className?: string;
  /** Disable the built-in full-resolution viewer (default: enabled). */
  disableViewer?: boolean;
}

export function PostImageCarousel({
  images,
  alt = 'Post image',
  maxHeightClass = 'max-h-[500px]',
  onImageClick,
  className,
  disableViewer = false,
}: PostImageCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const updateButtons = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateButtons();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateButtons, { passive: true });
    window.addEventListener('resize', updateButtons);
    return () => {
      el.removeEventListener('scroll', updateButtons);
      window.removeEventListener('resize', updateButtons);
    };
  }, [images.length]);

  const scrollByAmount = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
  };

  const handleNav = (e: MouseEvent, dir: 1 | -1) => {
    e.stopPropagation();
    e.preventDefault();
    scrollByAmount(dir);
  };

  const handleImageClick = (e: MouseEvent, index: number) => {
    e.stopPropagation();
    if (onImageClick) {
      onImageClick(index);
      return;
    }
    if (!disableViewer) setViewerIndex(index);
  };

  const clickable = !!onImageClick || !disableViewer;

  const viewerOpen = viewerIndex !== null;
  const closeViewer = () => setViewerIndex(null);
  const showPrev = (e: MouseEvent) => {
    e.stopPropagation();
    setViewerIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length));
  };
  const showNext = (e: MouseEvent) => {
    e.stopPropagation();
    setViewerIndex((i) => (i === null ? i : (i + 1) % images.length));
  };

  const Viewer = (
    <Dialog open={viewerOpen} onOpenChange={(o) => !o && closeViewer()}>
      <DialogContent className="max-w-[95vw] sm:max-w-5xl p-0 bg-background/95 backdrop-blur border-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{alt}</DialogTitle>
          <DialogDescription>Full resolution image preview</DialogDescription>
        </DialogHeader>
        {viewerIndex !== null && (
          <div className="relative flex items-center justify-center max-h-[90vh]">
            <img
              src={images[viewerIndex]}
              alt={`${alt} ${viewerIndex + 1}`}
              className="w-auto h-auto max-w-full max-h-[90vh] object-contain"
            />
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={showPrev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 backdrop-blur border border-border shadow-md flex items-center justify-center hover:bg-background"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={showNext}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 backdrop-blur border border-border shadow-md flex items-center justify-center hover:bg-background"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur rounded-full px-3 py-1 text-xs border border-border">
                  {viewerIndex + 1} / {images.length}
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  if (images.length === 1) {
    return (
      <>
        <div className={cn('rounded-lg bg-muted/30 flex items-center justify-center overflow-hidden', className)}>
          <img
            src={images[0]}
            alt={alt}
            className={cn('w-auto max-w-full object-contain', clickable && 'cursor-zoom-in', maxHeightClass)}
            onClick={(e) => handleImageClick(e, 0)}
          />
        </div>
        {Viewer}
      </>
    );
  }

  return (
    <>
      <div className={cn('relative group', className)}>
        <div
          ref={scrollerRef}
          className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 scroll-smooth scrollbar-thin"
        >
          {images.map((url, index) => (
            <div
              key={index}
              className="snap-start shrink-0 rounded-lg bg-muted/30 flex items-center justify-center overflow-hidden"
            >
              <img
                src={url}
                alt={`${alt} ${index + 1}`}
                className={cn(
                  'w-auto max-w-[85vw] sm:max-w-[500px] object-contain',
                  clickable && 'cursor-zoom-in',
                  maxHeightClass,
                )}
                onClick={(e) => handleImageClick(e, index)}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          aria-label="Previous image"
          onClick={(e) => handleNav(e, -1)}
          disabled={!canPrev}
          className={cn(
            'absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/80 backdrop-blur border border-border shadow-md flex items-center justify-center transition-opacity',
            'hover:bg-background disabled:opacity-0 disabled:pointer-events-none',
            'opacity-0 group-hover:opacity-100 focus:opacity-100',
          )}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Next image"
          onClick={(e) => handleNav(e, 1)}
          disabled={!canNext}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/80 backdrop-blur border border-border shadow-md flex items-center justify-center transition-opacity',
            'hover:bg-background disabled:opacity-0 disabled:pointer-events-none',
            'opacity-0 group-hover:opacity-100 focus:opacity-100',
          )}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      {Viewer}
    </>
  );
}
