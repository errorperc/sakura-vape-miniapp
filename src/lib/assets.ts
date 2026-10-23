const externalAssetPattern = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

export const publicAsset = (path: string) => {
  if (!path || externalAssetPattern.test(path)) {
    return path;
  }

  return `${import.meta.env.BASE_URL}${path.replace(/^\.?\//, '')}`;
};

export type ThumbWidth = 160 | 480 | 900;

// Миниатюра WebP с сервера для локальных фото; внешние ссылки и data URL отдаём как есть
export const thumbAsset = (path: string, width: ThumbWidth) => {
  if (!path || externalAssetPattern.test(path) || !/\.(webp|png|jpe?g)$/i.test(path)) {
    return publicAsset(path);
  }

  return `/thumbs/${width}/${path.replace(/^\.?\//, '')}`;
};
