import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { AuthService, getCookieOptions, MS_CLIENT_ID, MS_SSO_ENABLED, MS_TENANT_ID } from "./AuthService.js";

const COOKIE_NAME = "auth_token";

export class AuthController {
  private readonly svc = new AuthService();
  constructor() { const b = (c: any) => { for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(c))) if (k !== "constructor" && typeof c[k] === "function") c[k] = c[k].bind(c); }; b(this); }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await this.svc.login(email, password);
      res.cookie(COOKIE_NAME, result.token, getCookieOptions());
      res.json({ message: "Login successful", user: result.user });
    } catch (e) { next(e); }
  }

  logout(_req: Request, res: Response) {
    res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
    res.json({ message: "Logged out successfully" });
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.[COOKIE_NAME];
      if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
      const user = await this.svc.getMe(token);
      res.json(user);
    } catch (e: any) {
      if (e.statusCode === 401 || e.message === "Invalid token") { res.clearCookie(COOKIE_NAME); res.status(401).json({ error: e.message }); return; }
      next(e);
    }
  }

  async updateMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
      res.json(await this.svc.updateMe(userId, req.body.timeZone));
    } catch (e) { next(e); }
  }

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, role, employeeId, authProvider } = req.body;
      res.status(201).json(await this.svc.register(email, password, role, employeeId, authProvider));
    } catch (e) { next(e); }
  }

  async listUsers(_req: Request, res: Response, next: NextFunction) {
    try { res.json(await this.svc.listUsers()); } catch (e) { next(e); }
  }

  async updateUser(req: Request, res: Response, next: NextFunction) {
    try { res.json(await this.svc.updateUser(req.params.id, req.body, (req as any).user?.id)); } catch (e) { next(e); }
  }

  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try { await this.svc.deleteUser(req.params.id, (req as any).user?.id); res.status(204).send(); } catch (e) { next(e); }
  }

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.[COOKIE_NAME];
      if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
      res.json(await this.svc.changePassword(token, req.body.currentPassword, req.body.newPassword));
    } catch (e) { next(e); }
  }

  microsoftConfig(_req: Request, res: Response) {
    res.json({ enabled: MS_SSO_ENABLED, tenantId: MS_TENANT_ID });
  }

  microsoftLogin(req: Request, res: Response) {
    try {
      if (!MS_CLIENT_ID) { res.status(501).json({ error: "Microsoft SSO is not configured" }); return; }
      const state = crypto.randomBytes(16).toString("hex");
      res.cookie("ms_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 10 * 60 * 1000, path: "/" });
      res.redirect(this.svc.getMicrosoftAuthUrl(state));
    } catch (e) { res.redirect("/login?error=SSO+configuration+error"); }
  }

  async microsoftCallback(req: Request, res: Response, _next: NextFunction) {
    try {
      const { code, state, error, error_description } = req.query;
      if (error) { res.redirect(`/login?error=${encodeURIComponent(String(error_description || error))}`); return; }
      if (!code || typeof code !== "string") { res.redirect("/login?error=No+authorization+code+received"); return; }
      const savedState = req.cookies?.ms_oauth_state;
      if (!savedState || savedState !== state) { res.redirect("/login?error=Invalid+state+parameter"); return; }
      res.clearCookie("ms_oauth_state", { path: "/" });
      const token = await this.svc.handleMicrosoftCallback(code);
      res.cookie(COOKIE_NAME, token, getCookieOptions());
      res.redirect("/dashboard");
    } catch (e: any) {
      console.error("Microsoft SSO callback error:", e);
      const msg = e?.message ? encodeURIComponent(e.message) : "SSO+authentication+failed";
      res.redirect(`/login?error=${msg}`);
    }
  }
}
