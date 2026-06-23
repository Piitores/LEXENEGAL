import * as React from 'react';
import './ScrollReelTestimonials.css';

/* ----------------------------------------------------------------
 * ScrollReelTestimonials — adapté à la stack Lexenegal (React + CSS
 * classique, thème émeraude). Inspiré d'un composant shadcn/Tailwind,
 * réécrit SANS Tailwind. Bobine contra-rotative + texte qui monte
 * caractère par caractère. Pas de photos → tuiles monogramme.
 * ---------------------------------------------------------------- */

export interface ScrollReelTestimonial {
  quote: string;
  /** Author name */
  name: string;
  /** Role / organisation line */
  role: string;
  /** Initials shown on the monogram tile (e.g. "PG") */
  initials: string;
}

export interface ScrollReelTestimonialsProps {
  testimonials: ScrollReelTestimonial[];
  charStaggerMs?: number;
  className?: string;
}

/* Geometry — middle column pitch between tile centers:
 * 3 * (cell 121.33px + gap 8px) = 388px */
const CELL = 121.33;
const STEP = 3 * (CELL + 8);

const EXIT_MS = 240;
const SLIDE_MS = 800;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/* Blurred placeholder tile */
function Cell() {
  return <div aria-hidden="true" className="srt__cell" style={{ width: CELL, height: CELL }} />;
}

/* Monogram tile (replaces portrait) */
function Featured({ initials }: { initials: string }) {
  return (
    <div className="srt__featured" style={{ width: CELL, height: CELL }}>
      <span className="srt__monogram">{initials}</span>
      <div aria-hidden="true" className="srt__featured-sheen" />
    </div>
  );
}

/* Per-character split with staggered rise. */
function Chars({ text, startIndex, staggerMs }: { text: string; startIndex: number; staggerMs: number }) {
  let idx = startIndex;
  const words = text.split(' ');
  return (
    <>
      {words.map((word, wi) => {
        const wordSpan = (
          <span className="srt__word">
            {Array.from(word).map((ch, ci) => {
              const delay = idx * staggerMs;
              idx++;
              return (
                <span key={ci} className="scroll-reel-char" style={{ animationDelay: `${delay}ms` }}>
                  {ch}
                </span>
              );
            })}
          </span>
        );
        if (wi < words.length - 1) idx++;
        return (
          <React.Fragment key={wi}>
            {wordSpan}
            {wi < words.length - 1 ? ' ' : null}
          </React.Fragment>
        );
      })}
    </>
  );
}

export function ScrollReelTestimonials({
  testimonials,
  charStaggerMs = 6,
  className,
}: ScrollReelTestimonialsProps) {
  const [index, setIndex] = React.useState(0);
  const [displayIndex, setDisplayIndex] = React.useState(0);
  const [exiting, setExiting] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const animating = React.useRef(false);
  const timeouts = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  const count = testimonials.length;

  React.useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
    const t = timeouts.current;
    return () => {
      cancelAnimationFrame(raf);
      t.forEach(clearTimeout);
    };
  }, []);

  const paginate = React.useCallback(
    (dir: 1 | -1) => {
      if (animating.current) return;
      const next = index + dir;
      if (next < 0 || next >= count) return;
      animating.current = true;

      setIndex(next);
      setExiting(true);

      timeouts.current.push(
        setTimeout(() => {
          setDisplayIndex(next);
          setExiting(false);
        }, EXIT_MS)
      );
      timeouts.current.push(
        setTimeout(() => {
          animating.current = false;
        }, SLIDE_MS)
      );
    },
    [index, count]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); paginate(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); paginate(-1); }
  };

  const middleItems = React.useMemo(() => {
    const items: Array<{ type: 'cell' } | { type: 'featured'; i: number }> = [];
    for (let i = 0; i < 3; i++) items.push({ type: 'cell' });
    testimonials.forEach((_, i) => {
      items.push({ type: 'featured', i });
      if (i < count - 1) items.push({ type: 'cell' }, { type: 'cell' });
    });
    for (let i = 0; i < 3; i++) items.push({ type: 'cell' });
    return items;
  }, [testimonials, count]);

  const sideCellCount = 4 + 2 * count;
  const centerIdx = (count - 1) / 2;
  const middleY = (centerIdx - index) * STEP;
  const sideY = -middleY;

  const colStyle = (y: number): React.CSSProperties => ({
    transform: `translateY(${y}px)`,
    transition: mounted ? `transform ${SLIDE_MS}ms cubic-bezier(0.65,0,0.35,1)` : 'none',
  });

  const current = testimonials[displayIndex];

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Témoignages"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={cn('srt', className)}
    >
      {/* Reel */}
      <div
        aria-hidden="true"
        className="srt__reel"
        style={{
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0%, black 14%, black 86%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
          maskImage:
            'linear-gradient(to right, transparent 0%, black 14%, black 86%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
          WebkitMaskComposite: 'source-in',
          maskComposite: 'intersect',
        }}
      >
        <div className="srt__reel-inner">
          <div className="srt__col" style={colStyle(sideY)}>
            {Array.from({ length: sideCellCount }).map((_, i) => <Cell key={i} />)}
          </div>
          <div className="srt__col" style={colStyle(middleY)}>
            {middleItems.map((item, i) =>
              item.type === 'featured'
                ? <Featured key={i} initials={testimonials[item.i].initials} />
                : <Cell key={i} />
            )}
          </div>
          <div className="srt__col" style={colStyle(sideY)}>
            {Array.from({ length: sideCellCount }).map((_, i) => <Cell key={i} />)}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="srt__content">
        <div className="srt__content-top">
          <svg className="srt__quote-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M4.58 17.32C3.55 16.23 3 15 3 13.01c0-3.5 2.46-6.64 6.03-8.19l.9 1.38c-3.34 1.8-4 4.15-4.25 5.62.54-.28 1.24-.38 1.93-.31 1.8.17 3.23 1.65 3.23 3.49a3.5 3.5 0 0 1-3.5 3.5c-1.07 0-2.1-.49-2.75-1.18zm10 0C13.55 16.23 13 15 13 13.01c0-3.5 2.46-6.64 6.03-8.19l.9 1.38c-3.34 1.8-4 4.15-4.25 5.62.54-.28 1.24-.38 1.93-.31 1.8.17 3.23 1.65 3.23 3.49a3.5 3.5 0 0 1-3.5 3.5c-1.07 0-2.1-.49-2.75-1.18z" />
          </svg>

          <div className="srt__stage" aria-live="polite">
            {/* invisible sizer */}
            <div aria-hidden="true" className="srt__ghost">
              <p className="srt__quote">{current.quote}</p>
              <p className="srt__author">{current.name}, {current.role}</p>
            </div>
            <div key={displayIndex} className={cn('srt__block', exiting && 'scroll-reel-exit')}>
              <p className="srt__quote">
                <Chars text={current.quote} startIndex={0} staggerMs={charStaggerMs} />
              </p>
              <p className="srt__author">
                <Chars text={`${current.name}, ${current.role}`} startIndex={current.quote.length + 6} staggerMs={charStaggerMs} />
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="srt__controls">
          <button type="button" onClick={() => paginate(-1)} disabled={index === 0} aria-label="Témoignage précédent" className="srt__btn">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 2.5 3.5 6l4 3.5" /></svg>
          </button>
          <span className="srt__progress">{index + 1} / {count}</span>
          <button type="button" onClick={() => paginate(1)} disabled={index === count - 1} aria-label="Témoignage suivant" className="srt__btn">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 2.5 4 3.5-4 3.5" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScrollReelTestimonials;
