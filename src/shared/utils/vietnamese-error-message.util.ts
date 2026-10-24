import { HttpStatus } from '@nestjs/common';
import { ValidationError } from 'class-validator';

const STATUS_MESSAGES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Yêu cầu không hợp lệ',
  [HttpStatus.UNAUTHORIZED]: 'Bạn chưa được xác thực',
  [HttpStatus.FORBIDDEN]: 'Bạn không có quyền thực hiện thao tác này',
  [HttpStatus.NOT_FOUND]: 'Không tìm thấy tài nguyên',
  [HttpStatus.CONFLICT]: 'Dữ liệu đã tồn tại',
  [HttpStatus.REQUEST_TIMEOUT]: 'Yêu cầu đã quá thời gian xử lý',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Bạn đã gửi quá nhiều yêu cầu',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Đã có lỗi xảy ra, vui lòng thử lại sau',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Dịch vụ hiện không khả dụng',
};

const MESSAGE_TRANSLATIONS: Array<[RegExp, string]> = [
  [/^User not found$/i, 'Không tìm thấy người dùng'],
  [/^User with ID (.+) not found$/i, 'Không tìm thấy người dùng với ID $1'],
  [/^User với ID (.+) không tồn tại$/i, 'Người dùng với ID $1 không tồn tại'],
  [/^User already exists$/i, 'Người dùng đã tồn tại'],
  [/^Invalid credentials$/i, 'Thông tin đăng nhập không hợp lệ'],
  [/^Unauthorized$/i, 'Bạn chưa được xác thực'],
  [/^Forbidden$/i, 'Bạn không có quyền thực hiện thao tác này'],
  [/^Phone number already in use$/i, 'Số điện thoại đã được sử dụng'],
  [
    /^Phone number not found in token$/i,
    'Không tìm thấy số điện thoại trong token',
  ],
  [/^branchId is required$/i, 'Vui lòng chọn chi nhánh'],
  [/^Device not found$/i, 'Không tìm thấy thiết bị'],
  [/^Device type not found$/i, 'Không tìm thấy loại thiết bị'],
  [/^Assignment not found$/i, 'Không tìm thấy bản ghi cấp phát thiết bị'],
  [
    /^Assignment is not in ASSIGNED status$/i,
    'Thiết bị chưa ở trạng thái đang cấp phát',
  ],
  [/^Branch with ID (.+) not found$/i, 'Không tìm thấy chi nhánh với ID $1'],
  [/^Room with ID (.+) not found$/i, 'Không tìm thấy phòng với ID $1'],
  [/^Room with id (.+) not found$/i, 'Không tìm thấy phòng với ID $1'],
  [/^Contract with ID (.+) not found$/i, 'Không tìm thấy hợp đồng với ID $1'],
  [/^Contract with id (.+) not found$/i, 'Không tìm thấy hợp đồng với ID $1'],
  [
    /^Contract with user id (.+) not found$/i,
    'Không tìm thấy hợp đồng của người dùng với ID $1',
  ],
  [/^Resource with ID (.+) not found$/i, 'Không tìm thấy dữ liệu với ID $1'],
  [/^Cannot (GET|POST|PUT|PATCH|DELETE) (.+)$/i, 'Không tìm thấy đường dẫn $2'],
  [/^Bad Request$/i, 'Yêu cầu không hợp lệ'],
  [/^Not Found$/i, 'Không tìm thấy tài nguyên'],
  [/^Internal server error$/i, 'Đã có lỗi xảy ra, vui lòng thử lại sau'],
  [
    /^Device type must be one of these values: (.+)$/i,
    'Loại thiết bị phải là một trong các giá trị: $1',
  ],
  [
    /^Status must be one of these values: (.+)$/i,
    'Trạng thái phải là một trong các giá trị: $1',
  ],
  [/^managerId must be a valid UUID$/i, 'managerId phải là UUID hợp lệ'],
];

const VALIDATION_MESSAGES: Record<
  string,
  (property: string, value?: string) => string
