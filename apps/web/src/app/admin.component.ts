import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-admin',
  standalone: true,
  template: `
    <main id="main-content" tabindex="-1" class="admin-shell">
      <section class="admin-card" aria-labelledby="admin-title">
        <a class="back-link" href="/">← Back to shop</a>
        <p class="eyebrow">✦ &nbsp; Store access</p>
        <h1 id="admin-title">Admin area</h1>
        @if (busy() && !loaded()) {
          <p role="status">Checking sign-in…</p>
        } @else if (signedIn()) {
          <p class="admin-status" role="status">You’re signed in as an admin.</p>
          <button type="button" (click)="logout()" [disabled]="busy()">Sign out</button>
        } @else {
          <form (submit)="login($event, password)">
            <label for="admin-password">Admin password</label>
            <input id="admin-password" #password type="password" required
              maxlength="256" autocomplete="current-password">
            <button type="submit" [disabled]="busy()">Sign in</button>
          </form>
        }
        @if (error()) { <p class="admin-error" role="alert">{{ error() }}</p> }
      </section>
    </main>
  `
})
export class AdminComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly headers = { 'X-Admin-Request': '1' };
  readonly signedIn = signal(false);
  readonly busy = signal(true);
  readonly loaded = signal(false);
  readonly error = signal('');

  ngOnInit() {
    this.http.get('/api/admin/session').subscribe({
      next: () => { this.signedIn.set(true); this.finish(); },
      error: (err: HttpErrorResponse) => {
        if (err.status !== 401) this.showError(err);
        this.finish();
      }
    });
  }
  login(event: Event, input: HTMLInputElement) {
    event.preventDefault();
    if (this.busy()) return;
    const password = input.value;
    input.value = '';
    this.busy.set(true);
    this.error.set('');
    this.http.post('/api/admin/login', { password }, { headers: this.headers }).subscribe({
      next: () => { this.signedIn.set(true); this.finish(); },
      error: err => { this.showError(err); this.finish(); }
    });
  }
  logout() {
    this.busy.set(true);
    this.error.set('');
    this.http.post('/api/admin/logout', {}, { headers: this.headers }).subscribe({
      next: () => { this.signedIn.set(false); this.finish(); },
      error: err => { this.showError(err); this.finish(); }
    });
  }
  private finish() { this.loaded.set(true); this.busy.set(false); }
  private showError(err: HttpErrorResponse) {
    this.error.set(err.error?.error || 'Could not reach the server. Try again.');
  }
}
