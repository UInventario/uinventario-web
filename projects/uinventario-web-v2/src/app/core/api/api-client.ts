import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-runtime-config';

export interface ApiRequestOptions {
  readonly context?: HttpContext;
  readonly headers?: HttpHeaders | Record<string, string | string[]>;
  readonly params?: HttpParams | Record<string, string | number | boolean | readonly string[]>;
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  get<TResponse>(path: string, options: ApiRequestOptions = {}): Observable<TResponse> {
    return this.http.get<TResponse>(this.url(path), options);
  }

  post<TResponse, TBody>(
    path: string,
    body: TBody,
    options: ApiRequestOptions = {},
  ): Observable<TResponse> {
    return this.http.post<TResponse>(this.url(path), body, options);
  }

  put<TResponse, TBody>(
    path: string,
    body: TBody,
    options: ApiRequestOptions = {},
  ): Observable<TResponse> {
    return this.http.put<TResponse>(this.url(path), body, options);
  }

  patch<TResponse, TBody>(
    path: string,
    body: TBody,
    options: ApiRequestOptions = {},
  ): Observable<TResponse> {
    return this.http.patch<TResponse>(this.url(path), body, options);
  }

  delete<TResponse>(path: string, options: ApiRequestOptions = {}): Observable<TResponse> {
    return this.http.delete<TResponse>(this.url(path), options);
  }

  private url(path: string): string {
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw new Error('Las rutas API deben ser relativas y comenzar con /.');
    }
    return `${this.apiBaseUrl}${path}`;
  }
}
