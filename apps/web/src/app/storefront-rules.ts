import type { Product } from './catalogue.service';
export function cents(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(value.trim())) return NaN;
  const [whole, decimal = ''] = value.trim().split('.');
  return Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
}
export const totalStock = (p: Product) => p.variants.reduce((sum, v) => sum + v.stock, 0);
export function filterProducts(products: Product[], filters: {
  search?: string; category?: string | string[]; room?: string | string[];
  minimum?: string; maximum?: string; sort?: string;
} = {}) {
  const raw = (filters.search || '').trim().toLocaleLowerCase();
  const term = raw.length >= 2 ? raw : '';
  const low = cents(filters.minimum || ''), high = cents(filters.maximum || '');
  if (Number.isNaN(low) || Number.isNaN(high) || (low !== null && high !== null && low > high)) return [];
  const list = (value?: string | string[]) => Array.isArray(value) ? value : value ? [value] : [];
  const categories = list(filters.category), rooms = list(filters.room);
  return products.filter(p => p.available &&
    (!term || `${p.name} ${p.description} ${p.material}`.toLocaleLowerCase().includes(term)) &&
    (!categories.length || categories.includes(p.category)) && (!rooms.length || rooms.includes(p.room)) &&
    (low === null || p.priceCents >= low) && (high === null || p.priceCents <= high)).sort((a, b) => {
      if (filters.sort === 'price-asc') return a.priceCents - b.priceCents || a.id - b.id;
      if (filters.sort === 'price-desc') return b.priceCents - a.priceCents || a.id - b.id;
      const nameRank = (p: Product) => term && !p.name.toLocaleLowerCase().includes(term) ? 1 : 0;
      return nameRank(a) - nameRank(b) || Number(totalStock(a) === 0) - Number(totalStock(b) === 0) || a.id - b.id;
    });
}
