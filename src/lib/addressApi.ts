import { getAddressError } from '../../shared/address';

// Те же правила, что и на сервере — подсказка появляется ещё до отправки заказа
export const getAddressValidationMessage = getAddressError;
