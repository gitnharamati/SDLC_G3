import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AdminComponent } from './admin.component';
import { CatalogueService, Product } from './catalogue.service';

type Filter = 'search' | 'category' | 'room' | 'minimum' | 'maximum';
const initial = new URLSearchParams(window.location.search);
@Component({
  selector: 'app-root', standalone: true,
  imports: [CurrencyPipe, FormsModule, AdminComponent], templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  readonly isAdmin = window.location.pathname.replace(/\/$/, '') === '/admin';
  readonly isProductPage = window.location.pathname.startsWith('/products/');
  private readonly productId = /^\/products\/(\d+)\/?$/.exec(window.location.pathname)?.[1];
  private readonly catalogue = inject(CatalogueService);
  readonly products = signal<Product[]>([]);
  readonly categories = signal<{ id: number; name: string }[]>([]);
  readonly rooms = signal<string[]>([]);
  readonly loading = signal(true); readonly error = signal('');
  readonly search = signal(initial.get('search') || '');
  readonly category = signal(initial.get('category') || '');
  readonly room = signal(initial.get('room') || '');
  readonly minimum = signal(initial.get('minimum') || '');
  readonly maximum = signal(initial.get('maximum') || '');
  readonly chosenPhotos = signal<Record<number, string>>({});
  readonly brokenPhotos = signal<string[]>([]);
  readonly size = signal(''); readonly colour = signal('');
  readonly product = computed(() => this.products().find(p => p.id === Number(this.productId)) || null);
  readonly sizes = computed(() => this.optionValues('Size'));
  readonly colours = computed(() => this.optionValues('Colour'));
  readonly chosenVariant = computed(() => this.product()?.variants.find(v =>
    v.options.some(o => o.name === 'Size' && o.value === this.size()) &&
    v.options.some(o => o.name === 'Colour' && o.value === this.colour())));
  readonly priceError = computed(() => {
    const low = this.cents(this.minimum()), high = this.cents(this.maximum());
    if (Number.isNaN(low) || Number.isNaN(high)) return 'Enter prices of zero or more, using up to two decimal places.';
    return low !== null && high !== null && low > high ? 'Minimum price must not exceed maximum price.' : '';
  });
  readonly filtered = computed(() => {
    if (this.priceError()) return [];
    const term = this.search().trim().toLocaleLowerCase();
    const low = this.cents(this.minimum()), high = this.cents(this.maximum());
    return this.products().filter(p => p.available &&
      (!term || `${p.name} ${p.description} ${p.material}`.toLocaleLowerCase().includes(term)) &&
      (!this.category() || p.category === this.category()) && (!this.room() || p.room === this.room()) &&
      (low === null || p.priceCents >= low) && (high === null || p.priceCents <= high));
  });
  readonly shopLink = computed(() => '/'+this.queryString()+'#collection');
  ngOnInit() { if (!this.isAdmin) this.load(); }
  load() {
    this.loading.set(true); this.error.set('');
    forkJoin({ products: this.catalogue.getProducts(), catalogue: this.catalogue.getCatalogue() }).subscribe({
      next: result => {
        this.products.set(result.products.products);
        const categories = result.catalogue.departments.flatMap(d => d.categories);
        this.categories.set(categories.map(c => ({id:c.id,name:c.name})));
        this.rooms.set([...new Set(categories.flatMap(c => c.subcategories.map(r => r.name)))].sort());
        this.loading.set(false);
        if (this.isProductPage) document.title = (this.product()?.name || 'Product unavailable') + ' | Home Décor';
      },
      error: () => { this.error.set('We could not load the catalogue. Please try again.'); this.loading.set(false); }
    });
  }
  private cents(value: string): number | null {
    if (!value.trim()) return null;
    if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(value.trim())) return NaN;
    const [whole, decimal = ''] = value.trim().split('.');
    return Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  }
  setFilter(key: Filter, value: string) {
    this[key].set(String(value ?? ''));
    window.history.replaceState(null, '', '/'+this.queryString()+'#collection');
  }
  clearFilters() {
    for (const key of ['search','category','room','minimum','maximum'] as Filter[]) this[key].set('');
    window.history.replaceState(null, '', '/#collection');
  }
  private queryString() {
    const query = new URLSearchParams();
    for (const key of ['search','category','room','minimum','maximum'] as Filter[]) if (this[key]()) query.set(key,this[key]());
    return query.size ? '?' + query.toString() : '';
  }
  productLink(id: number) { return '/products/'+id+this.queryString(); }
  categoryLink(name: string) { return '/?category='+encodeURIComponent(name)+'#collection'; }
  private optionValues(name: string) {
    return [...new Set(this.product()?.variants.flatMap(v => v.options.filter(o => o.name === name).map(o => o.value)) || [])];
  }
  photoFor(product: Product) { return this.chosenPhotos()[product.id] || product.photos.find(photo => !this.brokenPhotos().includes(photo)) || ''; }
  choosePhoto(product: Product, photo: string) { this.chosenPhotos.update(photos => ({ ...photos, [product.id]: photo })); }
  photoFailed(product: Product, photo: string) {
    this.brokenPhotos.update(photos => photos.includes(photo) ? photos : [...photos, photo]);
    this.chosenPhotos.update(photos => { const copy = { ...photos }; delete copy[product.id]; return copy; });
  }
  totalStock(product: Product) { return product.variants.reduce((sum, v) => sum + v.stock, 0); }
}
