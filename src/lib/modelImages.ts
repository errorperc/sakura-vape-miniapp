import type { Product } from '../types';

export const placeholderImage = 'products/hqd-cuvie-plus.png';

// Готовые фото моделей из репозитория — доступны в галерее админки
export const bundledImages = [
  'products/generated/waka-extra-live-photo.webp',
  'products/generated/waka-extra-styled.webp',
  'products/generated/waka-10000-styled.webp',
  'products/generated/waka-sopro-20000-live-photo.webp',
  'products/generated/waka-sopro-20000-styled.webp',
  'products/generated/pafos-live-photo.webp',
  'products/generated/pafos-styled.webp',
  'products/generated/rick-morty-bad-trip-live-photo.webp',
  'products/generated/rick-morty-bat-trip-styled.webp',
];

const words = (value: string) => value.toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter(Boolean);
const normalizeImage = (image: string) => image.replace(/^\.?\//, '');

export const isPlaceholderImage = (image: string) => !image || normalizeImage(image) === placeholderImage;

/**
 * Фото той же модели: тот же бренд, и название одной позиции целиком начинает название другой.
 * «Sopro 20000» ↔ «Sopro 20000 Арбуз» — одна модель, «Sopro 20000» ↔ «Sopro 10000» — разные.
 */
export const findModelImage = (products: Product[], brand: string, name: string, excludeId?: string) => {
  const brandKey = words(brand).join(' ');
  const nameWords = words(name);
  if (!brandKey || nameWords.length === 0) return null;

  let best: { image: string; score: number } | null = null;
  for (const product of products) {
    if (product.id === excludeId || isPlaceholderImage(product.image) || words(product.brand).join(' ') !== brandKey) continue;

    const otherWords = words(product.name);
    const shorter = Math.min(otherWords.length, nameWords.length);
    if (shorter === 0 || !otherWords.slice(0, shorter).every((word, index) => word === nameWords[index])) continue;

    if (!best || shorter > best.score) best = { image: product.image, score: shorter };
  }

  return best?.image ?? null;
};

export const galleryImages = (products: Product[]) => {
  const seen = new Set<string>();
  return [...products.map((product) => product.image), ...bundledImages]
    .filter((image) => !isPlaceholderImage(image) && !image.startsWith('data:'))
    .filter((image) => {
      const key = normalizeImage(image);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};
