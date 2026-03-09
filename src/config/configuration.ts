export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    type: process.env.DB_TYPE || 'sqlite', // 'sqlite' or 'mariadb'
    sqlitePath: process.env.DB_SQLITE_PATH || './briefly.db',
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    name: process.env.DB_NAME || 'briefly_dev',
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
});
