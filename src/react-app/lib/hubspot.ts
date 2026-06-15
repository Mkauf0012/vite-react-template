/**
 * HubSpot API helpers — all calls proxied through the Hono worker
 * so the Service Key token never touches the browser.
 */

export interface ContactPayload {
  email: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  message?: string;
}

export interface DealPayload {
  dealname: string;
  contactId?: string;
  amount?: string;
  dealstage?: string;
  pipeline?: string;
}

export interface IntakePayload extends ContactPayload {
  dealname?: string;
  amount?: string;
  dealstage?: string;
  pipeline?: string;
}

async function post<T>(path: string, data: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(
      (err as { message?: string }).message ?? "Request failed"
    );
  }

  return res.json() as Promise<T>;
}

/** Create a contact in HubSpot */
export function createContact(data: ContactPayload) {
  return post<{ id: string }>("/api/hubspot/contact", data);
}

/** Create a deal (optionally linked to a contact) */
export function createDeal(data: DealPayload) {
  return post<{ id: string }>("/api/hubspot/deal", data);
}

/**
 * Full intake flow — creates contact + deal and associates them.
 * Use this for any form that should generate a pipeline entry.
 */
export function submitIntake(data: IntakePayload) {
  return post<{ contact: { id: string }; deal: { id: string }; contactId: string }>(
    "/api/hubspot/intake",
    data
  );
}
