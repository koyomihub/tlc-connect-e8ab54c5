import { useRef, useState, useEffect, MouseEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PostImageCarouselProps {
  images: string[];
  alt?: string;
  maxHeightClass?: string;
  onImageClick?: () => void;
  className?: string;
}

export function PostImageCarousel({
  images,
  alt = 'Post image',
  maxHeightClass = 'max-h-[500px]',
  onImageClick,
  className,
}: PostImageCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

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

  if (images.length === 1) {
    return (
      <div className={cn('rounded-lg bg-muted/30 flex items-center justify-center overflow-hidden', className)}>
        <img
          src={images[0]}
          alt={alt}
          className={cn('w-auto max-w-full object-contain', onImageClick && 'cursor-pointer', maxHeightClass)}
          onClick={onImageClick}
        />
      </div>
    );
  }

  return (
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
                onImageClick && 'cursor-pointer',
                maxHeightClass,
              )}
              onClick={onImageClick}
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
  );
}
