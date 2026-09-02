export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export type EmailProvider = {
  send(message: EmailMessage): Promise<void>;
};

export class ConsoleEmailProvider implements EmailProvider {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    console.info(`[email] to=${message.to} subject=${message.subject}`);
    if (process.env.NODE_ENV === 'development') {
      console.info(message.text);
    }
  }
}
