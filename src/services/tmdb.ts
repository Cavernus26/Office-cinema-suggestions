const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

export interface TMDBResult {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  media_type: 'movie' | 'tv';
  runtime?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  vote_average?: number;
}

interface SearchParams {
  query: string;
  api_key: string;
}

export const tmdbService = {
  search: async (query: string): Promise<TMDBResult[]> => {
    try {
      const response = await fetch(`/api/tmdb/search?query=${encodeURIComponent(query)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Search failed with status ${response.status}`);
      }
      const data = await response.json();
      
      // Filter results to only include movies or tv shows. 
      // If media_type is missing, we check for distinguishing fields like title or name.
      return (data.results || []).filter((item: any) => {
        if (item.media_type) return item.media_type === 'movie' || item.media_type === 'tv';
        if (item.title && item.release_date) {
           item.media_type = 'movie';
           return true;
        }
        if (item.name && item.first_air_date) {
           item.media_type = 'tv';
           return true;
        }
        return false;
      });
    } catch (error) {
      console.error('TMDB Search Error:', error);
      throw error;
    }
  },

  getDetails: async (id: number, type: 'movie' | 'tv'): Promise<TMDBResult> => {
    try {
      const response = await fetch(`/api/tmdb/details/${type}/${id}`);
      const data = await response.json();
      return { ...data, media_type: type };
    } catch (error) {
      console.error('TMDB Details Error:', error);
      throw error;
    }
  },

  getPosterUrl: (path: string | null, size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500') => {
    if (!path) return 'https://via.placeholder.com/500x750?text=No+Poster';
    return `${IMAGE_BASE_URL}/${size}${path}`;
  },

  getBackdropUrl: (path: string | null, size: 'w300' | 'w780' | 'w1280' | 'original' = 'w1280') => {
    if (!path) return '';
    return `${IMAGE_BASE_URL}/${size}${path}`;
  }
};
