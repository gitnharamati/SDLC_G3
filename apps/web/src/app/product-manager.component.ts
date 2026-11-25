import { afterNextRender, Component, computed, effect, ElementRef, inject, Injector, input, output, signal, ViewChild } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule, NgForm } from '@angular/forms';
import { Product } from './catalogue.service';
import { PhotoPickerComponent } from './photo-picker.component';

interface Photo { id: number; url: string; previewUrl: string; }

@Component({
  selector: 'app-product-manager',
  standalone: true,
  imports: [FormsModule, PhotoPickerComponent],
  templateUrl: './product-manager.component.html'
})
export class ProductManagerComponent {
  private readonly http = inject(HttpClient);
  private readonly injector = inject(Injector);
  @ViewChild('editArea') private editArea?: ElementRef<HTMLElement>;
  @ViewChild('editName') private editName?: ElementRef<HTMLInputElement>;
  readonly canSave = input.required<boolean>();
  readonly refreshToken = input(0);
  readonly sessionEnded = output<void>();
  readonly busyChanged = output<boolean>();
  readonly products = signal<Product[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly busy = signal(false);
  readonly deleteRequested = signal(false);
  readonly editing = signal<Product | null>(null);
  readonly photos = signal<Photo[]>([]);
  readonly photoError = signal(false);
  readonly photoLoading = signal(false);
  readonly newPhotos = signal<File[]>([]);
  readonly photoReset = signal(0);
  readonly search = signal('');
  readonly filtered = computed(() => this.products().filter(p =>
    (p.name + ' ' + p.category + ' ' + p.room).toLowerCase().includes(this.search().toLowerCase())));
  details = { name: '', description: '', material: '', price: '', available: true };
  stock: Record<number, number | null> = {};
  private readonly headers = { 'X-Admin-Request': '1' };

  constructor() {
    effect(() => {
      const refresh = this.refreshToken();
      if (this.canSave()) this.load();
    });
  }

  load() {
    this.loading.set(true);
    this.http.get<{ products: Product[] }>('/api/admin/products').subscribe({
      next: result => { this.products.set(result.products); this.loading.set(false); },
      error: error => { this.handleError(error); this.loading.set(false); }
    });
  }
  open(product: Product) {
    if (this.busy()) return;
    this.deleteRequested.set(false);
    this.editing.set(product);
    this.error.set(''); this.message.set('');
    this.details = { name: product.name, description: product.description, material: product.material,
      price: (product.priceCents / 100).toFixed(2), available: product.available };
    this.stock = Object.fromEntries(product.variants.map(variant => [variant.id, variant.stock]));
    this.newPhotos.set([]); this.photoReset.update(n => n + 1);
    this.photos.set([]);
    this.loadPhotos(product.id);
    afterNextRender(() => {
      if (this.editing()?.id !== product.id) return;
      this.editName?.nativeElement.focus({ preventScroll: true });
      this.editArea?.nativeElement.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        block: 'start'
      });
    }, { injector: this.injector });
  }
  openById(id: number) {
    if (this.busy() || !this.canSave()) return;
    this.http.get<{products: Product[]}>('/api/admin/products').subscribe({
      next: result => { this.products.set(result.products); const product = result.products.find(p => p.id === id);
        if (product) this.open(product); else this.error.set('This product is no longer available to edit.'); },
      error: error => this.handleError(error)
    });
  }
  loadPhotos(id: number) {
    this.photoLoading.set(true);
    this.photoError.set(false);
    this.http.get<{ photos: Photo[] }>(`/api/admin/products/${id}/photos`).subscribe({
      next: result => {
        if (this.editing()?.id === id) { this.photos.set(result.photos); this.photoLoading.set(false); }
      },
      error: error => { if (this.editing()?.id === id) { this.handleError(error); this.photoError.set(true); this.photoLoading.set(false); } }
    });
  }
  saveDetails(form: NgForm) {
    const product = this.editing();
    if (!product || this.busy() || !this.canSave()) return;
    this.error.set(''); this.message.set('');
    const price = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(this.details.price.trim());
    const priceCents = price ? Number(price[1]) * 100 + Number((price[2] ?? '').padEnd(2, '0')) : 0;
    const stock = product.variants.map(row => ({ id: row.id, quantity: this.stock[row.id] }));
    if (form.invalid || !priceCents || stock.some(row => row.quantity === null || !Number.isSafeInteger(row.quantity) || row.quantity < 0 || row.quantity > 999999)) {
      this.error.set('Complete the details, enter a valid price and whole stock quantities.'); return;
    }
    this.setBusy(true);
    this.http.post(`/api/admin/products/${product.id}`, { ...this.details, priceCents, stock }, { headers: this.headers }).subscribe({
      next: () => { this.message.set('Product details and stock saved.'); this.setBusy(false); this.load(); },
      error: error => { this.handleError(error); this.setBusy(false); }
    });
  }
  mainPhoto(id: number) { this.photos.update(photos => [...photos.filter(p => p.id === id), ...photos.filter(p => p.id !== id)]); }
  removePhoto(id: number) { this.photos.update(photos => photos.filter(p => p.id !== id)); }
  savePhotos() {
    const product = this.editing();
    if (!product || !this.canSave() || this.busy() || this.photoLoading() || this.photoError()) return;
    this.error.set(''); this.message.set('');
    if (this.photos().length + this.newPhotos().length > 4) {
      this.error.set('A product can have up to four photos. Remove a photo first.'); return;
    }
    const data = new FormData();
    data.append('keepIds', JSON.stringify(this.photos().map(p => p.id)));
    this.newPhotos().forEach(file => data.append('photos', file));
    this.setBusy(true);
    this.http.post<{ photos: Photo[] }>(`/api/admin/products/${product.id}/photos`, data, { headers: this.headers }).subscribe({
      next: result => {
        this.photos.set(result.photos); this.newPhotos.set([]); this.photoReset.update(n => n + 1);
        this.message.set('Product photos saved. The first picture is shown in the shop.');
        this.setBusy(false); this.load();
      },
      error: error => { this.handleError(error); this.setBusy(false); }
    });
  }
  deleteProduct() {
    const product = this.editing();
    if (!product || !this.deleteRequested() || this.busy() || !this.canSave()) return;
    this.error.set(''); this.message.set(''); this.setBusy(true);
    this.http.post(`/api/admin/products/${product.id}/delete`, { confirmProductId: product.id }, { headers: this.headers }).subscribe({
      next: () => {
        this.products.update(products => products.filter(row => row.id !== product.id));
        this.editing.set(null); this.deleteRequested.set(false); this.photos.set([]);
        this.newPhotos.set([]); this.photoReset.update(n => n + 1);
        this.message.set(`Deleted ${product.name}.`); this.setBusy(false);
      },
      error: error => { this.handleError(error); this.setBusy(false); }
    });
  }
  private setBusy(value: boolean) { this.busy.set(value); this.busyChanged.emit(value); }
  private handleError(error: HttpErrorResponse) {
    if (error.status === 401) this.sessionEnded.emit();
    else this.error.set(error.error?.error || 'Could not complete the request. Try again.');
  }
}
