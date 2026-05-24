import { ThemeConfig } from '../../types';

import Logomark from './Logomark';
import { theme } from './mantineTheme';
import Wordmark from './Wordmark';

export const altailabsTheme: ThemeConfig = {
  name: 'altailabs',
  displayName: 'Mooldir',
  mantineTheme: theme,
  Wordmark,
  Logomark,
  cssClass: 'theme-altailabs',
  favicon: {
    svg: '/favicons/altailabs/favicon.svg',
    png32: '/favicons/altailabs/favicon-32x32.png',
    png16: '/favicons/altailabs/favicon-16x16.png',
    appleTouchIcon: '/favicons/altailabs/apple-touch-icon.png',
    themeColor: '#0F3D2E',
  },
};
