/**
 * BaseRepository — all domain repositories extend this.
 *
 * Provides:
 *   • A shared Neon SQL client (lazily reads DATABASE_URL at call time).
 *   • Common SQL-building helpers (like pattern, pagination).
 *
 * Do NOT add business logic here. Business rules belong in the Service layer.
 *
 * Extending example:
 *   export class DepartmentRepository extends BaseRepository {
 *     async findAll(params: PaginationParams) { … }
 *   }
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { PaginationParams } from "../types/index.js";

export abstract class BaseRepository {
  protected readonly sql: NeonQueryFunction<false, false>;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL environment variable is not set");
    this.sql = neon(url);
  }

  /**
   * Escape special LIKE metacharacters in a user-supplied search string.
   * Returns the pattern wrapped in % … % ready to pass to ILIKE.
   */
  protected likePattern(search: string): string {
    return `%${search.replace(/[%_\\]/g, "\\$&")}%`;
  }

  /**
   * Returns a simple LIMIT / OFFSET fragment.
   * Only call this after sanitizing params via parsePagination().
   */
  protected paginationClause(params: PaginationParams): string {
    return `LIMIT ${params.limit} OFFSET ${params.offset}`;
  }
}
