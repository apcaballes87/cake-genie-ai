import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { genieBusinessProfile } from '../src/lib/seo/genieBusinessProfile'

const replaceBlock = (source: string, name: string, body: string) => {
  const start = `<!-- BEGIN ${name} -->`
  const end = `<!-- END ${name} -->`
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`)
  if (!pattern.test(source)) throw new Error(`Missing ${name} block in public/llms.txt`)
  return source.replace(pattern, `${start}\n${body}\n${end}`)
}

const main = async () => {
  const llmsPath = resolve('public/llms.txt')
  const original = await readFile(llmsPath, 'utf8')
  const businessFacts = [
    `- **Location**: ${genieBusinessProfile.addressLine}.`,
    `- **Operating Hours**: ${genieBusinessProfile.hoursDisplay}.`,
  ].join('\n')
  const contactFacts = [
    `- **Support**: ${genieBusinessProfile.supportEmail}`,
    `- **Phone**: ${genieBusinessProfile.phoneDisplay}`,
    `- **Google Maps**: [Unit 3, Treehouse Building](${genieBusinessProfile.mapUrl})`,
  ].join('\n')
  const withBusiness = replaceBlock(original, 'CANONICAL BUSINESS FACTS', businessFacts)
  const generated = replaceBlock(withBusiness, 'CANONICAL CONTACT FACTS', contactFacts)
  if (generated !== original) await writeFile(llmsPath, generated, 'utf8')
}

void main()
