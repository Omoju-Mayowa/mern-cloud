// middleware/authLimit.js
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';

const redisClient = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

const WHITELIST_IPS = (process.env.WHITELIST_IPS || '127.0.0.1,::1')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Limits
const maxAttemptsByIP = 10;        // e.g., 7 attempts per window
// const maxAttemptsByEmail = 5;      // e.g., 5 failed logins per email

const IpBlockDuration = 30 * 60; // 30 mins lockdown
// const EmailBlockDuration = 30 * 60; // 30 mins lockdown

const IpResetWindow = 30 * 60; // 30 mins Reset window
// const EmailResetWindow = 10 * 60; // 1 hr Reset Window

// Rate limiters
const limiterSlowBruteByIP = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'login_fail_ip',
  points: maxAttemptsByIP,
  duration: IpResetWindow, // 1 minute window
  blockDuration: IpBlockDuration // Block 15 minutes if exceeded
});

function isIpWhitelisted(ip) {
  if(!ip) {
    console.log('No IP provided');
    return false;
  }
  
  const clean = ip.replace(/^::ffff:/, '');

  // Only split on colon if it's not an IPv6 address
  const cleanIP = clean.includes('.') ? clean.split(':')[0] : clean;
  
  console.log({
    originalIP: ip,
    cleanIP: cleanIP,
    whitelist: WHITELIST_IPS,
    isWhitelisted: WHITELIST_IPS.includes(cleanIP)
  });
  
  return WHITELIST_IPS.includes(cleanIP);
}


async function consumeIfNotWhitelisted(ip) {
  console.log('Checking IP:', ip);
  const whitelisted = isIpWhitelisted(ip);
  console.log('Is whitelisted:', whitelisted);
  
  if(whitelisted) {
    console.log('IP is whitelisted, skipping rate limit');
    return true;
  }
  
  console.log('IP not whitelisted, applying rate limit');
  return limiterSlowBruteByIP.consume(ip);
}

// Discontinued due to impracticality

// const limiterConsecutiveFailsByEmail = new RateLimiterRedis({
//   storeClient: redisClient,
//   keyPrefix: 'login_fail_email',
//   points: maxAttemptsByEmail,
//   duration: EmailResetWindow,     // 1 hour window
//   blockDuration: EmailBlockDuration // Block 30 minutes if exceeded
// });

export {
  limiterSlowBruteByIP,
  // limiterConsecutiveFailsByEmail,
  redisClient,
  isIpWhitelisted,
  consumeIfNotWhitelisted
};