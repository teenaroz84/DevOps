/**
 * Shared response helpers for all Lambda functions.
 * Provides consistent HTTP responses with CORS headers.
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function success(body) {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

function notFound(message = 'Not found') {
  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

function badRequest(message = 'Bad request') {
  return {
    statusCode: 400,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

function serverError(message = 'Internal server error') {
  return {
    statusCode: 500,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

function corsPreFlight() {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: '',
  };
}

module.exports = { success, notFound, badRequest, serverError, corsPreFlight };
