// TitanMailer — sends via GoDaddy's "Professional Email powered by Titan"
// SMTP relay (smtpout.secureserver.net:465, implicit SSL — this is GoDaddy's
// own server, distinct from standalone Titan.email's smtp.titan.email).
// Mirrors ai-assist/gemini.ts's GeminiProvider shape: private fields, constructor
// throws if unset, one method that does the external call.

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

    // SMTP (RFC 5322 §2.3) requires CRLF line endings — a bare LF (plain "\n",
    // which is all our Postgres-stored templates contain) gets rejected by
    // GoDaddy's relay with "552: Message contains bare LF".
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
