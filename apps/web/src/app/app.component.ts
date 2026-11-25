import { CartService } from './cart.service';
import { cents, filterProducts } from './storefront-rules';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
  private readonly http = inject(HttpClient);
  readonly adminSignedIn = signal(false);
  readonly cart = inject(CartService);
  readonly isCartPage = signal(window.location.pathname.replace(/\/$/, '') === '/cart');
  readonly isResultsPage = window.location.pathname === '/shop' || initial.size > 0;
  readonly filtersOpen = signal(false);
  readonly searchError = signal('');
  readonly filterCount = computed(() => this.category().length + this.room().length + Number(!!this.minimum()) + Number(!!this.maximum()) + Number(this.sort() !== 'relevance'));
  readonly sort = signal(initial.get('sort') || 'relevance');
  readonly quantity = signal<number | null>(1);
  readonly added = signal('');
  readonly isAdmin = window.location.pathname.replace(/\/$/, '') === '/admin';
  readonly isProductPage = window.location.pathname.startsWith('/products/');
  private readonly productId = /^\/products\/(\d+)\/?$/.exec(window.location.pathname)?.[1];
  private readonly catalogue = inject(CatalogueService);
  readonly products = signal<Product[]>([]);
  readonly categories = signal<{ id: number; name: string }[]>([]);
  readonly rooms = signal<string[]>([]);
  readonly loading = signal(true); readonly error = signal('');
  readonly search = signal(initial.get('search') || '');
  readonly category = signal<string[]>(initial.getAll('category'));
  readonly room = signal<string[]>(initial.getAll('room'));
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
  readonly filtered = computed(() => filterProducts(this.products(), {
    search:this.search(), category:this.category(), room:this.room(), minimum:this.minimum(),maximum:this.maximum(),sort:this.sort()
  }));
  readonly activeFilters = computed(() => [
    ...this.category(), ...this.room(), this.minimum() ? 'Minimum $'+this.minimum() : '', this.maximum() ? 'Maximum $'+this.maximum() : ''
  ].filter(Boolean).join(' · '));
  readonly selectionMessage = computed(() => {
    if (!this.size() || !this.colour()) return !this.size() && !this.colour()
      ? 'Choose a size and colour to add this item to your cart' : !this.size()
      ? 'Choose a size to add this item to your cart' : 'Choose a colour to add this item to your cart';
    const v = this.chosenVariant();
    if (!v || !v.stock) return 'Out of stock for this combination';
    return `${v.stock} in stock for ${this.size()}, ${this.colour()}`;
  });
  readonly quantityError = computed(() => {
    const stock = this.chosenVariant()?.stock || 0, qty = this.quantity();
    return stock && (qty === null || !Number.isSafeInteger(qty) || qty < 1 || qty > stock) ? `Quantity can be 1 to ${stock}` : '';
  });
  readonly shopLink = computed(() => '/shop'+this.queryString()+'#collection');
  ngOnInit() {
    if (!this.isAdmin) {
      this.load();
      this.checkAdminSession();
      window.addEventListener('focus', () => this.checkAdminSession());
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) this.checkAdminSession();
      });
    }
    if (this.isCartPage()) void this.cart.refresh();
    window.addEventListener('popstate', () => window.location.reload());
  }
  private checkAdminSession() {
    this.http.get('/api/admin/session').subscribe({
      next: () => this.adminSignedIn.set(true),
      error: () => this.adminSignedIn.set(false)
    });
  }
  load() {
    this.loading.set(true); this.error.set('');
    forkJoin({ products: this.catalogue.getProducts(), catalogue: this.catalogue.getCatalogue() }).subscribe({
      next: result => {
        this.products.set(result.products.products);
        const categories = result.catalogue.departments.flatMap(d => d.categories);
        this.categories.set(categories.map(c => ({id:c.id,name:c.name})));
        this.rooms.set([...new Set(categories.flatMap(c => c.subcategories.map(r => r.name)))].sort());
        const single = (values: string[]) => values.length === 1 ? values[0] : '';
        this.size.set(single(this.sizes())); this.colour.set(single(this.colours()));
        this.loading.set(false);
        if (this.isProductPage) document.title = (this.product()?.name || 'Product unavailable') + ' | Home Décor';
      },
      error: () => { this.error.set('We could not load the catalogue. Please try again.'); this.loading.set(false); }
    });
  }
  submitSearch(value: string) {
    const term = value.trim();
    if (term.length === 1) {
      this.searchError.set('Enter at least 2 characters to search.');
      return;
    }
    this.searchError.set('');
    const query = new URLSearchParams();
    if (term) query.set('search', term);
    // Explicit navigation is needed because Angular intercepts form submits.
    // A new global search starts without filters from the previous query.
    window.location.assign('/shop' + (query.size ? '?' + query.toString() : '') + '#collection');
  }
  applyFilters() {
    if (this.priceError()) return;
    this.updateUrl(); this.closeFilters();
  }
  closeFilters() {
    this.filtersOpen.set(false);
    document.getElementById('filter-sort-toggle')?.focus({ preventScroll: true });
  }
  private cents = cents;
  setFilter(key: Filter, value: string) {
    if (key === 'category' || key === 'room') this[key].set(value ? [value] : []);
    else this[key].set(String(value ?? ''));
    this.updateUrl();
  }
  toggleFilter(key: 'category' | 'room', value: string) {
    this[key].update(values => values.includes(value) ? values.filter(v => v !== value) : [...values, value]);
    this.updateUrl();
  }
  updateUrl() { window.history.replaceState(null, '', '/shop'+this.queryString()+'#collection'); }
  clearFilters() {
    this.category.set([]); this.room.set([]); this.minimum.set(''); this.maximum.set(''); this.sort.set('relevance');
    this.updateUrl();
  }
  private queryString() {
    const query = new URLSearchParams();
    for (const key of ['search','minimum','maximum'] as const) if (this[key]()) query.set(key,this[key]());
    for (const key of ['category','room'] as const) for (const value of this[key]()) query.append(key,value);
    if (this.sort() !== 'relevance') query.set('sort',this.sort());
    return query.size ? '?' + query.toString() : '';
  }
  optionEnabled(type: string, value: string) {
    return this.product()?.variants.some(v => v.stock > 0 && v.options.some(o => o.name === type && o.value === value)) || false;
  }
  selectOption(type: 'Size' | 'Colour', value: string) {
    (type === 'Size' ? this.size : this.colour).set(value); this.added.set('');
  }
  async addToCart() {
    const p = this.product(), v = this.chosenVariant(), qty = this.quantity();
    if (!p || !v?.stock || !qty || this.quantityError()) return;
    if (await this.cart.add(p.id,v.id,qty,p.priceCents)) this.added.set(`Added ${p.name}, ${this.size()}, ${this.colour()} to your cart.`);
  }
  openCart(event: Event) {
    event.preventDefault(); this.isCartPage.set(true); this.added.set('');
    window.history.pushState(null,'','/cart'); document.title = 'Cart | Home Décor';
    window.scrollTo({top:0}); void this.cart.refresh();
  }
  swipeStart = 0;
  swipePhoto(event: TouchEvent) {
    const item = this.product();
    if (!item || item.photos.length < 2) return;
    const distance = event.changedTouches[0].clientX - this.swipeStart;
    if (Math.abs(distance) < 50) return;
    const photos = item.photos.filter(p => !this.brokenPhotos().includes(p));
    const current = photos.indexOf(this.photoFor(item));
    if (photos.length) this.choosePhoto(item,photos[(current + (distance < 0 ? 1 : photos.length-1)) % photos.length]);
  }
  productLink(id: number) { return '/products/'+id+this.queryString(); }
  categoryLink(name: string) { return '/shop?category='+encodeURIComponent(name)+'#collection'; }
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
