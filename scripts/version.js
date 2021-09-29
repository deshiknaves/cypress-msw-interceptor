#!/usr/bin/env node

const fs = require('fs')
const { execSync } = require('child_process')
const chalk = require('chalk')

const FILENAME = 'changes.json'

function run(command, log = true) {
  const output = execSync(command)

  if (log && output) {
    console.log(output.toString())
  }

  return output
}

try {
  run(`yarn changeset status --output=${FILENAME}`)
  const version = JSON.parse(fs.readFileSync(FILENAME))
  const tag = `v${version.releases[0].newVersion}`
  // Version the application with the changes
  run('yarn changeset version')
  run('git add CHANGELOG.md')
  run('git add package.json')
  run('git add .changeset')
  run(`git commit -m "[skip ci] ${tag}"`)
  run(`git tag ${tag}`)
} catch (err) {
  console.log(chalk.red('No changeset present'))
  console.log(chalk.red(err))
  process.exit(1)
}
