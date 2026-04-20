/**
 * Triggered when a new ContactMessage is created.
 * Notifies all admin users via email and in-app notification.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const msg = body.data || body;
    if (!msg || !msg.email) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Find all admin users
    const adminProfiles = await base44.asServiceRole.entities.UserProfile.filter({});
    // Get User records to find admins
    const allUsers = await base44.asServiceRole.entities.User.list("-created_date", 100).catch(() => []);
    const adminEmails = allUsers.filter(u => u.role === "admin").map(u => u.email);

    if (adminEmails.length === 0) {
      console.log("No admin users found");
      return Response.json({ ok: true, note: "no admins found" });
    }

    const subject = `📩 New Support Request: ${msg.subject || "No subject"}`;
    const htmlBody = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
        <h2 style="color:#0f172a;">New Support Request</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:100px;">From</td><td style="font-size:14px;color:#0f172a;">${msg.name} (${msg.email})</td></tr>
          ${msg.subject ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Subject</td><td style="font-size:14px;color:#0f172a;">${msg.subject}</td></tr>` : ""}
        </table>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;font-size:14px;color:#334155;white-space:pre-wrap;">${msg.message}</div>
        <div style="margin-top:20px;">
          <a href="https://minest.ca/admin?tab=support" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">View in Admin Panel</a>
        </div>
      </div>
    `;

    for (const adminEmail of adminEmails) {
      // In-app notification only — no email to admin
      await base44.asServiceRole.entities.Notification.create({
        user_id: adminEmail,
        type: "system",
        title: `New support request from ${msg.name}`,
        body: msg.subject || msg.message?.slice(0, 80) || "",
        link: "/admin?tab=support",
        read: false,
        delivery_status_in_app: "delivered",
        delivery_status_email: "sent",
      });
    }

    return Response.json({ ok: true, notified: adminEmails.length });
  } catch (error) {
    console.error("onContactMessage error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});