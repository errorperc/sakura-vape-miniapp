import type { CartItem, OrderItem, Product } from '../types';

export interface RepeatPlan {
  /** Какое количество выставить в корзине по каждому товару */
  set: { product: Product; quantity: number }[];
  /** Товары заказа, которых сейчас нет совсем */
  missing: string[];
  /** Товары, которых осталось меньше, чем было в заказе */
  reduced: string[];
}

// Повтор заказа: в корзине должно стать не меньше, чем было в заказе, но не больше остатка.
// То, что уже лежит в корзине, не уменьшаем.
export const planRepeat = (items: OrderItem[], products: Product[], cart: CartItem[]): RepeatPlan => {
  const plan: RepeatPlan = { set: [], missing: [], reduced: [] };

  for (const item of items) {
    const product = products.find((candidate) => candidate.id === item.productId);

    if (!product || !product.isActive || product.stockCount <= 0) {
      plan.missing.push(item.productName);
      continue;
    }

    const inCart = cart.find((entry) => entry.productId === product.id)?.quantity ?? 0;
    const quantity = Math.min(Math.max(inCart, item.quantity), product.stockCount);
    if (quantity < item.quantity) plan.reduced.push(item.productName);
    plan.set.push({ product, quantity });
  }

  return plan;
};

// Короткое пояснение для покупателя; пустая строка — всё добавлено как было
export const describeRepeat = (plan: RepeatPlan) => {
  const parts: string[] = [];
  if (plan.missing.length > 0) parts.push(`Нет в наличии: ${plan.missing.join(', ')}.`);
  if (plan.reduced.length > 0) parts.push(`Осталось меньше, чем было: ${plan.reduced.join(', ')}.`);
  if (parts.length > 0 && plan.set.length > 0) parts.push('Остальное добавлено.');
  return parts.join(' ');
};
