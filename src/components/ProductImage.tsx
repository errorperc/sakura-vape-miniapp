import { useState } from 'react';
import { publicAsset, thumbAsset } from '../lib/assets';
import type { ThumbWidth } from '../lib/assets';

interface ProductImageProps {
  src: string;
  width: ThumbWidth;
  alt?: string;
  eager?: boolean;
}

// Фото товара: миниатюра нужной ширины, плавное появление и запасной вариант — оригинал
export function ProductImage({ src, width, alt = '', eager = false }: ProductImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [fallback, setFallback] = useState(false);

  return (
    <img
      className={`product-image ${loaded ? 'is-loaded' : ''}`}
      src={fallback ? publicAsset(src) : thumbAsset(src, width)}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => !fallback && setFallback(true)}
    />
  );
}
