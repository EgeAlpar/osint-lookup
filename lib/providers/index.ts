import type { Provider } from '../types'
import { accountExistence } from './account-existence'
import { emailCheck } from './email-check'
import { emailProfiles } from './email-profiles'
import { githubEmail } from './github-email'
import { gravatar } from './gravatar'
import { hibp } from './hibp'
import { profileExistence } from './profile-existence'

/** Every provider the app can run. Order is cosmetic; results stream as ready. */
export const allProviders: readonly Provider[] = [
  profileExistence,
  emailProfiles,
  gravatar,
  hibp,
  githubEmail,
  emailCheck,
  accountExistence,
]
