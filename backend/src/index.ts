import './load-env';
import app from './app';
import { getConfig } from './config';
import { logger } from './utils/logger';
import { schedulerService } from './services/scheduler.service';
import { startShippingStatusChecker, scheduleShippingStatusCheck } from './jobs/shippingStatusChecker';
import { whatsappWebService } from './services/whatsappWeb.service';

const config = getConfig();
const PORT = config.port || 3000;
const isVercel = process.env.VERCEL === '1';

const startServer = async () => {
  try {
    if (!isVercel) {
      schedulerService.startAll();
      startShippingStatusChecker();
      scheduleShippingStatusCheck();

      const whatsappWebOn = whatsappWebService.isEnabled();
      logger.info('WhatsApp Web configuration', {
        enabled: whatsappWebOn,
        env: process.env.WHATSAPP_WEB_ENABLED ?? '(not set)',
      });

      if (whatsappWebOn) {
        whatsappWebService.start().catch((err) => {
          logger.error('WhatsApp Web failed to start', { err });
        });
        logger.info('WhatsApp Web started — order confirmations use linked Business account');
      }
    } else {
      logger.info('Running on Vercel — cron, queues, and WhatsApp Web are disabled');
    }

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

if (!isVercel) {
  void startServer();
}
