import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());

// Health check
app.get("/api/", (c) => c.json({ name: "Cloudflare" }));

// Create or upsert a HubSpot contact
app.post("/api/hubspot/contact", async (c) => {
  const body = await c.req.json<{
    email: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    message?: string;
  }>();

  if (!body.email) {
    return c.json({ error: "email is required" }, 400);
  }

  const res = await fetch(
    "https://api.hubapi.com/crm/v3/objects/contacts",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.HUBSPOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          email: body.email,
          firstname: body.firstname ?? "",
          lastname: body.lastname ?? "",
          phone: body.phone ?? "",
          message: body.message ?? "",
        },
      }),
    }
  );

  const data = await res.json();
  return c.json(data, res.status as 200 | 201 | 400 | 409 | 500);
});

// Create a deal and associate it with a contact
app.post("/api/hubspot/deal", async (c) => {
  const body = await c.req.json<{
    dealname: string;
    contactId?: string;
    amount?: string;
    dealstage?: string;
    pipeline?: string;
  }>();

  if (!body.dealname) {
    return c.json({ error: "dealname is required" }, 400);
  }

  // 1. Create the deal
  const dealRes = await fetch(
    "https://api.hubapi.com/crm/v3/objects/deals",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.HUBSPOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          dealname: body.dealname,
          pipeline: body.pipeline ?? "default",
          dealstage: body.dealstage ?? "appointmentscheduled",
          amount: body.amount ?? "",
        },
      }),
    }
  );

  const deal = (await dealRes.json()) as { id?: string; message?: string };

  if (!dealRes.ok || !deal.id) {
    return c.json(deal, dealRes.status as 400 | 500);
  }

  // 2. Associate deal → contact if contactId provided
  if (body.contactId) {
    await fetch(
      `https://api.hubapi.com/crm/v3/objects/deals/${deal.id}/associations/contacts/${body.contactId}/deal_to_contact`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${c.env.HUBSPOT_TOKEN}` },
      }
    );
  }

  return c.json(deal, 201);
});

// Full intake: create contact then deal in one request
app.post("/api/hubspot/intake", async (c) => {
  const body = await c.req.json<{
    email: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    message?: string;
    dealname?: string;
    amount?: string;
    dealstage?: string;
    pipeline?: string;
  }>();

  if (!body.email) {
    return c.json({ error: "email is required" }, 400);
  }

  // Step 1: create contact
  const contactRes = await fetch(
    "https://api.hubapi.com/crm/v3/objects/contacts",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.HUBSPOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          email: body.email,
          firstname: body.firstname ?? "",
          lastname: body.lastname ?? "",
          phone: body.phone ?? "",
          message: body.message ?? "",
        },
      }),
    }
  );

  const contact = (await contactRes.json()) as {
    id?: string;
    message?: string;
    status?: string;
  };

  // HubSpot returns 409 if contact already exists — get the existing id
  let contactId = contact.id;
  if (contactRes.status === 409) {
    // Extract id from error message or re-fetch by email
    const existingRes = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${body.email}?idProperty=email`,
      {
        headers: { Authorization: `Bearer ${c.env.HUBSPOT_TOKEN}` },
      }
    );
    const existing = (await existingRes.json()) as { id?: string };
    contactId = existing.id;
  }

  // Step 2: create deal
  const dealname =
    body.dealname ??
    `${body.firstname ?? ""} ${body.lastname ?? ""} Intake`.trim();

  const dealRes = await fetch(
    "https://api.hubapi.com/crm/v3/objects/deals",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.HUBSPOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          dealname,
          pipeline: body.pipeline ?? "default",
          dealstage: body.dealstage ?? "appointmentscheduled",
          amount: body.amount ?? "",
        },
      }),
    }
  );

  const deal = (await dealRes.json()) as { id?: string };

  // Step 3: associate deal → contact
  if (deal.id && contactId) {
    await fetch(
      `https://api.hubapi.com/crm/v3/objects/deals/${deal.id}/associations/contacts/${contactId}/deal_to_contact`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${c.env.HUBSPOT_TOKEN}` },
      }
    );
  }

  return c.json({ contact, deal, contactId }, 201);
});

export default app;
