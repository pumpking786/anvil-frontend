import type { LineItem, Product } from './types';
// Retain the existing stored format: the first line is the product title, followed
// by its sales description. This also works for quotations saved before this UI.
export function splitItemDescription(description: string) {
  const [title, ...details] = description.split(/\r?\n/);
  return { title, details: details.join('\n') };
}
export function joinItemDescription(title: string, details: string) {
  return details ? `${title}\n${details}` : title;
}
export function searchProducts(products: Product[], query: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return products.filter((p) => {
    const text = `${p.name} ${p.sku} ${p.topic} ${p.salesDescription}`.toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });
}
export function addProductLine(items: LineItem[], product: Product, id: string): LineItem[] {
  const empty = items.findIndex(
    (i) => !i.description.trim() && i.quantity === 1 && i.unitPrice === 0,
  );
  if (items.length >= 200 && empty < 0) return items;
  const item: LineItem = {
    id,
    description: [product.name, product.salesDescription].filter(Boolean).join('\n'),
    quantity: 1,
    unitPrice: product.salePrice,
  };
  if (empty >= 0)
    return items.map((value, index) =>
      index === empty ? { ...item, id: value.id, appearance: value.appearance } : value,
    );
  return [...items, item];
}

// Replace only the selected row; retain quantity, identity and the user's formatting.
export function selectProductForLine(item: LineItem, product: Product): LineItem {
  return {
    ...item,
    description: joinItemDescription(product.name, product.salesDescription),
    unitPrice: product.salePrice,
  };
}
