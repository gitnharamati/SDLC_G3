import { Component, OnDestroy, effect, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-photo-picker',
  standalone: true,
  template: `
    <label class="photo-upload-label">Choose product photos
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple
        [disabled]="disabled()" (change)="choose($event)">
    </label>
    <p class="editor-note">JPG, PNG or WebP. Up to {{ limit() }} new photo(s), 5 MB each. The first photo is the main picture.</p>
    @if (error()) { <p class="admin-error" role="alert">{{ error() }}</p> }
    <div class="photo-grid">
      @for (photo of photos(); track photo.url; let i = $index) {
        <div class="photo-tile">
          <img [src]="photo.url" [alt]="'Selected photo ' + (i + 1)">
          <span>{{ photo.file.name }}</span>
          <button type="button" class="small-button" [disabled]="disabled()" (click)="remove(i)">Remove selected photo {{ i + 1 }}</button>
        </div>
      }
    </div>
  `
})
export class PhotoPickerComponent implements OnDestroy {
  readonly limit = input(4);
  readonly disabled = input(false);
  readonly resetToken = input(0);
  readonly filesChanged = output<File[]>();
  readonly photos = signal<{ file: File; url: string }[]>([]);
  readonly error = signal('');
  private lastReset = 0;

  constructor() {
    effect(() => {
      const token = this.resetToken();
      if (token !== this.lastReset) { this.lastReset = token; this.clear(); }
    });
  }
  choose(event: Event) {
    const field = event.target as HTMLInputElement;
    const incoming = Array.from(field.files ?? []);
    field.value = '';
    this.error.set('');
    if (incoming.length + this.photos().length > this.limit()) {
      this.error.set('Choose fewer photos. This product can have up to four in total.'); return;
    }
    if (incoming.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      this.error.set('Use JPG, PNG or WebP photos of 5 MB or less.'); return;
    }
    this.photos.update(photos => [...photos, ...incoming.map(file => ({ file, url: URL.createObjectURL(file) }))]);
    this.publish();
  }
  remove(index: number) {
    URL.revokeObjectURL(this.photos()[index].url);
    this.photos.update(photos => photos.filter((_, i) => i !== index));
    this.publish();
  }
  private publish() { this.filesChanged.emit(this.photos().map(photo => photo.file)); }
  private clear() {
    this.photos().forEach(photo => URL.revokeObjectURL(photo.url));
    this.photos.set([]); this.error.set(''); this.publish();
  }
  ngOnDestroy() { this.photos().forEach(photo => URL.revokeObjectURL(photo.url)); }
}
