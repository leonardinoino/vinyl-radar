export type Release = {
  id: number;
  artist: string;
  title: string;
  genre: string;
  type: "Collector Pick" | "Mainstream Breakout";
  price: number;
  firstPress: boolean;
  limited: boolean;
  numbered: boolean;
  signed: boolean;
  score: number;
  note: string;
};

export type UserPreferences = {
  name: string;
  favoriteGenres: string[];
  maxBudget: number;
  collectorLevel: "low" | "medium" | "high";
  likesFirstPress: boolean;
  likesLimited: boolean;
  likesSigned: boolean;
  likesNumbered: boolean;
  nichePreference: number;
  mainstreamPreference: number;
};

export const releases: Release[] = [
  {
    id: 1,
    artist: "Fontaines D.C.",
    title: "Romance",
    genre: "post-punk",
    type: "Mainstream Breakout",
    price: 32,
    firstPress: true,
    limited: true,
    numbered: false,
    signed: false,
    score: 78,
    note: "Retail exclusive + hype forte",
  },
  {
    id: 2,
    artist: "Unknown Label",
    title: "First Press EP",
    genre: "ambient",
    type: "Collector Pick",
    price: 28,
    firstPress: true,
    limited: true,
    numbered: true,
    signed: false,
    score: 86,
    note: "300 copie, hand-numbered",
  },
  {
    id: 3,
    artist: "Ambient Archive",
    title: "Live Session Vol. 1",
    genre: "ambient",
    type: "Collector Pick",
    price: 24,
    firstPress: true,
    limited: true,
    numbered: false,
    signed: false,
    score: 82,
    note: "Prima stampa, micro-label",
  },
  {
    id: 4,
    artist: "Arctic Monkeys",
    title: "Tour Edition",
    genre: "indie rock",
    type: "Mainstream Breakout",
    price: 45,
    firstPress: false,
    limited: true,
    numbered: false,
    signed: true,
    score: 74,
    note: "Tour-only variant, hype alta",
  },
  {
    id: 5,
    artist: "Burial Echo",
    title: "Night Transit",
    genre: "electronic",
    type: "Collector Pick",
    price: 36,
    firstPress: true,
    limited: true,
    numbered: true,
    signed: false,
    score: 84,
    note: "White label style, low pressing",
  },
  {
    id: 6,
    artist: "Blue Note Memory",
    title: "Midnight Tape",
    genre: "jazz",
    type: "Collector Pick",
    price: 52,
    firstPress: false,
    limited: true,
    numbered: false,
    signed: true,
    score: 71,
    note: "Anniversary signed edition",
  },
];

export const mockUser: UserPreferences = {
  name: "Mock User 1",
  favoriteGenres: ["post-punk", "ambient", "indie rock"],
  maxBudget: 20,
  collectorLevel: "high",
  likesFirstPress: true,
  likesLimited: true,
  likesSigned: false,
  likesNumbered: true,
  nichePreference: 8,
  mainstreamPreference: 4,
};

export const mockUser2: UserPreferences = {
  name: "Mock User 2",
  favoriteGenres: ["hip-hop", "jazz", "mainstream pop"],
  maxBudget: 100,
  collectorLevel: "medium",
  likesFirstPress: false,
  likesLimited: true,
  likesSigned: true,
  likesNumbered: false,
  nichePreference: 3,
  mainstreamPreference: 9,
};

export const mockUser3: UserPreferences = {
  name: "Mock User 3",
  favoriteGenres: ["ambient", "electronic", "jazz"],
  maxBudget: 60,
  collectorLevel: "high",
  likesFirstPress: true,
  likesLimited: true,
  likesSigned: false,
  likesNumbered: true,
  nichePreference: 10,
  mainstreamPreference: 2,
};

export const mockUser4: UserPreferences = {
  name: "Mock User 4",
  favoriteGenres: ["indie rock", "mainstream pop", "post-punk"],
  maxBudget: 35,
  collectorLevel: "low",
  likesFirstPress: false,
  likesLimited: false,
  likesSigned: true,
  likesNumbered: false,
  nichePreference: 2,
  mainstreamPreference: 10,
};

export const mockUsers = {
  user1: mockUser,
  user2: mockUser2,
  user3: mockUser3,
  user4: mockUser4,
} as const;

export type MockUserKey = keyof typeof mockUsers;