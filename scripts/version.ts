import { $ } from 'zx'
import chalk from 'chalk'
import fs from 'fs'

const FILENAME = 'changes.json'

void (async function () {
  try {
    await $`yarn changeset status --output=${FILENAME}`
    const version = JSON.parse(fs.readFileSync(FILENAME).toString())
    const tag = `v${version.releases[0].newVersion}`
    await $`yarn changeset version`
    await $`git add CHANGELOG.md`
    await $`git add package.json`
    await $`git add .changeset`
    await $`git commit -m "[skip ci] ${tag}"`
    await $`git tag ${tag}`
  } catch (err) {
    console.log(chalk.red('No changeset present'))
    console.log(chalk.red(err))
    process.exit(1)
  }
})()
