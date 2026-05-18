export const AVATAR_OPTIONS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Buddy',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Cali',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Coco',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Buster',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=Mario',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=Peach',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Alice',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Luna',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Bob',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Maya',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Sparkle',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Cool',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Bear',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Lucky',
  'https://api.dicebear.com/7.x/big-ears/svg?seed=Cookie',
  'https://api.dicebear.com/7.x/big-smile/svg?seed=Happy',
];

export const getRandomAvatar = (seed: string) => {
  const index = Math.abs(seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % AVATAR_OPTIONS.length;
  return AVATAR_OPTIONS[index];
};
