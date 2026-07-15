export interface ThemeTemplate {
  name: string;
  bg: string;
  surface: string;
  border: string;
  muted: string;
  primary: string;
  accent: string; // RGB format for withOpacity
  accentHover: string; // RGB format
}

export const THEME_TEMPLATES: ThemeTemplate[] = [
  {
    name: 'Default Blue',
    bg: '#0F1117',
    surface: '#161B22',
    border: '#21262D',
    muted: '#6E7681',
    primary: '#E6EDF3',
    accent: '139, 76, 241',
    accentHover: '121, 59, 232',
  },
  {
    name: 'Midnight Purple',
    bg: '#090514',
    surface: '#130C25',
    border: '#251945',
    muted: '#8A7B9E',
    primary: '#E8E5ED',
    accent: '172, 88, 255',
    accentHover: '150, 60, 240',
  },
  {
    name: 'Hacker Green',
    bg: '#050D06',
    surface: '#0A1A0C',
    border: '#143318',
    muted: '#6E9973',
    primary: '#E3F2E5',
    accent: '57, 255, 100',
    accentHover: '40, 220, 80',
  },
  {
    name: 'Sakura Pink',
    bg: '#1C1217',
    surface: '#291A22',
    border: '#452A39',
    muted: '#A68B99',
    primary: '#F5E6ED',
    accent: '255, 115, 175',
    accentHover: '235, 90, 150',
  },
  {
    name: 'Ocean Cyan',
    bg: '#06131A',
    surface: '#0B212E',
    border: '#153C54',
    muted: '#759EB8',
    primary: '#E5F3FA',
    accent: '0, 195, 255',
    accentHover: '0, 170, 225',
  },
  {
    name: 'Sunset Orange',
    bg: '#170E0A',
    surface: '#241610',
    border: '#40261D',
    muted: '#A37E6F',
    primary: '#F7EBE5',
    accent: '255, 115, 38',
    accentHover: '230, 95, 25',
  },
  {
    name: 'Crimson Red',
    bg: '#140607',
    surface: '#240C0E',
    border: '#401519',
    muted: '#9E6A6F',
    primary: '#F5E4E6',
    accent: '235, 45, 60',
    accentHover: '210, 30, 45',
  },
  {
    name: 'Solar Yellow',
    bg: '#1A1806',
    surface: '#2B280A',
    border: '#4D4712',
    muted: '#A39C6B',
    primary: '#F7F6E6',
    accent: '255, 215, 0',
    accentHover: '230, 190, 0',
  },
  {
    name: 'Slate Gray',
    bg: '#111315',
    surface: '#1A1D21',
    border: '#2C3138',
    muted: '#7D8590',
    primary: '#E5E7EB',
    accent: '150, 160, 175',
    accentHover: '130, 140, 155',
  },
  {
    name: 'Deep Mocha',
    bg: '#14100D',
    surface: '#211B17',
    border: '#382E28',
    muted: '#948378',
    primary: '#EDEAE6',
    accent: '196, 146, 112',
    accentHover: '176, 126, 92',
  },
];
