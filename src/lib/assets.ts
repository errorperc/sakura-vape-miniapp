const externalAssetPattern = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

export const publicAsset = (path: string) => {
  if (!path || externalAssetPattern.test(path)) {
    return path;
  }

  return `${import.meta.env.BASE_URL}${path.replace(/^\.?\//, '')}`;
};
