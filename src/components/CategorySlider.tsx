import {
  Box,
  Boxes,
  Cpu,
  Droplets,
  LayoutGrid,
  Tag,
  Wrench,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { WheelEvent } from 'react';
import type { CatalogFilter } from '../types';

interface CategorySliderProps {
  filters: CatalogFilter[];
  activeFilterId: string;
  onChange: (filterId: string) => void;
}

const getFilterIcon = (filter: CatalogFilter) => {
  if (filter.mode === 'all') return LayoutGrid;
  if (filter.mode === 'brand') return Tag;
  if (filter.value === 'disposable') return Zap;
  if (filter.value === 'liquid') return Droplets;
  if (filter.value === 'pod') return Cpu;
  if (filter.value === 'cartridge') return Boxes;
  if (filter.value === 'accessory') return Wrench;

  return Box;
};

export function CategorySlider({ filters, activeFilterId, onChange }: CategorySliderProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [scrollEdges, setScrollEdges] = useState({ left: false, right: true });

  const updateScrollEdges = () => {
    const slider = sliderRef.current;

    if (!slider) {
      return;
    }

    setScrollEdges({
      left: slider.scrollLeft > 3,
      right: slider.scrollLeft + slider.clientWidth < slider.scrollWidth - 3,
    });
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!sliderRef.current || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      return;
    }

    sliderRef.current.scrollLeft += event.deltaY;
  };

  useEffect(() => {
    updateScrollEdges();
  }, [filters]);

  return (
    <div
      className={[
        'category-slider',
        scrollEdges.left ? 'category-slider--fade-left' : '',
        scrollEdges.right ? 'category-slider--fade-right' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Категории каталога"
      ref={sliderRef}
      onScroll={updateScrollEdges}
      onWheel={handleWheel}
    >
      {filters.map((filter) => {
        const Icon = getFilterIcon(filter);
        const isActive = filter.id === activeFilterId;

        return (
          <button
            className={`chip ${isActive ? 'chip--active' : ''}`}
            type="button"
            key={filter.id}
            aria-pressed={isActive}
            onClick={(event) => {
              onChange(filter.id);
              event.currentTarget.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center',
              });
            }}
          >
            <span className="chip__icon" aria-hidden="true">
              <Icon size={14} strokeWidth={2.25} />
            </span>
            <span className="chip__label">{filter.label}</span>
          </button>
        );
      })}
    </div>
  );
}
