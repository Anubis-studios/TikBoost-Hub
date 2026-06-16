export interface Task {
  id: string;
  type: 'follow' | 'like' | 'watch_ad' | 'daily_checkin' | 'referral';
  title: string;
  description: string;
  stars: number;
  icon: string;
  tiktokUrl?: string;
  completed: boolean;
  cooldownHours?: number;
}

export interface BoostPackage {
  id: string;
  type: 'video' | 'profile';
  label: string;
  description: string;
  stars: number;
  reach: string;
  duration: string;
  popular?: boolean;
}

export interface CaptionTemplate {
  niche: string;
  captions: string[];
  hashtags: string[];
}

export const TASKS: Task[] = [
  {
    id: 'daily_checkin',
    type: 'daily_checkin',
    title: 'Daily Check-In',
    description: 'Open the app every day to collect bonus stars',
    stars: 50,
    icon: 'calendar-today',
    completed: false,
    cooldownHours: 24,
  },
  {
    id: 'follow_shadow',
    type: 'follow',
    title: 'Follow @shadow0fanubis2 on TikTok',
    description: 'Follow our official TikTok account @shadow0fanubis2 and earn stars',
    stars: 150,
    icon: 'person-add',
    tiktokUrl: 'https://www.tiktok.com/@shadow0fanubis2',
    completed: false,
  },
  {
    id: 'like_1',
    type: 'like',
    title: 'Like a Viral Video',
    description: 'Like this trending video on TikTok to earn stars',
    stars: 40,
    icon: 'favorite',
    tiktokUrl: 'https://www.tiktok.com/foryou',
    completed: false,
  },
  {
    id: 'like_2',
    type: 'like',
    title: 'Like 5 Videos',
    description: 'Like 5 TikTok videos in the For You feed',
    stars: 80,
    icon: 'favorite',
    tiktokUrl: 'https://www.tiktok.com/foryou',
    completed: false,
  },
  {
    id: 'watch_ad_1',
    type: 'watch_ad',
    title: 'Watch a Short Ad',
    description: 'Watch a 30-second ad to earn stars instantly',
    stars: 25,
    icon: 'play-circle',
    completed: false,
    cooldownHours: 1,
  },
  {
    id: 'watch_ad_2',
    type: 'watch_ad',
    title: 'Watch 3 Ads',
    description: 'Watch 3 ads for a bonus star reward',
    stars: 90,
    icon: 'play-circle',
    completed: false,
    cooldownHours: 6,
  },
];

export const BOOST_PACKAGES: BoostPackage[] = [
  // ── VIDEO BOOSTS ───────────────────────────────────────────────
  {
    id: 'video_starter',
    type: 'video',
    label: 'Video Starter Boost',
    description: 'Get 50–100 real views on your latest video',
    stars: 500,
    reach: '50–100 views',
    duration: '24 hours',
  },
  {
    id: 'video_growth',
    type: 'video',
    label: 'Video Growth Boost',
    description: 'Get 200–500 real views on your latest video',
    stars: 1200,
    reach: '200–500 views',
    duration: '48 hours',
    popular: true,
  },
  {
    id: 'video_pro',
    type: 'video',
    label: 'Video Pro Boost',
    description: 'Get 1K–2K views with priority feed placement',
    stars: 2500,
    reach: '1K–2K views',
    duration: '72 hours',
  },
  {
    id: 'video_viral',
    type: 'video',
    label: 'Video Viral Boost',
    description: 'Massive 5K+ view push — for viral-ready content',
    stars: 6000,
    reach: '5K+ views',
    duration: '7 days',
  },
  // ── PROFILE BOOSTS ─────────────────────────────────────────────
  {
    id: 'profile_starter',
    type: 'profile',
    label: 'Profile Starter Boost',
    description: 'Get 20–50 real profile visits & followers',
    stars: 400,
    reach: '20–50 followers',
    duration: '24 hours',
  },
  {
    id: 'profile_growth',
    type: 'profile',
    label: 'Profile Growth Boost',
    description: 'Get 100–200 real followers and profile visits',
    stars: 1000,
    reach: '100–200 followers',
    duration: '48 hours',
    popular: true,
  },
  {
    id: 'profile_pro',
    type: 'profile',
    label: 'Profile Pro Boost',
    description: 'Get 500–1K followers with featured placement',
    stars: 2200,
    reach: '500–1K followers',
    duration: '72 hours',
  },
  {
    id: 'profile_viral',
    type: 'profile',
    label: 'Profile Viral Boost',
    description: '2K+ followers — explosive account growth',
    stars: 5000,
    reach: '2K+ followers',
    duration: '7 days',
  },
];

