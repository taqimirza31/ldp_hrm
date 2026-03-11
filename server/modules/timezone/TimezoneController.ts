import type { Request, Response, NextFunction } from "express";
import { neon } from "@neondatabase/serverless";
import { createInterviewMeeting } from "../../services/teamsGraph.js";
import { isTeamsIntegrationConfigured } from "../../config/teams.js";

export class TimezoneController {
  constructor() {
    const b = (c: any) => {
      for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(c)))
        if (k !== "constructor" && typeof c[k] === "function") c[k] = c[k].bind(c);
    };
    b(this);
  }

  /** GET /api/timezone/employees — active employees with their IANA timezone from users table */
  async getEmployees(_req: Request, res: Response, next: NextFunction) {
    try {
      const sql = neon(process.env.DATABASE_URL!);
      const rows = await sql`
        SELECT
          e.id,
          e.first_name,
          e.last_name,
          e.job_title,
          e.department,
          e.work_email,
          e.avatar,
          e.location,
          u.time_zone
        FROM employees e
        LEFT JOIN users u ON LOWER(u.email) = LOWER(e.work_email)
        WHERE e.employment_status IN ('active', 'onboarding', 'on_leave')
        ORDER BY e.first_name, e.last_name
      `;
      res.json(rows);
    } catch (e) { next(e); }
  }

  /** GET /api/timezone/status — whether Teams integration is configured */
  async getStatus(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ teamsConfigured: isTeamsIntegrationConfigured() });
    } catch (e) { next(e); }
  }

  /** GET /api/timezone/meetings — list scheduled meetings (newest first) */
  async getMeetings(_req: Request, res: Response, next: NextFunction) {
    try {
      const sql = neon(process.env.DATABASE_URL!);
      const rows = await sql`
        SELECT id, title, start_at, end_at, join_url, attendee_emails, created_at
        FROM scheduled_meetings
        ORDER BY start_at DESC
        LIMIT 100
      `;
      return res.json(rows);
    } catch (e) { next(e); }
  }

  /** POST /api/timezone/meeting — schedule a Teams meeting with selected employees */
  async scheduleMeeting(req: Request, res: Response, next: NextFunction) {
    try {
      const { title, start, end, attendeeIds, body } = req.body as {
        title?: string;
        start?: string;
        end?: string;
        attendeeIds?: string[];
        body?: string;
      };

      if (!title?.trim() || !start || !end || !Array.isArray(attendeeIds) || attendeeIds.length === 0) {
        return res.status(400).json({ error: "title, start, end, and attendeeIds are required" });
      }

      const sql = neon(process.env.DATABASE_URL!);
      const rows = await sql`
        SELECT work_email
        FROM employees
        WHERE id = ANY(${attendeeIds})
          AND work_email IS NOT NULL
          AND TRIM(work_email) != ''
      `;

      const emails = (rows as { work_email: string }[]).map((r) => r.work_email).filter(Boolean);
      if (!emails.length) {
        return res.status(400).json({ error: "No valid attendee work emails found" });
      }

      const result = await createInterviewMeeting({
        subject: title.trim(),
        start,
        end,
        interviewerEmails: emails,
        body: body?.trim() || null,
      });

      if (result.success) {
        const userId = req.user?.id ?? null;
        const emailsJson = JSON.stringify(emails);
        try {
          await sql`
            INSERT INTO scheduled_meetings (title, start_at, end_at, join_url, attendee_emails, created_by_user_id)
            VALUES (
              ${title.trim()},
              ${start},
              ${end},
              ${result.joinUrl ?? null},
              (SELECT array_agg(elem) FROM jsonb_array_elements_text(${emailsJson}::jsonb) AS elem),
              ${userId}
            )
          `;
        } catch (insertErr) {
          console.error("[timezone] Failed to save meeting to DB:", insertErr);
          // Still return success so user sees Teams link; meeting just won't appear in list
        }
      }

      return res.json(result);
    } catch (e) {
      next(e);
    }
  }
}
