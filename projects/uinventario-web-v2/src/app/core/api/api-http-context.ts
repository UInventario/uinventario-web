import { HttpContextToken } from '@angular/common/http';

export const API_TIMEOUT_MS = new HttpContextToken<number>(() => 15_000);
export const API_RETRY_LIMIT = new HttpContextToken<number>(() => 1);
