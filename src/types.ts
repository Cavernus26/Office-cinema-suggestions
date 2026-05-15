export interface UserProfile {
  name: string;
  passcode?: string;
  avatar: string;
  watchedCount: number;
  recsCount: number;
  avgRating: number;
  avgRecommendationRating?: number;
  totalRecommendationRatingSum?: number;
  totalRecommendationRatingCount?: number;
  currentlyWatching?: {
    title: string;
    id: string;
  };
  createdAt: any;
}

export interface Recommendation {
  id: string;
  tmdbId: number;
  title: string;
  type: 'movie' | 'tv';
  posterPath: string;
  backdropPath?: string;
  year: string;
  runtime?: number;
  seasons?: number;
  episodesCount?: number;
  voteAverage?: number;
  averageRating?: number;
  ratingCount?: number;
  comment: string;
  authorId: string;
  authorName: string;
  createdAt: any;
  reactionsCount?: number;
}

export type WatchStatus = 'Watching' | 'Completed' | 'Plan to Watch';

export interface UserAction {
  id: string;
  userId: string;
  userName: string;
  recommendationId: string;
  status?: WatchStatus;
  rating?: number;
  comment?: string;
  createdAt: any;
}

export interface Reaction {
  id: string;
  recommendationId: string;
  userId: string;
  emoji: string;
  createdAt: any;
}
