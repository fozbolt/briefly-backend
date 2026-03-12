export default () => ({
  port: parseInt(process.env.PORT || '3001', 10),
  database: {
    type: process.env.DB_TYPE || 'sqlite', // 'sqlite' or 'mariadb'
    sqlitePath: process.env.DB_SQLITE_PATH || './briefly.db',
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    name: process.env.DB_NAME || 'briefly_dev',
    synchronize:
      process.env.DB_SYNCHRONIZE !== undefined
        ? process.env.DB_SYNCHRONIZE === 'true'
        : (process.env.NODE_ENV || 'development') !== 'production' &&
          (process.env.NODE_ENV || 'development') !== 'stage',
  },
  apis: {
    openWeatherMap: {
      key: process.env.OPENWEATHERMAP_API_KEY || '',
      baseUrl: 'https://api.openweathermap.org/data/2.5',
    },
    newsApi: {
      key: process.env.NEWSAPI_KEY || '',
      baseUrl: 'https://newsapi.org/v2',
    },
    alphaVantage: {
      key: process.env.ALPHA_VANTAGE_KEY || '',
      baseUrl: 'https://www.alphavantage.co/query',
    },
    tomTom: {
      key: process.env.TOMTOM_API_KEY || '',
      baseUrl: process.env.TOMTOM_BASE_URL || 'https://api.tomtom.com',
    },
    coinGecko: {
      baseUrl: 'https://api.coingecko.com/api/v3',
    },
    openLibrary: {
      baseUrl: 'https://openlibrary.org',
    },
    zenQuotes: {
      baseUrl: 'https://zenquotes.io/api',
    },
  },
  rssFeeds: {
    bbcWorld: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    techCrunch: 'https://techcrunch.com/feed/',
    hbr: 'https://feeds.hbr.org/harvardbusiness',
    fastCompany: 'https://www.fastcompany.com/latest/rss',
  },
  llm: {
    baseUrl: process.env.FREE_LLM_BASE || 'https://text.pollinations.ai',
    model: process.env.FREE_LLM_MODEL || 'openai-fast',
  },
  priceAlerts: {
    enabled:
      process.env.PRICE_ALERTS_ENABLED !== undefined
        ? process.env.PRICE_ALERTS_ENABLED === 'true'
        : (process.env.NODE_ENV || 'development') !== 'test',
    pollIntervalMs: parseInt(process.env.PRICE_ALERT_POLL_INTERVAL_MS || '300000', 10),
    defaultThresholdPercent: parseFloat(process.env.PRICE_ALERT_DEFAULT_THRESHOLD_PERCENT || '3'),
    expoPushUrl: process.env.EXPO_PUSH_URL || 'https://exp.host/--/api/v2/push/send',
    expoAccessToken: process.env.EXPO_ACCESS_TOKEN || '',
  },
  auth: {
    tokenSecret: process.env.AUTH_TOKEN_SECRET || '',
    tokenTtlHours: parseInt(process.env.AUTH_TOKEN_TTL_HOURS || '720', 10),
  },
  email: {
    provider: process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? 'resend' : 'console'),
    resendApiKey: process.env.RESEND_API_KEY || '',
    from: process.env.EMAIL_FROM || 'Briefly <onboarding@briefly.app>',
    replyTo: process.env.EMAIL_REPLY_TO || '',
    verificationBaseUrl:
      process.env.EMAIL_VERIFICATION_BASE_URL ||
      `http://localhost:${process.env.PORT || '3001'}/api`,
    verificationTokenTtlMinutes: parseInt(
      process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES || '1440',
      10,
    ),
  },
});
