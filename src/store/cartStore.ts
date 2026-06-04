import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, Product } from '../types';

interface CartStore {
  items: CartItem[];
  addItem: (product: Product) => boolean;
  setQuantity: (product: Product, quantity: number) => boolean;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  getQuantity: (productId: string) => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product) => {
        if (!product.isActive || product.stockCount <= 0) {
          return false;
        }

        const current = get().items;
        const existing = current.find((item) => item.productId === product.id);

        if (!existing) {
          set({ items: [...current, { productId: product.id, quantity: 1 }] });
          return true;
        }

        if (existing.quantity >= product.stockCount) {
          return false;
        }

        set({
          items: current.map((item) =>
            item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item,
          ),
        });
        return true;
      },

      setQuantity: (product, quantity) => {
        const current = get().items;

        if (!product.isActive || product.stockCount <= 0 || quantity <= 0) {
          set({ items: current.filter((item) => item.productId !== product.id) });
          return product.stockCount > 0;
        }

        const nextQuantity = Math.min(quantity, product.stockCount);
        set({
          items: current.map((item) =>
            item.productId === product.id ? { ...item, quantity: nextQuantity } : item,
          ),
        });

        return nextQuantity === quantity;
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((item) => item.productId !== productId) });
      },

      clearCart: () => {
        set({ items: [] });
      },

      getQuantity: (productId) => {
        return get().items.find((item) => item.productId === productId)?.quantity ?? 0;
      },
    }),
    {
      name: 'vape-shop-cart',
      version: 1,
    },
  ),
);
