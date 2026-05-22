/**
 * AltaiLabs theme — minimal override over the upstream HyperDX
 * mantineTheme. We deliberately keep typography, spacing, component
 * shapes intact; only the green palette swaps for AltaiLabs forest
 * green so that every accent (active links, primary buttons, focus
 * rings) picks up the brand colour automatically via Mantine's
 * `primaryColor: 'green'` slot.
 *
 * The palette interpolates between:
 *   G.cream   #F1F0E5  (lightest, content-on-dark surface)
 *   G.pale    #D6E5DD  (hover backgrounds)
 *   G.soft    #7AAA94  (mid)
 *   G.primary #0F3D2E  (the brand spot — primaryShade lands here)
 *   G.deep    #072218  (darkest, headings on light)
 *
 * Tokens come from the same `T`/`G` system documented at
 * `/brand` on altailabs.io (Brand v2 spec).
 */
import { theme as hyperdxTheme } from '../hyperdx/mantineTheme';

const forestGreen: [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
] = [
  '#F1F0E5', // 0 — cream
  '#E1ECE3', // 1
  '#D6E5DD', // 2 — pale
  '#B6CDC0', // 3
  '#7AAA94', // 4 — soft
  '#3A7762', // 5
  '#1F5C46', // 6 — mid
  '#163E2C', // 7
  '#0F3D2E', // 8 — primary (brand spot)
  '#072218', // 9 — deep
];

export const theme = {
  ...hyperdxTheme,
  colors: {
    ...(hyperdxTheme.colors ?? {}),
    green: forestGreen,
  },
};
