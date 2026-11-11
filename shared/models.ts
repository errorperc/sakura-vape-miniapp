// Модель и её вкусы. В базе каждый вкус — отдельный товар со своим остатком;
// в одну карточку их собирает совпадение бренда и названия модели.

export const flavorPlaceholder = 'Уточните вкус в админке';

// Настоящий вкус или пустая строка: заглушку из стартового каталога покупателю не показываем
export const realFlavor = (taste: string | null | undefined) => {
  const value = (taste ?? '').replace(/\s+/g, ' ').trim();
  return value && value.toLowerCase() !== flavorPlaceholder.toLowerCase() ? value : '';
};

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();

export const modelKey = (product: { brand: string; name: string }) => `${normalize(product.brand)}|${normalize(product.name)}`;

export interface ProductModel<T> {
  key: string;
  brand: string;
  name: string;
  variants: T[];
}

// Собирает товары в модели, сохраняя порядок первого появления
export const groupByModel = <T extends { brand: string; name: string }>(products: T[]): ProductModel<T>[] => {
  const models = new Map<string, ProductModel<T>>();

  for (const product of products) {
    const key = modelKey(product);
    const model = models.get(key);
    if (model) model.variants.push(product);
    else models.set(key, { key, brand: product.brand, name: product.name, variants: [product] });
  }

  return [...models.values()];
};

// Название строки заказа: «Waka Sopro 20000 · Арбуз»
export const orderItemTitle = (title: string, flavor: string | null | undefined) => {
  const taste = realFlavor(flavor);
  return taste ? `${title} · ${taste}` : title;
};

// 1 вкус, 2 вкуса, 5 вкусов
export const flavorCountLabel = (count: number) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} вкус`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} вкуса`;
  return `${count} вкусов`;
};
