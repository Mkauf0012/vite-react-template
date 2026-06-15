import { useState, FormEvent } from "react";
import { submitIntake, IntakePayload } from "../lib/hubspot";

type FormState = "idle" | "loading" | "success" | "error";

interface IntakeFormProps {
  /** Override the auto-generated deal name */
  dealName?: string;
  /** HubSpot pipeline ID — defaults to "default" */
  pipeline?: string;
  /** HubSpot deal stage ID — defaults to "appointmentscheduled" */
  dealStage?: string;
  onSuccess?: (data: unknown) => void;
}

export default function IntakeForm({
  dealName,
  pipeline,
  dealStage,
  onSuccess,
}: IntakeFormProps) {
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("loading");
    setErrorMsg("");

    const fd = new FormData(e.currentTarget);

    const payload: IntakePayload = {
      email: fd.get("email") as string,
      firstname: fd.get("firstname") as string,
      lastname: fd.get("lastname") as string,
      phone: fd.get("phone") as string,
      message: fd.get("message") as string,
      dealname: dealName,
      pipeline,
      dealstage: dealStage,
    };

    try {
      const result = await submitIntake(payload);
      setState("success");
      onSuccess?.(result);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="intake-form-success" role="status">
        <h3>Thanks! We'll be in touch soon.</h3>
        <p>Your information has been received.</p>
      </div>
    );
  }

  return (
    <form className="intake-form" onSubmit={handleSubmit} noValidate>
      <div className="intake-form__row">
        <label htmlFor="intake-firstname">
          First name
          <input
            id="intake-firstname"
            name="firstname"
            type="text"
            autoComplete="given-name"
            required
            disabled={state === "loading"}
          />
        </label>

        <label htmlFor="intake-lastname">
          Last name
          <input
            id="intake-lastname"
            name="lastname"
            type="text"
            autoComplete="family-name"
            required
            disabled={state === "loading"}
          />
        </label>
      </div>

      <label htmlFor="intake-email">
        Email
        <input
          id="intake-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={state === "loading"}
        />
      </label>

      <label htmlFor="intake-phone">
        Phone
        <input
          id="intake-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          disabled={state === "loading"}
        />
      </label>

      <label htmlFor="intake-message">
        Message
        <textarea
          id="intake-message"
          name="message"
          rows={4}
          disabled={state === "loading"}
        />
      </label>

      {state === "error" && (
        <p className="intake-form__error" role="alert">
          {errorMsg}
        </p>
      )}

      <button type="submit" disabled={state === "loading"}>
        {state === "loading" ? "Sending…" : "Submit"}
      </button>
    </form>
  );
}