export const CAPTION_TEMPLATES: CaptionTemplate[] = [
  {
    niche: 'Dance',
    captions: [
      'Drop everything and dance! Life is too short for boring moves',
      'When the beat hits different, your body just knows what to do',
      'Dancing my way through Monday like nobody watching',
      'This song lives in my head rent-free and I have no complaints',
    ],
    hashtags: ['#dance', '#fyp', '#viral', '#trending', '#dancechallenge', '#foryoupage', '#tiktokdance', '#dancer'],
  },
  {
    niche: 'Fashion',
    captions: [
      'GRWM for a day that hits different',
      'Outfit check: main character energy activated',
      'Fashion is art and I am the canvas',
      'This look went from idea to icon in under an hour',
    ],
    hashtags: ['#fashion', '#ootd', '#style', '#fyp', '#outfit', '#viral', '#fashiontiktok', '#trending', '#grwm'],
  },
  {
    niche: 'Food',
    captions: [
      'This recipe will change your life and I am not exaggerating',
      'POV: you made something that actually tastes better than it looks',
      'Eating my way through the week, one banger recipe at a time',
      'The food version of a glow up and it only takes 15 minutes',
    ],
    hashtags: ['#food', '#foodtiktok', '#recipe', '#fyp', '#cooking', '#viral', '#easyrecipe', '#foodie', '#yummy'],
  },
  {
    niche: 'Fitness',
    captions: [
      'Your future self will thank you for showing up today',
      'No motivation? Do it anyway. That is literally the secret.',
      'Warning: this workout will make you feel unstoppable',
      'Started from the beginning, still going. Progress over perfection.',
    ],
    hashtags: ['#fitness', '#gym', '#workout', '#fyp', '#fit', '#viral', '#gymtok', '#motivation', '#health'],
  },
  {
    niche: 'Comedy',
    captions: [
      'Nobody asked but here we are anyway',
      'This is exactly as chaotic as it looks and I regret nothing',
      'The character development was not planned but here we are',
      'Real life documentary about absolutely nothing and everything',
    ],
    hashtags: ['#funny', '#comedy', '#fyp', '#lol', '#viral', '#relatable', '#humor', '#trending', '#foryou'],
  },
  {
    niche: 'Lifestyle',
    captions: [
      'Building the life I used to dream about, one day at a time',
      'Main character season is officially open and I am fully committed',
      'Soft life era has begun and I am never going back',
      'This is what choosing yourself actually looks like in practice',
    ],
    hashtags: ['#lifestyle', '#fyp', '#viral', '#dayinmylife', '#vlog', '#trending', '#aesthetic', '#selfcare'],
  },
];

export const LEVELS = [
  { level: 1, name: 'Newcomer', minStars: 0, color: '#A0A0A0' },
  { level: 2, name: 'Creator', minStars: 500, color: '#00D97E' },
  { level: 3, name: 'Influencer', minStars: 2000, color: '#0A84FF' },
  { level: 4, name: 'Viral Star', minStars: 5000, color: '#8B5CF6' },
  { level: 5, name: 'TikTok Legend', minStars: 12000, color: '#FFD700' },
];

export const getUserLevel = (totalStarsEarned: number) => {
  let currentLevel = LEVELS[0];
  for (const level of LEVELS) {
    if (totalStarsEarned >= level.minStars) {
      currentLevel = level;
    }
  }
  const nextLevel = LEVELS.find(l => l.level === currentLevel.level + 1);
  return { currentLevel, nextLevel };
};
