import { useState } from 'react';

interface StarRatingProps {
  value: number;          // 0-10 integer (half-stars)
  onChange?: (value: number) => void;
}

export default function StarRating({ value, onChange }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const display = hoverValue ?? value;
  const numericLabel = (display / 2).toFixed(1).replace(/\.0$/, '');
  const readonly = !onChange;

  function handleClick(starIndex: number, e: React.MouseEvent) {
    if (!onChange) return;
    e.preventDefault();
    // left click = full star, right click = half star
    if (e.type === 'contextmenu') {
      onChange(starIndex * 2 - 1);
    } else {
      onChange(starIndex * 2);
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(star => {
        const filled = display >= star * 2;
        const half = !filled && display >= star * 2 - 1;

        return (
          <span
            key={star}
            className={`text-xl select-none ${readonly ? '' : 'cursor-pointer'}`}
            onClick={e => handleClick(star, e)}
            onContextMenu={e => handleClick(star, e)}
            onMouseEnter={() => !readonly && setHoverValue(star * 2)}
            onMouseLeave={() => !readonly && setHoverValue(null)}
          >
            {filled ? (
              <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ) : half ? (
              <svg className="w-5 h-5" viewBox="0 0 20 20">
                <defs>
                  <linearGradient id={`half-${star}`}>
                    <stop offset="50%" stopColor="#f59e0b" />
                    <stop offset="50%" stopColor="#d6d3d1" />
                  </linearGradient>
                </defs>
                <path fill={`url(#half-${star})`} d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-stone-300" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            )}
          </span>
        );
      })}
      <span className="text-sm text-stone-600 ml-1">{numericLabel}</span>
    </span>
  );
}
