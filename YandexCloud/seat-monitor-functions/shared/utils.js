// Утилиты для работы с JWT и валидацией
const jwt = require('jsonwebtoken');

/**
 * Генерация JWT токена
 */
function generateToken(deviceUUID) {
  const secret = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
  const payload = {
    deviceUUID: deviceUUID,
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, secret, {
    expiresIn: '30d' // 30 дней
  });
}

/**
 * Валидация JWT токена
 */
function verifyToken(token) {
  try {
    const secret = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
}

/**
 * Валидация UUID формата
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Форматирование ответа с CORS заголовками
 */
function createResponse(statusCode, body, headers = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  return {
    statusCode: statusCode,
    headers: { ...defaultHeaders, ...headers },
    body: JSON.stringify(body)
  };
}

/**
 * Обработка OPTIONS запроса (CORS preflight)
 */
function handleOptions() {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    },
    body: JSON.stringify({})
  };
}

module.exports = {
  generateToken,
  verifyToken,
  isValidUUID,
  createResponse,
  handleOptions
};

