const db = require('../config/database');

async function log(eventType, data = {}) {
  try {
    await db.query(
      `INSERT INTO security_log(event_type,session_id,zone_id,ip_address,token_used,details)
       VALUES($1,$2,$3,$4::inet,$5,$6)`,
      [eventType, data.sessionId||null, data.zoneId||null,
       data.ip||null, data.token||null, JSON.stringify(data.details||{})]
    );
  } catch (e) { console.error('Logger:', e.message); }
}

module.exports = {
  stamp:   d => log('stamp_ok', d),
  blocked: d => log('token_expired', d),
  invalid: d => log('invalid_token', d),
  rate:    d => log('rate_limit', d),
  admin:   d => log('admin_action', d),
  error:   (msg, details) => log('error', { details: { msg, ...details } }),
};
