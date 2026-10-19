// سجل بسيط لكل حساب — سطر واحد لكل حدث، بلا نصّ رسائل العملاء.
// لا يُطبع متن أي رسالة في السجل: الحمولة تذهب إلى n8n، والسجل للتشغيل فقط.

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const WANT = LEVELS[String(process.env.WA_LOG_LEVEL || 'info').toLowerCase()] || LEVELS.info;

function emit(level, scope, msg, extra) {
  if ((LEVELS[level] || 0) < WANT) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${msg}`;
  const tail = extra && Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : '';
  if (level === 'error' || level === 'warn') process.stderr.write(line + tail + '\n');
  else process.stdout.write(line + tail + '\n');
}

export function logger(scope) {
  return {
    debug(msg, extra) { emit('debug', scope, msg, extra); },
    info(msg, extra) { emit('info', scope, msg, extra); },
    warn(msg, extra) { emit('warn', scope, msg, extra); },
    error(msg, extra) { emit('error', scope, msg, extra); },
  };
}
