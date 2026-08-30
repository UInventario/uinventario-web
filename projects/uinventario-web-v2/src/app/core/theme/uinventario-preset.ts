import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';

export const UINVENTARIO_PRESET = definePreset(Aura, {
  semantic: {
    transitionDuration: '140ms',
    focusRing: {
      width: '3px',
      style: 'solid',
      color: '{primary.500}',
      offset: '2px',
      shadow: 'none',
    },
    primary: {
      50: '{blue.50}',
      100: '{blue.100}',
      200: '{blue.200}',
      300: '{blue.300}',
      400: '{blue.400}',
      500: '{blue.500}',
      600: '{blue.600}',
      700: '{blue.700}',
      800: '{blue.800}',
      900: '{blue.900}',
      950: '{blue.950}',
    },
    formField: {
      borderRadius: '{border.radius.md}',
      paddingX: '0.75rem',
      paddingY: '0.625rem',
      focusRing: {
        width: '3px',
        style: 'solid',
        color: '{primary.500}',
        offset: '1px',
        shadow: 'none',
      },
    },
  },
});
