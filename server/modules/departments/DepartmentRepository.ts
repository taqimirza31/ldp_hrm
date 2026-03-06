/**
 * DepartmentRepository — all database interactions for the departments table.
 *
 * Rules:
 *  • Only raw SQL / ORM queries here. No business logic.
 *  • Never throw HTTP errors from here; throw plain JS errors or let them bubble.
 *  • All public methods are async and return typed results.
 *  • Use parameterized queries for all user input (neon tagged templates handle this).
 */

import { BaseRepository } from "../../core/base/BaseRepository.js";
import type { PaginationParams } from "../../core/types/index.js";
import type { CreateDepartmentInput, UpdateDepartmentInput } from "./Department.validators.js";

// ─── Raw row type returned from the DB ───────────────────────────────────────

export interface DepartmentRow {
  id: string;
  name: string;
  freshteam_id: string | null;
  created_at: Date;
  updated_at: Date;
  /** Computed by LEFT JOIN with employees table */
  employee_count: number;
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class DepartmentRepository extends BaseRepository {
  /**
   * Paginated list with optional name search.
   * Returns rows + total count (needed for pagination meta).
   */
  async findAll(params: PaginationParams): Promise<{ rows: DepartmentRow[]; total: number }> {
    const { search, limit, offset } = params;

    // Count first (separate query so we can paginate accurately)
    const [countRow] = (await (search
      ? this.sql`
          SELECT COUNT(*)::int AS total
          FROM departments
          WHERE name ILIKE ${this.likePattern(search)}`
      : this.sql`
          SELECT COUNT(*)::int AS total
          FROM departments`)) as [{ total: number }];

    const rows = (await (search
      ? this.sql`
          SELECT
            d.id,
            d.name,
            d.freshteam_id,
            d.created_at,
            d.updated_at,
            COUNT(e.id)::int AS employee_count
          FROM departments d
          LEFT JOIN employees e
            ON LOWER(e.department) = LOWER(d.name)
            AND e.employment_status NOT IN ('terminated', 'resigned', 'offboarded')
          WHERE d.name ILIKE ${this.likePattern(search)}
          GROUP BY d.id, d.name, d.freshteam_id, d.created_at, d.updated_at
          ORDER BY d.name ASC
          LIMIT ${limit} OFFSET ${offset}`
      : this.sql`
          SELECT
            d.id,
            d.name,
            d.freshteam_id,
            d.created_at,
            d.updated_at,
            COUNT(e.id)::int AS employee_count
          FROM departments d
          LEFT JOIN employees e
            ON LOWER(e.department) = LOWER(d.name)
            AND e.employment_status NOT IN ('terminated', 'resigned', 'offboarded')
          GROUP BY d.id, d.name, d.freshteam_id, d.created_at, d.updated_at
          ORDER BY d.name ASC
          LIMIT ${limit} OFFSET ${offset}`)) as DepartmentRow[];

    return { rows, total: countRow?.total ?? 0 };
  }

  /** Single department by primary key, with employee count. */
  async findById(id: string): Promise<DepartmentRow | null> {
    const rows = (await this.sql`
      SELECT
        d.id,
        d.name,
        d.freshteam_id,
        d.created_at,
        d.updated_at,
        COUNT(e.id)::int AS employee_count
      FROM departments d
      LEFT JOIN employees e
        ON LOWER(e.department) = LOWER(d.name)
        AND e.employment_status NOT IN ('terminated', 'resigned', 'offboarded')
      WHERE d.id = ${id}
      GROUP BY d.id, d.name, d.freshteam_id, d.created_at, d.updated_at
      LIMIT 1
    `) as DepartmentRow[];
    return rows[0] ?? null;
  }

  /** Look up by name (case-insensitive) — used for uniqueness checks. */
  async findByName(name: string): Promise<DepartmentRow | null> {
    const rows = (await this.sql`
      SELECT id, name, freshteam_id, created_at, updated_at, 0 AS employee_count
      FROM departments
      WHERE LOWER(name) = LOWER(${name})
      LIMIT 1
    `) as DepartmentRow[];
    return rows[0] ?? null;
  }

  /** Look up by FreshTeam ID — used for idempotent sync. */
  async findByFreshteamId(freshteamId: string): Promise<DepartmentRow | null> {
    const rows = (await this.sql`
      SELECT id, name, freshteam_id, created_at, updated_at, 0 AS employee_count
      FROM departments
      WHERE freshteam_id = ${freshteamId}
      LIMIT 1
    `) as DepartmentRow[];
    return rows[0] ?? null;
  }

  /** Insert a new department row and return it. */
  async create(data: CreateDepartmentInput): Promise<DepartmentRow> {
    const rows = (await this.sql`
      INSERT INTO departments (name, freshteam_id)
      VALUES (${data.name}, ${data.freshteamId ?? null})
      RETURNING id, name, freshteam_id, created_at, updated_at, 0 AS employee_count
    `) as DepartmentRow[];
    return rows[0];
  }

  /** Partial update — only supplied fields are changed. */
  async update(id: string, data: UpdateDepartmentInput): Promise<DepartmentRow | null> {
    const rows = (await this.sql`
      UPDATE departments
      SET
        name        = COALESCE(${data.name ?? null},        name),
        freshteam_id = CASE
                        WHEN ${data.freshteamId !== undefined}
                        THEN ${data.freshteamId ?? null}
                        ELSE freshteam_id
                      END,
        updated_at  = NOW()
      WHERE id = ${id}
      RETURNING id, name, freshteam_id, created_at, updated_at, 0 AS employee_count
    `) as DepartmentRow[];
    return rows[0] ?? null;
  }

  /** Hard delete. Returns true if a row was deleted. */
  async delete(id: string): Promise<boolean> {
    const rows = (await this.sql`
      DELETE FROM departments WHERE id = ${id} RETURNING id
    `) as { id: string }[];
    return rows.length > 0;
  }
}
