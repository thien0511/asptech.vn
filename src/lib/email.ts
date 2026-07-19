import { randomBytes } from "node:crypto";
import net from "node:net";
import tls from "node:tls";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
  secure: boolean;
};

export class EmailConfigurationError extends Error {
  constructor() {
    super("SMTP is not configured.");
    this.name = "EmailConfigurationError";
  }
}

export class EmailDeliveryError extends Error {
  constructor(message = "Email delivery failed.") {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

function requireSmtpConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  const port = Number(process.env.SMTP_PORT ?? 587);

  if (!host || !from || !Number.isInteger(port)) {
    throw new EmailConfigurationError();
  }

  return {
    host,
    port,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
  };
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function normalizeLineEndings(value: string) {
  return value.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

function createPassword(length = 16) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function parseAddress(email: string) {
  return `<${email}>`;
}

class SmtpClient {
  private socket: net.Socket | tls.TLSSocket | null = null;
  private buffer = "";

  constructor(private readonly config: SmtpConfig) {}

  async send(input: SendEmailInput) {
    await this.connect();
    await this.expect([220]);
    await this.command(`EHLO ${this.localName()}`, [250]);

    if (!this.config.secure) {
      await this.command("STARTTLS", [220]);
      await this.upgradeToTls();
      await this.command(`EHLO ${this.localName()}`, [250]);
    }

    if (this.config.user && this.config.password) {
      const auth = Buffer.from(`\0${this.config.user}\0${this.config.password}`, "utf8").toString("base64");
      await this.command(`AUTH PLAIN ${auth}`, [235]);
    }

    await this.command(`MAIL FROM:${parseAddress(this.config.from)}`, [250]);
    await this.command(`RCPT TO:${parseAddress(input.to)}`, [250, 251]);
    await this.command("DATA", [354]);
    await this.command(this.message(input), [250]);
    await this.command("QUIT", [221]);
    this.socket?.end();
  }

  private connect() {
    this.socket = this.config.secure
      ? tls.connect({ host: this.config.host, port: this.config.port, servername: this.config.host })
      : net.connect({ host: this.config.host, port: this.config.port });

    this.socket.setEncoding("utf8");
    this.socket.on("data", (chunk) => {
      this.buffer += chunk;
    });

    return new Promise<void>((resolve, reject) => {
      this.socket?.once("connect", resolve);
      this.socket?.once("error", reject);
    });
  }

  private upgradeToTls() {
    return new Promise<void>((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("SMTP socket is not connected."));
        return;
      }

      const secureSocket = tls.connect({ socket: this.socket, servername: this.config.host }, resolve);
      secureSocket.setEncoding("utf8");
      secureSocket.on("data", (chunk) => {
        this.buffer += chunk;
      });
      secureSocket.once("error", reject);
      this.socket = secureSocket;
    });
  }

  private command(command: string, expectedCodes: number[]) {
    this.socket?.write(`${command}\r\n`);
    return this.expect(expectedCodes);
  }

  private expect(expectedCodes: number[]) {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("SMTP server response timed out."));
      }, 15000);

      const check = () => {
        const lines = this.buffer.split(/\r\n/);
        const pending = lines.pop() ?? "";
        const completeLine = [...lines].reverse().find((line) => /^\d{3} /.test(line));
        if (!completeLine) {
          this.buffer = `${lines.join("\r\n")}${lines.length ? "\r\n" : ""}${pending}`;
          return;
        }

        const code = Number(completeLine.slice(0, 3));
        this.buffer = pending;
        cleanup();
        if (expectedCodes.includes(code)) {
          resolve();
        } else {
          reject(new Error(`SMTP command failed with code ${code}.`));
        }
      };

      const onData = () => check();
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        clearTimeout(timeout);
        this.socket?.off("data", onData);
        this.socket?.off("error", onError);
      };

      this.socket?.on("data", onData);
      this.socket?.once("error", onError);
      check();
    });
  }

  private localName() {
    return process.env.SMTP_HELO_NAME ?? "asptech.vn";
  }

  private message(input: SendEmailInput) {
    const headers = [
      `From: ${parseAddress(this.config.from)}`,
      `To: ${parseAddress(input.to)}`,
      `Subject: ${encodeHeader(input.subject)}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
    ];

    return `${headers.join("\r\n")}\r\n\r\n${normalizeLineEndings(input.text)}\r\n.`;
  }
}

export function generateTemporaryPassword() {
  return createPassword();
}

export async function sendRegistrationPasswordEmail(to: string, name: string, password: string) {
  const config = requireSmtpConfig();
  const client = new SmtpClient(config);
  try {
    await client.send({
      to,
      subject: "Mật khẩu đăng nhập ASP Tech",
      text: [
        `Xin chào ${name},`,
        "",
        "Tài khoản ASP Tech của bạn đã được tạo.",
        `Email đăng nhập: ${to}`,
        `Mật khẩu tạm thời: ${password}`,
        "",
        "Vui lòng đăng nhập và đổi mật khẩu sau khi truy cập hệ thống.",
        "",
        "ASP Tech",
      ].join("\n"),
    });
  } catch (error) {
    if (error instanceof EmailConfigurationError) {
      throw error;
    }
    throw new EmailDeliveryError(error instanceof Error ? error.message : undefined);
  }
}

export async function sendPasswordResetEmail(to: string, name: string, password: string) {
  const config = requireSmtpConfig();
  const client = new SmtpClient(config);
  try {
    await client.send({
      to,
      subject: "Mật khẩu tạm thời ASP Tech",
      text: [
        `Xin chào ${name},`,
        "",
        "Hệ thống đã tạo mật khẩu tạm thời mới cho tài khoản ASP Tech của bạn.",
        `Email đăng nhập: ${to}`,
        `Mật khẩu tạm thời: ${password}`,
        "",
        "Vui lòng đăng nhập bằng mật khẩu này và đổi mật khẩu ngay sau khi truy cập hệ thống.",
        "",
        "Nếu bạn không yêu cầu reset mật khẩu, vui lòng liên hệ quản trị viên.",
        "",
        "ASP Tech",
      ].join("\n"),
    });
  } catch (error) {
    if (error instanceof EmailConfigurationError) {
      throw error;
    }
    throw new EmailDeliveryError(error instanceof Error ? error.message : undefined);
  }
}
