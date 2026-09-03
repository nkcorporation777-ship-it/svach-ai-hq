// TitanMailer — sends via GoDaddy's "Professional Email powered by Titan"
// SMTP relay. Own copy of onboarding-email/mailer.ts: Edge Functions bundle
// per-function, not shared across directories.

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

export class TitanMailer {
  #user: string
  #password: string

  constructor(user: string, password: string) {
    if (!user || !password) {
      throw new Error("TITAN_SMTP_USER / TITAN_SMTP_PASSWORD are not set")
    }
    this.#user = user
    this.#password = password
  }

  async send(to: string, subject: string, body: string) {
    const client = new SMTPClient({
      connection: {
        hostname: "smtpout.secureserver.net",
        port: 465,
        tls: true,
        auth: { username: this.#user, password: this.#password },
      },
    })

    // SMTP (RFC 5322 §2.3) requires CRLF line endings — a bare LF gets
    // rejected by GoDaddy's relay with "552: Message contains bare LF".
    const crlfBody = body.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n")

    try {
      await client.send({
        from: this.#user,
        to,
        subject,
        content: crlfBody,
      })
    } finally {
      await client.close()
    }
  }
}
