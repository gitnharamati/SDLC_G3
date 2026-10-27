import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface Variant { id: number; sku: string; stock: number; options: { name: string; value: string }[]; }
export interface Product {
  id: number; name: string; description: string; material: string; priceCents: number;
  available: boolean; room: string; category: string; department: string; photos: string[]; variants: Variant[];
}
@Injectable({ providedIn: 'root' })
export class CatalogueService {
  private readonly http = inject(HttpClient);
  getProducts() { return this.http.get<{ products: Product[] }>('/api/products'); }
}