> = {
  isNotEmpty: (property) => `${property} không được để trống`,
  isString: (property) => `${property} phải là chuỗi`,
  isNumber: (property) => `${property} phải là số`,
  isInt: (property) => `${property} phải là số nguyên`,
  isBoolean: (property) => `${property} phải là đúng hoặc sai`,
  isEnum: (property, value) =>
    value
      ? `${property} phải là một trong các giá trị: ${value}`
      : `${property} không hợp lệ`,
  isUUID: (property) => `${property} phải là UUID hợp lệ`,
  isDate: (property) => `${property} phải là ngày hợp lệ`,
  isDateString: (property) => `${property} phải là chuỗi ngày hợp lệ`,
  isEmail: (property) => `${property} phải là email hợp lệ`,
  isArray: (property) => `${property} phải là mảng`,
  isUrl: (property) => `${property} phải là URL hợp lệ`,
  minLength: (property) => `${property} chưa đủ độ dài tối thiểu`,
  maxLength: (property) => `${property} vượt quá độ dài cho phép`,
  arrayMaxSize: (property) => `${property} vượt quá số lượng cho phép`,
  min: (property) => `${property} nhỏ hơn giá trị tối thiểu`,
  max: (property) => `${property} lớn hơn giá trị tối đa`,
  matches: (property) => `${property} không đúng định dạng`,
  whitelistValidation: (property) => `${property} không được phép gửi lên`,
};

const hasVietnameseCharacter = (message: string) =>
  /[À-ỹĐđ]/.test(message) ||
  /\b(không|người|phòng|hóa|thiết|gói|quyền|lỗi)\b/i.test(message);

export const translateErrorMessage = (
  message: unknown,
  statusCode = HttpStatus.INTERNAL_SERVER_ERROR,
): string => {
  if (Array.isArray(message)) {
    const translated = message
      .map((item) => translateErrorMessage(item, statusCode))
      .filter(Boolean);

    return translated.length
      ? translated.join(', ')
      : getDefaultStatusMessage(statusCode);
  }

  if (message && typeof message === 'object') {
    const maybeMessage = (message as { message?: unknown }).message;

    if (maybeMessage) {
      return translateErrorMessage(maybeMessage, statusCode);
    }

    return getDefaultStatusMessage(statusCode);
  }

  if (typeof message !== 'string' || !message.trim()) {
    return getDefaultStatusMessage(statusCode);
  }

  const normalized = message.trim();

  if (hasVietnameseCharacter(normalized)) {
    return normalized;
  }

  for (const [pattern, replacement] of MESSAGE_TRANSLATIONS) {
    if (pattern.test(normalized)) {
      return normalized.replace(pattern, replacement);
    }
  }

  return getDefaultStatusMessage(statusCode);
};

export const getDefaultStatusMessage = (statusCode: number): string =>
  STATUS_MESSAGES[statusCode] ??
  STATUS_MESSAGES[HttpStatus.INTERNAL_SERVER_ERROR];

export const flattenValidationErrors = (
  errors: ValidationError[],
  parentPath = '',
): string[] =>
  errors.flatMap((error) => {
    const property = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const currentMessages = Object.entries(error.constraints ?? {}).map(
      ([constraint, rawMessage]) =>
        translateValidationMessage(property, constraint, rawMessage),
    );
    const childMessages = flattenValidationErrors(
      error.children ?? [],
      property,
    );

    return [...currentMessages, ...childMessages];
  });

const translateValidationMessage = (
  property: string,
  constraint: string,
  rawMessage?: string,
): string => {
  if (rawMessage && hasVietnameseCharacter(rawMessage)) {
    return rawMessage;
  }

  const enumValues = rawMessage?.match(/following values: (.+)$/i)?.[1];
  const factory = VALIDATION_MESSAGES[constraint];

  if (factory) {
    return factory(property, enumValues);
  }

  return `${property} không hợp lệ`;
};
