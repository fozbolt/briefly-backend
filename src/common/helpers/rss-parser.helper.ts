import RssParser from 'rss-parser';

export interface RssItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  creator: string;
}

const parser = new RssParser({ timeout: 10000 });

export async function fetchRssFeed(url: string): Promise<RssItem[]> {
  try {
    const feed = await parser.parseURL(url);
    return feed.items.map((item) => ({
      title: item.title || '',
      description: item.contentSnippet || item.content || '',
      link: item.link || '',
      pubDate: item.pubDate || '',
      creator: item.creator || item.author || '',
    }));
  } catch (error) {
    console.error(`RSS fetch failed for ${url}:`, (error as Error).message);
    return [];
  }
}
