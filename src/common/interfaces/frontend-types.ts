// Mirror of frontend types — the API contract
// Must match: briefly-frontend/src/types/index.ts

export interface Weather {
  location?: string;
  temp: number;
  unit: string;
  condition: string;
  description: string;
  icon: string;
  sourceCount?: number;
}

export interface Task {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  done: boolean;
}

export interface Email {
  id: string;
  title: string;
  sender: string;
  time: string;
  preview: string;
}

export interface Signal {
  id: string;
  title: string;
  description: string;
  signal?: string;
  icon: string;
}

export interface Stock {
  name: string;
  change: string;
  positive: boolean;
}

export interface Portfolio {
  total: string;
  change: string;
  stocks: Stock[];
}

export interface Book {
  title: string;
  readTime: string;
  image: string;
}

export interface CareerTip {
  title: string;
  readTime: string;
  tag: string;
}

export interface SocialPost {
  text: string;
  author: string;
  time: string;
}

export interface SocialPulse {
  twitter: SocialPost;
  linkedin: SocialPost;
}

export interface Recommendation {
  id: string;
  title: string;
  subtitle: string;
  interest: string;
}

export interface DigestResponse {
  weather: Weather | null;
  tasks: Task[];
  emails: Email[];
  signals: Signal[];
  portfolio: Portfolio | null;
  book: Book | null;
  careerTip: CareerTip | null;
  socialPulse: SocialPulse | null;
  recommendations: Recommendation[];
  generatedAt: string;
}
