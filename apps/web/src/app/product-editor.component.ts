import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule, NgForm } from '@angular/forms';

interface Room { id: number; name: string; }
interface Category extends Room { subcategories: Room[]; }
interface Department extends Room { categories: Category[]; }
interface SavedProduct { id: number; name: string; available: boolean; variantCount: number; }

const initialDetails = () => ({ name: '', description: '', material: '', price: '', available: true });
const optionsFrom = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);
const validOptions = (values: string[]) => values.length >= 1 && values.length <= 12 &&
  values.every(value => value.length <= 60) &&
  new Set(values.map(value => value.toLowerCase())).size === values.length;

@Component({
  selector: 'app-product-editor',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './product-editor.component.html'
})
export class ProductEditorComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly canSave = input.required<boolean>();
  readonly sessionEnded = output<void>();
  readonly savingChanged = output<boolean>();
  readonly departments = signal<Department[]>([]);
  readonly loading = signal(true);
  readonly catalogueError = signal('');
  readonly error = signal('');
  readonly saved = signal<SavedProduct | null>(null);
  readonly saving = signal(false);
  readonly departmentId = signal(0);
  readonly categoryId = signal(0);
  readonly roomId = signal(0);
  readonly sizeText = signal('');
  readonly colourText = signal('');
  readonly sizes = computed(() => optionsFrom(this.sizeText()));
  readonly colours = computed(() => optionsFrom(this.colourText()));
  readonly stock = signal<Record<string, number | null>>({});
  details = initialDetails();
  readonly categories = computed(() => this.departments().find(d => d.id === this.departmentId())?.categories ?? []);
  readonly rooms = computed(() => this.categories().find(c => c.id === this.categoryId())?.subcategories ?? []);
  readonly variants = computed(() => this.optionsValid() ? this.sizes().flatMap(size =>
    this.colours().map(colour => ({ size, colour, key: JSON.stringify([size, colour]) }))) : []);
  readonly optionsValid = computed(() => validOptions(this.sizes()) && validOptions(this.colours()));

  ngOnInit() { this.loadPlacement(); }

  loadPlacement() {
    this.loading.set(true);
    this.catalogueError.set('');
    this.http.get<{ departments: Department[] }>('/api/catalogue').subscribe({
      next: result => {
        this.departments.set(result.departments);
        if (!result.departments.length) this.catalogueError.set('No departments are available.');
        this.loading.set(false);
      },
      error: () => { this.catalogueError.set('Could not load departments and categories.'); this.loading.set(false); }
    });
  }

  chooseDepartment(id: number) { this.departmentId.set(id); this.chooseCategory(0); }
  chooseCategory(id: number) { this.categoryId.set(id); this.roomId.set(0); }
  updateStock(key: string, value: number | null) { this.stock.update(stock => ({ ...stock, [key]: value })); }

  save(form: NgForm) {
    if (this.saving() || !this.canSave()) return;
    this.error.set('');
    this.saved.set(null);
    if (form.invalid || !this.roomId()) {
      this.error.set('Complete the required product fields and choose a room.');
      return;
    }
    const price = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(this.details.price.trim());
    const priceCents = price ? Number(price[1]) * 100 + Number((price[2] ?? '').padEnd(2, '0')) : 0;
    if (!priceCents) { this.error.set('Enter a price such as 24.99.'); return; }
    if (!this.optionsValid()) {
      this.error.set('Enter 1–12 different sizes and colours each, up to 60 characters per value.');
      return;
    }
    const stock = this.variants().map(row => Object.hasOwn(this.stock(), row.key) ? this.stock()[row.key] : 0);
    if (stock.some(value => value === null || !Number.isSafeInteger(value) || value < 0 || value > 999999)) {
      this.error.set('Enter a whole stock quantity from 0 to 999,999 for every combination.');
      return;
    }
    const { name, description, material, available } = this.details;
    const payload = { name, description, material, available, priceCents, departmentId: this.departmentId(),
      categoryId: this.categoryId(), roomId: this.roomId(), sizes: this.sizes(), colours: this.colours(), stock };
    this.setSaving(true);
    this.http.post<{ product: SavedProduct }>('/api/admin/products', payload, {
      headers: { 'X-Admin-Request': '1' }
    }).subscribe({
      next: ({ product }) => {
        this.details = initialDetails();
        this.chooseDepartment(0);
        this.sizeText.set('');
        this.colourText.set('');
        this.stock.set({});
        form.resetForm({ ...this.details, department: 0, category: 0, room: 0, sizes: '', colours: '' });
        this.saved.set(product);
        this.setSaving(false);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 401) this.sessionEnded.emit();
        else this.error.set(err.error?.error || 'Could not save the product. Try again.');
        this.setSaving(false);
      }
    });
  }

  private setSaving(value: boolean) { this.saving.set(value); this.savingChanged.emit(value); }
}
