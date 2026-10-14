import { smsReminderRepository } from '../repositories/smsReminderRepository.js';
import { createFakeSmsProvider } from './fakeSmsProvider.js';
import { createSmsReminderService } from './smsReminderService.js';
import { createSmsService } from './smsService.js';
import { createUniSmsProvider } from './unismsSmsProvider.js';

export function createSmsModule(
  {
    smsEnabled = false,
    smsProvider = 'unisms',
    uniSmsApiKey = '',
    uniSmsSenderId = '',
    smsProviderTimeoutMs = 5_000,
    clinicTimeZone = 'Asia/Manila',
    staleProcessingMs = 10 * 60 * 1000,
    logger,
  } = {},
  { repository = smsReminderRepository, fetchImpl, capture, now } = {},
) {
  const provider = smsProvider === 'fake'
    ? createFakeSmsProvider({ capture })
    : createUniSmsProvider({
      apiKey: uniSmsApiKey,
      senderId: uniSmsSenderId,
      timeoutMs: smsProviderTimeoutMs,
      fetchImpl,
    });
  const smsService = createSmsService({ enabled: smsEnabled, provider });
  const smsReminderService = createSmsReminderService({
    repository,
    smsService,
    logger,
    timeZone: clinicTimeZone,
    staleProcessingMs,
    now,
  });
  return { provider, smsService, smsReminderService };
}
