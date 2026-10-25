// Build-time switches. Kept out of src/license so they stay readable and are replaced by Vite as plain constants.

/** Development servers skip the activation screen (production builds never do). */
export const LICENSE_OFF: boolean = import.meta.env.VITE_LICENSE === 'off';

/** The signed APK build sets this so a fresh install opens with sample data (first launch only). */
export const SEED_SAMPLE: boolean = import.meta.env.VITE_SEED_SAMPLE === '1';
