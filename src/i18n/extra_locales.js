// Per-locale partial dictionaries for the admin UI shell (sidebar + header).
// Only keys translated here render in the selected language; every other key
// falls back to English via tr(). Never claim a fuller translation than exists.
import { extra1 } from './extra_1.js'
import { extra2 } from './extra_2.js'
import { extra3 } from './extra_3.js'
export const localeDicts = { ...extra1, ...extra2, ...extra3 }
