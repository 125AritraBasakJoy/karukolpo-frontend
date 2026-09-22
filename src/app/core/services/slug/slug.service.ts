import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api/api.service';

export type SlugKind = 'product' | 'category';

export interface SlugSuggestionResponse {
  /** Always free to use — the backend de-duplicates it. */
  suggestion: string;
  /** Whether the slug passed via the `slug` query param is free to use. */
  available: boolean;
  /** Human-readable reason when the typed slug is unavailable. */
  error: string | null;
}

/** Reserved words are real routes under /products/ and cannot be URL names. */
export const RESERVED_SLUGS = ['hot-deals', 'best-sellers', 'discount'];
/** Matches anything UUID-shaped (including bare ids). */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Lowercase letters, digits and single hyphens; no leading/trailing hyphen. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Best-effort local fallback when the suggestion API is unreachable.
 * ASCII-only by design — Bengali romanization needs the backend, so an empty
 * string is returned when no reliable slug can be derived.
 */
export function slugifyLocal(name: string): string {
  const slug = (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug;
}

/**
 * Full backend-compatible check — used to decide whether a typed slug can be
 * sent to the API at all. Bangla/mixed input fails this on purpose: the UI
 * does NOT block it, it just omits it so the backend derives a proper slug.
 */
export function isValidBackendSlug(slug: string): boolean {
  return !!slug && validateSlugLocal(slug) === null;
}

/**
 * Client-side pre-check so the form can show instant feedback before the
 * server round-trip. The backend remains the source of truth.
 */
export function validateSlugLocal(slug: string): string | null {
  if (!slug) return null;
  if (!SLUG_PATTERN.test(slug)) {
    return 'Use lowercase letters, digits and single hyphens only (no leading or trailing hyphen).';
  }
  if (UUID_PATTERN.test(slug)) {
    return 'IDs are not allowed as a URL name.';
  }
  if (RESERVED_SLUGS.includes(slug)) {
    return `'${slug}' is reserved and cannot be used as a URL name.`;
  }
  return null;
}

/**
 * Talks to GET /admin/slug-suggestion (admin-authenticated).
 *
 * - kind: product or category
 * - name: derives a de-duplicated suggestion from a name
 * - slug: validates the admin's typed value (available / error)
 *
 * Intended to be called debounced while the admin types.
 */
@Injectable({ providedIn: 'root' })
export class SlugService {
  constructor(private apiService: ApiService) { }

  getSuggestion(kind: SlugKind, options: { name?: string; slug?: string } = {}): Observable<SlugSuggestionResponse> {
    const params = new URLSearchParams();
    params.append('kind', kind);
    if (options.name && options.name.trim()) params.append('name', options.name.trim());
    if (options.slug && options.slug.trim()) params.append('slug', options.slug.trim());
    const qs = params.toString();
    return this.apiService.get<SlugSuggestionResponse>(`admin/slug-suggestion?${qs}`);
  }
}
