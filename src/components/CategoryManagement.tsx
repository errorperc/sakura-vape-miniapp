import { FolderPlus, Save, Tags, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { CatalogCategory, Product } from '../types';

interface CategoryManagementProps {
  categories: CatalogCategory[];
  products: Product[];
  onCreate: (label: string) => Promise<void>;
  onRename: (id: string, label: string) => Promise<void>;
  onDelete: (id: string) => Promise<boolean>;
}

export function CategoryManagement({
  categories,
  products,
  onCreate,
  onRename,
  onDelete,
}: CategoryManagementProps) {
  const [newLabel, setNewLabel] = useState('');
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    setLabels(Object.fromEntries(categories.map((category) => [category.id, category.label])));
  }, [categories]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onCreate(newLabel.trim());
    setNewLabel('');
    setMessage('Категория добавлена.');
  };

  const productCount = (categoryId: string) =>
    products.filter((product) => product.category === categoryId).length;

  return (
    <section className="category-management">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Структура каталога</span>
          <h2>Категории товаров</h2>
        </div>
        <span className="category-management__count">
          <Tags size={15} aria-hidden="true" />
          {categories.length}
        </span>
      </div>

      <form className="category-add" onSubmit={submit}>
        <input
          required
          value={newLabel}
          onChange={(event) => setNewLabel(event.target.value)}
          placeholder="Новая категория"
        />
        <button className="icon-button category-add__button" type="submit" title="Добавить категорию">
          <FolderPlus size={17} aria-hidden="true" />
        </button>
      </form>

      <div className="category-editor-list">
        {categories.map((category) => {
          const count = productCount(category.id);

          return (
            <article className="category-editor-row" key={category.id}>
              <span className="category-editor-row__count">{count}</span>
              <input
                value={labels[category.id] ?? category.label}
                onChange={(event) =>
                  setLabels((current) => ({ ...current, [category.id]: event.target.value }))
                }
                aria-label={`Название категории ${category.label}`}
              />
              <button
                className="icon-button"
                type="button"
                onClick={async () => {
                  await onRename(category.id, labels[category.id] ?? category.label);
                  setMessage('Название категории обновлено.');
                }}
                title="Сохранить название"
              >
                <Save size={15} aria-hidden="true" />
              </button>
              <button
                className="icon-button icon-button--danger"
                type="button"
                disabled={count > 0}
                onClick={async () => {
                  if (await onDelete(category.id)) {
                    setMessage('Пустая категория удалена.');
                  }
                }}
                title={count > 0 ? 'Сначала перенесите товары в другую категорию' : 'Удалить категорию'}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </article>
          );
        })}
      </div>

      {message ? <p className="form-note category-management__message">{message}</p> : null}
    </section>
  );
}
