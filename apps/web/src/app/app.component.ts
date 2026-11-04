import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { AdminComponent } from './admin.component';
import { CatalogueService, Product } from './catalogue.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CurrencyPipe, AdminComponent],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  readonly isAdmin = window.location.pathname.replace(/\/$/, '') === '/admin';
  private readonly catalogue = inject(CatalogueService);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly selected = signal<Product | null>(null);
  readonly totalVariants = computed(() => this.products().reduce((sum, p) => sum + p.variants.length, 0));
  ngOnInit() { if (!this.isAdmin) this.load(); }
  load() {
    this.loading.set(true);
    this.error.set('');
    this.catalogue.getProducts().subscribe({
      next: response => { this.products.set(response.products); this.loading.set(false); },
      error: () => { this.error.set('We could not load the catalogue. Please try again.'); this.loading.set(false); }
    });
  }
  totalStock(product: Product) { return product.variants.reduce((sum, v) => sum + v.stock, 0); }
}
