import { useLayoutEffect, useRef, useState } from 'react';
import { publicAsset, thumbAsset } from '../lib/assets';
import type { ThumbWidth } from '../lib/assets';

interface ProductImageProps {
  src: string;
  width: ThumbWidth;
  alt?: string;
  eager?: boolean;
  /** Фото первого экрана: грузится первым и показывается без проявления */
  priority?: boolean;
  /** Подсказка браузеру, какой ширины будет фото на экране — для выбора размера из srcset */
  sizes?: string;
}

const srcSetWidths: ThumbWidth[] = [160, 320, 480, 900];

// Фото товара: миниатюра подходящей ширины, плавное появление и запасной вариант — оригинал
export function ProductImage({ src, width, alt = '', eager = false, priority = false, sizes }: ProductImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [fallback, setFallback] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  // Картинка из кэша может загрузиться раньше, чем React подпишется на onLoad, —
  // тогда событие теряется и фото навсегда остаётся прозрачным. Проверяем сами.
  useLayoutEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) setLoaded(true);
  }, [src, width, fallback]);
  const thumbSource = thumbAsset(src, width);
  const canUseSrcSet = !fallback && sizes && thumbSource !== publicAsset(src);

  return (
    <img
      ref={imageRef}
      className={`product-image ${loaded ? 'is-loaded' : ''} ${priority ? 'is-instant' : ''}`}
      src={fallback ? publicAsset(src) : thumbSource}
      srcSet={canUseSrcSet ? srcSetWidths.map((w) => `${thumbAsset(src, w)} ${w}w`).join(', ') : undefined}
      sizes={canUseSrcSet ? sizes : undefined}
      width={width}
      height={width}
      alt={alt}
      loading={eager || priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : 'auto'}
      onLoad={() => setLoaded(true)}
      onError={() => !fallback && setFallback(true)}
    />
  );
}
