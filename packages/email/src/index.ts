import { ConduitSDK, IConduitEmail, IRegisterTemplateParams, ISendEmailParams } from '@conduit/sdk';
import { emailTemplateSchema } from './models/EmailTemplate';
import { EmailProvider } from '@conduit/email-provider';
import { EmailService } from './services/email.service';
import { AdminHandlers } from './handlers/AdminHandlers';
import EmailConfigSchema from './config/email';

class EmailModule implements IConduitEmail {
  private emailProvider: EmailProvider;
  private emailService: EmailService;
  private adminHandlers: AdminHandlers;

  constructor(
    private readonly sdk: ConduitSDK
  ) {
    if ((this.sdk as any).config.get('email.active')) {
      this.enableModule().catch(console.log);
    }
  }

  static get config() {
    return EmailConfigSchema;
  }

  async initModule() {
    try {
      if ((this.sdk as any).config.get('email.active')) {
        await this.enableModule();
        return true;
      }
      throw new Error('Module is not active');
    } catch (e) {
      console.log(e);
      return false;
    }
  }

  private async enableModule() {
    this.registerModels();
    this.initEmailProvider();
    this.emailService = new EmailService(this.emailProvider, this.sdk);


    this.adminHandlers = new AdminHandlers(this.sdk, this.emailService);
    this.initAdminRoutes();

  }

  async registerTemplate(params: IRegisterTemplateParams) {
    return this.emailService.registerTemplate(params);
  }

  async sendEmail(template: string, params: ISendEmailParams) {
    return this.emailService.sendEmail(template, params);
  }

  private registerModels() {
    const database = this.sdk.getDatabase();
    database.createSchemaFromAdapter(emailTemplateSchema);
  }

  private initEmailProvider() {
    const { config } = this.sdk as any;
    const emailConfig = config.get('email');

    let { transport, transportSettings } = emailConfig;

    this.emailProvider = new EmailProvider(transport, transportSettings);
  }

  private initAdminRoutes() {
    const admin = this.sdk.getAdmin();

    admin.registerRoute('GET', '/email/templates',
      (req, res, next) => this.adminHandlers.getTemplates(req, res).catch(next));

    admin.registerRoute('POST', '/email/templates',
      (req, res, next) => this.adminHandlers.createTemplate(req, res).catch(next));

    admin.registerRoute('PUT', '/email/templates/:id',
      (req, res, next) => this.adminHandlers.editTemplate(req, res).catch(next));

    admin.registerRoute('POST', '/email/send',
      (req, res, next) => this.adminHandlers.sendEmail(req, res).catch(next));

  }
}

export = EmailModule;
