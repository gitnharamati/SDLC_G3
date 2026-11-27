import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
export interface CartItem { productId: number; variantId: number; qty: number; }
export interface CartLine extends CartItem {
  available: boolean; stock: number; priceCents?: number; lineCents: number; name?: string;
  category?: string; room?: string; photos?: string[]; options?: { name: string; value: string }[]; note?: string;
}
const key = 'home-decor-cart-v1';
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  readonly items = signal<CartItem[]>(this.restore());
  readonly lines = signal<CartLine[]>([]);
  readonly busy = signal(false); readonly error = signal(''); readonly storageWarning = signal('');
  readonly count = computed(() => this.items().reduce((n, line) => n + line.qty, 0));
  readonly totalCents = computed(() => this.lines().reduce((n, line) => n + line.lineCents, 0));
  private prices = new Map<number, number>();
  private restore(): CartItem[] {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(raw)) return [];
      const clean = raw.filter(x => x && [x.productId,x.variantId,x.qty].every(Number.isSafeInteger) &&
        x.productId > 0 && x.variantId > 0 && x.qty > 0 && x.qty <= 999999).slice(0,100);
      return [...new Map(clean.map(x => [x.variantId, {productId:x.productId,variantId:x.variantId,qty:x.qty}])).values()];
    } catch { return []; }
  }
  private persist(lines: CartLine[]) {
    // Zero-stock and unavailable rows remain removable and are excluded from totals.
    this.items.set(lines.map(line => ({ productId: line.productId, variantId: line.variantId,
      qty: line.qty > 0 ? line.qty : 1 })));
    try { localStorage.setItem(key, JSON.stringify(this.items())); }
    catch { this.storageWarning.set('Your browser could not save this cart. Keep this page open to retain it.'); }
  }
  private async check(items: CartItem[]) {
    const result = await firstValueFrom(this.http.post<{lines: CartLine[]}>('/api/cart/check', {lines:items}));
    return result.lines.map(line => {
      const previous = this.prices.get(line.variantId);
      if (line.priceCents !== undefined) this.prices.set(line.variantId,line.priceCents);
      const priceNote = previous !== undefined && line.priceCents !== undefined && previous !== line.priceCents
        ? `Price updated from $${(previous/100).toFixed(2)} to $${(line.priceCents/100).toFixed(2)}` : '';
      return {...line, note:[line.note,priceNote].filter(Boolean).join('. ')};
    });
  }
  completeOrder() {
    this.items.set([]); this.lines.set([]); this.prices.clear(); this.error.set('');
    try { localStorage.removeItem(key); } catch { this.storageWarning.set('The order is saved. Clear the old cart in this browser before shopping again.'); }
  }
  async refresh() {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    try { const lines = await this.check(this.items()); this.lines.set(lines); this.persist(lines); }
    catch { this.error.set('Could not check the cart. Try again before continuing.'); }
    finally { this.busy.set(false); }
  }
  async add(productId: number, variantId: number, qty: number, displayedPrice: number) {
    if (this.busy()) return false;
    this.busy.set(true); this.error.set(''); this.prices.set(variantId,displayedPrice);
    try {
      const items = this.items().map(line => ({...line}));
      const existing = items.find(line => line.variantId === variantId && line.productId === productId);
      if (existing) existing.qty += qty; else items.push({productId,variantId,qty});
      const lines = await this.check(items);
      const added = lines.find(line => line.variantId === variantId && line.productId === productId);
      if (!added?.available) throw new Error('This item is no longer available');
      const requested = items.find(line => line.variantId === variantId)!.qty;
      if (added.stock < requested) throw new Error(`Only ${added.stock} left. Check the quantity already in your cart.`);
      this.lines.set(lines); this.persist(lines); return true;
    } catch (error) { this.error.set(error instanceof Error && !('status' in error) ? error.message : 'Could not add this item. Please try again.'); return false; }
    finally { this.busy.set(false); }
  }
  async update(variantId: number, value: number | null) {
    if (this.busy()) return;
    if (!Number.isSafeInteger(value) || value === null || value < 1 || value > 999999) {
      this.error.set('Quantity must be a whole number from 1 to 999,999. Use Remove to delete an item.'); return;
    }
    const previous = this.items();
    this.items.update(items => items.map(line => line.variantId === variantId ? {...line,qty:value} : line));
    await this.refresh();
    if (this.error()) this.items.set(previous);
  }
  async remove(variantId: number) {
    if (this.busy()) return;
    this.items.update(items => items.filter(line => line.variantId !== variantId));
    this.lines.update(lines => lines.filter(line => line.variantId !== variantId));
    try { localStorage.setItem(key,JSON.stringify(this.items())); } catch { /* The visible cart remains usable. */ }
    await this.refresh();
  }
}
