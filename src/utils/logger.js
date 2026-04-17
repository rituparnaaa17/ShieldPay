const writeLog = (level, message, meta = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  const line = JSON.stringify(entry);

  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
};

export const logger = {
  info: (message, meta = {}) => writeLog("info", message, meta),
  warn: (message, meta = {}) => writeLog("warn", message, meta),
  error: (message, meta = {}) => writeLog("error", message, meta),
};
