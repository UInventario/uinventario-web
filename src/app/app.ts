import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { RuntimeConfigService } from './core/runtime-config.service';

type ApiStatus = 'checking' | 'online' | 'offline';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App implements OnInit {
  private readonly runtimeConfig = inject(RuntimeConfigService);

  protected readonly apiStatus = signal<ApiStatus>('checking');
  protected readonly apiBaseUrl = this.runtimeConfig.apiBaseUrl;

  ngOnInit(): void {
    void this.checkApi();
  }

  protected async checkApi(): Promise<void> {
    this.apiStatus.set('checking');

    try {
      const response = await fetch(`${this.apiBaseUrl()}/health/ready`);
      const body = (await response.json()) as { status?: string };
      this.apiStatus.set(response.ok && body.status === 'ok' ? 'online' : 'offline');
    } catch {
      this.apiStatus.set('offline');
    }
  }
}
